/**
 * @rootlodge/reality-server - Server Package Entry Point
 * 
 * Socketless Real-Time Infrastructure - Server
 * 
 * @packageDocumentation
 */

// Types
export * from './types';

// Main server
export { RealityServer, createRealityServer } from './server';

// Storage adapters
export { MemoryStorage, createMemoryStorage } from './storage/memory';
export { SQLStorage, createSQLStorage, SQLDialects, type SQLExecutor, type SQLDialect, type SQLStorageConfig } from './storage/sql';
export { DrizzleStorage, createDrizzleStorage, DRIZZLE_POSTGRES_SCHEMA, DRIZZLE_MYSQL_SCHEMA, DRIZZLE_SQLITE_SCHEMA, type DrizzleStorageConfig } from './storage/drizzle';
export { PrismaStorage, createPrismaStorage, PRISMA_SCHEMA, type PrismaStorageConfig } from './storage/prisma';
export { DynamoDBStorage, createDynamoDBStorage, DYNAMODB_CLOUDFORMATION, type DynamoDBStorageConfig } from './storage/nosql';

// Mesh
export { MeshCoordinator, createMeshCoordinator, type MeshConfig } from './mesh';

// Redis
export { RedisAccelerator, createRedisAccelerator, type RedisAcceleratorConfig, type RedisClient } from './redis';

// HTTP handlers
export {
  handleSync,
  handleInvalidation,
  handleVersionQuery,
  handleHealth,
  handleNodeUpdate,
  handleCors,
  type HandlerDeps,
} from './http/handlers';

export { createExpressMiddleware, createExpressRouter } from './http/express';
export { createFetchHandler, createWorkersHandler } from './http/fetch';

// Compatibility
export { SSECompatAdapter, createSSECompatAdapter, type SSECompatConfig } from './compat/sse';
export { PollingCompatAdapter, createPollingCompatAdapter, type PollingCompatConfig } from './compat/polling';
