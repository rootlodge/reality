/**
 * @rootlodge/reality-server - Drizzle Storage Adapter
 * 
 * First-class Drizzle ORM integration for Reality storage.
 */

import type { RealityStorage, RealityNodeMeta } from '../../types';

/**
 * Drizzle table schema definition
 * 
 * Users should define this in their Drizzle schema:
 * 
 * ```typescript
 * import { pgTable, varchar, bigint, index } from 'drizzle-orm/pg-core';
 * 
 * export const realityNodes = pgTable('reality_nodes', {
 *   key: varchar('key', { length: 255 }).primaryKey(),
 *   version: bigint('version', { mode: 'number' }).notNull(),
 *   hash: varchar('hash', { length: 64 }).notNull(),
 *   updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
 * }, (table) => ({
 *   versionIdx: index('version_idx').on(table.version),
 * }));
 * ```
 */
export interface DrizzleRealityTable {
  key: unknown;
  version: unknown;
  hash: unknown;
  updatedAt: unknown;
}

/**
 * Drizzle database interface
 */
export interface DrizzleDB {
  select: <T>(fields?: T) => {
    from: (table: unknown) => {
      where: (condition: unknown) => Promise<T[]>;
      orderBy: (column: unknown) => {
        where: (condition: unknown) => Promise<T[]>;
      };
    };
  };
  insert: (table: unknown) => {
    values: (values: unknown) => {
      onConflictDoUpdate: (config: unknown) => Promise<void>;
    };
  };
  delete: (table: unknown) => {
    where: (condition: unknown) => Promise<void>;
  };
  transaction: <T>(fn: (tx: DrizzleDB) => Promise<T>) => Promise<T>;
}

/**
 * Drizzle Storage configuration
 */
export interface DrizzleStorageConfig {
  /** Drizzle database instance */
  db: DrizzleDB;
  /** Drizzle table reference */
  table: DrizzleRealityTable;
  /** SQL operators from drizzle-orm */
  operators: {
    eq: (column: unknown, value: unknown) => unknown;
    gt: (column: unknown, value: unknown) => unknown;
    inArray: (column: unknown, values: unknown[]) => unknown;
    max: (column: unknown) => unknown;
    asc: (column: unknown) => unknown;
  };
}

/**
 * Drizzle Storage implementation
 * 
 * @example
 * ```typescript
 * import { drizzle } from 'drizzle-orm/node-postgres';
 * import { eq, gt, inArray, max, asc } from 'drizzle-orm';
 * import { realityNodes } from './schema';
 * 
 * const db = drizzle(pool);
 * 
 * const storage = createDrizzleStorage({
 *   db,
 *   table: realityNodes,
 *   operators: { eq, gt, inArray, max, asc },
 * });
 * ```
 */
export class DrizzleStorage implements RealityStorage {
  private db: DrizzleDB;
  private table: DrizzleRealityTable;
  private ops: DrizzleStorageConfig['operators'];

  constructor(config: DrizzleStorageConfig) {
    this.db = config.db;
    this.table = config.table;
    this.ops = config.operators;
  }

  async getNode(key: string): Promise<RealityNodeMeta | null> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(this.ops.eq(this.table.key, key)) as Array<{
        key: string;
        version: number;
        hash: string;
        updatedAt: number;
      }>;

    if (results.length === 0) return null;

    const row = results[0]!;
    return {
      key: row.key,
      version: row.version,
      hash: row.hash,
      updatedAt: row.updatedAt,
    };
  }

  async setNode(meta: RealityNodeMeta): Promise<void> {
    await this.db
      .insert(this.table)
      .values({
        key: meta.key,
        version: meta.version,
        hash: meta.hash,
        updatedAt: meta.updatedAt,
      })
      .onConflictDoUpdate({
        target: this.table.key,
        set: {
          version: meta.version,
          hash: meta.hash,
          updatedAt: meta.updatedAt,
        },
      });
  }

  async incrementVersion(key: string, hash: string): Promise<RealityNodeMeta> {
    return this.db.transaction(async (tx) => {
      // Get current max version
      const maxResults = await tx
        .select({ maxVersion: this.ops.max(this.table.version) })
        .from(this.table) as unknown as Array<{ maxVersion: number | null }>;

      const maxVersion = maxResults[0]?.maxVersion ?? 0;
      const newVersion = maxVersion + 1;

      const meta: RealityNodeMeta = {
        key,
        version: newVersion,
        hash,
        updatedAt: Date.now(),
      };

      await tx
        .insert(this.table)
        .values({
          key: meta.key,
          version: meta.version,
          hash: meta.hash,
          updatedAt: meta.updatedAt,
        })
        .onConflictDoUpdate({
          target: this.table.key,
          set: {
            version: meta.version,
            hash: meta.hash,
            updatedAt: meta.updatedAt,
          },
        });

      return meta;
    });
  }

  async listChangedSince(version: number): Promise<RealityNodeMeta[]> {
    const results = await this.db
      .select()
      .from(this.table)
      .orderBy(this.ops.asc(this.table.version))
      .where(this.ops.gt(this.table.version, version)) as Array<{
        key: string;
        version: number;
        hash: string;
        updatedAt: number;
      }>;

    return results.map((row) => ({
      key: row.key,
      version: row.version,
      hash: row.hash,
      updatedAt: row.updatedAt,
    }));
  }

  async getNodes(keys: string[]): Promise<Map<string, RealityNodeMeta>> {
    if (keys.length === 0) {
      return new Map();
    }

    const results = await this.db
      .select()
      .from(this.table)
      .where(this.ops.inArray(this.table.key, keys)) as Array<{
        key: string;
        version: number;
        hash: string;
        updatedAt: number;
      }>;

    const map = new Map<string, RealityNodeMeta>();
    for (const row of results) {
      map.set(row.key, {
        key: row.key,
        version: row.version,
        hash: row.hash,
        updatedAt: row.updatedAt,
      });
    }

    return map;
  }

  async getMaxVersion(): Promise<number> {
    const results = await this.db
      .select({ maxVersion: this.ops.max(this.table.version) })
      .from(this.table) as unknown as Array<{ maxVersion: number | null }>;

    return results[0]?.maxVersion ?? 0;
  }

  async deleteNode(key: string): Promise<void> {
    await this.db.delete(this.table).where(this.ops.eq(this.table.key, key));
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.db.select().from(this.table).where(this.ops.eq(1, 0));
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Create Drizzle storage adapter
 */
export function createDrizzleStorage(config: DrizzleStorageConfig): DrizzleStorage {
  return new DrizzleStorage(config);
}

/**
 * Generate Drizzle schema for PostgreSQL
 * 
 * Copy this to your schema file:
 */
export const DRIZZLE_POSTGRES_SCHEMA = `
import { pgTable, varchar, bigint, index } from 'drizzle-orm/pg-core';

export const realityNodes = pgTable('reality_nodes', {
  key: varchar('key', { length: 255 }).primaryKey(),
  version: bigint('version', { mode: 'number' }).notNull(),
  hash: varchar('hash', { length: 64 }).notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
}, (table) => ({
  versionIdx: index('version_idx').on(table.version),
}));
`;

/**
 * Generate Drizzle schema for MySQL
 */
export const DRIZZLE_MYSQL_SCHEMA = `
import { mysqlTable, varchar, bigint, index } from 'drizzle-orm/mysql-core';

export const realityNodes = mysqlTable('reality_nodes', {
  key: varchar('key', { length: 255 }).primaryKey(),
  version: bigint('version', { mode: 'number' }).notNull(),
  hash: varchar('hash', { length: 64 }).notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
}, (table) => ({
  versionIdx: index('version_idx').on(table.version),
}));
`;

/**
 * Generate Drizzle schema for SQLite
 */
export const DRIZZLE_SQLITE_SCHEMA = `
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const realityNodes = sqliteTable('reality_nodes', {
  key: text('key').primaryKey(),
  version: integer('version').notNull(),
  hash: text('hash').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => ({
  versionIdx: index('version_idx').on(table.version),
}));
`;
