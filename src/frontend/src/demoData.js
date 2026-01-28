'use client';

// Mock forecast data for demo purposes
export const DEMO_DATA = {
  // Sample forecast result showing strong predictability
  forecast: {
    success: true,
    p50: 3,
    p80: 4,
    p95: 6,
    mean: 4.2,
    median: 4,
    min: 2,
    max: 8,
    remaining: 85,
    weeksAnalyzed: 12,
    throughputStats: {
      mean: 21,
      median: 20,
      min: 14,
      max: 32
    },
    distribution: [
      { weeks: 2, count: 120, percent: 1.2 },
      { weeks: 3, count: 2850, percent: 28.5 },
      { weeks: 4, count: 4200, percent: 42.0 },
      { weeks: 5, count: 1850, percent: 18.5 },
      { weeks: 6, count: 800, percent: 8.0 },
      { weeks: 7, count: 200, percent: 2.0 },
    ],
    simulationCount: 10000,
    useIssueCount: false
  },

  // Sample throughput data (12 weeks)
  throughput: {
    weeklyData: [
      { weekStart: '2026-01-03', pointsCompleted: 18, issuesCompleted: 5 },
      { weekStart: '2026-01-10', pointsCompleted: 24, issuesCompleted: 7 },
      { weekStart: '2026-01-17', pointsCompleted: 21, issuesCompleted: 6 },
      { weekStart: '2026-01-24', pointsCompleted: 32, issuesCompleted: 9 },
      { weekStart: '2026-01-31', pointsCompleted: 20, issuesCompleted: 5 },
      { weekStart: '2026-02-07', pointsCompleted: 25, issuesCompleted: 7 },
      { weekStart: '2026-02-14', pointsCompleted: 19, issuesCompleted: 6 },
      { weekStart: '2026-02-21', pointsCompleted: 28, issuesCompleted: 8 },
      { weekStart: '2026-02-28', pointsCompleted: 22, issuesCompleted: 6 },
      { weekStart: '2026-03-07', pointsCompleted: 16, issuesCompleted: 4 },
      { weekStart: '2026-03-14', pointsCompleted: 26, issuesCompleted: 7 },
      { weekStart: '2026-03-21', pointsCompleted: 21, issuesCompleted: 6 },
    ],
    pointsPerWeek: [18, 24, 21, 32, 20, 25, 19, 28, 22, 16, 26, 21],
    issuesPerWeek: [5, 7, 6, 9, 5, 7, 6, 8, 6, 4, 7, 6]
  },

  // Sample remaining issues
  remaining: {
    issueCount: 42,
    totalPoints: 85,
    unestimatedCount: 3,
    issues: [
      // In Progress (show first)
      {
        key: 'DEMO-1',
        summary: 'Migrate authentication to OAuth 2.0',
        issueType: 'Story',
        status: 'In Progress',
        statusCategory: 'In Progress',
        storyPoints: 8,
        assignee: 'Alice Johnson',
        created: '2026-03-15'
      },
      {
        key: 'DEMO-2',
        summary: 'Add dark mode support to dashboard',
        issueType: 'Story',
        status: 'In Progress',
        statusCategory: 'In Progress',
        storyPoints: 5,
        assignee: 'Bob Smith',
        created: '2026-03-18'
      },
      // To Do (sorted by points desc)
      {
        key: 'DEMO-3',
        summary: 'Implement API rate limiting',
        issueType: 'Story',
        status: 'To Do',
        statusCategory: 'To Do',
        storyPoints: 13,
        assignee: 'Charlie Davis',
        created: '2026-03-01'
      },
      {
        key: 'DEMO-4',
        summary: 'Build admin analytics dashboard',
        issueType: 'Story',
        status: 'To Do',
        statusCategory: 'To Do',
        storyPoints: 11,
        assignee: 'Diana Chen',
        created: '2026-03-02'
      },
      {
        key: 'DEMO-5',
        summary: 'Database query optimization',
        issueType: 'Task',
        status: 'To Do',
        statusCategory: 'To Do',
        storyPoints: 8,
        assignee: 'Eve Martinez',
        created: '2026-03-05'
      },
      {
        key: 'DEMO-6',
        summary: 'User notification system',
        issueType: 'Story',
        status: 'To Do',
        statusCategory: 'To Do',
        storyPoints: 8,
        assignee: 'Frank Wilson',
        created: '2026-03-06'
      },
      {
        key: 'DEMO-7',
        summary: 'Mobile app performance tuning',
        issueType: 'Story',
        status: 'To Do',
        statusCategory: 'To Do',
        storyPoints: 7,
        assignee: 'Grace Lee',
        created: '2026-03-08'
      },
      {
        key: 'DEMO-8',
        summary: 'Implement webhook support',
        issueType: 'Story',
        status: 'To Do',
        statusCategory: 'To Do',
        storyPoints: 7,
        assignee: 'Henry Brown',
        created: '2026-03-10'
      },
      {
        key: 'DEMO-9',
        summary: 'Add search functionality',
        issueType: 'Story',
        status: 'To Do',
        statusCategory: 'To Do',
        storyPoints: 5,
        assignee: 'Iris Taylor',
        created: '2026-03-12'
      },
      {
        key: 'DEMO-10',
        summary: 'Email notification templates',
        issueType: 'Task',
        status: 'To Do',
        statusCategory: 'To Do',
        storyPoints: 3,
        assignee: 'Jack Anderson',
        created: '2026-03-20'
      },
      {
        key: 'DEMO-11',
        summary: 'Fix validation edge cases',
        issueType: 'Bug',
        status: 'To Do',
        statusCategory: 'To Do',
        storyPoints: 2,
        assignee: 'Kate White',
        created: '2026-03-21'
      },
      {
        key: 'DEMO-12',
        summary: 'Update documentation',
        issueType: 'Task',
        status: 'To Do',
        statusCategory: 'To Do',
        storyPoints: 1,
        assignee: 'Luke Green',
        created: '2026-03-22'
      },
      {
        key: 'DEMO-13',
        summary: 'Caching layer implementation',
        issueType: 'Story',
        status: 'To Do',
        statusCategory: 'To Do',
        storyPoints: null,
        assignee: 'Maya Patel',
        created: '2026-03-23'
      },
      // ... more issues to reach 42 total
      {
        key: 'DEMO-14',
        summary: 'Improve error handling',
        issueType: 'Story',
        status: 'To Do',
        statusCategory: 'To Do',
        storyPoints: 5,
        assignee: 'Noah Rodriguez',
        created: '2026-03-24'
      },
      {
        key: 'DEMO-15',
        summary: 'Add audit logging',
        issueType: 'Story',
        status: 'To Do',
        statusCategory: 'To Do',
        storyPoints: 6,
        assignee: 'Olivia Jackson',
        created: '2026-03-25'
      },
    ]
  },

  // Estimation accuracy data
  estimationAccuracy: {
    sampleSize: 127,
    insufficient: false,
    overallAvgDaysPerPoint: 0.95,
    byPointValue: [
      {
        storyPoints: 1,
        count: 18,
        avgCycleTimeDays: 1.1,
        minCycleTime: 0.5,
        maxCycleTime: 2.3,
        avgDaysPerPoint: 1.1,
        variability: 42,
        issues: [
          { key: 'DEMO-100', summary: 'Fix typo in docs', storyPoints: 1, cycleTimeDays: 1, daysPerPoint: 1.0 },
        ]
      },
      {
        storyPoints: 2,
        count: 24,
        avgCycleTimeDays: 1.9,
        minCycleTime: 1.0,
        maxCycleTime: 3.2,
        avgDaysPerPoint: 0.95,
        variability: 38,
        issues: []
      },
      {
        storyPoints: 3,
        count: 31,
        avgCycleTimeDays: 2.8,
        minCycleTime: 1.5,
        maxCycleTime: 4.5,
        avgDaysPerPoint: 0.93,
        variability: 35,
        issues: []
      },
      {
        storyPoints: 5,
        count: 28,
        avgCycleTimeDays: 4.8,
        minCycleTime: 2.5,
        maxCycleTime: 7.2,
        avgDaysPerPoint: 0.96,
        variability: 40,
        issues: []
      },
      {
        storyPoints: 8,
        count: 15,
        avgCycleTimeDays: 7.5,
        minCycleTime: 4.0,
        maxCycleTime: 10.5,
        avgDaysPerPoint: 0.94,
        variability: 44,
        issues: []
      },
      {
        storyPoints: 13,
        count: 11,
        avgCycleTimeDays: 12.2,
        minCycleTime: 8.0,
        maxCycleTime: 16.5,
        avgDaysPerPoint: 0.94,
        variability: 38,
        issues: []
      },
    ],
    estimationBias: {
      type: 'well_calibrated',
      score: 98,
      message: 'Story point estimates correlate well with actual effort.'
    },
    recommendations: [
      {
        type: 'well_calibrated',
        priority: 'info',
        title: 'Estimates are well calibrated',
        detail: 'Your team averages 0.95 days per story point with good correlation between estimates and actual effort.'
      }
    ],
    issueMetrics: []
  }
};

export function useDemoMode() {
  // Check if demo mode is enabled via URL parameter
  const isDemoMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === 'true';
  
  return {
    isDemoMode,
    data: DEMO_DATA
  };
}
