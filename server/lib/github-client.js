import { config } from '../config.js'
import { logger } from './logger.js'

const GITHUB_API = 'https://api.github.com'
const RATE_LIMIT_WARNING_THRESHOLD = 100

// Track rate limit state across requests
const rateLimit = {
  remaining: null,
  limit: null,
  reset: null,
  lastChecked: null,
}

export function getRateLimitStatus() {
  return { ...rateLimit }
}

function parseRateLimitHeaders(headers) {
  const remaining = headers.get('x-ratelimit-remaining')
  const limit = headers.get('x-ratelimit-limit')
  const reset = headers.get('x-ratelimit-reset')

  if (remaining !== null) rateLimit.remaining = parseInt(remaining, 10)
  if (limit !== null) rateLimit.limit = parseInt(limit, 10)
  if (reset !== null) rateLimit.reset = parseInt(reset, 10)
  rateLimit.lastChecked = new Date().toISOString()

  if (rateLimit.remaining !== null && rateLimit.remaining < RATE_LIMIT_WARNING_THRESHOLD) {
    const resetDate = rateLimit.reset ? new Date(rateLimit.reset * 1000).toISOString() : 'unknown'
    logger.warn('GitHub API rate limit low', {
      remaining: rateLimit.remaining,
      limit: rateLimit.limit,
      resetsAt: resetDate,
    })
  }
}

function isRateLimited(response) {
  if (response.status !== 403) return false
  const remaining = response.headers.get('x-ratelimit-remaining')
  if (remaining !== null && parseInt(remaining, 10) === 0) return true
  // GitHub may also include a rate limit message in the body
  return false
}

/**
 * Make an authenticated request to the GitHub API.
 * Returns { data, response } on success.
 * Throws GitHubApiError on failure.
 */
export async function githubFetch(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${GITHUB_API}${endpoint}`

  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    ...options.headers,
  }

  if (config.githubToken) {
    headers['Authorization'] = `Bearer ${config.githubToken}`
  }

  const response = await fetch(url, {
    ...options,
    headers,
    signal: options.signal || AbortSignal.timeout(15000),
  })

  parseRateLimitHeaders(response.headers)

  if (isRateLimited(response)) {
    const retryAfter = rateLimit.reset
      ? Math.max(0, rateLimit.reset - Math.floor(Date.now() / 1000))
      : 60
    const error = new GitHubApiError('GitHub API rate limit exceeded', 403, retryAfter)
    throw error
  }

  if (!response.ok) {
    throw new GitHubApiError(
      `GitHub API error: ${response.status} ${response.statusText}`,
      response.status
    )
  }

  const data = await response.json()
  return { data, response }
}

export class GitHubApiError extends Error {
  constructor(message, status, retryAfter = null) {
    super(message)
    this.name = 'GitHubApiError'
    this.status = status
    this.retryAfter = retryAfter
  }
}

/**
 * Express middleware helper: catches GitHubApiError and returns proper 503.
 * Wrap route handlers that use githubFetch with this.
 */
export function handleGitHubError(res, error) {
  if (error instanceof GitHubApiError && error.status === 403 && error.retryAfter !== null) {
    res.set('Retry-After', String(error.retryAfter))
    res.status(503).json({
      error: 'GitHub API rate limit exceeded',
      retryAfter: error.retryAfter,
    })
    return true
  }
  return false
}
