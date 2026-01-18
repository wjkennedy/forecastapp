import seedrandom from 'seedrandom';

/**
 * Compute scenario forecast by applying deltas to baseline using pure JavaScript
 * 
 * @param {Object} req - Forge request object
 * @param {string} req.payload.snapshotId - Snapshot identifier
 * @param {Array} req.payload.baselineData - Issues, throughput, remaining from baseline
 * @param {Array} req.payload.deltas - Array of scenario modifications
 * @returns {Object} Scenario forecast result
 */
export async function handler(req) {
  const startTime = Date.now();
  console.log('computeScenario started');
  
  try {
    const { snapshotId, baselineData, deltas } = req.payload;
    
    console.log(`Applying ${deltas.length} deltas to baseline`);
    
    // 1. Clone baseline issues for modification
    const issues = (baselineData.issues || []).map(issue => ({
      key: issue.key,
      storyPoints: issue.storyPoints || 0,
      statusCategory: issue.statusCategory,
      team: issue.team,
      epicKey: issue.epicKey,
      inScope: true
    }));
    
    // 2. Apply scope deltas (remove)
    const scopeRemoveDeltas = deltas.filter(d => d.delta_type === 'scope_remove');
    for (const delta of scopeRemoveDeltas) {
      const issue = issues.find(i => i.key === delta.entity_key);
      if (issue) {
        issue.inScope = false;
      }
    }
    console.log(`Removed ${scopeRemoveDeltas.length} issues from scope`);
    
    // 3. Apply scope deltas (add)
    const scopeAddDeltas = deltas.filter(d => d.delta_type === 'scope_add');
    for (const delta of scopeAddDeltas) {
      const value = delta.delta_value;
      issues.push({
        key: delta.entity_key,
        storyPoints: value.estimate || 0,
        statusCategory: 'To Do',
        team: value.team || 'default',
        epicKey: value.epic || null,
        inScope: true
      });
    }
    console.log(`Added ${scopeAddDeltas.length} issues to scope`);
    
    // 4. Apply estimate overrides
    const estimateOverrides = deltas.filter(d => d.delta_type === 'estimate_override');
    for (const delta of estimateOverrides) {
      const issue = issues.find(i => i.key === delta.entity_key);
      if (issue) {
        issue.storyPoints = delta.delta_value.story_points;
      }
    }
    console.log(`Applied ${estimateOverrides.length} estimate overrides`);
    
    // 5. Compute adjusted remaining work
    const remainingIssues = issues.filter(i => 
      i.inScope && (i.statusCategory === 'To Do' || i.statusCategory === 'In Progress')
    );
    
    const totalRemaining = {
      issue_count: remainingIssues.length,
      total_points: remainingIssues.reduce((sum, i) => sum + i.storyPoints, 0)
    };
    
    // Team breakdown
    const teamMap = new Map();
    for (const issue of remainingIssues) {
      const team = issue.team || 'unassigned';
      if (!teamMap.has(team)) {
        teamMap.set(team, { team, issueCount: 0, totalPoints: 0 });
      }
      const t = teamMap.get(team);
      t.issueCount += 1;
      t.totalPoints += issue.storyPoints;
    }
    const teamRemaining = Array.from(teamMap.values());
    
    console.log(`Adjusted remaining: ${totalRemaining.total_points} points`);
    
    // 6. Apply capacity multipliers to throughput
    const adjustedThroughput = applyCapacityDeltas(
      baselineData.throughput,
      deltas.filter(d => d.delta_type === 'capacity_multiplier')
    );
    
    // 8. Run Monte Carlo simulation with adjusted inputs
    const forecast = runMonteCarloSimulation(
      totalRemaining.total_points,
      adjustedThroughput,
      snapshotId
    );
    
    // 9. Generate scenario ID from deltas
    const scenarioId = generateScenarioId(deltas);
    
    const elapsed = Date.now() - startTime;
    console.log(`computeScenario completed in ${elapsed}ms`);
    
    return {
      success: true,
      runId: `run_${Date.now()}`,
      scenarioId,
      snapshotId,
      computedAt: new Date().toISOString(),
      
      // Forecast results
      p50: forecast.p50,
      p80: forecast.p80,
      p95: forecast.p95,
      
      // Adjusted inputs
      adjustedRemaining: totalRemaining.total_points,
      adjustedIssues: totalRemaining.issue_count,
      teamRemaining,
      
      // Deltas applied
      deltasApplied: deltas.length,
      deltasSummary: summarizeDeltas(deltas),
      
      // Comparison to baseline
      baselineP50: baselineData.p50,
      baselineP80: baselineData.p80,
      deltaWeeks: {
        p50: forecast.p50 - baselineData.p50,
        p80: forecast.p80 - baselineData.p80
      },
      
      // Detailed data
      distribution: forecast.distribution,
      burnDown: forecast.burnDown,
      
      executionTime: elapsed
    };
    
  } catch (error) {
    console.error('computeScenario error:', error);
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
}

/**
 * Apply capacity multipliers to throughput data
 */
function applyCapacityDeltas(baseThroughput, capacityDeltas) {
  if (capacityDeltas.length === 0) {
    return baseThroughput;
  }
  
  // Clone throughput data
  const adjusted = baseThroughput.map(week => ({ ...week }));
  
  for (const delta of capacityDeltas) {
    const { multiplier, start_date, end_date } = delta.delta_value;
    const affectedTeam = delta.entity_key.replace('team:', '');
    
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    
    for (const week of adjusted) {
      const weekDate = new Date(week.week_start);
      
      if (weekDate >= startDate && weekDate <= endDate && week.team === affectedTeam) {
        week.points_completed *= multiplier;
        console.log(`Applied ${multiplier}x to ${affectedTeam} week ${week.week_start}`);
      }
    }
  }
  
  return adjusted;
}

/**
 * Run Monte Carlo simulation
 */
function runMonteCarloSimulation(remainingWork, throughput, seed) {
  const samples = 10000;
  const rng = seedrandom(seed + '_scenario');
  const completionWeeks = [];
  
  for (let i = 0; i < samples; i++) {
    let remaining = remainingWork;
    let weeks = 0;
    const maxWeeks = 104;
    
    while (remaining > 0 && weeks < maxWeeks) {
      const randomIndex = Math.floor(rng() * throughput.length);
      const weekThroughput = throughput[randomIndex].points_completed || 0;
      remaining -= weekThroughput;
      weeks++;
    }
    
    completionWeeks.push(weeks);
  }
  
  completionWeeks.sort((a, b) => a - b);
  
  const p50 = completionWeeks[Math.floor(samples * 0.50)];
  const p80 = completionWeeks[Math.floor(samples * 0.80)];
  const p95 = completionWeeks[Math.floor(samples * 0.95)];
  
  // Generate distribution
  const distribution = generateHistogram(completionWeeks);
  
  // Generate burn-down
  const burnDown = generateBurnDown(remainingWork, throughput, p50, p80);
  
  return { p50, p80, p95, distribution, burnDown };
}

/**
 * Generate histogram
 */
function generateHistogram(completionWeeks) {
  const buckets = {};
  
  for (const weeks of completionWeeks) {
    const bucket = Math.floor(weeks);
    buckets[bucket] = (buckets[bucket] || 0) + 1;
  }
  
  return Object.entries(buckets)
    .map(([weeks, count]) => ({
      weeks: parseInt(weeks),
      count,
      probability: count / completionWeeks.length
    }))
    .sort((a, b) => a.weeks - b.weeks);
}

/**
 * Generate burn-down projection
 */
function generateBurnDown(totalWork, throughput, p50Weeks, p80Weeks) {
  const throughputValues = throughput.map(t => t.points_completed || 0);
  throughputValues.sort((a, b) => a - b);
  const medianThroughput = throughputValues[Math.floor(throughputValues.length / 2)];
  const p20Throughput = throughputValues[Math.floor(throughputValues.length * 0.2)];
  
  const p50Projection = [];
  const p80Projection = [];
  
  let p50Remaining = totalWork;
  for (let week = 0; week <= p50Weeks && p50Remaining > 0; week++) {
    p50Projection.push({ week, remaining: Math.max(0, p50Remaining) });
    p50Remaining -= medianThroughput;
  }
  
  let p80Remaining = totalWork;
  for (let week = 0; week <= p80Weeks && p80Remaining > 0; week++) {
    p80Projection.push({ week, remaining: Math.max(0, p80Remaining) });
    p80Remaining -= p20Throughput;
  }
  
  return { p50: p50Projection, p80: p80Projection };
}

/**
 * Generate scenario ID from deltas
 */
function generateScenarioId(deltas) {
  const deltaString = JSON.stringify(deltas.map(d => 
    `${d.delta_type}:${d.entity_key}`
  ));
  
  let hash = 0;
  for (let i = 0; i < deltaString.length; i++) {
    const char = deltaString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  return `scenario_${Math.abs(hash).toString(36)}`;
}

/**
 * Summarize deltas for display
 */
function summarizeDeltas(deltas) {
  const summary = {};
  
  for (const delta of deltas) {
    if (!summary[delta.delta_type]) {
      summary[delta.delta_type] = 0;
    }
    summary[delta.delta_type]++;
  }
  
  return summary;
}
