/**
 * Configurable polling scheduler.
 * Supports changing intervals at runtime and pause/resume.
 */

export class Scheduler {
  /** @type {Map<string, { fn: Function, interval: number, timerId: number|null }>} */
  #tasks = new Map();
  #paused = false;

  /**
   * Register a polling task.
   * @param {string} id - Unique task name
   * @param {Function} fn - Async function to call
   * @param {number} interval - Milliseconds between calls
   */
  register(id, fn, interval) {
    this.#tasks.set(id, { fn, interval, timerId: null });
  }

  /** Start all registered tasks (runs each immediately, then on interval). */
  startAll() {
    this.#paused = false;
    for (const [id, task] of this.#tasks) {
      this.#startTask(id, task);
    }
  }

  /** Pause all polling. */
  pause() {
    this.#paused = true;
    for (const task of this.#tasks.values()) {
      if (task.timerId !== null) {
        clearInterval(task.timerId);
        task.timerId = null;
      }
    }
  }

  /** Resume polling. */
  resume() {
    this.startAll();
  }

  /** Update the interval for a specific task. */
  setInterval(id, interval) {
    const task = this.#tasks.get(id);
    if (!task) return;
    task.interval = interval;
    if (!this.#paused && task.timerId !== null) {
      clearInterval(task.timerId);
      this.#startTask(id, task);
    }
  }

  /** Get current interval for a task. */
  getInterval(id) {
    return this.#tasks.get(id)?.interval ?? null;
  }

  #startTask(id, task) {
    task.fn();
    task.timerId = setInterval(task.fn, task.interval);
  }
}
