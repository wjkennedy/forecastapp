'use client';

import { useState } from 'react'

/**
 * Confidence Recommendation Component
 * Shows forecast confidence and recommends which percentile to use as baseline
 */
export function ConfidenceRecommendation({ confidence, forecast }) {
  const [expandedSection, setExpandedSection] = useState(null)

  if (!confidence || !forecast) {
    return null
  }

  const { recommendation, velocityStability, estimationConfidence } = confidence
  const { p50, p80, p95 } = forecast

  // Determine confidence color
  const getConfidenceColor = (score) => {
    if (score >= 80) return 'high'
    if (score >= 60) return 'medium'
    if (score >= 40) return 'low'
    return 'critical'
  }

  const confidenceColor = getConfidenceColor(recommendation.confidenceScore)

  // Format weeks to readable format
  const formatWeeks = (weeks) => {
    if (!weeks) return 'N/A'
    return `${Math.round(weeks)} week${weeks !== 1 ? 's' : ''}`
  }

  return (
    <div className="confidence-recommendation">
      <div className="confidence-header">
        <div className="header-content">
          <h3>Confidence-Based Recommendation</h3>
          <p className="header-subtitle">
            Use {recommendation.percentile} as your baseline estimate
          </p>
        </div>
        <div className={`confidence-score confidence-${confidenceColor}`}>
          <div className="score-value">{recommendation.confidenceScore}%</div>
          <div className="score-label">Forecast Confidence</div>
        </div>
      </div>

      {/* Recommendation Card */}
      <div className="recommendation-section active">
        <div className="section-header">
          <h4>Why {recommendation.percentile}?</h4>
        </div>
        <div className="section-content">
          <div className="rationale">
            <p>{recommendation.rationale}</p>
          </div>

          {/* Percentile Selection Cards */}
          <div className="percentile-cards">
            <div className={`percentile-card ${recommendation.percentile === 'P50' ? 'recommended' : ''}`}>
              <div className="percentile-label">P50 (Median)</div>
              <div className="percentile-value">{formatWeeks(p50)}</div>
              <div className="percentile-desc">50% confidence</div>
              {recommendation.percentile === 'P50' && <div className="recommended-badge">← Recommended</div>}
            </div>

            <div className={`percentile-card ${recommendation.percentile === 'P80' ? 'recommended' : ''}`}>
              <div className="percentile-label">P80 (Realistic)</div>
              <div className="percentile-value">{formatWeeks(p80)}</div>
              <div className="percentile-desc">80% confidence</div>
              {recommendation.percentile === 'P80' && <div className="recommended-badge">← Recommended</div>}
            </div>

            <div className={`percentile-card ${recommendation.percentile === 'P95' ? 'recommended' : ''}`}>
              <div className="percentile-label">P95 (Conservative)</div>
              <div className="percentile-value">{formatWeeks(p95)}</div>
              <div className="percentile-desc">95% confidence</div>
              {recommendation.percentile === 'P95' && <div className="recommended-badge">← Recommended</div>}
            </div>
          </div>

          <div className="selection-help">
            <p>
              <strong>How to use:</strong> Based on your team's velocity stability ({velocityStability.level}) and estimation accuracy ({estimationConfidence.level}), 
              we recommend using {recommendation.percentile} for your planning. This baseline replaces planning poker debates with data-driven analysis.
            </p>
          </div>
        </div>
      </div>

      {/* Confidence Factors */}
      <div className="factors-section">
        <button
          className="section-toggle"
          onClick={() => setExpandedSection(expandedSection === 'factors' ? null : 'factors')}
        >
          <h4>Confidence Factors</h4>
          <span className="toggle-icon">{expandedSection === 'factors' ? '−' : '+'}</span>
        </button>

        {expandedSection === 'factors' && (
          <div className="section-content">
            {/* Velocity Stability */}
            <div className="factor-card">
              <div className="factor-header">
                <div className="factor-title">
                  <span className="factor-name">Velocity Stability</span>
                  <span className="factor-score">{velocityStability.score}%</span>
                </div>
                <div className={`factor-level ${velocityStability.level}`}>
                  {velocityStability.level.replace(/_/g, ' ')}
                </div>
              </div>
              <p className="factor-message">{velocityStability.message}</p>
              <div className="factor-details">
                <div className="detail-item">
                  <span className="detail-label">Sample Size:</span>
                  <span className="detail-value">{velocityStability.details.sampleSize} weeks</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Average Velocity:</span>
                  <span className="detail-value">{velocityStability.details.mean} points/week</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Variability:</span>
                  <span className="detail-value">{velocityStability.details.coefficient_of_variation}%</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Range:</span>
                  <span className="detail-value">{velocityStability.details.min}–{velocityStability.details.max} points</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Trend:</span>
                  <span className={`detail-value trend-${velocityStability.details.trend}`}>
                    {velocityStability.details.trend}
                  </span>
                </div>
              </div>
            </div>

            {/* Estimation Accuracy */}
            <div className="factor-card">
              <div className="factor-header">
                <div className="factor-title">
                  <span className="factor-name">Estimation Accuracy</span>
                  <span className="factor-score">{estimationConfidence.score}%</span>
                </div>
                <div className={`factor-level ${estimationConfidence.level}`}>
                  {estimationConfidence.level.replace(/_/g, ' ')}
                </div>
              </div>
              <p className="factor-message">{estimationConfidence.message}</p>
              <div className="factor-details">
                <div className="detail-item">
                  <span className="detail-label">Sample Size:</span>
                  <span className="detail-value">{estimationConfidence.details.sampleSize} completed issues</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Bias:</span>
                  <span className="detail-value">{estimationConfidence.details.bias_score}% (1.0 = perfect)</span>
                </div>
                {estimationConfidence.details.high_variability_count > 0 && (
                  <div className="detail-item">
                    <span className="detail-label">High Variability Issues:</span>
                    <span className="detail-value">{estimationConfidence.details.high_variability_count}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Usage Guidance */}
      <div className="usage-guidance">
        <h4>Usage Guidance</h4>
        <ul>
          <li><strong>{recommendation.percentile} Estimate:</strong> Use this as your baseline commitment in planning.</li>
          {recommendation.percentile !== 'P50' && <li><strong>P50 represents:</strong> A 50/50 chance of finishing within {formatWeeks(p50)} ({formatWeeks(p50)} vs later).</li>}
          {recommendation.percentile !== 'P95' && <li><strong>P95 represents:</strong> A 95% confidence level — use this for stakeholder commitments or contracts.</li>}
          <li><strong>Improve Confidence:</strong> Stabilize velocity by reducing interruptions, and calibrate estimates by reviewing completed work regularly.</li>
        </ul>
      </div>
    </div>
  )
}

export default ConfidenceRecommendation
