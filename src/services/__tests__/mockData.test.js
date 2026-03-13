import { describe, it, expect } from 'vitest'
import { getAgentWorkload, getCostHistory, getCIMinutesUsage } from '../mockData.js'

describe('mockData service', () => {
  describe('getAgentWorkload', () => {
    it('should return an empty array', () => {
      expect(getAgentWorkload()).toEqual([])
    })
  })

  describe('getCostHistory', () => {
    it('should return 30 days of cost data', () => {
      const result = getCostHistory()
      expect(result).toHaveLength(30)
    })

    it('should include date, actual, and budget fields', () => {
      const result = getCostHistory()
      for (const day of result) {
        expect(day).toHaveProperty('date')
        expect(day).toHaveProperty('actual', 0)
        expect(day).toHaveProperty('budget')
        expect(typeof day.budget).toBe('number')
      }
    })

    it('should have dates in YYYY-MM-DD format', () => {
      const result = getCostHistory()
      for (const day of result) {
        expect(day.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      }
    })
  })

  describe('getCIMinutesUsage', () => {
    it('should return usage object with used, total, and percentage', () => {
      const result = getCIMinutesUsage()
      expect(result).toEqual({
        used: 420,
        total: 2000,
        percentage: 21,
      })
    })
  })
})
