'use client';

import { useState, useMemo } from 'react';

/**
 * Calculate projected completion week for each issue based on forecast
 */
function calculateSchedule(issues, forecast, avgThroughput) {
  if (!issues || !forecast || !avgThroughput || avgThroughput <= 0) {
    return issues || [];
  }

  let cumulativePoints = 0;
  const scheduledIssues = [];

  for (const issue of issues) {
    const points = issue.storyPoints || 1; // Default to 1 if unestimated
    cumulativePoints += points;
    
    // Calculate which week this issue would be completed
    // Using average throughput: week = cumulative points / avg throughput per week
    const completionWeek = Math.ceil(cumulativePoints / avgThroughput);
    
    // Determine confidence based on P50/P80/P95
    let confidence = 'high'; // Within P50
    if (completionWeek > forecast.p50 && completionWeek <= forecast.p80) {
      confidence = 'medium';
    } else if (completionWeek > forecast.p80) {
      confidence = 'low';
    }

    // Calculate projected date
    const today = new Date();
    const projectedDate = new Date(today.getTime() + (completionWeek * 7 * 24 * 60 * 60 * 1000));

    scheduledIssues.push({
      ...issue,
      projectedWeek: completionWeek,
      projectedDate: projectedDate.toISOString().split('T')[0],
      cumulativePoints,
      confidence
    });
  }

  return scheduledIssues;
}

/**
 * Format date for display
 */
function formatDate(dateStr) {
  if (!dateStr) return '--';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Get confidence badge style
 */
function ConfidenceBadge({ confidence }) {
  const labels = {
    high: 'High confidence (within P50)',
    medium: 'Medium confidence (P50-P80)',
    low: 'At risk (beyond P80)'
  };
  
  return (
    <span className={`confidence-badge confidence-${confidence}`} title={labels[confidence]}>
      {confidence === 'high' ? 'Likely' : confidence === 'medium' ? 'Possible' : 'At Risk'}
    </span>
  );
}

/**
 * Issue type icon
 */
function IssueTypeIcon({ type }) {
  const icons = {
    'Story': 'S',
    'Bug': 'B',
    'Task': 'T',
    'Epic': 'E',
    'Sub-task': 'ST'
  };
  const colors = {
    'Story': '#63ba3c',
    'Bug': '#e5493a',
    'Task': '#4bade8',
    'Epic': '#904ee2',
    'Sub-task': '#4bade8'
  };
  
  return (
    <span 
      className="issue-type-icon" 
      style={{ backgroundColor: colors[type] || '#5e6c84' }}
      title={type}
    >
      {icons[type] || type?.charAt(0) || '?'}
    </span>
  );
}

/**
 * Status badge
 */
function StatusBadge({ status, category }) {
  return (
    <span className={`status-badge status-${category?.toLowerCase().replace(/\s+/g, '-')}`}>
      {status}
    </span>
  );
}

/**
 * Remaining Work Display Component
 */
export function RemainingWork({ remaining, forecast, throughput }) {
  const [viewMode, setViewMode] = useState('timeline'); // 'timeline' | 'list' | 'summary'
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'in-progress' | 'todo'
  const [sortBy, setSortBy] = useState('schedule'); // 'schedule' | 'points' | 'status'

  // Calculate schedule projections
  const avgThroughput = useMemo(() => {
    if (throughput?.mean) return throughput.mean;
    if (throughput?.avgPointsPerWeek) return throughput.avgPointsPerWeek;
    if (throughput?.weeklyData?.length > 0) {
      const points = throughput.weeklyData.map(w => w.pointsCompleted || 0);
      return points.reduce((a, b) => a + b, 0) / points.length;
    }
    return 0;
  }, [throughput]);

  const scheduledIssues = useMemo(() => {
    return calculateSchedule(remaining?.issues || [], forecast, avgThroughput);
  }, [remaining?.issues, forecast, avgThroughput]);

  // Apply filters and sorting
  const displayIssues = useMemo(() => {
    let filtered = scheduledIssues;
    
    if (filterStatus === 'in-progress') {
      filtered = filtered.filter(i => i.statusCategory === 'In Progress');
    } else if (filterStatus === 'todo') {
      filtered = filtered.filter(i => i.statusCategory === 'To Do');
    }
    
    if (sortBy === 'points') {
      filtered = [...filtered].sort((a, b) => (b.storyPoints || 0) - (a.storyPoints || 0));
    } else if (sortBy === 'status') {
      filtered = [...filtered].sort((a, b) => {
        if (a.statusCategory === b.statusCategory) return 0;
        return a.statusCategory === 'In Progress' ? -1 : 1;
      });
    }
    // 'schedule' is default order
    
    return filtered;
  }, [scheduledIssues, filterStatus, sortBy]);

  // Group by week for timeline view
  const weeklyGroups = useMemo(() => {
    const groups = new Map();
    for (const issue of displayIssues) {
      const week = issue.projectedWeek;
      if (!groups.has(week)) {
        groups.set(week, { week, issues: [], totalPoints: 0 });
      }
      const group = groups.get(week);
      group.issues.push(issue);
      group.totalPoints += issue.storyPoints || 0;
    }
    return Array.from(groups.values()).sort((a, b) => a.week - b.week);
  }, [displayIssues]);

  // Summary stats
  const stats = useMemo(() => {
    const inProgress = scheduledIssues.filter(i => i.statusCategory === 'In Progress');
    const toDo = scheduledIssues.filter(i => i.statusCategory === 'To Do');
    const highConfidence = scheduledIssues.filter(i => i.confidence === 'high');
    const atRisk = scheduledIssues.filter(i => i.confidence === 'low');
    
    return {
      total: scheduledIssues.length,
      inProgress: inProgress.length,
      toDo: toDo.length,
      totalPoints: remaining?.totalPoints || 0,
      unestimated: remaining?.unestimatedCount || 0,
      highConfidence: highConfidence.length,
      atRisk: atRisk.length
    };
  }, [scheduledIssues, remaining]);

  if (!remaining || !remaining.issues || remaining.issues.length === 0) {
    return (
      <div className="remaining-work empty">
        <p>No remaining work found. Either all issues are complete or no issues matched the query.</p>
      </div>
    );
  }

  return (
    <div className="remaining-work">
      <div className="remaining-header">
        <h3>Remaining Work Schedule</h3>
        <p className="remaining-subtitle">
          {stats.total} items ({stats.totalPoints} points) projected across {weeklyGroups.length} weeks
        </p>
      </div>

      {/* Summary Cards */}
      <div className="remaining-summary">
        <div className="summary-card">
          <div className="summary-number">{stats.inProgress}</div>
          <div className="summary-label">In Progress</div>
        </div>
        <div className="summary-card">
          <div className="summary-number">{stats.toDo}</div>
          <div className="summary-label">To Do</div>
        </div>
        <div className="summary-card">
          <div className="summary-number">{stats.totalPoints}</div>
          <div className="summary-label">Total Points</div>
        </div>
        <div className="summary-card warning">
          <div className="summary-number">{stats.unestimated}</div>
          <div className="summary-label">Unestimated</div>
        </div>
        <div className="summary-card success">
          <div className="summary-number">{stats.highConfidence}</div>
          <div className="summary-label">High Confidence</div>
        </div>
        <div className="summary-card danger">
          <div className="summary-number">{stats.atRisk}</div>
          <div className="summary-label">At Risk</div>
        </div>
      </div>

      {/* Controls */}
      <div className="remaining-controls">
        <div className="view-tabs">
          <button 
            className={`view-tab ${viewMode === 'timeline' ? 'active' : ''}`}
            onClick={() => setViewMode('timeline')}
          >
            Timeline
          </button>
          <button 
            className={`view-tab ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
          >
            List
          </button>
        </div>
        
        <div className="filter-controls">
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">All Status</option>
            <option value="in-progress">In Progress</option>
            <option value="todo">To Do</option>
          </select>
          
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="schedule">By Schedule</option>
            <option value="points">By Points</option>
            <option value="status">By Status</option>
          </select>
        </div>
      </div>

      {/* Timeline View */}
      {viewMode === 'timeline' && (
        <div className="timeline-view">
          {weeklyGroups.map(group => (
            <div key={group.week} className="week-group">
              <div className="week-header">
                <div className="week-info">
                  <span className="week-number">Week {group.week}</span>
                  <span className="week-date">
                    {formatDate(new Date(Date.now() + group.week * 7 * 24 * 60 * 60 * 1000).toISOString())}
                  </span>
                </div>
                <div className="week-stats">
                  <span className="week-count">{group.issues.length} items</span>
                  <span className="week-points">{group.totalPoints} pts</span>
                </div>
              </div>
              <div className="week-issues">
                {group.issues.map(issue => (
                  <div key={issue.key} className={`issue-card confidence-border-${issue.confidence}`}>
                    <div className="issue-main">
                      <IssueTypeIcon type={issue.issueType} />
                      <a 
                        href={`/browse/${issue.key}`} 
                        className="issue-key"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {issue.key}
                      </a>
                      <span className="issue-summary">{issue.summary}</span>
                    </div>
                    <div className="issue-meta">
                      <StatusBadge status={issue.status} category={issue.statusCategory} />
                      {issue.storyPoints && (
                        <span className="issue-points">{issue.storyPoints} pts</span>
                      )}
                      {!issue.storyPoints && (
                        <span className="issue-unestimated">Unestimated</span>
                      )}
                      <ConfidenceBadge confidence={issue.confidence} />
                      {issue.assignee && (
                        <span className="issue-assignee" title={issue.assignee}>
                          {issue.assignee.split(' ').map(n => n[0]).join('')}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="list-view">
          <table className="issues-table">
            <thead>
              <tr>
                <th>Key</th>
                <th>Summary</th>
                <th>Status</th>
                <th>Points</th>
                <th>Week</th>
                <th>Projected Date</th>
                <th>Confidence</th>
              </tr>
            </thead>
            <tbody>
              {displayIssues.map(issue => (
                <tr key={issue.key} className={`confidence-row-${issue.confidence}`}>
                  <td>
                    <div className="cell-with-icon">
                      <IssueTypeIcon type={issue.issueType} />
                      <a href={`/browse/${issue.key}`} target="_blank" rel="noopener noreferrer">
                        {issue.key}
                      </a>
                    </div>
                  </td>
                  <td className="summary-cell">{issue.summary}</td>
                  <td><StatusBadge status={issue.status} category={issue.statusCategory} /></td>
                  <td>{issue.storyPoints || '-'}</td>
                  <td>Week {issue.projectedWeek}</td>
                  <td>{formatDate(issue.projectedDate)}</td>
                  <td><ConfidenceBadge confidence={issue.confidence} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Scheduling Notes */}
      <div className="scheduling-notes">
        <h4>Understanding the Schedule</h4>
        <ul>
          <li><strong>Projected weeks</strong> are calculated by dividing cumulative work by your average throughput ({avgThroughput.toFixed(1)} points/week).</li>
          <li><strong>High confidence</strong> items are projected to complete within P50 ({forecast?.p50} weeks).</li>
          <li><strong>At Risk</strong> items extend beyond P80 ({forecast?.p80} weeks) and may slip.</li>
          <li>Unestimated items are counted as 1 point each for scheduling purposes.</li>
        </ul>
      </div>
    </div>
  );
}

export default RemainingWork;
