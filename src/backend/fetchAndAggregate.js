import api, { route } from '@forge/api';
import duckdb from 'duckdb';

/**
 * Fetch Jira issues and compute baseline aggregations
 * 
 * @param {Object} req - Forge request object
 * @param {string} req.payload.scopeType - 'project' | 'epic' | 'jql'
 * @param {Object} req.payload.scopeParams - { projectKey, epicKey, jql }
 * @returns {Object} { snapshotId, throughput, remaining, issues }
 */
export async function handler(req) {
  const startTime = Date.now();
  console.log('=== FETCH AND AGGREGATE STARTED ===');
  console.log('Request:', JSON.stringify(req, null, 2));
  console.log('Payload:', JSON.stringify(req.payload, null, 2));
  
  try {
    const { scopeType, scopeParams } = req.payload;
    
    // 1. Build JQL query from scope
    const jql = buildJQL(scopeType, scopeParams);
    console.log('JQL query:', jql);
    
    // 2. Fetch issues from Jira API (with pagination)
    const issues = await fetchAllIssues(jql);
    console.log(`Fetched ${issues.length} issues`);
    
    // 3. Initialize DuckDB in-memory
    const db = new duckdb.Database(':memory:');
    const conn = db.connect();
    
    // 4. Create issues table
    conn.exec(`
      CREATE TABLE issues (
        key VARCHAR PRIMARY KEY,
        summary VARCHAR,
        issue_type VARCHAR,
        status VARCHAR,
        status_category VARCHAR,
        
        project_key VARCHAR,
        epic_key VARCHAR,
        parent_key VARCHAR,
        
        story_points DOUBLE,
        original_estimate_seconds INTEGER,
        
        created TIMESTAMP,
        updated TIMESTAMP,
        resolved TIMESTAMP,
        
        assignee VARCHAR,
        team VARCHAR
      )
    `);
    
    // 5. Insert issues (batch insert for performance)
    const stmt = conn.prepare(`
      INSERT INTO issues VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    for (const issue of issues) {
      stmt.run(
        issue.key,
        issue.summary,
        issue.issueType,
        issue.status,
        issue.statusCategory,
        issue.projectKey,
        issue.epicKey,
        issue.parentKey,
        issue.storyPoints,
        issue.originalEstimateSeconds,
        issue.created,
        issue.updated,
        issue.resolved,
        issue.assignee,
        issue.team
      );
    }
    stmt.finalize();
    
    console.log('Issues loaded into DuckDB');
    
    // 6. Compute historical throughput (last 26 weeks)
    const throughputQuery = `
      SELECT 
        DATE_TRUNC('week', resolved) as week_start,
        team,
        SUM(story_points) as points_completed,
        COUNT(*) as issues_completed
      FROM issues
      WHERE status_category = 'Done'
        AND resolved >= CURRENT_DATE - INTERVAL '26 weeks'
        AND story_points IS NOT NULL
      GROUP BY 1, 2
      ORDER BY 1
    `;
    
    const throughput = conn.all(throughputQuery);
    console.log(`Computed throughput: ${throughput.length} weeks`);
    
    // 7. Compute remaining work
    const remainingQuery = `
      SELECT 
        COUNT(*) as issue_count,
        SUM(COALESCE(story_points, 0)) as total_points,
        SUM(CASE WHEN story_points IS NULL THEN 1 ELSE 0 END) as unestimated_count
      FROM issues
      WHERE status_category IN ('To Do', 'In Progress')
    `;
    
    const remaining = conn.get(remainingQuery);
    console.log('Remaining work:', remaining);
    
    // 8. Get team summary
    const teamSummary = conn.all(`
      SELECT 
        team,
        COUNT(*) as issue_count,
        SUM(COALESCE(story_points, 0)) as total_points
      FROM issues
      WHERE status_category IN ('To Do', 'In Progress')
      GROUP BY team
      ORDER BY total_points DESC
    `);
    
    // 9. Close connection
    conn.close();
    db.close();
    
    // 10. Generate snapshot ID (hash of issue keys)
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
      executionTime: elapsed,
      // Don't return full issues to save payload size
      // Frontend can request specific issues if needed
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
 * Fetch all issues from Jira API with pagination
 */
async function fetchAllIssues(jql) {
  const allIssues = [];
  let startAt = 0;
  const maxResults = 100;
  let total = 0;
  
  do {
    const response = await api.asApp().requestJira(route`/rest/api/3/search`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        jql,
        startAt,
        maxResults,
        fields: [
          'summary',
          'issuetype',
          'status',
          'project',
          'parent',
          'customfield_10014', // Epic Link (may vary)
          'customfield_10016', // Story Points (may vary)
          'timeoriginalestimate',
          'created',
          'updated',
          'resolutiondate',
          'assignee'
        ]
      })
    });
    
    if (!response.ok) {
      throw new Error(`Jira API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    total = data.total;
    
    // Transform Jira issues to our schema
    const issues = data.issues.map(transformIssue);
    allIssues.push(...issues);
    
    startAt += maxResults;
    console.log(`Fetched ${allIssues.length} of ${total} issues`);
    
  } while (startAt < total && allIssues.length < 5000); // Safety limit
  
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
