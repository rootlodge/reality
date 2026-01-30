/**
 * @rootlodge/reality - Time Utilities
 * 
 * Cross-platform time utilities with clock skew handling.
 */

/**
 * Get current timestamp in milliseconds
 */
export function now(): number {
  return Date.now();
}

/**
 * Get high-resolution time if available, otherwise fall back to Date.now()
 */
export function hrTime(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.timeOrigin + performance.now();
  }
  return Date.now();
}

/**
 * Calculate server time offset from response
 */
export function calculateClockSkew(serverTime: number, requestStartTime: number, responseTime: number): number {
  const roundTripTime = responseTime - requestStartTime;
  const estimatedServerTime = requestStartTime + roundTripTime / 2;
  return serverTime - estimatedServerTime;
}

/**
 * Adjust local time to estimated server time
 */
export function adjustToServerTime(localTime: number, clockSkew: number): number {
  return localTime + clockSkew;
}

/**
 * Format timestamp as ISO string
 */
export function toISOString(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

/**
 * Check if a timestamp is stale (older than threshold)
 */
export function isStale(timestamp: number, staleThreshold: number): boolean {
  return now() - timestamp > staleThreshold;
}

/**
 * Calculate exponential backoff delay
 */
export function backoffDelay(attempt: number, baseDelay: number, maxDelay: number = 30000): number {
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  // Add jitter to prevent thundering herd
  const jitter = delay * 0.1 * Math.random();
  return Math.floor(delay + jitter);
}

/**
 * Create a deferred promise
 */
export interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

export function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  
  return { promise, resolve, reject };
}

/**
 * Create a timeout promise
 */
export function timeout<T>(promise: Promise<T>, ms: number, message?: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(message ?? `Operation timed out after ${ms}ms`));
    }, ms);
    
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Debounce a function
 */
export function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn(...args);
      timer = null;
    }, delay);
  };
}

/**
 * Throttle a function
 */
export function throttle<T extends (...args: Parameters<T>) => ReturnType<T>>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let lastRun = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  
  return (...args: Parameters<T>) => {
    const elapsed = now() - lastRun;
    
    if (elapsed >= limit) {
      lastRun = now();
      fn(...args);
    } else if (!timer) {
      timer = setTimeout(() => {
        lastRun = now();
        timer = null;
        fn(...args);
      }, limit - elapsed);
    }
  };
}
