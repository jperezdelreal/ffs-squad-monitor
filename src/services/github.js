/**
 * GitHub service - All GitHub data now flows through backend API.
 * This module provides convenience wrappers for backend endpoints.
 * Direct GitHub API calls have been removed to enable:
 * - Centralized rate limiting and auth token management
 * - Response caching (60s TTL on backend)
 * - Unified error handling
 */

export async function fetchRepoEvents(owner, repo, limit = 10) {
  try {
    const response = await fetch('/api/events?owner=' + owner + '&repo=' + repo + '&limit=' + limit);
    
    if (!response.ok) {
      console.warn('Failed to fetch events for ' + owner + '/' + repo);
      return [];
    }
    
    const events = await response.json();
    return events;
  } catch (error) {
    console.error('Error fetching events for ' + owner + '/' + repo + ':', error);
    return [];
  }
}

export async function fetchAllRepoEvents() {
  try {
    const response = await fetch('/api/events');
    if (!response.ok) {
      console.warn('Failed to fetch all repo events');
      return [];
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching all repo events:', error);
    return [];
  }
}

export async function fetchRepoIssues(owner, repo) {
  try {
    const response = await fetch('/api/issues?owner=' + owner + '&repo=' + repo + '&state=all');
    
    if (!response.ok) {
      console.warn('Failed to fetch issues for ' + owner + '/' + repo);
      return [];
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching issues for ' + owner + '/' + repo + ':', error);
    return [];
  }
}

export async function fetchAllRepoIssues() {
  try {
    const response = await fetch('/api/issues?state=all');
    if (!response.ok) {
      console.warn('Failed to fetch all repo issues');
      return [];
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching all repo issues:', error);
    return [];
  }
}

export async function fetchWorkflowRuns(owner, repo) {
  try {
    const response = await fetch('/api/workflows?owner=' + owner + '&repo=' + repo);
    
    if (!response.ok) {
      console.warn('Failed to fetch workflow runs for ' + owner + '/' + repo);
      return [];
    }
    
    const data = await response.json();
    return data.workflow_runs || data;
  } catch (error) {
    console.error('Error fetching workflow runs for ' + owner + '/' + repo + ':', error);
    return [];
  }
}

export function getRepoColor(repoName) {
  // This function remains client-side only as it reads from cached config
  const config = window.__FFS_CONFIG__;
  if (!config?.repos) return '#6b7280';
  const repo = config.repos.find(r => repoName.includes(r.id || r.name));
  return repo?.color || '#6b7280';
}
