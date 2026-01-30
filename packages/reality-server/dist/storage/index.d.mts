import { R as RealityStorage, b as RealityNodeMeta } from '../index-DMEqceRR.mjs';
import 'zod';

/**
 * @rootlodge/reality-server - Memory Storage
 *
 * In-memory storage adapter for development and testing.
 * Not recommended for production use with multiple servers.
 */

/**
 * In-memory storage implementation
 */
declare class MemoryStorage implements RealityStorage {
    private nodes;
    private maxVersion;
    getNode(key: string): Promise<RealityNodeMeta | null>;
    setNode(meta: RealityNodeMeta): Promise<void>;
    incrementVersion(key: string, hash: string): Promise<RealityNodeMeta>;
    listChangedSince(version: number): Promise<RealityNodeMeta[]>;
    getNodes(keys: string[]): Promise<Map<string, RealityNodeMeta>>;
    getMaxVersion(): Promise<number>;
    deleteNode(key: string): Promise<void>;
    isHealthy(): Promise<boolean>;
    /**
     * Clear all data (useful for testing)
     */
    clear(): void;
    /**
     * Get all nodes (for debugging)
     */
    getAllNodes(): Map<string, RealityNodeMeta>;
}
/**
 * Create a memory storage instance
 */
declare function createMemoryStorage(): MemoryStorage;

/**
 * @rootlodge/reality-server - SQL Storage Adapter
 *
 * Generic SQL storage adapter that works with any SQL database.
 * Provides a base implementation that can be extended for specific databases.
 */

/**
 * SQL query executor interface
 */
interface SQLExecutor {
    execute<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
    executeOne<T = unknown>(sql: string, params?: unknown[]): Promise<T | null>;
    transaction<T>(fn: (tx: SQLExecutor) => Promise<T>): Promise<T>;
}
/**
 * SQL dialect configuration
 */
interface SQLDialect {
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
declare const SQLDialects: {
    postgres: {
        placeholder: (i: number) => string;
        upsert: (table: string, columns: string[], conflictColumn: string) => string;
        now: () => string;
    };
    mysql: {
        placeholder: () => string;
        upsert: (table: string, columns: string[], conflictColumn: string) => string;
        now: () => string;
    };
    sqlite: {
        placeholder: () => string;
        upsert: (table: string, columns: string[], _conflictColumn: string) => string;
        now: () => string;
    };
};
/**
 * SQL Storage configuration
 */
interface SQLStorageConfig {
    executor: SQLExecutor;
    dialect: SQLDialect;
    tableName: string;
    autoCreateTable?: boolean;
}
/**
 * SQL Storage implementation
 */
declare class SQLStorage implements RealityStorage {
    private executor;
    private dialect;
    private tableName;
    private initialized;
    constructor(config: SQLStorageConfig);
    /**
     * Ensure the table exists
     */
    private ensureTable;
    getNode(key: string): Promise<RealityNodeMeta | null>;
    setNode(meta: RealityNodeMeta): Promise<void>;
    incrementVersion(key: string, hash: string): Promise<RealityNodeMeta>;
    listChangedSince(version: number): Promise<RealityNodeMeta[]>;
    getNodes(keys: string[]): Promise<Map<string, RealityNodeMeta>>;
    getMaxVersion(): Promise<number>;
    deleteNode(key: string): Promise<void>;
    isHealthy(): Promise<boolean>;
}
/**
 * Create SQL storage with a specific dialect
 */
declare function createSQLStorage(config: SQLStorageConfig): SQLStorage;

/**
 * @rootlodge/reality-server - Drizzle Storage Adapter
 *
 * First-class Drizzle ORM integration for Reality storage.
 */

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
interface DrizzleRealityTable {
    key: unknown;
    version: unknown;
    hash: unknown;
    updatedAt: unknown;
}
/**
 * Drizzle database interface
 */
interface DrizzleDB {
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
interface DrizzleStorageConfig {
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
declare class DrizzleStorage implements RealityStorage {
    private db;
    private table;
    private ops;
    constructor(config: DrizzleStorageConfig);
    getNode(key: string): Promise<RealityNodeMeta | null>;
    setNode(meta: RealityNodeMeta): Promise<void>;
    incrementVersion(key: string, hash: string): Promise<RealityNodeMeta>;
    listChangedSince(version: number): Promise<RealityNodeMeta[]>;
    getNodes(keys: string[]): Promise<Map<string, RealityNodeMeta>>;
    getMaxVersion(): Promise<number>;
    deleteNode(key: string): Promise<void>;
    isHealthy(): Promise<boolean>;
}
/**
 * Create Drizzle storage adapter
 */
declare function createDrizzleStorage(config: DrizzleStorageConfig): DrizzleStorage;
/**
 * Generate Drizzle schema for PostgreSQL
 *
 * Copy this to your schema file:
 */
declare const DRIZZLE_POSTGRES_SCHEMA = "\nimport { pgTable, varchar, bigint, index } from 'drizzle-orm/pg-core';\n\nexport const realityNodes = pgTable('reality_nodes', {\n  key: varchar('key', { length: 255 }).primaryKey(),\n  version: bigint('version', { mode: 'number' }).notNull(),\n  hash: varchar('hash', { length: 64 }).notNull(),\n  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),\n}, (table) => ({\n  versionIdx: index('version_idx').on(table.version),\n}));\n";
/**
 * Generate Drizzle schema for MySQL
 */
declare const DRIZZLE_MYSQL_SCHEMA = "\nimport { mysqlTable, varchar, bigint, index } from 'drizzle-orm/mysql-core';\n\nexport const realityNodes = mysqlTable('reality_nodes', {\n  key: varchar('key', { length: 255 }).primaryKey(),\n  version: bigint('version', { mode: 'number' }).notNull(),\n  hash: varchar('hash', { length: 64 }).notNull(),\n  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),\n}, (table) => ({\n  versionIdx: index('version_idx').on(table.version),\n}));\n";
/**
 * Generate Drizzle schema for SQLite
 */
declare const DRIZZLE_SQLITE_SCHEMA = "\nimport { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';\n\nexport const realityNodes = sqliteTable('reality_nodes', {\n  key: text('key').primaryKey(),\n  version: integer('version').notNull(),\n  hash: text('hash').notNull(),\n  updatedAt: integer('updated_at').notNull(),\n}, (table) => ({\n  versionIdx: index('version_idx').on(table.version),\n}));\n";

/**
 * @rootlodge/reality-server - Prisma Storage Adapter
 *
 * Prisma ORM integration for Reality storage.
 */

/**
 * Prisma client interface (minimal subset)
 */
interface PrismaClient {
    realityNode: {
        findUnique: (args: {
            where: {
                key: string;
            };
        }) => Promise<PrismaRealityNode | null>;
        findMany: (args: {
            where?: unknown;
            orderBy?: unknown;
        }) => Promise<PrismaRealityNode[]>;
        upsert: (args: {
            where: {
                key: string;
            };
            create: PrismaRealityNodeInput;
            update: PrismaRealityNodeInput;
        }) => Promise<PrismaRealityNode>;
        delete: (args: {
            where: {
                key: string;
            };
        }) => Promise<void>;
        aggregate: (args: {
            _max: {
                version: true;
            };
        }) => Promise<{
            _max: {
                version: number | null;
            };
        }>;
    };
    $transaction: <T>(fn: (tx: PrismaClient) => Promise<T>) => Promise<T>;
    $queryRaw: <T>(query: TemplateStringsArray, ...values: unknown[]) => Promise<T>;
}
interface PrismaRealityNode {
    key: string;
    version: bigint | number;
    hash: string;
    updatedAt: bigint | number;
}
interface PrismaRealityNodeInput {
    key: string;
    version: bigint | number;
    hash: string;
    updatedAt: bigint | number;
}
/**
 * Prisma Storage configuration
 */
interface PrismaStorageConfig {
    /** Prisma client instance */
    prisma: PrismaClient;
}
/**
 * Prisma Storage implementation
 *
 * @example
 * ```typescript
 * import { PrismaClient } from '@prisma/client';
 * import { createPrismaStorage } from '@rootlodge/reality-server/storage';
 *
 * const prisma = new PrismaClient();
 * const storage = createPrismaStorage({ prisma });
 * ```
 *
 * Required Prisma schema:
 * ```prisma
 * model RealityNode {
 *   key       String   @id @db.VarChar(255)
 *   version   BigInt
 *   hash      String   @db.VarChar(64)
 *   updatedAt BigInt   @map("updated_at")
 *
 *   @@index([version])
 *   @@map("reality_nodes")
 * }
 * ```
 */
declare class PrismaStorage implements RealityStorage {
    private prisma;
    constructor(config: PrismaStorageConfig);
    getNode(key: string): Promise<RealityNodeMeta | null>;
    setNode(meta: RealityNodeMeta): Promise<void>;
    incrementVersion(key: string, hash: string): Promise<RealityNodeMeta>;
    listChangedSince(version: number): Promise<RealityNodeMeta[]>;
    getNodes(keys: string[]): Promise<Map<string, RealityNodeMeta>>;
    getMaxVersion(): Promise<number>;
    deleteNode(key: string): Promise<void>;
    isHealthy(): Promise<boolean>;
}
/**
 * Create Prisma storage adapter
 */
declare function createPrismaStorage(config: PrismaStorageConfig): PrismaStorage;
/**
 * Prisma schema for Reality nodes
 */
declare const PRISMA_SCHEMA = "\nmodel RealityNode {\n  key       String   @id @db.VarChar(255)\n  version   BigInt\n  hash      String   @db.VarChar(64)\n  updatedAt BigInt   @map(\"updated_at\")\n\n  @@index([version])\n  @@map(\"reality_nodes\")\n}\n";

/**
 * @rootlodge/reality-server - DynamoDB Storage Adapter
 *
 * AWS DynamoDB storage adapter for serverless deployments.
 */

/**
 * DynamoDB client interface (minimal subset matching AWS SDK v3)
 */
interface DynamoDBClient {
    send: (command: unknown) => Promise<unknown>;
}
/**
 * DynamoDB Storage configuration
 */
interface DynamoDBStorageConfig {
    /** DynamoDB client instance */
    client: DynamoDBClient;
    /** Table name */
    tableName: string;
    /** Optional: GSI name for version queries */
    versionIndexName?: string;
}
/**
 * DynamoDB Storage implementation
 *
 * Required table structure:
 * - Partition Key: key (String)
 * - GSI on version (Number) for efficient listChangedSince queries
 *
 * @example
 * ```typescript
 * import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
 * import { createDynamoDBStorage } from '@rootlodge/reality-server/storage';
 *
 * const client = new DynamoDBClient({ region: 'us-east-1' });
 * const storage = createDynamoDBStorage({
 *   client,
 *   tableName: 'reality-nodes',
 *   versionIndexName: 'version-index',
 * });
 * ```
 */
declare class DynamoDBStorage implements RealityStorage {
    private client;
    private tableName;
    private versionIndexName?;
    constructor(config: DynamoDBStorageConfig);
    getNode(key: string): Promise<RealityNodeMeta | null>;
    setNode(meta: RealityNodeMeta): Promise<void>;
    incrementVersion(key: string, hash: string): Promise<RealityNodeMeta>;
    listChangedSince(version: number): Promise<RealityNodeMeta[]>;
    getNodes(keys: string[]): Promise<Map<string, RealityNodeMeta>>;
    getMaxVersion(): Promise<number>;
    deleteNode(key: string): Promise<void>;
    isHealthy(): Promise<boolean>;
    private documentToMeta;
    private metaToDocument;
    private createGetItemCommand;
    private createPutItemCommand;
    private createDeleteItemCommand;
    private createQueryCommand;
    private createScanCommand;
    private createBatchGetItemCommand;
}
/**
 * Create DynamoDB storage adapter
 */
declare function createDynamoDBStorage(config: DynamoDBStorageConfig): DynamoDBStorage;
/**
 * CloudFormation template for DynamoDB table
 */
declare const DYNAMODB_CLOUDFORMATION = "\nAWSTemplateFormatVersion: '2010-09-09'\nDescription: Reality DynamoDB Table\n\nResources:\n  RealityNodesTable:\n    Type: AWS::DynamoDB::Table\n    Properties:\n      TableName: reality-nodes\n      BillingMode: PAY_PER_REQUEST\n      AttributeDefinitions:\n        - AttributeName: key\n          AttributeType: S\n        - AttributeName: version\n          AttributeType: N\n      KeySchema:\n        - AttributeName: key\n          KeyType: HASH\n      GlobalSecondaryIndexes:\n        - IndexName: version-index\n          KeySchema:\n            - AttributeName: version\n              KeyType: HASH\n          Projection:\n            ProjectionType: ALL\n";

export { DRIZZLE_MYSQL_SCHEMA, DRIZZLE_POSTGRES_SCHEMA, DRIZZLE_SQLITE_SCHEMA, DYNAMODB_CLOUDFORMATION, type DrizzleDB, type DrizzleRealityTable, DrizzleStorage, type DrizzleStorageConfig, type DynamoDBClient, DynamoDBStorage, type DynamoDBStorageConfig, MemoryStorage, PRISMA_SCHEMA, type PrismaClient, PrismaStorage, type PrismaStorageConfig, type SQLDialect, SQLDialects, type SQLExecutor, SQLStorage, type SQLStorageConfig, createDrizzleStorage, createDynamoDBStorage, createMemoryStorage, createPrismaStorage, createSQLStorage };
