import api, { route } from '@forge/api';
import computeConfidence from './computeConfidence.js';

/**
 * Fetch Jira issues and compute baseline aggregations using pure JavaScript
 * 
 * @param {Object} req - Forge request object
 * @param {string} req.payload.scopeType - 'project' | 'epic' | 'jql'
 * @param {Object} req.payload.scopeParams - { projectKey, epicKey, jql }
 * @returns {Object} { snapshotId, throughput, remaining, issues }
 */
export async function handler(req) {
  const startTime = Date.now();
  console.log('=== FETCH AND AGGREGATE STARTED ===');
  console.log('Payload:', JSON.stringify(req.payload, null, 2));
  
  try {
    const { scopeType, scopeParams } = req.payload;
    
    // 1. Build JQL query from scope
    const jql = buildJQL(scopeType, scopeParams);
    console.log('JQL query:', jql);
    
    // 2. Fetch issues from Jira API (with pagination)
    const issues = await fetchAllIssues(jql);
    console.log(`Fetched ${issues.length} issues`);
    
    // 3. Compute historical throughput using JavaScript
    const throughput = computeThroughput(issues);
    console.log(`Computed throughput: ${throughput.weeklyData.length} weeks`);
    
    // 4. Compute remaining work
    const remaining = computeRemaining(issues);
    console.log('Remaining work:', remaining);
    
    // 5. Get team summary
    const teamSummary = computeTeamSummary(issues);
    
    // 6. Compute estimation accuracy from completed issues
    const estimationAccuracy = computeEstimationAccuracy(issues);
    console.log('Estimation accuracy computed:', estimationAccuracy.sampleSize, 'issues analyzed');
    
    // 7. Compute forecast confidence
    const confidence = computeConfidence(throughput.weeklyData, estimationAccuracy);
    console.log('Confidence analysis completed');
    
    // 8. Generate snapshot ID
    const snapshotId = generateSnapshotId(issues);
    
    const elapsed = Date.now() - startTime;
    console.log(`fetchAndAggregate completed in ${elapsed}ms`);
    
    return {
      success: true,
      snapshotId,
      throughput,
      remaining,
      teamSummary,
      estimationAccuracy,
      confidence,
      issueCount: issues.length,
      executionTime: elapsed
    };
    
  } catch (error) {
    console.error('fetchAndAggregate error:', error);
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
}

/**
 * Compute historical throughput from issues (pure JavaScript)
 */
function computeThroughput(issues) {
  const now = new Date();
  const weeksAgo = 12; // Look back 12 weeks
  const cutoffDate = new Date(now.getTime() - (weeksAgo * 7 * 24 * 60 * 60 * 1000));
  
  // Filter resolved issues within the time window
  const resolvedIssues = issues.filter(issue => {
    if (issue.statusCategory !== 'Done' || !issue.resolved) return false;
    const resolvedDate = new Date(issue.resolved);
    return resolvedDate >= cutoffDate;
  });
  
  // Group by week
  const weeklyMap = new Map();
  
  for (const issue of resolvedIssues) {
    const resolvedDate = new Date(issue.resolved);
    const weekStart = getWeekStart(resolvedDate);
    const weekKey = weekStart.toISOString().split('T')[0];
    
    if (!weeklyMap.has(weekKey)) {
      weeklyMap.set(weekKey, { weekStart: weekKey, issuesCompleted: 0, pointsCompleted: 0 });
    }
    
    const week = weeklyMap.get(weekKey);
    week.issuesCompleted += 1;
    week.pointsCompleted += issue.storyPoints || 0;
  }
  
  // Convert to array and sort
  const weeklyData = Array.from(weeklyMap.values()).sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  
  // Compute averages
  const issuesPerWeek = weeklyData.map(w => w.issuesCompleted);
  const pointsPerWeek = weeklyData.map(w => w.pointsCompleted);
  
  return {
    weeklyData,
    issuesPerWeek,
    pointsPerWeek,
    avgIssuesPerWeek: issuesPerWeek.length > 0 ? issuesPerWeek.reduce((a, b) => a + b, 0) / issuesPerWeek.length : 0,
    avgPointsPerWeek: pointsPerWeek.length > 0 ? pointsPerWeek.reduce((a, b) => a + b, 0) / pointsPerWeek.length : 0,
    weeksAnalyzed: weeklyData.length
  };
}

/**
 * Compute remaining work from issues
 */
function computeRemaining(issues) {
  const remainingIssues = issues.filter(issue => 
    issue.statusCategory === 'To Do' || issue.statusCategory === 'In Progress'
  );
  
  const issueCount = remainingIssues.length;
  const totalPoints = remainingIssues.reduce((sum, issue) => sum + (issue.storyPoints || 0), 0);
  const unestimatedCount = remainingIssues.filter(issue => !issue.storyPoints).length;
  
  // Sort remaining issues: In Progress first, then by points (desc), then by created date
  const sortedIssues = remainingIssues
    .map(issue => ({
      key: issue.key,
      summary: issue.summary,
      issueType: issue.issueType,
      status: issue.status,
      statusCategory: issue.statusCategory,
      storyPoints: issue.storyPoints,
      assignee: issue.assignee,
      created: issue.created,
      epicKey: issue.epicKey,
      parentKey: issue.parentKey
    }))
    .sort((a, b) => {
      // In Progress before To Do
      if (a.statusCategory === 'In Progress' && b.statusCategory !== 'In Progress') return -1;
      if (b.statusCategory === 'In Progress' && a.statusCategory !== 'In Progress') return 1;
      // Then by story points (descending, nulls last)
      const aPoints = a.storyPoints || 0;
      const bPoints = b.storyPoints || 0;
      if (aPoints !== bPoints) return bPoints - aPoints;
      // Then by created date (oldest first)
      return new Date(a.created) - new Date(b.created);
    });
  
  return {
    issueCount,
    totalPoints,
    unestimatedCount,
    issues: sortedIssues // Include actual issue details
  };
}

/**
 * Compute team summary
 */
function computeTeamSummary(issues) {
  const remainingIssues = issues.filter(issue => 
    issue.statusCategory === 'To Do' || issue.statusCategory === 'In Progress'
  );
  
  const teamMap = new Map();
  
  for (const issue of remainingIssues) {
    const team = issue.team || 'unassigned';
    
    if (!teamMap.has(team)) {
      teamMap.set(team, { team, issueCount: 0, totalPoints: 0 });
    }
    
    const summary = teamMap.get(team);
    summary.issueCount += 1;
    summary.totalPoints += issue.storyPoints || 0;
  }
  
  return Array.from(teamMap.values()).sort((a, b) => b.totalPoints - a.totalPoints);
}

/**
 * Get the start of the week (Monday) for a date
 */
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  return new Date(d.setDate(diff));
}

/**
 * Build JQL query from scope parameters
 */
function buildJQL(scopeType, scopeParams) {
  switch (scopeType) {
    case 'project':
      return `project = "${scopeParams.projectKey}" ORDER BY created DESC`;
      
    case 'epic':
      return `"Epic Link" = "${scopeParams.epicKey}" ORDER BY created DESC`;
      
    case 'jql':
      return scopeParams.jql;
      
    default:
      throw new Error(`Unknown scope type: ${scopeType}`);
  }
}

/**
 * Fetch all issues from Jira API with pagination using the new /search/jql endpoint
 */
async function fetchAllIssues(jql) {
  const allIssues = [];
  let nextPageToken = null;
  const maxResults = 100;
  const fields = ['summary', 'issuetype', 'status', 'project', 'parent', 'customfield_10014', 'customfield_10016', 'timeoriginalestimate', 'created', 'updated', 'resolutiondate', 'assignee'];
  
  do {
    console.log(`Fetching issues with JQL: ${jql}, nextPageToken: ${nextPageToken || 'null'}`);
    
    // Build request body for POST /rest/api/3/search/jql
    const requestBody = {
      jql: jql,
      fields: fields,
      maxResults: maxResults
    };
    
    if (nextPageToken) {
      requestBody.nextPageToken = nextPageToken;
    }
    
    // Use POST to /rest/api/3/search/jql
    const response = await api.asUser().requestJira(
      route`/rest/api/3/search/jql`,
      {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      }
    );
    
    console.log(`Jira API response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Jira API error response: ${errorText}`);
      throw new Error(`Jira API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Transform Jira issues to our schema
    const issues = (data.issues || []).map(transformIssue);
    allIssues.push(...issues);
    
    // Get next page token for pagination
    nextPageToken = data.nextPageToken || null;
    
    console.log(`Fetched ${allIssues.length} issues so far, nextPageToken: ${nextPageToken || 'none'}`);
    
  } while (nextPageToken && allIssues.length < 5000); // Safety limit
  
  return allIssues;
}

/**
 * Transform Jira API issue to our schema
 */
function transformIssue(jiraIssue) {
  const fields = jiraIssue.fields;
  
  return {
    key: jiraIssue.key,
    summary: fields.summary || '',
    issueType: fields.issuetype?.name || 'Unknown',
    status: fields.status?.name || 'Unknown',
    statusCategory: fields.status?.statusCategory?.name || 'To Do',
    
    projectKey: fields.project?.key || null,
    epicKey: fields.customfield_10014 || null, // Epic Link
    parentKey: fields.parent?.key || null,
    
    storyPoints: fields.customfield_10016 || null, // Story Points
    originalEstimateSeconds: fields.timeoriginalestimate || null,
    
    created: fields.created || null,
    updated: fields.updated || null,
    resolved: fields.resolutiondate || null,
    
    assignee: fields.assignee?.displayName || null,
    team: deriveTeam(fields) // Derive from assignee or custom field
  };
}

/**
 * Derive team from issue fields
 * TODO: Make this configurable per installation
 */
function deriveTeam(fields) {
  // Option 1: Use custom team field if exists
  if (fields.customfield_team) {
    return fields.customfield_team.value;
  }
  
  // Option 2: Derive from assignee (simple heuristic)
  const assignee = fields.assignee?.displayName;
  if (!assignee) return 'unassigned';
  
  // Simple team assignment based on assignee name
  // In production, this should be configurable
  if (assignee.includes('Frontend') || assignee.includes('FE')) return 'frontend';
  if (assignee.includes('Backend') || assignee.includes('BE')) return 'backend';
  if (assignee.includes('Data')) return 'data';
  
  return 'default';
}

/**
 * Compute estimation accuracy by comparing story points to actual cycle time
 * This helps identify systematic under/overestimation patterns
 */
function computeEstimationAccuracy(issues) {
  const now = new Date();
  const weeksAgo = 12; // Analyze last 12 weeks of completed work
  const cutoffDate = new Date(now.getTime() - (weeksAgo * 7 * 24 * 60 * 60 * 1000));
  
  // Filter completed issues with both estimates and resolution dates
  const completedWithEstimates = issues.filter(issue => {
    if (issue.statusCategory !== 'Done') return false;
    if (!issue.resolved || !issue.created) return false;
    if (!issue.storyPoints || issue.storyPoints <= 0) return false;
    const resolvedDate = new Date(issue.resolved);
    return resolvedDate >= cutoffDate;
  });
  
  if (completedWithEstimates.length < 3) {
    return {
      sampleSize: completedWithEstimates.length,
      insufficient: true,
      message: 'Need at least 3 completed issues with estimates to analyze accuracy'
    };
  }
  
  // Calculate cycle time (days from created to resolved) for each issue
  const issueMetrics = completedWithEstimates.map(issue => {
    const created = new Date(issue.created);
    const resolved = new Date(issue.resolved);
    const cycleTimeDays = (resolved - created) / (1000 * 60 * 60 * 24);
    const daysPerPoint = cycleTimeDays / issue.storyPoints;
    
    return {
      key: issue.key,
      summary: issue.summary,
      issueType: issue.issueType,
      storyPoints: issue.storyPoints,
      cycleTimeDays: Math.round(cycleTimeDays * 10) / 10,
      daysPerPoint: Math.round(daysPerPoint * 10) / 10
    };
  });
  
  // Group by story point value to find patterns
  const byPointValue = new Map();
  for (const metric of issueMetrics) {
    const points = metric.storyPoints;
    if (!byPointValue.has(points)) {
      byPointValue.set(points, []);
    }
    byPointValue.get(points).push(metric);
  }
  
  // Calculate stats for each point value
  const pointValueStats = [];
  for (const [points, metrics] of byPointValue) {
    const cycleTimes = metrics.map(m => m.cycleTimeDays);
    const avgCycleTime = cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length;
    const daysPerPointValues = metrics.map(m => m.daysPerPoint);
    const avgDaysPerPoint = daysPerPointValues.reduce((a, b) => a + b, 0) / daysPerPointValues.length;
    
    // Calculate standard deviation for variability
    const variance = cycleTimes.reduce((sum, ct) => sum + Math.pow(ct - avgCycleTime, 2), 0) / cycleTimes.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = avgCycleTime > 0 ? (stdDev / avgCycleTime) * 100 : 0;
    
    pointValueStats.push({
      storyPoints: points,
      count: metrics.length,
      avgCycleTimeDays: Math.round(avgCycleTime * 10) / 10,
      minCycleTime: Math.round(Math.min(...cycleTimes) * 10) / 10,
      maxCycleTime: Math.round(Math.max(...cycleTimes) * 10) / 10,
      avgDaysPerPoint: Math.round(avgDaysPerPoint * 10) / 10,
      variability: Math.round(coefficientOfVariation), // % variability
      issues: metrics.slice(0, 5) // Sample of issues for reference
    });
  }
  
  // Sort by story points ascending
  pointValueStats.sort((a, b) => a.storyPoints - b.storyPoints);
  
  // Calculate overall metrics
  const allDaysPerPoint = issueMetrics.map(m => m.daysPerPoint);
  const overallAvgDaysPerPoint = allDaysPerPoint.reduce((a, b) => a + b, 0) / allDaysPerPoint.length;
  
  // Detect estimation bias by comparing expected vs actual ratios
  // If 2-point stories take the same time as 5-point stories, there's a problem
  const estimationBias = detectEstimationBias(pointValueStats);
  
  // Generate recommendations
  const recommendations = generateEstimationRecommendations(pointValueStats, estimationBias, overallAvgDaysPerPoint);
  
  return {
    sampleSize: completedWithEstimates.length,
    insufficient: false,
    overallAvgDaysPerPoint: Math.round(overallAvgDaysPerPoint * 10) / 10,
    byPointValue: pointValueStats,
    estimationBias,
    recommendations,
    // Include raw metrics for the data explorer
    issueMetrics: issueMetrics.slice(0, 50) // Limit to 50 for payload size
  };
}

/**
 * Detect if story point estimates correlate with actual effort
 */
function detectEstimationBias(pointValueStats) {
  if (pointValueStats.length < 2) {
    return { type: 'insufficient_data', message: 'Need multiple point values to detect bias' };
  }
  
  // Check if higher point values actually take proportionally longer
  const sortedByPoints = [...pointValueStats].sort((a, b) => a.storyPoints - b.storyPoints);
  
  let linearityScore = 0;
  let comparisons = 0;
  
  for (let i = 0; i < sortedByPoints.length - 1; i++) {
    const lower = sortedByPoints[i];
    const higher = sortedByPoints[i + 1];
    
    // Expected ratio of cycle times based on point ratio
    const pointRatio = higher.storyPoints / lower.storyPoints;
    const actualTimeRatio = higher.avgCycleTimeDays / lower.avgCycleTimeDays;
    
    // How close is actual to expected? (1.0 = perfect correlation)
    const accuracy = actualTimeRatio / pointRatio;
    linearityScore += accuracy;
    comparisons++;
  }
  
  const avgLinearity = comparisons > 0 ? linearityScore / comparisons : 1;
  
  // Classify the bias
  if (avgLinearity < 0.5) {
    return {
      type: 'severe_overestimation',
      score: Math.round(avgLinearity * 100),
      message: 'Larger estimates take much less time than expected. Consider using smaller point values.'
    };
  } else if (avgLinearity < 0.8) {
    return {
      type: 'moderate_overestimation', 
      score: Math.round(avgLinearity * 100),
      message: 'Larger stories are being overestimated relative to smaller ones.'
    };
  } else if (avgLinearity > 1.5) {
    return {
      type: 'severe_underestimation',
      score: Math.round(avgLinearity * 100),
      message: 'Larger estimates take much more time than expected. Stories may need to be broken down more.'
    };
  } else if (avgLinearity > 1.2) {
    return {
      type: 'moderate_underestimation',
      score: Math.round(avgLinearity * 100),
      message: 'Larger stories are being underestimated relative to smaller ones.'
    };
  } else {
    return {
      type: 'well_calibrated',
      score: Math.round(avgLinearity * 100),
      message: 'Story point estimates correlate well with actual effort.'
    };
  }
}

/**
 * Generate actionable recommendations based on estimation patterns
 */
function generateEstimationRecommendations(pointValueStats, bias, avgDaysPerPoint) {
  const recommendations = [];
  
  // High variability warnings
  const highVariabilityPoints = pointValueStats.filter(p => p.variability > 50 && p.count >= 3);
  if (highVariabilityPoints.length > 0) {
    const pointValues = highVariabilityPoints.map(p => p.storyPoints).join(', ');
    recommendations.push({
      type: 'high_variability',
      priority: 'high',
      title: 'Inconsistent estimates detected',
      detail: `${pointValues}-point stories have high variability (>50% spread). Consider breaking these down or refining estimation criteria.`,
      affectedPoints: highVariabilityPoints.map(p => p.storyPoints)
    });
  }
  
  // Estimation bias recommendations
  if (bias.type === 'severe_underestimation' || bias.type === 'moderate_underestimation') {
    recommendations.push({
      type: 'underestimation',
      priority: bias.type === 'severe_underestimation' ? 'high' : 'medium',
      title: 'Systematic underestimation',
      detail: `Larger stories consistently take longer than estimates suggest. Apply a ${Math.round((bias.score - 100) / 10) * 10}% buffer to estimates above 3 points.`,
      suggestedMultiplier: Math.round(bias.score) / 100
    });
  }
  
  if (bias.type === 'severe_overestimation' || bias.type === 'moderate_overestimation') {
    recommendations.push({
      type: 'overestimation',
      priority: bias.type === 'severe_overestimation' ? 'high' : 'medium',
      title: 'Systematic overestimation',
      detail: `Larger stories complete faster than estimates suggest. Your team may be padding estimates or the work is getting done more efficiently than expected.`
    });
  }
  
  // Point value-specific recommendations
  for (const stat of pointValueStats) {
    if (stat.count >= 3 && stat.avgDaysPerPoint > avgDaysPerPoint * 1.5) {
      recommendations.push({
        type: 'slow_point_value',
        priority: 'medium',
        title: `${stat.storyPoints}-point stories take longer per point`,
        detail: `At ${stat.avgDaysPerPoint} days/point vs ${Math.round(avgDaysPerPoint * 10) / 10} average, consider if these need to be sized higher or broken down.`,
        affectedPoints: [stat.storyPoints]
      });
    }
  }
  
  // General calibration suggestion
  if (recommendations.length === 0 && bias.type === 'well_calibrated') {
    recommendations.push({
      type: 'well_calibrated',
      priority: 'info',
      title: 'Estimates are well calibrated',
      detail: `Your team averages ${Math.round(avgDaysPerPoint * 10) / 10} days per story point with good correlation between estimates and actual effort.`
    });
  }
  
  return recommendations;
}

/**
 * Generate snapshot ID from issues
 */
function generateSnapshotId(issues) {
  // Simple hash: concatenate keys and create hash
  const keys = issues.map(i => i.key).sort().join(',');
  
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < keys.length; i++) {
    const char = keys.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return `snapshot_${Math.abs(hash).toString(36)}_${issues.length}`;
}
