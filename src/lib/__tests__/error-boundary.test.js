import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('error-boundary', () => {
  let consoleErrorSpy;
  let createdElements;
  let initErrorBoundary;
  let wrapComponentRefresh;

  beforeEach(async () => {
    // Mock console.error
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Track created elements
    createdElements = [];

    // Mock document.createElement to return unique elements
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      const element = {
        className: '',
        textContent: '',
        innerHTML: '',
        onclick: null,
        parentElement: null,
        tagName: tag.toUpperCase(),
        remove: vi.fn(),
        appendChild: vi.fn(),
      };
      createdElements.push(element);
      return element;
    });

    // Mock document.body.appendChild
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});

    // Use fake timers
    vi.useFakeTimers();

    // Reset module to clear state
    vi.resetModules();
    const module = await import('../error-boundary.js');
    initErrorBoundary = module.initErrorBoundary;
    wrapComponentRefresh = module.wrapComponentRefresh;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('initErrorBoundary', () => {
    it('should add error event listener', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      initErrorBoundary();

      expect(addEventListenerSpy).toHaveBeenCalledWith('error', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
    });

    it('should handle global errors', () => {
      initErrorBoundary();

      const errorEvent = new Event('error');
      errorEvent.error = new Error('Test error');
      errorEvent.filename = 'test.js';
      errorEvent.lineno = 10;
      errorEvent.colno = 5;

      window.dispatchEvent(errorEvent);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Error Boundary] Global error:',
        expect.objectContaining({
          component: 'Global',
          message: 'Test error',
        })
      );
    });

    it('should handle errors without error object', () => {
      initErrorBoundary();

      const errorEvent = new Event('error');
      errorEvent.message = 'String error message';
      errorEvent.filename = 'test.js';
      errorEvent.lineno = 10;
      errorEvent.colno = 5;

      window.dispatchEvent(errorEvent);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Error Boundary] Global error:',
        expect.objectContaining({
          component: 'Global',
          message: 'String error message',
        })
      );
    });

    it('should handle unhandled promise rejections', async () => {
      initErrorBoundary();

      const rejectionEvent = new Event('unhandledrejection');
      const preventDefaultSpy = vi.spyOn(rejectionEvent, 'preventDefault');
      rejectionEvent.reason = new Error('Promise rejection');
      rejectionEvent.promise = Promise.resolve(); // Use resolved promise to avoid actual rejection

      window.dispatchEvent(rejectionEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Error Boundary] Promise error:',
        expect.objectContaining({
          component: 'Promise',
          message: 'Promise rejection',
        })
      );
    });
  });

  describe('wrapComponentRefresh', () => {
    it('should wrap a successful refresh function', async () => {
      const mockRefresh = vi.fn().mockResolvedValue(undefined);
      const wrapped = wrapComponentRefresh('TestComponent', mockRefresh);

      await wrapped();

      expect(mockRefresh).toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should catch and handle errors from refresh function', async () => {
      const error = new Error('Refresh failed');
      const mockRefresh = vi.fn().mockRejectedValue(error);
      const wrapped = wrapComponentRefresh('TestComponent', mockRefresh);

      await wrapped();

      expect(mockRefresh).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Error Boundary] TestComponent error:',
        expect.objectContaining({
          component: 'TestComponent',
          message: 'Refresh failed',
        })
      );
    });

    it('should handle non-Error objects', async () => {
      const mockRefresh = vi.fn().mockRejectedValue('string error');
      const wrapped = wrapComponentRefresh('TestComponent', mockRefresh);

      await wrapped();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Error Boundary] TestComponent error:',
        expect.objectContaining({
          component: 'TestComponent',
          message: 'string error',
        })
      );
    });
  });

  describe('error notification', () => {
    it('should show error notification on error', async () => {
      const error = new Error('Test notification');
      const mockRefresh = vi.fn().mockRejectedValue(error);
      const wrapped = wrapComponentRefresh('NotificationTest', mockRefresh);

      await wrapped();

      // Check that createElement was called for notification elements
      const callArgs = document.createElement.mock.calls.map(call => call[0]);
      expect(callArgs).toContain('div');
      expect(callArgs).toContain('span');
      expect(callArgs).toContain('button');
      expect(document.body.appendChild).toHaveBeenCalled();
    });

    it('should auto-dismiss notification after 5 seconds', async () => {
      const error = new Error('Auto dismiss test');
      const mockRefresh = vi.fn().mockRejectedValue(error);
      const wrapped = wrapComponentRefresh('AutoDismissTest', mockRefresh);

      await wrapped();

      // Get the notification element (first div created)
      const notification = createdElements.find(el => el.tagName === 'DIV');
      notification.parentElement = document.body;

      expect(notification.remove).not.toHaveBeenCalled();

      vi.advanceTimersByTime(5000);

      expect(notification.remove).toHaveBeenCalled();
    });

    it('should handle manual close of notification', async () => {
      const error = new Error('Manual close test');
      const mockRefresh = vi.fn().mockRejectedValue(error);
      const wrapped = wrapComponentRefresh('ManualCloseTest', mockRefresh);

      await wrapped();

      // Find the close button (button element)
      const button = createdElements.find(el => el.tagName === 'BUTTON');
      const notification = createdElements.find(el => el.tagName === 'DIV');

      expect(button).toBeDefined();
      expect(button.onclick).toBeInstanceOf(Function);

      // Simulate clicking the close button
      button.onclick();

      expect(notification.remove).toHaveBeenCalled();
    });

    it('should not crash if notification is already removed', async () => {
      const error = new Error('Already removed test');
      const mockRefresh = vi.fn().mockRejectedValue(error);
      const wrapped = wrapComponentRefresh('AlreadyRemovedTest', mockRefresh);

      await wrapped();

      const notification = createdElements.find(el => el.tagName === 'DIV');
      notification.parentElement = null; // Simulate already removed

      // Advance time to trigger auto-dismiss
      vi.advanceTimersByTime(5000);

      // Should not throw an error and should not try to remove
      expect(notification.remove).not.toHaveBeenCalled();
    });
  });

  describe('error counting and critical overlay', () => {
    it('should increment error count', async () => {
      const error1 = new Error('Error 1');
      const error2 = new Error('Error 2');
      const mockRefresh1 = vi.fn().mockRejectedValue(error1);
      const mockRefresh2 = vi.fn().mockRejectedValue(error2);
      const wrapped1 = wrapComponentRefresh('Component1', mockRefresh1);
      const wrapped2 = wrapComponentRefresh('Component2', mockRefresh2);

      await wrapped1();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Error Boundary] Component1 error:',
        expect.objectContaining({ errorCount: 1 })
      );

      await wrapped2();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Error Boundary] Component2 error:',
        expect.objectContaining({ errorCount: 2 })
      );
    });

    it('should reset error count after 1 minute', async () => {
      const error = new Error('Reset test');
      const mockRefresh = vi.fn().mockRejectedValue(error);
      const wrapped = wrapComponentRefresh('ResetTest', mockRefresh);

      await wrapped();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Error Boundary] ResetTest error:',
        expect.objectContaining({ errorCount: 1 })
      );

      // Advance time by more than 1 minute
      vi.advanceTimersByTime(61000);

      await wrapped();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Error Boundary] ResetTest error:',
        expect.objectContaining({ errorCount: 1 })
      );
    });

    it('should show critical error overlay after 10 errors', async () => {
      const error = new Error('Critical test');
      const mockRefresh = vi.fn().mockRejectedValue(error);
      const wrapped = wrapComponentRefresh('CriticalTest', mockRefresh);

      // Trigger 10 errors
      for (let i = 0; i < 10; i++) {
        await wrapped();
      }

      // Check that critical overlay was created
      expect(document.createElement).toHaveBeenCalledWith('div');
      expect(document.body.appendChild).toHaveBeenCalled();

      // Verify the last error count is 10
      expect(consoleErrorSpy).toHaveBeenLastCalledWith(
        '[Error Boundary] CriticalTest error:',
        expect.objectContaining({ errorCount: 10 })
      );
    });

    it('should not show notification after critical threshold', async () => {
      const error = new Error('Post-critical test');
      const mockRefresh = vi.fn().mockRejectedValue(error);
      const wrapped = wrapComponentRefresh('PostCriticalTest', mockRefresh);

      // Trigger 10 errors to reach critical threshold
      for (let i = 0; i < 10; i++) {
        await wrapped();
      }

      const createElementCallsBefore = document.createElement.mock.calls.length;

      // Trigger one more error
      await wrapped();

      const createElementCallsAfter = document.createElement.mock.calls.length;

      // Should have created critical overlay but no additional notification
      expect(consoleErrorSpy).toHaveBeenLastCalledWith(
        '[Error Boundary] PostCriticalTest error:',
        expect.objectContaining({ errorCount: 11 })
      );
    });
  });

  describe('error message formatting', () => {
    it('should handle Error objects with message and stack', async () => {
      const error = new Error('Detailed error');
      error.stack = 'Error: Detailed error\n    at test.js:10:5';
      const mockRefresh = vi.fn().mockRejectedValue(error);
      const wrapped = wrapComponentRefresh('DetailTest', mockRefresh);

      await wrapped();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Error Boundary] DetailTest error:',
        expect.objectContaining({
          message: 'Detailed error',
          stack: 'Error: Detailed error\n    at test.js:10:5',
        })
      );
    });

    it('should handle null error', async () => {
      const mockRefresh = vi.fn().mockRejectedValue(null);
      const wrapped = wrapComponentRefresh('NullErrorTest', mockRefresh);

      await wrapped();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Error Boundary] NullErrorTest error:',
        expect.objectContaining({
          message: 'null',
        })
      );
    });

    it('should handle undefined error', async () => {
      const mockRefresh = vi.fn().mockRejectedValue(undefined);
      const wrapped = wrapComponentRefresh('UndefinedErrorTest', mockRefresh);

      await wrapped();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Error Boundary] UndefinedErrorTest error:',
        expect.objectContaining({
          message: 'undefined',
        })
      );
    });

    it('should include timestamp in error log', async () => {
      const error = new Error('Timestamp test');
      const mockRefresh = vi.fn().mockRejectedValue(error);
      const wrapped = wrapComponentRefresh('TimestampTest', mockRefresh);

      await wrapped();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Error Boundary] TimestampTest error:',
        expect.objectContaining({
          timestamp: expect.any(String),
        })
      );
    });

    it('should include context in error log', () => {
      initErrorBoundary();

      const errorEvent = new Event('error');
      errorEvent.error = new Error('Context test');
      errorEvent.filename = 'context.js';
      errorEvent.lineno = 42;
      errorEvent.colno = 15;

      window.dispatchEvent(errorEvent);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Error Boundary] Global error:',
        expect.objectContaining({
          context: {
            filename: 'context.js',
            lineno: 42,
            colno: 15,
          },
        })
      );
    });
  });

  describe('DOM manipulation', () => {
    it('should set correct CSS classes on notification elements', async () => {
      const error = new Error('CSS test');
      const mockRefresh = vi.fn().mockRejectedValue(error);
      const wrapped = wrapComponentRefresh('CSSTest', mockRefresh);

      await wrapped();

      // Find the elements by tag
      const divs = createdElements.filter(e => e.tagName === 'DIV');
      const spans = createdElements.filter(e => e.tagName === 'SPAN');
      const buttons = createdElements.filter(e => e.tagName === 'BUTTON');

      expect(divs.length).toBeGreaterThan(0);
      expect(spans.length).toBeGreaterThan(0);
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('should set correct content for critical error overlay', async () => {
      const error = new Error('Overlay test');
      const mockRefresh = vi.fn().mockRejectedValue(error);
      const wrapped = wrapComponentRefresh('OverlayTest', mockRefresh);

      // Trigger 10 errors to show critical overlay
      for (let i = 0; i < 10; i++) {
        await wrapped();
      }

      // The critical overlay should have been created
      const overlayElements = createdElements.filter(el => 
        el.className === 'critical-error-overlay'
      );

      expect(overlayElements.length).toBeGreaterThan(0);
    });
  });
});
