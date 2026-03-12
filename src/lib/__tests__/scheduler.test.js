import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Scheduler } from '../scheduler.js';

describe('Scheduler', () => {
  let scheduler;

  beforeEach(() => {
    vi.useFakeTimers();
    scheduler = new Scheduler();
  });

  afterEach(() => {
    // Clean up all intervals
    scheduler.pause();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('register', () => {
    it('registers a task with id, function, and interval', () => {
      const fn = vi.fn();
      scheduler.register('test-task', fn, 1000);
      
      expect(scheduler.getInterval('test-task')).toBe(1000);
    });

    it('allows multiple tasks with different ids', () => {
      const fn1 = vi.fn();
      const fn2 = vi.fn();
      scheduler.register('task1', fn1, 1000);
      scheduler.register('task2', fn2, 2000);

      expect(scheduler.getInterval('task1')).toBe(1000);
      expect(scheduler.getInterval('task2')).toBe(2000);
    });
  });

  describe('startAll', () => {
    it('calls each task function immediately', () => {
      const fn = vi.fn();
      scheduler.register('task', fn, 1000);

      scheduler.startAll();

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('sets up intervals for tasks', () => {
      const fn = vi.fn();
      scheduler.register('task', fn, 1000);
      scheduler.startAll();

      expect(fn).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(1000);
      expect(fn).toHaveBeenCalledTimes(2);

      vi.advanceTimersByTime(1000);
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('respects different intervals', () => {
      const fn1 = vi.fn();
      const fn2 = vi.fn();
      scheduler.register('task1', fn1, 1000);
      scheduler.register('task2', fn2, 2000);
      scheduler.startAll();

      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(1000);
      expect(fn1).toHaveBeenCalledTimes(2);
      expect(fn2).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(1000);
      expect(fn1).toHaveBeenCalledTimes(3);
      expect(fn2).toHaveBeenCalledTimes(2);
    });
  });

  describe('pause', () => {
    it('stops all running intervals', () => {
      const fn = vi.fn();
      scheduler.register('task', fn, 1000);
      scheduler.startAll();

      expect(fn).toHaveBeenCalledTimes(1);

      scheduler.pause();
      vi.advanceTimersByTime(5000);

      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('resume', () => {
    it('restarts all tasks', () => {
      const fn = vi.fn();
      scheduler.register('task', fn, 1000);
      scheduler.startAll();

      expect(fn).toHaveBeenCalledTimes(1);

      scheduler.pause();
      scheduler.resume();

      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('setInterval', () => {
    it('updates interval for a task', () => {
      const fn = vi.fn();
      scheduler.register('task', fn, 1000);

      scheduler.setInterval('task', 2000);

      expect(scheduler.getInterval('task')).toBe(2000);
    });

    it('restarts running task with new interval', () => {
      const fn = vi.fn();
      scheduler.register('task', fn, 1000);
      scheduler.startAll();

      expect(fn).toHaveBeenCalledTimes(1);

      scheduler.setInterval('task', 500);
      expect(fn).toHaveBeenCalledTimes(2);

      vi.advanceTimersByTime(500);
      expect(fn).toHaveBeenCalledTimes(3);
    });
  });

  describe('getInterval', () => {
    it('returns null for non-existent task', () => {
      expect(scheduler.getInterval('nonexistent')).toBe(null);
    });

    it('returns interval for registered task', () => {
      const fn = vi.fn();
      scheduler.register('task', fn, 5000);

      expect(scheduler.getInterval('task')).toBe(5000);
    });
  });
});
