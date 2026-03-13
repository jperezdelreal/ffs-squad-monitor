import { fetchConfig, getConfigSync } from './config.js'

const GITHUB_API = 'https://api.github.com';

export async function fetchRepoEvents(owner, repo, limit = 10) {
  try {
    const response = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/events?per_page=${limit}`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
      },
    });
    
    if (!response.ok) {
      console.warn(`Failed to fetch events for ${owner}/${repo}`);
      return [];
    }
    
    const events = await response.json();
    return events.map(event => ({
      id: event.id,
      type: event.type,
      repo: `${owner}/${repo}`,
      actor: event.actor.login,
      createdAt: event.created_at,
      payload: event.payload,
    }));
  } catch (error) {
    console.error(`Error fetching events for ${owner}/${repo}:`, error);
    return [];
  }
}

export async function fetchAllRepoEvents() {
  const { repos } = await fetchConfig();
  const promises = repos.map(repo => fetchRepoEvents(repo.owner, repo.name, 10));
  const results = await Promise.all(promises);
  
  const allEvents = results.flat().sort((a, b) => 
    new Date(b.createdAt) - new Date(a.createdAt)
  );
  
  return allEvents.slice(0, 50);
}

export async function fetchRepoIssues(owner, repo) {
  try {
    const response = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/issues?state=all&per_page=100`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
      },
    });
    
    if (!response.ok) {
      console.warn(`Failed to fetch issues for ${owner}/${repo}`);
      return [];
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Error fetching issues for ${owner}/${repo}:`, error);
    return [];
  }
}

export async function fetchAllRepoIssues() {
  const { repos } = await fetchConfig();
  const promises = repos.map(repo => 
    fetchRepoIssues(repo.owner, repo.name).then(issues => ({
      repo: `${repo.owner}/${repo.name}`,
      issues,
    }))
  );
  
  return await Promise.all(promises);
}

export async function fetchWorkflowRuns(owner, repo) {
  try {
    const response = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/actions/runs?per_page=30`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
      },
    });
    
    if (!response.ok) {
      console.warn(`Failed to fetch workflow runs for ${owner}/${repo}`);
      return [];
    }
    
    const data = await response.json();
    return data.workflow_runs || [];
  } catch (error) {
    console.error(`Error fetching workflow runs for ${owner}/${repo}:`, error);
    return [];
  }
}

export function getRepoColor(repoName) {
  const config = getConfigSync();
  const repos = config?.repos || [];
  const repo = repos.find(r => repoName.includes(r.name));
  return repo?.color || '#6b7280';
}

