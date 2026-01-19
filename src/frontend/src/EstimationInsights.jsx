'use client';

import { useState, useMemo } from 'react';

/**
 * Estimation Insights - Analyzes historical accuracy of story point estimates
 * Provides guidance for sizing future work based on actual trends
 */
export default function EstimationInsights({ estimationAccuracy, throughput }) {
  const [expandedSection, setExpandedSection] = useState('recommendations');
  
  const healthStatus = useMemo(() => {
    if (!estimationAccuracy) return null;
    if (estimationAccuracy.insufficient) return null;
    const { estimationBias } = estimationAccuracy;
    if (estimationBias.type === 'well_calibrated') return 'healthy';
    if (estimationBias.type.includes('severe')) return 'critical';
    return 'warning';
  }, [estimationAccuracy]);

  if (!estimationAccuracy || estimationAccuracy.insufficient) {
    return (
      <div className="estimation-insights insufficient">
        {estimationAccuracy && estimationAccuracy.insufficient ? (
          <div className="insufficient-message">
            <div className="insufficient-icon">?</div>
            <p>{estimationAccuracy.message}</p>
            <p className="hint">Complete more issues with story point estimates to unlock this analysis.</p>
          </div>
        ) : (
          <p>No estimation accuracy data available.</p>
        )}
      </div>
    );
  }
  
  const { byPointValue, estimationBias, recommendations, overallAvgDaysPerPoint, sampleSize } = estimationAccuracy;
  
  return (
    <div className="estimation-insights">
      <div className="insights-header">
        <div className="header-content">
          <h3>Estimation Accuracy Analysis</h3>
          <p className="insights-subtitle">
            Based on {sampleSize} completed issues from the last 12 weeks
          </p>
        </div>
        <div className={`health-indicator health-${healthStatus}`}>
          <span className="health-dot"></span>
          <span className="health-label">
            {healthStatus === 'healthy' ? 'Well Calibrated' : 
             healthStatus === 'critical' ? 'Needs Attention' : 'Review Recommended'}
          </span>
        </div>
      </div>
      
      {/* Key Metrics */}
      <div className="insights-metrics">
        <div className="metric-card">
          <div className="metric-value">{overallAvgDaysPerPoint}</div>
          <div className="metric-label">Avg Days / Point</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{byPointValue.length}</div>
          <div className="metric-label">Point Values Used</div>
        </div>
        <div className="metric-card">
          <div className={`metric-value ${estimationBias.score > 120 || estimationBias.score < 80 ? 'metric-warning' : ''}`}>
            {estimationBias.score}%
          </div>
          <div className="metric-label">Linearity Score</div>
          <div className="metric-hint">100% = perfect correlation</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{sampleSize}</div>
          <div className="metric-label">Issues Analyzed</div>
        </div>
      </div>
      
      {/* Recommendations Section */}
      <div className="insights-section">
        <button 
          className={`section-toggle ${expandedSection === 'recommendations' ? 'expanded' : ''}`}
          onClick={() => setExpandedSection(expandedSection === 'recommendations' ? null : 'recommendations')}
        >
          <span className="section-title">
            <span className="section-icon">!</span>
            Sizing Recommendations
            {recommendations.filter(r => r.priority === 'high').length > 0 && (
              <span className="badge badge-high">{recommendations.filter(r => r.priority === 'high').length} High Priority</span>
            )}
          </span>
          <span className="toggle-icon">{expandedSection === 'recommendations' ? '−' : '+'}</span>
        </button>
        
        {expandedSection === 'recommendations' && (
          <div className="section-content">
            {recommendations.length === 0 ? (
              <p className="no-recommendations">No specific recommendations at this time.</p>
            ) : (
              <div className="recommendations-list">
                {recommendations.map((rec, i) => (
                  <div key={i} className={`recommendation-card priority-${rec.priority}`}>
                    <div className="rec-header">
                      <span className={`priority-badge priority-${rec.priority}`}>
                        {rec.priority === 'high' ? 'Action Needed' : 
                         rec.priority === 'medium' ? 'Review' : 'Info'}
                      </span>
                      <h4>{rec.title}</h4>
                    </div>
                    <p className="rec-detail">{rec.detail}</p>
                    {rec.suggestedMultiplier && (
                      <div className="rec-action">
                        <strong>Suggested adjustment:</strong> Multiply estimates over 3 points by {rec.suggestedMultiplier}x
                      </div>
                    )}
                    {rec.affectedPoints && (
                      <div className="affected-points">
                        Affects: {rec.affectedPoints.map(p => `${p}-point`).join(', ')} stories
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Point Value Breakdown */}
      <div className="insights-section">
        <button 
          className={`section-toggle ${expandedSection === 'breakdown' ? 'expanded' : ''}`}
          onClick={() => setExpandedSection(expandedSection === 'breakdown' ? null : 'breakdown')}
        >
          <span className="section-title">
            <span className="section-icon">#</span>
            Point Value Breakdown
          </span>
          <span className="toggle-icon">{expandedSection === 'breakdown' ? '−' : '+'}</span>
        </button>
        
        {expandedSection === 'breakdown' && (
          <div className="section-content">
            <p className="breakdown-intro">
              How long does each story point value actually take? Use this to calibrate future estimates.
            </p>
            <div className="breakdown-table-container">
              <table className="breakdown-table">
                <thead>
                  <tr>
                    <th>Points</th>
                    <th>Count</th>
                    <th>Avg Cycle Time</th>
                    <th>Range</th>
                    <th>Days/Point</th>
                    <th>Variability</th>
                  </tr>
                </thead>
                <tbody>
                  {byPointValue.map((stat) => (
                    <tr key={stat.storyPoints} className={stat.variability > 50 ? 'high-variability' : ''}>
                      <td>
                        <span className="point-badge">{stat.storyPoints}</span>
                      </td>
                      <td>{stat.count}</td>
                      <td>{stat.avgCycleTimeDays} days</td>
                      <td className="range-cell">
                        {stat.minCycleTime} - {stat.maxCycleTime} days
                      </td>
                      <td className={stat.avgDaysPerPoint > overallAvgDaysPerPoint * 1.3 ? 'slow-indicator' : ''}>
                        {stat.avgDaysPerPoint}
                      </td>
                      <td>
                        <span className={`variability-indicator ${stat.variability > 50 ? 'high' : stat.variability > 30 ? 'medium' : 'low'}`}>
                          {stat.variability}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="breakdown-legend">
              <div className="legend-item">
                <span className="variability-indicator low">Low</span> &lt;30% spread
              </div>
              <div className="legend-item">
                <span className="variability-indicator medium">Med</span> 30-50% spread
              </div>
              <div className="legend-item">
                <span className="variability-indicator high">High</span> &gt;50% spread
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Sizing Guide */}
      <div className="insights-section">
        <button 
          className={`section-toggle ${expandedSection === 'guide' ? 'expanded' : ''}`}
          onClick={() => setExpandedSection(expandedSection === 'guide' ? null : 'guide')}
        >
          <span className="section-title">
            <span className="section-icon">*</span>
            Sizing Guide for New Work
          </span>
          <span className="toggle-icon">{expandedSection === 'guide' ? '−' : '+'}</span>
        </button>
        
        {expandedSection === 'guide' && (
          <div className="section-content">
            <SizingGuide 
              byPointValue={byPointValue} 
              estimationBias={estimationBias}
              avgDaysPerPoint={overallAvgDaysPerPoint}
            />
          </div>
        )}
      </div>
      
      {/* Estimation Bias Explanation */}
      <div className="bias-explanation">
        <h4>Understanding Your Estimation Pattern</h4>
        <p className={`bias-message bias-${estimationBias.type}`}>
          {estimationBias.message}
        </p>
        <div className="bias-visual">
          <div className="bias-scale">
            <span className="scale-label">Overestimate</span>
            <div className="scale-bar">
              <div 
                className="scale-marker" 
                style={{ left: `${Math.min(100, Math.max(0, (estimationBias.score / 2)))}%` }}
              ></div>
            </div>
            <span className="scale-label">Underestimate</span>
          </div>
          <div className="scale-reference">
            <span>50%</span>
            <span>100% (ideal)</span>
            <span>150%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Sizing Guide component - provides practical guidance for estimating new work
 */
function SizingGuide({ byPointValue, estimationBias, avgDaysPerPoint }) {
  // Calculate suggested sizing based on historical data
  const sizingGuide = useMemo(() => {
    const guide = [];
    
    // Generate entries for common point values
    const commonPoints = [1, 2, 3, 5, 8, 13];
    
    for (const points of commonPoints) {
      const historical = byPointValue.find(p => p.storyPoints === points);
      
      let expectedDays;
      let confidence;
      let note = '';
      
      if (historical && historical.count >= 3) {
        expectedDays = historical.avgCycleTimeDays;
        confidence = historical.variability < 30 ? 'high' : historical.variability < 50 ? 'medium' : 'low';
        
        if (historical.variability > 50) {
          note = 'High variability - consider breaking down';
        }
      } else {
        // Extrapolate from overall average
        expectedDays = Math.round(points * avgDaysPerPoint * 10) / 10;
        confidence = 'extrapolated';
        
        if (!historical) {
          note = 'No historical data - extrapolated';
        } else {
          note = `Only ${historical.count} samples`;
        }
      }
      
      // Apply bias correction for larger stories
      let adjustedDays = expectedDays;
      if (points >= 5 && (estimationBias.type === 'moderate_underestimation' || estimationBias.type === 'severe_underestimation')) {
        const multiplier = estimationBias.score / 100;
        adjustedDays = Math.round(expectedDays * multiplier * 10) / 10;
      }
      
      guide.push({
        points,
        expectedDays,
        adjustedDays,
        confidence,
        note,
        historical: historical || null
      });
    }
    
    return guide;
  }, [byPointValue, estimationBias, avgDaysPerPoint]);

  return (
    <div className="sizing-guide">
      <p className="guide-intro">
        Use this reference when sizing new work. Times are based on your team's historical performance.
      </p>
      
      <div className="guide-grid">
        {sizingGuide.map((item) => (
          <div key={item.points} className={`guide-card confidence-${item.confidence}`}>
            <div className="guide-points">{item.points}</div>
            <div className="guide-label">points</div>
            <div className="guide-time">
              <span className="time-value">{item.adjustedDays}</span>
              <span className="time-unit">days expected</span>
            </div>
            {item.expectedDays !== item.adjustedDays && (
              <div className="time-adjusted">
                <span className="original">{item.expectedDays}d</span> adjusted for bias
              </div>
            )}
            <div className={`guide-confidence confidence-${item.confidence}`}>
              {item.confidence === 'high' ? 'High confidence' :
               item.confidence === 'medium' ? 'Medium confidence' :
               item.confidence === 'low' ? 'Low confidence' :
               'Extrapolated'}
            </div>
            {item.note && <div className="guide-note">{item.note}</div>}
          </div>
        ))}
      </div>
      
      <div className="guide-tips">
        <h5>Tips for More Accurate Estimates</h5>
        <ul>
          <li>Compare new work to completed stories of similar complexity, not just size</li>
          <li>If a story feels uncertain, size it higher - your data shows {estimationBias.type.includes('under') ? 'underestimation is common' : 'estimates are generally reliable'}</li>
          <li>Break down anything over 5 points to reduce variability</li>
          <li>Track actual time and revisit these benchmarks monthly</li>
        </ul>
      </div>
    </div>
  );
}
