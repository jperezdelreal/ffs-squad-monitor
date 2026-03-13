import { describe, it, expect } from 'vitest'
import { getAgentWorkload } from '../mockData.js'

describe('mockData service', () => {
  describe('getAgentWorkload', () => {
    it('should return an empty array', () => {
      expect(getAgentWorkload()).toEqual([])
    })
  })
})
