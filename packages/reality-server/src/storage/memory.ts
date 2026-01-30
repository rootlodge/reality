/**
 * @rootlodge/reality-server - Memory Storage
 * 
 * In-memory storage adapter for development and testing.
 * Not recommended for production use with multiple servers.
 */

import type { RealityStorage, RealityNodeMeta } from '../types';

/**
 * In-memory storage implementation
 */
export class MemoryStorage implements RealityStorage {
  private nodes: Map<string, RealityNodeMeta> = new Map();
  private maxVersion = 0;

  async getNode(key: string): Promise<RealityNodeMeta | null> {
    return this.nodes.get(key) ?? null;
  }

  async setNode(meta: RealityNodeMeta): Promise<void> {
    this.nodes.set(meta.key, meta);
    this.maxVersion = Math.max(this.maxVersion, meta.version);
  }

  async incrementVersion(key: string, hash: string): Promise<RealityNodeMeta> {
    const existing = this.nodes.get(key);
    const version = this.maxVersion + 1;
    
    const meta: RealityNodeMeta = {
      key,
      version,
      hash,
      updatedAt: Date.now(),
    };

    this.nodes.set(key, meta);
    this.maxVersion = version;
    
    return meta;
  }

  async listChangedSince(version: number): Promise<RealityNodeMeta[]> {
    const result: RealityNodeMeta[] = [];
    
    for (const meta of this.nodes.values()) {
      if (meta.version > version) {
        result.push(meta);
      }
    }

    return result.sort((a, b) => a.version - b.version);
  }

  async getNodes(keys: string[]): Promise<Map<string, RealityNodeMeta>> {
    const result = new Map<string, RealityNodeMeta>();
    
    for (const key of keys) {
      const meta = this.nodes.get(key);
      if (meta) {
        result.set(key, meta);
      }
    }

    return result;
  }

  async getMaxVersion(): Promise<number> {
    return this.maxVersion;
  }

  async deleteNode(key: string): Promise<void> {
    this.nodes.delete(key);
  }

  async isHealthy(): Promise<boolean> {
    return true;
  }

  /**
   * Clear all data (useful for testing)
   */
  clear(): void {
    this.nodes.clear();
    this.maxVersion = 0;
  }

  /**
   * Get all nodes (for debugging)
   */
  getAllNodes(): Map<string, RealityNodeMeta> {
    return new Map(this.nodes);
  }
}

/**
 * Create a memory storage instance
 */
export function createMemoryStorage(): MemoryStorage {
  return new MemoryStorage();
}
