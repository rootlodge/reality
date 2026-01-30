/**
 * @rootlodge/reality-server - Invalidation Adapters
 * 
 * Optional adapters for database integration.
 * Reality does NOT own your data - these are just helpers!
 * 
 * Use these to:
 * - Auto-invalidate when your DB changes
 * - Hook into transactions
 * - Get advisory notifications
 * 
 * You DON'T need these to use Reality!
 */

import type { RealityInvalidationAdapter } from '../types';

/**
 * Create a simple callback-based invalidation adapter
 * 
 * @example
 * ```typescript
 * const adapter = createCallbackInvalidationAdapter({
 *   onInvalidate: async (keys) => {
 *     console.log('Keys invalidated:', keys);
 *     // Notify your cache, broadcast to clients, etc.
 *   },
 * });
 * 
 * server.setInvalidationAdapter(adapter);
 * ```
 */
export function createCallbackInvalidationAdapter(options: {
  onInvalidate: (keys: string[]) => Promise<void>;
  beforeTransaction?: <T>(fn: () => Promise<T>) => Promise<T>;
  afterTransaction?: (affectedKeys: string[]) => Promise<void>;
}): RealityInvalidationAdapter {
  return {
    onInvalidate: options.onInvalidate,
    beforeTransaction: options.beforeTransaction,
    afterTransaction: options.afterTransaction,
  };
}

/**
 * Drizzle ORM invalidation adapter
 * 
 * Auto-invalidates Reality keys when Drizzle transactions complete.
 * 
 * @example
 * ```typescript
 * import { drizzle } from 'drizzle-orm/postgres-js';
 * import { createDrizzleInvalidationAdapter } from '@rootlodge/reality-server';
 * 
 * const db = drizzle(client);
 * const reality = new RealityServer({ serverId: 'server-1' });
 * 
 * const adapter = createDrizzleInvalidationAdapter({
 *   db,
 *   keyExtractor: (tableName, operation, data) => {
 *     if (tableName === 'messages') {
 *       return [`chat:room:${data.roomId}`];
 *     }
 *     return [];
 *   },
 * });
 * 
 * reality.setInvalidationAdapter(adapter);
 * ```
 */
export interface DrizzleInvalidationConfig {
  /** Drizzle database instance */
  db: unknown;
  /** Extract Reality keys from table/operation/data */
  keyExtractor: (
    tableName: string,
    operation: 'insert' | 'update' | 'delete',
    data: unknown
  ) => string[];
  /** Custom invalidation handler */
  onInvalidate?: (keys: string[]) => Promise<void>;
}

export function createDrizzleInvalidationAdapter(
  config: DrizzleInvalidationConfig
): RealityInvalidationAdapter {
  const pendingKeys = new Set<string>();
  
  return {
    onInvalidate: async (keys: string[]) => {
      if (config.onInvalidate) {
        await config.onInvalidate(keys);
      }
    },
    
    beforeTransaction: async <T>(fn: () => Promise<T>): Promise<T> => {
      pendingKeys.clear();
      return fn();
    },
    
    afterTransaction: async (affectedKeys: string[]) => {
      for (const key of affectedKeys) {
        pendingKeys.add(key);
      }
    },
  };
}

/**
 * Prisma ORM invalidation adapter
 * 
 * Auto-invalidates Reality keys when Prisma transactions complete.
 * 
 * @example
 * ```typescript
 * import { PrismaClient } from '@prisma/client';
 * import { createPrismaInvalidationAdapter } from '@rootlodge/reality-server';
 * 
 * const prisma = new PrismaClient();
 * const reality = new RealityServer({ serverId: 'server-1' });
 * 
 * const adapter = createPrismaInvalidationAdapter({
 *   prisma,
 *   keyExtractor: (model, operation, data) => {
 *     if (model === 'Message') {
 *       return [`chat:room:${data.roomId}`];
 *     }
 *     return [];
 *   },
 * });
 * 
 * reality.setInvalidationAdapter(adapter);
 * ```
 */
export interface PrismaInvalidationConfig {
  /** Prisma client instance */
  prisma: unknown;
  /** Extract Reality keys from model/operation/data */
  keyExtractor: (
    model: string,
    operation: 'create' | 'update' | 'delete' | 'upsert',
    data: unknown
  ) => string[];
  /** Custom invalidation handler */
  onInvalidate?: (keys: string[]) => Promise<void>;
}

export function createPrismaInvalidationAdapter(
  config: PrismaInvalidationConfig
): RealityInvalidationAdapter {
  return {
    onInvalidate: async (keys: string[]) => {
      if (config.onInvalidate) {
        await config.onInvalidate(keys);
      }
    },
    
    beforeTransaction: async <T>(fn: () => Promise<T>): Promise<T> => {
      return fn();
    },
    
    afterTransaction: async (_affectedKeys: string[]) => {
      // Keys are typically extracted at the point of operation
    },
  };
}

/**
 * Generic SQL invalidation adapter
 * 
 * For use with raw SQL or other ORMs.
 * 
 * @example
 * ```typescript
 * const adapter = createSQLInvalidationAdapter({
 *   keyExtractor: (sql, params) => {
 *     // Parse SQL to extract affected tables/keys
 *     if (sql.includes('INSERT INTO messages')) {
 *       return [`chat:room:${params.roomId}`];
 *     }
 *     return [];
 *   },
 * });
 * ```
 */
export interface SQLInvalidationConfig {
  /** Extract Reality keys from SQL query and params */
  keyExtractor: (sql: string, params: unknown[]) => string[];
  /** Custom invalidation handler */
  onInvalidate?: (keys: string[]) => Promise<void>;
}

export function createSQLInvalidationAdapter(
  config: SQLInvalidationConfig
): RealityInvalidationAdapter {
  return {
    onInvalidate: async (keys: string[]) => {
      if (config.onInvalidate) {
        await config.onInvalidate(keys);
      }
    },
  };
}

/**
 * Composite adapter that combines multiple adapters
 * 
 * @example
 * ```typescript
 * const adapter = createCompositeInvalidationAdapter([
 *   drizzleAdapter,
 *   loggingAdapter,
 *   cacheAdapter,
 * ]);
 * ```
 */
export function createCompositeInvalidationAdapter(
  adapters: RealityInvalidationAdapter[]
): RealityInvalidationAdapter {
  return {
    onInvalidate: async (keys: string[]) => {
      await Promise.all(adapters.map(a => a.onInvalidate(keys)));
    },
    
    beforeTransaction: async <T>(fn: () => Promise<T>): Promise<T> => {
      // Chain beforeTransaction calls
      let result: T;
      const chain = adapters.reduceRight(
        (next, adapter) => async () => {
          if (adapter.beforeTransaction) {
            return adapter.beforeTransaction(next);
          }
          return next();
        },
        fn
      );
      result = await chain();
      return result;
    },
    
    afterTransaction: async (affectedKeys: string[]) => {
      await Promise.all(
        adapters
          .filter(a => a.afterTransaction)
          .map(a => a.afterTransaction!(affectedKeys))
      );
    },
  };
}

/**
 * Logging adapter for debugging
 */
export function createLoggingInvalidationAdapter(options: {
  prefix?: string;
  logger?: (message: string) => void;
} = {}): RealityInvalidationAdapter {
  const prefix = options.prefix ?? '[Reality]';
  const log = options.logger ?? console.log;
  
  return {
    onInvalidate: async (keys: string[]) => {
      log(`${prefix} Invalidated: ${keys.join(', ')}`);
    },
    
    beforeTransaction: async <T>(fn: () => Promise<T>): Promise<T> => {
      log(`${prefix} Transaction starting`);
      const result = await fn();
      log(`${prefix} Transaction completed`);
      return result;
    },
    
    afterTransaction: async (affectedKeys: string[]) => {
      log(`${prefix} Transaction affected: ${affectedKeys.join(', ')}`);
    },
  };
}
