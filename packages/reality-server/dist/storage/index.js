'use strict';

// src/storage/memory.ts
var MemoryStorage = class {
  constructor() {
    this.nodes = /* @__PURE__ */ new Map();
    this.maxVersion = 0;
  }
  async getNode(key) {
    return this.nodes.get(key) ?? null;
  }
  async setNode(meta) {
    this.nodes.set(meta.key, meta);
    this.maxVersion = Math.max(this.maxVersion, meta.version);
  }
  async incrementVersion(key, hash) {
    const version = this.maxVersion + 1;
    const meta = {
      key,
      version,
      hash,
      updatedAt: Date.now()
    };
    this.nodes.set(key, meta);
    this.maxVersion = version;
    return meta;
  }
  async listChangedSince(version) {
    const result = [];
    for (const meta of this.nodes.values()) {
      if (meta.version > version) {
        result.push(meta);
      }
    }
    return result.sort((a, b) => a.version - b.version);
  }
  async getNodes(keys) {
    const result = /* @__PURE__ */ new Map();
    for (const key of keys) {
      const meta = this.nodes.get(key);
      if (meta) {
        result.set(key, meta);
      }
    }
    return result;
  }
  async getMaxVersion() {
    return this.maxVersion;
  }
  async deleteNode(key) {
    this.nodes.delete(key);
  }
  async isHealthy() {
    return true;
  }
  /**
   * Clear all data (useful for testing)
   */
  clear() {
    this.nodes.clear();
    this.maxVersion = 0;
  }
  /**
   * Get all nodes (for debugging)
   */
  getAllNodes() {
    return new Map(this.nodes);
  }
};
function createMemoryStorage() {
  return new MemoryStorage();
}

// src/storage/sql/sql-storage.ts
var SQLDialects = {
  postgres: {
    placeholder: (i) => `$${i}`,
    upsert: (table, columns, conflictColumn) => `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(", ")}) ON CONFLICT (${conflictColumn}) DO UPDATE SET ${columns.filter((c) => c !== conflictColumn).map((c, _i) => `${c} = EXCLUDED.${c}`).join(", ")}`,
    now: () => "NOW()"
  },
  mysql: {
    placeholder: () => "?",
    upsert: (table, columns, conflictColumn) => `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")}) ON DUPLICATE KEY UPDATE ${columns.filter((c) => c !== conflictColumn).map((c) => `${c} = VALUES(${c})`).join(", ")}`,
    now: () => "NOW()"
  },
  sqlite: {
    placeholder: () => "?",
    upsert: (table, columns, _conflictColumn) => `INSERT OR REPLACE INTO ${table} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
    now: () => "datetime('now')"
  }
};
var SQLStorage = class {
  constructor(config) {
    this.initialized = false;
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
  async ensureTable() {
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
    const indexSql = `
      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_version 
      ON ${this.tableName} (version)
    `;
    try {
      await this.executor.execute(indexSql);
    } catch {
    }
    this.initialized = true;
  }
  async getNode(key) {
    await this.ensureTable();
    const sql = `SELECT key, version, hash, updated_at FROM ${this.tableName} WHERE key = ${this.dialect.placeholder(1)}`;
    const row = await this.executor.executeOne(sql, [key]);
    if (!row) return null;
    return {
      key: row.key,
      version: Number(row.version),
      hash: row.hash,
      updatedAt: Number(row.updated_at)
    };
  }
  async setNode(meta) {
    await this.ensureTable();
    const sql = this.dialect.upsert(
      this.tableName,
      ["key", "version", "hash", "updated_at"],
      "key"
    );
    await this.executor.execute(sql, [meta.key, meta.version, meta.hash, meta.updatedAt]);
  }
  async incrementVersion(key, hash) {
    await this.ensureTable();
    return this.executor.transaction(async (tx) => {
      const maxSql = `SELECT COALESCE(MAX(version), 0) as max_version FROM ${this.tableName}`;
      const maxResult = await tx.executeOne(maxSql);
      const newVersion = (maxResult?.max_version ?? 0) + 1;
      const meta = {
        key,
        version: newVersion,
        hash,
        updatedAt: Date.now()
      };
      const upsertSql = this.dialect.upsert(
        this.tableName,
        ["key", "version", "hash", "updated_at"],
        "key"
      );
      await tx.execute(upsertSql, [meta.key, meta.version, meta.hash, meta.updatedAt]);
      return meta;
    });
  }
  async listChangedSince(version) {
    await this.ensureTable();
    const sql = `
      SELECT key, version, hash, updated_at 
      FROM ${this.tableName} 
      WHERE version > ${this.dialect.placeholder(1)}
      ORDER BY version ASC
    `;
    const rows = await this.executor.execute(sql, [version]);
    return rows.map((row) => ({
      key: row.key,
      version: Number(row.version),
      hash: row.hash,
      updatedAt: Number(row.updated_at)
    }));
  }
  async getNodes(keys) {
    await this.ensureTable();
    if (keys.length === 0) {
      return /* @__PURE__ */ new Map();
    }
    const placeholders = keys.map((_, i) => this.dialect.placeholder(i + 1)).join(", ");
    const sql = `
      SELECT key, version, hash, updated_at 
      FROM ${this.tableName} 
      WHERE key IN (${placeholders})
    `;
    const rows = await this.executor.execute(sql, keys);
    const result = /* @__PURE__ */ new Map();
    for (const row of rows) {
      result.set(row.key, {
        key: row.key,
        version: Number(row.version),
        hash: row.hash,
        updatedAt: Number(row.updated_at)
      });
    }
    return result;
  }
  async getMaxVersion() {
    await this.ensureTable();
    const sql = `SELECT COALESCE(MAX(version), 0) as max_version FROM ${this.tableName}`;
    const result = await this.executor.executeOne(sql);
    return result?.max_version ?? 0;
  }
  async deleteNode(key) {
    await this.ensureTable();
    const sql = `DELETE FROM ${this.tableName} WHERE key = ${this.dialect.placeholder(1)}`;
    await this.executor.execute(sql, [key]);
  }
  async isHealthy() {
    try {
      await this.executor.executeOne("SELECT 1");
      return true;
    } catch {
      return false;
    }
  }
};
function createSQLStorage(config) {
  return new SQLStorage(config);
}

// src/storage/drizzle/drizzle-storage.ts
var DrizzleStorage = class {
  constructor(config) {
    this.db = config.db;
    this.table = config.table;
    this.ops = config.operators;
  }
  async getNode(key) {
    const results = await this.db.select().from(this.table).where(this.ops.eq(this.table.key, key));
    if (results.length === 0) return null;
    const row = results[0];
    return {
      key: row.key,
      version: row.version,
      hash: row.hash,
      updatedAt: row.updatedAt
    };
  }
  async setNode(meta) {
    await this.db.insert(this.table).values({
      key: meta.key,
      version: meta.version,
      hash: meta.hash,
      updatedAt: meta.updatedAt
    }).onConflictDoUpdate({
      target: this.table.key,
      set: {
        version: meta.version,
        hash: meta.hash,
        updatedAt: meta.updatedAt
      }
    });
  }
  async incrementVersion(key, hash) {
    return this.db.transaction(async (tx) => {
      const maxResults = await tx.select({ maxVersion: this.ops.max(this.table.version) }).from(this.table);
      const maxVersion = maxResults[0]?.maxVersion ?? 0;
      const newVersion = maxVersion + 1;
      const meta = {
        key,
        version: newVersion,
        hash,
        updatedAt: Date.now()
      };
      await tx.insert(this.table).values({
        key: meta.key,
        version: meta.version,
        hash: meta.hash,
        updatedAt: meta.updatedAt
      }).onConflictDoUpdate({
        target: this.table.key,
        set: {
          version: meta.version,
          hash: meta.hash,
          updatedAt: meta.updatedAt
        }
      });
      return meta;
    });
  }
  async listChangedSince(version) {
    const results = await this.db.select().from(this.table).orderBy(this.ops.asc(this.table.version)).where(this.ops.gt(this.table.version, version));
    return results.map((row) => ({
      key: row.key,
      version: row.version,
      hash: row.hash,
      updatedAt: row.updatedAt
    }));
  }
  async getNodes(keys) {
    if (keys.length === 0) {
      return /* @__PURE__ */ new Map();
    }
    const results = await this.db.select().from(this.table).where(this.ops.inArray(this.table.key, keys));
    const map = /* @__PURE__ */ new Map();
    for (const row of results) {
      map.set(row.key, {
        key: row.key,
        version: row.version,
        hash: row.hash,
        updatedAt: row.updatedAt
      });
    }
    return map;
  }
  async getMaxVersion() {
    const results = await this.db.select({ maxVersion: this.ops.max(this.table.version) }).from(this.table);
    return results[0]?.maxVersion ?? 0;
  }
  async deleteNode(key) {
    await this.db.delete(this.table).where(this.ops.eq(this.table.key, key));
  }
  async isHealthy() {
    try {
      await this.db.select().from(this.table).where(this.ops.eq(1, 0));
      return true;
    } catch {
      return false;
    }
  }
};
function createDrizzleStorage(config) {
  return new DrizzleStorage(config);
}
var DRIZZLE_POSTGRES_SCHEMA = `
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
var DRIZZLE_MYSQL_SCHEMA = `
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
var DRIZZLE_SQLITE_SCHEMA = `
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

// src/storage/prisma/prisma-storage.ts
var PrismaStorage = class {
  constructor(config) {
    this.prisma = config.prisma;
  }
  async getNode(key) {
    const node = await this.prisma.realityNode.findUnique({
      where: { key }
    });
    if (!node) return null;
    return {
      key: node.key,
      version: Number(node.version),
      hash: node.hash,
      updatedAt: Number(node.updatedAt)
    };
  }
  async setNode(meta) {
    await this.prisma.realityNode.upsert({
      where: { key: meta.key },
      create: {
        key: meta.key,
        version: BigInt(meta.version),
        hash: meta.hash,
        updatedAt: BigInt(meta.updatedAt)
      },
      update: {
        key: meta.key,
        version: BigInt(meta.version),
        hash: meta.hash,
        updatedAt: BigInt(meta.updatedAt)
      }
    });
  }
  async incrementVersion(key, hash) {
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.realityNode.aggregate({
        _max: { version: true }
      });
      const maxVersion = result._max.version ?? BigInt(0);
      const newVersion = Number(maxVersion) + 1;
      const meta = {
        key,
        version: newVersion,
        hash,
        updatedAt: Date.now()
      };
      await tx.realityNode.upsert({
        where: { key },
        create: {
          key: meta.key,
          version: BigInt(meta.version),
          hash: meta.hash,
          updatedAt: BigInt(meta.updatedAt)
        },
        update: {
          key: meta.key,
          version: BigInt(meta.version),
          hash: meta.hash,
          updatedAt: BigInt(meta.updatedAt)
        }
      });
      return meta;
    });
  }
  async listChangedSince(version) {
    const nodes = await this.prisma.realityNode.findMany({
      where: {
        version: { gt: BigInt(version) }
      },
      orderBy: {
        version: "asc"
      }
    });
    return nodes.map((node) => ({
      key: node.key,
      version: Number(node.version),
      hash: node.hash,
      updatedAt: Number(node.updatedAt)
    }));
  }
  async getNodes(keys) {
    if (keys.length === 0) {
      return /* @__PURE__ */ new Map();
    }
    const nodes = await this.prisma.realityNode.findMany({
      where: {
        key: { in: keys }
      }
    });
    const map = /* @__PURE__ */ new Map();
    for (const node of nodes) {
      map.set(node.key, {
        key: node.key,
        version: Number(node.version),
        hash: node.hash,
        updatedAt: Number(node.updatedAt)
      });
    }
    return map;
  }
  async getMaxVersion() {
    const result = await this.prisma.realityNode.aggregate({
      _max: { version: true }
    });
    return Number(result._max.version ?? 0);
  }
  async deleteNode(key) {
    try {
      await this.prisma.realityNode.delete({
        where: { key }
      });
    } catch {
    }
  }
  async isHealthy() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
};
function createPrismaStorage(config) {
  return new PrismaStorage(config);
}
var PRISMA_SCHEMA = `
model RealityNode {
  key       String   @id @db.VarChar(255)
  version   BigInt
  hash      String   @db.VarChar(64)
  updatedAt BigInt   @map("updated_at")

  @@index([version])
  @@map("reality_nodes")
}
`;

// src/storage/nosql/dynamodb-storage.ts
var DynamoDBStorage = class {
  constructor(config) {
    this.client = config.client;
    this.tableName = config.tableName;
    this.versionIndexName = config.versionIndexName;
  }
  async getNode(key) {
    const command = {
      TableName: this.tableName,
      Key: {
        key: { S: key }
      }
    };
    const result = await this.client.send(this.createGetItemCommand(command));
    if (!result.Item) return null;
    return this.documentToMeta(result.Item);
  }
  async setNode(meta) {
    const command = {
      TableName: this.tableName,
      Item: this.metaToDocument(meta)
    };
    await this.client.send(this.createPutItemCommand(command));
  }
  async incrementVersion(key, hash) {
    const maxVersion = await this.getMaxVersion();
    const newVersion = maxVersion + 1;
    const meta = {
      key,
      version: newVersion,
      hash,
      updatedAt: Date.now()
    };
    const command = {
      TableName: this.tableName,
      Item: this.metaToDocument(meta),
      ConditionExpression: "attribute_not_exists(#key) OR #version < :newVersion",
      ExpressionAttributeNames: {
        "#key": "key",
        "#version": "version"
      },
      ExpressionAttributeValues: {
        ":newVersion": { N: String(newVersion) }
      }
    };
    try {
      await this.client.send(this.createPutItemCommand(command));
      return meta;
    } catch (error) {
      if (error.name === "ConditionalCheckFailedException") {
        return this.incrementVersion(key, hash);
      }
      throw error;
    }
  }
  async listChangedSince(version) {
    if (this.versionIndexName) {
      const command2 = {
        TableName: this.tableName,
        IndexName: this.versionIndexName,
        KeyConditionExpression: "#version > :version",
        ExpressionAttributeNames: {
          "#version": "version"
        },
        ExpressionAttributeValues: {
          ":version": { N: String(version) }
        }
      };
      const result2 = await this.client.send(this.createQueryCommand(command2));
      return (result2.Items ?? []).map((item) => this.documentToMeta(item)).sort((a, b) => a.version - b.version);
    }
    const command = {
      TableName: this.tableName,
      FilterExpression: "#version > :version",
      ExpressionAttributeNames: {
        "#version": "version"
      },
      ExpressionAttributeValues: {
        ":version": { N: String(version) }
      }
    };
    const result = await this.client.send(this.createScanCommand(command));
    return (result.Items ?? []).map((item) => this.documentToMeta(item)).sort((a, b) => a.version - b.version);
  }
  async getNodes(keys) {
    if (keys.length === 0) {
      return /* @__PURE__ */ new Map();
    }
    const command = {
      RequestItems: {
        [this.tableName]: {
          Keys: keys.map((key) => ({ key: { S: key } }))
        }
      }
    };
    const result = await this.client.send(this.createBatchGetItemCommand(command));
    const items = result.Responses?.[this.tableName] ?? [];
    const map = /* @__PURE__ */ new Map();
    for (const item of items) {
      const meta = this.documentToMeta(item);
      map.set(meta.key, meta);
    }
    return map;
  }
  async getMaxVersion() {
    const command = {
      TableName: this.tableName,
      ProjectionExpression: "#version",
      ExpressionAttributeNames: {
        "#version": "version"
      }
    };
    const result = await this.client.send(this.createScanCommand(command));
    const items = result.Items ?? [];
    if (items.length === 0) return 0;
    return Math.max(...items.map((item) => parseInt(item.version.N, 10)));
  }
  async deleteNode(key) {
    const command = {
      TableName: this.tableName,
      Key: {
        key: { S: key }
      }
    };
    await this.client.send(this.createDeleteItemCommand(command));
  }
  async isHealthy() {
    try {
      const command = {
        TableName: this.tableName,
        Limit: 1
      };
      await this.client.send(this.createScanCommand(command));
      return true;
    } catch {
      return false;
    }
  }
  documentToMeta(doc) {
    return {
      key: doc.key.S,
      version: parseInt(doc.version.N, 10),
      hash: doc.hash.S,
      updatedAt: parseInt(doc.updatedAt.N, 10)
    };
  }
  metaToDocument(meta) {
    return {
      key: { S: meta.key },
      version: { N: String(meta.version) },
      hash: { S: meta.hash },
      updatedAt: { N: String(meta.updatedAt) }
    };
  }
  // Command factory methods (to be replaced with actual AWS SDK commands)
  createGetItemCommand(input) {
    return { __type: "GetItem", input };
  }
  createPutItemCommand(input) {
    return { __type: "PutItem", input };
  }
  createDeleteItemCommand(input) {
    return { __type: "DeleteItem", input };
  }
  createQueryCommand(input) {
    return { __type: "Query", input };
  }
  createScanCommand(input) {
    return { __type: "Scan", input };
  }
  createBatchGetItemCommand(input) {
    return { __type: "BatchGetItem", input };
  }
};
function createDynamoDBStorage(config) {
  return new DynamoDBStorage(config);
}
var DYNAMODB_CLOUDFORMATION = `
AWSTemplateFormatVersion: '2010-09-09'
Description: Reality DynamoDB Table

Resources:
  RealityNodesTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: reality-nodes
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: key
          AttributeType: S
        - AttributeName: version
          AttributeType: N
      KeySchema:
        - AttributeName: key
          KeyType: HASH
      GlobalSecondaryIndexes:
        - IndexName: version-index
          KeySchema:
            - AttributeName: version
              KeyType: HASH
          Projection:
            ProjectionType: ALL
`;

exports.DRIZZLE_MYSQL_SCHEMA = DRIZZLE_MYSQL_SCHEMA;
exports.DRIZZLE_POSTGRES_SCHEMA = DRIZZLE_POSTGRES_SCHEMA;
exports.DRIZZLE_SQLITE_SCHEMA = DRIZZLE_SQLITE_SCHEMA;
exports.DYNAMODB_CLOUDFORMATION = DYNAMODB_CLOUDFORMATION;
exports.DrizzleStorage = DrizzleStorage;
exports.DynamoDBStorage = DynamoDBStorage;
exports.MemoryStorage = MemoryStorage;
exports.PRISMA_SCHEMA = PRISMA_SCHEMA;
exports.PrismaStorage = PrismaStorage;
exports.SQLDialects = SQLDialects;
exports.SQLStorage = SQLStorage;
exports.createDrizzleStorage = createDrizzleStorage;
exports.createDynamoDBStorage = createDynamoDBStorage;
exports.createMemoryStorage = createMemoryStorage;
exports.createPrismaStorage = createPrismaStorage;
exports.createSQLStorage = createSQLStorage;
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map