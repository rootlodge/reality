/**
 * @rootlodge/reality - Hash Utilities
 * 
 * Deterministic hashing for content comparison.
 * Works in all environments: Node.js, Browser, React Native, Edge.
 */

/**
 * Generate a deterministic hash from any serializable value.
 * Uses a fast, non-cryptographic hash suitable for content comparison.
 */
export function createHash(data: unknown): string {
  const str = typeof data === 'string' ? data : JSON.stringify(data, sortReplacer);
  return fnv1aHash(str);
}

/**
 * FNV-1a hash implementation
 * Fast, simple, good distribution for our use case
 */
function fnv1aHash(str: string): string {
  let hash = 2166136261; // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    // FNV prime multiplication using bit operations
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  // Convert to unsigned 32-bit and then to hex
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * JSON replacer that sorts object keys for deterministic serialization
 */
function sortReplacer(_key: string, value: unknown): unknown {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }
  return Object.keys(value as Record<string, unknown>)
    .sort()
    .reduce((sorted, key) => {
      sorted[key] = (value as Record<string, unknown>)[key];
      return sorted;
    }, {} as Record<string, unknown>);
}

/**
 * Compare two hashes for equality
 */
export function hashEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Generate a composite hash from multiple hashes
 */
export function combineHashes(hashes: string[]): string {
  return createHash(hashes.sort().join(':'));
}
