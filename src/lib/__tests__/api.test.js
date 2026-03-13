import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
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

      expect(mockFetch).toHaveBeenCalledWith('/api/heartbeat', expect.any(Object));
      expect(result).toEqual({ status: 'ok', timestamp: 123 });
    });

    it('returns error object on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await fetchHeartbeat();

      expect(result).toEqual({ error: true, message: 'Network error' });
    });

    it('returns error object on HTTP error status', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await fetchHeartbeat();

      expect(result).toEqual({ error: true, message: 'HTTP 500' });
    });

    it('returns data on success', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'ok' }),
      });

      const result = await fetchHeartbeat();

      expect(result).not.toHaveProperty('error');
      expect(result).toEqual({ status: 'ok' });
    });

    it('handles errors correctly', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'ok' }),
      });
      await fetchHeartbeat();

      mockFetch.mockRejectedValue(new Error('Network error'));
      const result = await fetchHeartbeat();

      expect(result).toHaveProperty('error', true);
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

      expect(mockFetch).toHaveBeenCalledWith('/api/logs', expect.any(Object));
      expect(result).toEqual(logs);
    });

    it('returns error object on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await fetchLogs();

      expect(result).toEqual({ error: true, message: 'Network error' });
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

      expect(mockFetch).toHaveBeenCalledWith('/api/timeline', expect.any(Object));
      expect(result).toEqual(timeline);
    });

    it('returns error object on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await fetchTimeline();

      expect(result).toEqual({ error: true, message: 'Network error' });
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

      expect(mockFetch).toHaveBeenCalledWith('/api/repos', expect.any(Object));
      expect(result).toEqual(repos);
    });

    it('returns error object on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await fetchRepos();

      expect(result).toEqual({ error: true, message: 'Network error' });
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

      expect(mockFetch).toHaveBeenCalledWith('/api/agents', expect.any(Object));
      expect(result).toEqual(agents);
    });

    it('returns error object on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await fetchAgents();

      expect(result).toEqual({ error: true, message: 'Network error' });
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

      expect(mockFetch).toHaveBeenCalledWith('/api/issues', expect.any(Object));
      expect(result).toEqual(issues);
    });

    it('returns error object on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await fetchIssues();

      expect(result).toEqual({ error: true, message: 'Network error' });
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

      expect(mockFetch).toHaveBeenCalledWith('/api/pulse', expect.any(Object));
      expect(result).toEqual(pulse);
    });

    it('returns error object on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await fetchPulse();

      expect(result).toEqual({ error: true, message: 'Network error' });
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

      expect(result).toEqual({ error: true, message: 'HTTP 404' });
    });

    it('handles 500 errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await fetchAgents();

      expect(result).toEqual({ error: true, message: 'HTTP 500' });
    });

    it('handles network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Failed to fetch'));

      const result = await fetchRepos();

      expect(result).toEqual({ error: true, message: 'Failed to fetch' });
    });
  });
});
