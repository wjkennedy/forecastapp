/**
 * Compute forecast confidence based on velocity stability and estimation accuracy
 * Returns a recommendation for which percentile (P50/P80/P95) to use as baseline
 */
export function computeConfidence(throughputData, estimationAccuracy, simulationResults) {
  // Analyze velocity stability
  const velocityStability = analyzeVelocityStability(throughputData);
  
  // Analyze estimation accuracy confidence
  const estimationConfidence = analyzeEstimationConfidence(estimationAccuracy);
  
  // Combine to determine recommended percentile
  const recommendation = determineRecommendation(velocityStability, estimationConfidence, simulationResults);
  
  return {
    velocityStability,
    estimationConfidence,
    recommendation,
    confidence: calculateOverallConfidence(velocityStability, estimationConfidence)
  };
}

/**
 * Analyze velocity stability - how consistent is team throughput?
 */
function analyzeVelocityStability(throughputData) {
  if (!throughputData || throughputData.length < 3) {
    return {
      score: 0,
      level: 'insufficient_data',
      message: 'Need at least 3 weeks of data to assess velocity stability',
      details: {
        sampleSize: throughputData?.length || 0,
        coefficient_of_variation: null,
        trend: null
      }
    };
  }

  const velocities = throughputData.map(w => w.pointsCompleted || w.points_completed || 0);
  const mean = velocities.reduce((a, b) => a + b, 0) / velocities.length;
  const variance = velocities.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / velocities.length;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = mean > 0 ? (stdDev / mean) * 100 : 0;

  // Detect trend (improving or declining velocity)
  const firstHalf = velocities.slice(0, Math.floor(velocities.length / 2));
  const secondHalf = velocities.slice(Math.floor(velocities.length / 2));
  const firstHalfAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondHalfAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  const trend = secondHalfAvg > firstHalfAvg ? 'improving' : secondHalfAvg < firstHalfAvg ? 'declining' : 'stable';

  // Score: lower CV = higher stability
  let score;
  let level;
  if (coefficientOfVariation < 15) {
    score = 95;
    level = 'very_stable';
  } else if (coefficientOfVariation < 25) {
    score = 80;
    level = 'stable';
  } else if (coefficientOfVariation < 40) {
    score = 60;
    level = 'moderate';
  } else if (coefficientOfVariation < 60) {
    score = 40;
    level = 'volatile';
  } else {
    score = 20;
    level = 'highly_volatile';
  }

  // Penalize declining trends
  if (trend === 'declining') {
    score = Math.max(20, score - 15);
  }

  return {
    score,
    level,
    message: getMessage(level, trend, coefficientOfVariation),
    details: {
      sampleSize: velocities.length,
      mean: Math.round(mean * 10) / 10,
      stdDev: Math.round(stdDev * 10) / 10,
      coefficient_of_variation: Math.round(coefficientOfVariation),
      trend,
      min: Math.min(...velocities),
      max: Math.max(...velocities)
    }
  };
}

/**
 * Analyze estimation accuracy - how well do estimates match reality?
 */
function analyzeEstimationConfidence(estimationAccuracy) {
  if (!estimationAccuracy || estimationAccuracy.insufficient) {
    return {
      score: 50, // Neutral if no data
      level: 'insufficient_data',
      message: 'Need more completed issues with estimates to assess accuracy',
      details: {
        sampleSize: estimationAccuracy?.sampleSize || 0,
        bias_score: null
      }
    };
  }

  const biasScore = estimationAccuracy.estimationBias?.score || 100;
  const recommendations = estimationAccuracy.recommendations || [];
  const highVariabilityIssues = recommendations.filter(r => r.type === 'high_variability').length;
  const biasWarnings = recommendations.filter(r => r.type === 'underestimation' || r.type === 'overestimation').length;

  // Score based on bias alignment (100 = well calibrated)
  let score;
  let level;

  if (biasScore >= 95 && biasScore <= 105) {
    score = 90;
    level = 'well_calibrated';
  } else if (biasScore >= 85 && biasScore <= 115) {
    score = 75;
    level = 'acceptable';
  } else if (biasScore >= 70 && biasScore <= 130) {
    score = 55;
    level = 'needs_adjustment';
  } else {
    score = 35;
    level = 'poorly_calibrated';
  }

  // Penalize high variability
  if (highVariabilityIssues > 2) {
    score = Math.max(20, score - 20);
  }

  // Penalize systematic bias
  if (biasWarnings > 1) {
    score = Math.max(30, score - 25);
  }

  return {
    score,
    level,
    message: getEstimationMessage(level, biasScore, highVariabilityIssues),
    details: {
      sampleSize: estimationAccuracy.sampleSize,
      bias_score: biasScore,
      bias_type: estimationAccuracy.estimationBias?.type,
      high_variability_count: highVariabilityIssues
    }
  };
}

/**
 * Determine recommended percentile based on confidence scores
 */
function determineRecommendation(velocityStability, estimationConfidence, simulationResults) {
  const velocityScore = velocityStability.score || 0;
  const estimationScore = estimationConfidence.score || 0;
  const combinedScore = (velocityScore + estimationScore) / 2;

  // Recommendation logic
  let recommended;
  let rationale;

  if (combinedScore >= 80) {
    recommended = 'P50';
    rationale = 'High confidence in estimates. Team velocity is stable and estimates are well-calibrated. Use P50 as your baseline commitment.';
  } else if (combinedScore >= 60) {
    recommended = 'P80';
    rationale = 'Moderate confidence. Velocity is fairly consistent and estimates are reasonable. P80 provides realistic buffer for execution risks.';
  } else if (combinedScore >= 40) {
    recommended = 'P95';
    rationale = 'Lower confidence due to velocity volatility or estimation issues. Use P95 for safer planning and stakeholder commitments.';
  } else {
    recommended = 'CUSTOM';
    rationale = 'Insufficient confidence in baseline forecasts. Recommend improving estimation practices and collecting more velocity data before committing.';
  }

  // Get the actual values from simulation if available
  const percentiles = {};
  if (simulationResults) {
    percentiles.p50 = simulationResults.p50;
    percentiles.p80 = simulationResults.p80;
    percentiles.p95 = simulationResults.p95;
  }

  return {
    percentile: recommended,
    confidenceScore: Math.round(combinedScore),
    rationale,
    breakdown: {
      velocityStabilityScore: velocityScore,
      estimationAccuracyScore: estimationScore
    },
    percentiles
  };
}

/**
 * Calculate overall confidence percentage
 */
function calculateOverallConfidence(velocityStability, estimationConfidence) {
  const baseConfidence = (velocityStability.score + estimationConfidence.score) / 2;
  
  // Cap at 95% - no forecast is ever 100% confident
  return Math.min(95, Math.max(20, Math.round(baseConfidence)));
}

/**
 * Generate message for velocity stability
 */
function getMessage(level, trend, cv) {
  const messages = {
    very_stable: `Your team's velocity is very consistent (${cv}% variability). Forecasts based on historical data are highly reliable.`,
    stable: `Velocity is stable (${cv}% variability). Good foundation for forecasting, though plan for some weekly fluctuation.`,
    moderate: `Velocity shows moderate variation (${cv}% variability). Forecasts are reasonable but include a buffer for variance.`,
    volatile: `Velocity is quite volatile (${cv}% variability). Consider investigating causes and look for patterns.`,
    highly_volatile: `Velocity varies significantly (${cv}% variability). Forecast accuracy is limited without addressing root causes.`
  };

  let msg = messages[level] || messages.moderate;
  
  if (trend === 'improving') {
    msg += ' Trend shows improvement - velocity is increasing.';
  } else if (trend === 'declining') {
    msg += ' ⚠️ Trend shows decline - investigate and address issues affecting team capacity.';
  }

  return msg;
}

/**
 * Generate message for estimation accuracy
 */
function getEstimationMessage(level, biasScore, variabilityCount) {
  const messages = {
    well_calibrated: `Estimates are well-calibrated to actual effort (bias: ${biasScore}%). Team sizing is predictable.`,
    acceptable: `Estimates are reasonable but show some deviation (bias: ${biasScore}%). Minor adjustments could improve accuracy.`,
    needs_adjustment: `Estimates need calibration (bias: ${biasScore}%). Team tends to ${biasScore < 100 ? 'overestimate' : 'underestimate'} effort.`,
    poorly_calibrated: `Significant gap between estimates and actual effort (bias: ${biasScore}%). Strongly recommend reviewing estimation process.`
  };

  let msg = messages[level] || messages.acceptable;
  
  if (variabilityCount > 0) {
    msg += ` Note: ${variabilityCount} point value(s) show high variability in how long they take.`;
  }

  return msg;
}

export default computeConfidence;
