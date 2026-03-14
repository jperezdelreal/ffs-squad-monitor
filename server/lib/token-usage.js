import { logger } from './logger.js'

const log = logger.child({ component: 'token-usage' })

// Model pricing per 1M tokens (USD)
export const MODEL_PRICING = {
  'gpt-4o':            { input: 2.50,  output: 10.00 },
  'gpt-4o-mini':       { input: 0.15,  output: 0.60  },
  'gpt-4-turbo':       { input: 10.00, output: 30.00 },
  'gpt-4':             { input: 30.00, output: 60.00 },
  'gpt-3.5-turbo':     { input: 0.50,  output: 1.50  },
  'claude-sonnet-4-20250514': { input: 3.00,  output: 15.00 },
  'claude-haiku':      { input: 0.25,  output: 1.25  },
  'claude-3-5-sonnet': { input: 3.00,  output: 15.00 },
  'claude-3-opus':     { input: 15.00, output: 75.00 },
  'copilot':           { input: 0.00,  output: 0.00  },
}

/**
 * Calculate cost in USD for a given token count and model.
 * @param {string} model - Model name (must be a key in MODEL_PRICING)
 * @param {number} inputTokens - Number of input/prompt tokens
 * @param {number} outputTokens - Number of output/completion tokens
 * @returns {{ inputCost: number, outputCost: number, totalCost: number }}
 */
export function calculateCost(model, inputTokens, outputTokens) {
  const pricing = MODEL_PRICING[model]
  if (!pricing) {
    log.warn('Unknown model for cost calculation', { model })
    return { inputCost: 0, outputCost: 0, totalCost: 0 }
  }

  const inputCost = (inputTokens / 1_000_000) * pricing.input
  const outputCost = (outputTokens / 1_000_000) * pricing.output
  return {
    inputCost: Math.round(inputCost * 1_000_000) / 1_000_000,
    outputCost: Math.round(outputCost * 1_000_000) / 1_000_000,
    totalCost: Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000,
  }
}

// Regex patterns for extracting token usage from GitHub Actions logs
const TOKEN_PATTERNS = [
  // Pattern: "Tokens used: 1234 input, 5678 output (model: gpt-4o)"
  /Tokens used:\s*(\d+)\s*input,\s*(\d+)\s*output\s*\(model:\s*([^)]+)\)/gi,
  // Pattern: "prompt_tokens=1234 completion_tokens=5678 model=gpt-4o"
  /prompt_tokens=(\d+)\s+completion_tokens=(\d+)\s+model=(\S+)/gi,
  // Pattern: "usage: {"prompt_tokens": 1234, "completion_tokens": 5678}"
  /"prompt_tokens":\s*(\d+),\s*"completion_tokens":\s*(\d+)/gi,
]

/**
 * Parse GitHub Actions log text and extract token usage entries.
 * @param {string} logText - Raw log output
 * @param {string} [agent] - Agent name (optional)
 * @returns {Array<{ agent: string|null, model: string, inputTokens: number, outputTokens: number }>}
 */
export function parseTokensFromLog(logText, agent = null) {
  if (!logText || typeof logText !== 'string') return []

  const entries = []

  for (const pattern of TOKEN_PATTERNS) {
    pattern.lastIndex = 0
    let match
    while ((match = pattern.exec(logText)) !== null) {
      const inputTokens = parseInt(match[1], 10)
      const outputTokens = parseInt(match[2], 10)
      const model = match[3] || 'unknown'

      if (inputTokens >= 0 && outputTokens >= 0) {
        entries.push({
          agent,
          model: model.trim(),
          inputTokens,
          outputTokens,
        })
      }
    }
  }

  return entries
}

/**
 * Aggregate token usage records by model.
 * @param {Array} records - Array of { model, inputTokens, outputTokens } objects
 * @returns {Object} Aggregated stats keyed by model
 */
export function aggregateByModel(records) {
  const byModel = {}

  for (const record of records) {
    const key = record.model || 'unknown'
    if (!byModel[key]) {
      byModel[key] = { model: key, inputTokens: 0, outputTokens: 0, totalTokens: 0, requests: 0 }
    }
    byModel[key].inputTokens += record.inputTokens || 0
    byModel[key].outputTokens += record.outputTokens || 0
    byModel[key].totalTokens += (record.inputTokens || 0) + (record.outputTokens || 0)
    byModel[key].requests += 1
  }

  // Attach cost to each model bucket
  for (const entry of Object.values(byModel)) {
    const cost = calculateCost(entry.model, entry.inputTokens, entry.outputTokens)
    entry.inputCost = cost.inputCost
    entry.outputCost = cost.outputCost
    entry.totalCost = cost.totalCost
  }

  return byModel
}

/**
 * Aggregate token usage records by agent.
 * @param {Array} records - Array of { agent, model, inputTokens, outputTokens } objects
 * @returns {Object} Aggregated stats keyed by agent
 */
export function aggregateByAgent(records) {
  const byAgent = {}

  for (const record of records) {
    const key = record.agent || 'unknown'
    if (!byAgent[key]) {
      byAgent[key] = { agent: key, inputTokens: 0, outputTokens: 0, totalTokens: 0, requests: 0, totalCost: 0 }
    }
    byAgent[key].inputTokens += record.inputTokens || 0
    byAgent[key].outputTokens += record.outputTokens || 0
    byAgent[key].totalTokens += (record.inputTokens || 0) + (record.outputTokens || 0)
    byAgent[key].requests += 1

    const cost = calculateCost(record.model, record.inputTokens || 0, record.outputTokens || 0)
    byAgent[key].totalCost += cost.totalCost
  }

  // Round accumulated costs
  for (const entry of Object.values(byAgent)) {
    entry.totalCost = Math.round(entry.totalCost * 1_000_000) / 1_000_000
  }

  return byAgent
}
