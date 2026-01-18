import api, { route } from '@forge/api';

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
    
    // 6. Generate snapshot ID
    const snapshotId = generateSnapshotId(issues);
    
    const elapsed = Date.now() - startTime;
    console.log(`fetchAndAggregate completed in ${elapsed}ms`);
    
    return {
      success: true,
      snapshotId,
      throughput,
      remaining,
      teamSummary,
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
  
  return {
    issueCount,
    totalPoints,
    unestimatedCount
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
