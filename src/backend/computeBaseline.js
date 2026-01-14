import seedrandom from 'seedrandom';

/**
 * Compute baseline forecast using Monte Carlo simulation
 * 
 * @param {Object} req - Forge request object
 * @param {string} req.payload.snapshotId - Snapshot identifier
 * @param {Array} req.payload.throughput - Historical throughput data
 * @param {Object} req.payload.remaining - Remaining work summary
 * @returns {Object} Forecast result with P50/P80/P95 and distribution
 */
export async function handler(req) {
  const startTime = Date.now();
  console.log('computeBaseline started');
  
  try {
    const { snapshotId, throughput, remaining } = req.payload;
    
    // Validate inputs
    if (!throughput || throughput.length === 0) {
      throw new Error('No historical throughput data available');
    }
    
    if (!remaining || remaining.total_points === 0) {
      return {
        success: true,
        message: 'No remaining work - project is complete!',
        p50: 0,
        p80: 0,
        p95: 0
      };
    }
    
    console.log(`Running simulation with ${remaining.total_points} points remaining`);
    console.log(`Historical throughput: ${throughput.length} weeks`);
    
    // Run Monte Carlo simulation
    const samples = 10000;
    const seed = snapshotId; // Deterministic based on snapshot
    const rng = seedrandom(seed);
    
    const completionWeeks = [];
    
    for (let i = 0; i < samples; i++) {
      let remainingWork = remaining.total_points;
      let weeks = 0;
      const maxWeeks = 104; // 2 years max
      
      while (remainingWork > 0 && weeks < maxWeeks) {
        // Resample from historical throughput
        const randomIndex = Math.floor(rng() * throughput.length);
        const weekThroughput = throughput[randomIndex].points_completed || 0;
        
        remainingWork -= weekThroughput;
        weeks++;
      }
      
      completionWeeks.push(weeks);
    }
    
    // Sort for percentile calculation
    completionWeeks.sort((a, b) => a - b);
    
    // Calculate percentiles
    const p50 = completionWeeks[Math.floor(samples * 0.50)];
    const p80 = completionWeeks[Math.floor(samples * 0.80)];
    const p95 = completionWeeks[Math.floor(samples * 0.95)];
    
    console.log(`Forecast: P50=${p50}, P80=${p80}, P95=${p95} weeks`);
    
    // Generate distribution histogram
    const distribution = generateHistogram(completionWeeks);
    
    // Generate burn-down projection
    const burnDown = generateBurnDown(remaining.total_points, throughput, p50, p80);
    
    // Calculate throughput statistics
    const throughputStats = calculateThroughputStats(throughput);
    
    const elapsed = Date.now() - startTime;
    console.log(`computeBaseline completed in ${elapsed}ms`);
    
    return {
      success: true,
      runId: `run_${Date.now()}`,
      snapshotId,
      scenarioId: 'baseline',
      computedAt: new Date().toISOString(),
      
      // Forecast results
      p50,
      p80,
      p95,
      
      // Input summary
      remainingWork: remaining.total_points,
      remainingIssues: remaining.issue_count,
      unestimatedIssues: remaining.unestimated_count,
      
      // Throughput stats
      throughputStats,
      
      // Detailed data
      distribution,
      burnDown,
      
      executionTime: elapsed
    };
    
  } catch (error) {
    console.error('computeBaseline error:', error);
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
}

/**
 * Generate histogram of completion weeks
 */
function generateHistogram(completionWeeks) {
  const buckets = {};
  
  for (const weeks of completionWeeks) {
    const bucket = Math.floor(weeks);
    buckets[bucket] = (buckets[bucket] || 0) + 1;
  }
  
  // Convert to array and sort
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
  // Calculate median throughput
  const throughputValues = throughput.map(t => t.points_completed || 0);
  throughputValues.sort((a, b) => a - b);
  const medianThroughput = throughputValues[Math.floor(throughputValues.length / 2)];
  
  // Generate weekly projections for P50 and P80
  const p50Projection = [];
  const p80Projection = [];
  
  // P50 line (median case)
  let p50Remaining = totalWork;
  for (let week = 0; week <= p50Weeks && p50Remaining > 0; week++) {
    p50Projection.push({
      week,
      remaining: Math.max(0, p50Remaining)
    });
    p50Remaining -= medianThroughput;
  }
  
  // P80 line (pessimistic case - slower throughput)
  const p20Throughput = throughputValues[Math.floor(throughputValues.length * 0.2)];
  let p80Remaining = totalWork;
  for (let week = 0; week <= p80Weeks && p80Remaining > 0; week++) {
    p80Projection.push({
      week,
      remaining: Math.max(0, p80Remaining)
    });
    p80Remaining -= p20Throughput;
  }
  
  return {
    p50: p50Projection,
    p80: p80Projection
  };
}

/**
 * Calculate throughput statistics
 */
function calculateThroughputStats(throughput) {
  const values = throughput.map(t => t.points_completed || 0).filter(v => v > 0);
  
  if (values.length === 0) {
    return {
      median: 0,
      mean: 0,
      p20: 0,
      p80: 0,
      min: 0,
      max: 0
    };
  }
  
  values.sort((a, b) => a - b);
  
  return {
    median: values[Math.floor(values.length * 0.5)],
    mean: values.reduce((a, b) => a + b, 0) / values.length,
    p20: values[Math.floor(values.length * 0.2)],
    p80: values[Math.floor(values.length * 0.8)],
    min: values[0],
    max: values[values.length - 1],
    weeks: values.length
  };
}
