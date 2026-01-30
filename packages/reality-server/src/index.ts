/**
 * @rootlodge/reality-server - Server Package Entry Point
 * 
 * Socketless Real-Time Infrastructure - Server
 * 
 * IMPORTANT: Reality does NOT own your data!
 * - Storage is OPTIONAL (defaults to in-memory)
 * - Reality only tracks change metadata (version/hash)
 * - Your application stores the actual payloads
 * - DB adapters are optional helpers for invalidation
 * 
 * @packageDocumentation
 */

// Types
export * from './types';

// Main server
export { RealityServer, createRealityServer } from './server';

// Embedded server for SSR
export {
  EmbeddedRealityServer,
  createEmbeddedRealityServer,
  getSharedEmbeddedServer,
  resetSharedEmbeddedServer,
  type EmbeddedServerConfig,
} from './embedded';

// Storage adapters (OPTIONAL - Reality works without these!)
export { MemoryStorage, createMemoryStorage } from './storage/memory';
export { SQLStorage, createSQLStorage, SQLDialects, type SQLExecutor, type SQLDialect, type SQLStorageConfig } from './storage/sql';
export { DrizzleStorage, createDrizzleStorage, DRIZZLE_POSTGRES_SCHEMA, DRIZZLE_MYSQL_SCHEMA, DRIZZLE_SQLITE_SCHEMA, type DrizzleStorageConfig } from './storage/drizzle';
export { PrismaStorage, createPrismaStorage, PRISMA_SCHEMA, type PrismaStorageConfig } from './storage/prisma';
export { DynamoDBStorage, createDynamoDBStorage, DYNAMODB_CLOUDFORMATION, type DynamoDBStorageConfig } from './storage/nosql';

// Invalidation adapters (OPTIONAL - for advisory DB integration)
export {
  createCallbackInvalidationAdapter,
  createDrizzleInvalidationAdapter,
  createPrismaInvalidationAdapter,
  createSQLInvalidationAdapter,
  createCompositeInvalidationAdapter,
  createLoggingInvalidationAdapter,
  type DrizzleInvalidationConfig,
  type PrismaInvalidationConfig,
  type SQLInvalidationConfig,
} from './invalidation';

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
