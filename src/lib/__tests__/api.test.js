import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isConnected,
  onConnectionChange,
  fetchHeartbeat,
  fetchLogs,
  fetchTimeline,
  fetchRepos,
  fetchAgents,
  fetchIssues,
  fetchPulse,
} from '../api.js';

describe('api', () => {
  let mockFetch;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchHeartbeat', () => {
    it('fetches from /api/heartbeat', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'ok', timestamp: 123 }),
      });

      const result = await fetchHeartbeat();

      expect(mockFetch).toHaveBeenCalledWith('/api/heartbeat');
      expect(result).toEqual({ status: 'ok', timestamp: 123 });
    });

    it('returns null on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await fetchHeartbeat();

      expect(result).toBe(null);
    });

    it('returns null on HTTP error status', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await fetchHeartbeat();

      expect(result).toBe(null);
    });

    it('sets connected state on success', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'ok' }),
      });

      await fetchHeartbeat();

      expect(isConnected()).toBe(true);
    });

    it('sets disconnected on failure', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'ok' }),
      });
      await fetchHeartbeat();

      mockFetch.mockRejectedValue(new Error('Network error'));
      await fetchHeartbeat();

      expect(isConnected()).toBe(false);
    });
  });

  describe('fetchLogs', () => {
    it('fetches from /api/logs', async () => {
      const logs = [{ id: 1, message: 'test' }];
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => logs,
      });

      const result = await fetchLogs();

      expect(mockFetch).toHaveBeenCalledWith('/api/logs');
      expect(result).toEqual(logs);
    });

    it('returns null on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await fetchLogs();

      expect(result).toBe(null);
    });
  });

  describe('fetchTimeline', () => {
    it('fetches from /api/timeline', async () => {
      const timeline = [{ id: 1, event: 'start' }];
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => timeline,
      });

      const result = await fetchTimeline();

      expect(mockFetch).toHaveBeenCalledWith('/api/timeline');
      expect(result).toEqual(timeline);
    });

    it('returns null on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await fetchTimeline();

      expect(result).toBe(null);
    });
  });

  describe('fetchRepos', () => {
    it('fetches from /api/repos', async () => {
      const repos = [{ name: 'repo1', url: 'https://github.com/test/repo1' }];
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => repos,
      });

      const result = await fetchRepos();

      expect(mockFetch).toHaveBeenCalledWith('/api/repos');
      expect(result).toEqual(repos);
    });

    it('returns null on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await fetchRepos();

      expect(result).toBe(null);
    });
  });

  describe('fetchAgents', () => {
    it('fetches from /api/agents', async () => {
      const agents = [{ id: 'agent1', name: 'Agent 1' }];
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => agents,
      });

      const result = await fetchAgents();

      expect(mockFetch).toHaveBeenCalledWith('/api/agents');
      expect(result).toEqual(agents);
    });

    it('returns null on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await fetchAgents();

      expect(result).toBe(null);
    });
  });

  describe('fetchIssues', () => {
    it('fetches from /api/issues', async () => {
      const issues = [{ id: 1, title: 'Bug fix' }];
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => issues,
      });

      const result = await fetchIssues();

      expect(mockFetch).toHaveBeenCalledWith('/api/issues');
      expect(result).toEqual(issues);
    });

    it('returns null on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await fetchIssues();

      expect(result).toBe(null);
    });
  });

  describe('fetchPulse', () => {
    it('fetches from /api/pulse', async () => {
      const pulse = { active: 5, idle: 2 };
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => pulse,
      });

      const result = await fetchPulse();

      expect(mockFetch).toHaveBeenCalledWith('/api/pulse');
      expect(result).toEqual(pulse);
    });

    it('returns null on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await fetchPulse();

      expect(result).toBe(null);
    });
  });

  describe('connection listeners', () => {
    it('removes listener when unsubscribe is called', async () => {
      const listener = vi.fn();
      const unsubscribe = onConnectionChange(listener);

      unsubscribe();

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'ok' }),
      });

      await fetchHeartbeat();

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('HTTP error handling', () => {
    it('handles 404 errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await fetchLogs();

      expect(result).toBe(null);
    });

    it('handles 500 errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await fetchAgents();

      expect(result).toBe(null);
    });

    it('handles network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Failed to fetch'));

      const result = await fetchRepos();

      expect(result).toBe(null);
    });
  });
});
