/**
 * @rootlodge/reality-server - SQL Storage Adapter
 * 
 * Generic SQL storage adapter that works with any SQL database.
 * Provides a base implementation that can be extended for specific databases.
 */

import type { RealityStorage, RealityNodeMeta } from '../types';

/**
 * SQL query executor interface
 */
export interface SQLExecutor {
  execute<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
  executeOne<T = unknown>(sql: string, params?: unknown[]): Promise<T | null>;
  transaction<T>(fn: (tx: SQLExecutor) => Promise<T>): Promise<T>;
}

/**
 * SQL dialect configuration
 */
export interface SQLDialect {
  /** Placeholder style: '?' for MySQL/SQLite, '$1' for Postgres */
  placeholder: (index: number) => string;
  /** UPSERT syntax */
  upsert: (table: string, columns: string[], conflictColumn: string) => string;
  /** Current timestamp function */
  now: () => string;
}

/**
 * Common SQL dialects
 */
export const SQLDialects = {
  postgres: {
    placeholder: (i: number) => `$${i}`,
    upsert: (table: string, columns: string[], conflictColumn: string) =>
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')}) ` +
      `ON CONFLICT (${conflictColumn}) DO UPDATE SET ${columns.filter(c => c !== conflictColumn).map((c, i) => `${c} = EXCLUDED.${c}`).join(', ')}`,
    now: () => 'NOW()',
  },
  mysql: {
    placeholder: () => '?',
    upsert: (table: string, columns: string[], conflictColumn: string) =>
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')}) ` +
      `ON DUPLICATE KEY UPDATE ${columns.filter(c => c !== conflictColumn).map(c => `${c} = VALUES(${c})`).join(', ')}`,
    now: () => 'NOW()',
  },
  sqlite: {
    placeholder: () => '?',
    upsert: (table: string, columns: string[], conflictColumn: string) =>
      `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
    now: () => "datetime('now')",
  },
} satisfies Record<string, SQLDialect>;

/**
 * SQL Storage configuration
 */
export interface SQLStorageConfig {
  executor: SQLExecutor;
  dialect: SQLDialect;
  tableName: string;
  autoCreateTable?: boolean;
}

/**
 * SQL Storage implementation
 */
export class SQLStorage implements RealityStorage {
  private executor: SQLExecutor;
  private dialect: SQLDialect;
  private tableName: string;
  private initialized = false;

  constructor(config: SQLStorageConfig) {
    this.executor = config.executor;
    this.dialect = config.dialect;
    this.tableName = config.tableName;

    if (config.autoCreateTable) {
      this.ensureTable();
    }
  }

  /**
   * Ensure the table exists
   */
  private async ensureTable(): Promise<void> {
    if (this.initialized) return;

    const sql = `
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        key VARCHAR(255) PRIMARY KEY,
        version BIGINT NOT NULL,
        hash VARCHAR(64) NOT NULL,
        updated_at BIGINT NOT NULL
      )
    `;

    await this.executor.execute(sql);
    
    // Create index on version for efficient listChangedSince queries
    const indexSql = `
      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_version 
      ON ${this.tableName} (version)
    `;
    
    try {
      await this.executor.execute(indexSql);
    } catch {
      // Index creation may fail on some databases, that's okay
    }

    this.initialized = true;
  }

  async getNode(key: string): Promise<RealityNodeMeta | null> {
    await this.ensureTable();
    
    const sql = `SELECT key, version, hash, updated_at FROM ${this.tableName} WHERE key = ${this.dialect.placeholder(1)}`;
    const row = await this.executor.executeOne<{
      key: string;
      version: number;
      hash: string;
      updated_at: number;
    }>(sql, [key]);

    if (!row) return null;

    return {
      key: row.key,
      version: Number(row.version),
      hash: row.hash,
      updatedAt: Number(row.updated_at),
    };
  }

  async setNode(meta: RealityNodeMeta): Promise<void> {
    await this.ensureTable();
    
    const sql = this.dialect.upsert(
      this.tableName,
      ['key', 'version', 'hash', 'updated_at'],
      'key'
    );

    await this.executor.execute(sql, [meta.key, meta.version, meta.hash, meta.updatedAt]);
  }

  async incrementVersion(key: string, hash: string): Promise<RealityNodeMeta> {
    await this.ensureTable();
    
    return this.executor.transaction(async (tx) => {
      // Get current max version
      const maxSql = `SELECT COALESCE(MAX(version), 0) as max_version FROM ${this.tableName}`;
      const maxResult = await tx.executeOne<{ max_version: number }>(maxSql);
      const newVersion = (maxResult?.max_version ?? 0) + 1;

      const meta: RealityNodeMeta = {
        key,
        version: newVersion,
        hash,
        updatedAt: Date.now(),
      };

      const upsertSql = this.dialect.upsert(
        this.tableName,
        ['key', 'version', 'hash', 'updated_at'],
        'key'
      );

      await tx.execute(upsertSql, [meta.key, meta.version, meta.hash, meta.updatedAt]);

      return meta;
    });
  }

  async listChangedSince(version: number): Promise<RealityNodeMeta[]> {
    await this.ensureTable();
    
    const sql = `
      SELECT key, version, hash, updated_at 
      FROM ${this.tableName} 
      WHERE version > ${this.dialect.placeholder(1)}
      ORDER BY version ASC
    `;

    const rows = await this.executor.execute<{
      key: string;
      version: number;
      hash: string;
      updated_at: number;
    }>(sql, [version]);

    return rows.map((row) => ({
      key: row.key,
      version: Number(row.version),
      hash: row.hash,
      updatedAt: Number(row.updated_at),
    }));
  }

  async getNodes(keys: string[]): Promise<Map<string, RealityNodeMeta>> {
    await this.ensureTable();
    
    if (keys.length === 0) {
      return new Map();
    }

    const placeholders = keys.map((_, i) => this.dialect.placeholder(i + 1)).join(', ');
    const sql = `
      SELECT key, version, hash, updated_at 
      FROM ${this.tableName} 
      WHERE key IN (${placeholders})
    `;

    const rows = await this.executor.execute<{
      key: string;
      version: number;
      hash: string;
      updated_at: number;
    }>(sql, keys);

    const result = new Map<string, RealityNodeMeta>();
    for (const row of rows) {
      result.set(row.key, {
        key: row.key,
        version: Number(row.version),
        hash: row.hash,
        updatedAt: Number(row.updated_at),
      });
    }

    return result;
  }

  async getMaxVersion(): Promise<number> {
    await this.ensureTable();
    
    const sql = `SELECT COALESCE(MAX(version), 0) as max_version FROM ${this.tableName}`;
    const result = await this.executor.executeOne<{ max_version: number }>(sql);
    return result?.max_version ?? 0;
  }

  async deleteNode(key: string): Promise<void> {
    await this.ensureTable();
    
    const sql = `DELETE FROM ${this.tableName} WHERE key = ${this.dialect.placeholder(1)}`;
    await this.executor.execute(sql, [key]);
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.executor.executeOne('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Create SQL storage with a specific dialect
 */
export function createSQLStorage(config: SQLStorageConfig): SQLStorage {
  return new SQLStorage(config);
}
