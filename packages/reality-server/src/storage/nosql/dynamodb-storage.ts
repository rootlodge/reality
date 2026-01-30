/**
 * @rootlodge/reality-server - DynamoDB Storage Adapter
 * 
 * AWS DynamoDB storage adapter for serverless deployments.
 */

import type { RealityStorage, RealityNodeMeta } from '../../types';

/**
 * DynamoDB client interface (minimal subset matching AWS SDK v3)
 */
export interface DynamoDBClient {
  send: (command: unknown) => Promise<unknown>;
}

/**
 * DynamoDB document interface
 */
interface DynamoDBDocument {
  key: { S: string };
  version: { N: string };
  hash: { S: string };
  updatedAt: { N: string };
}

/**
 * DynamoDB Storage configuration
 */
export interface DynamoDBStorageConfig {
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
export class DynamoDBStorage implements RealityStorage {
  private client: DynamoDBClient;
  private tableName: string;
  private versionIndexName?: string;

  constructor(config: DynamoDBStorageConfig) {
    this.client = config.client;
    this.tableName = config.tableName;
    this.versionIndexName = config.versionIndexName;
  }

  async getNode(key: string): Promise<RealityNodeMeta | null> {
    const command = {
      TableName: this.tableName,
      Key: {
        key: { S: key },
      },
    };

    const result = await this.client.send(this.createGetItemCommand(command)) as {
      Item?: DynamoDBDocument;
    };

    if (!result.Item) return null;

    return this.documentToMeta(result.Item);
  }

  async setNode(meta: RealityNodeMeta): Promise<void> {
    const command = {
      TableName: this.tableName,
      Item: this.metaToDocument(meta),
    };

    await this.client.send(this.createPutItemCommand(command));
  }

  async incrementVersion(key: string, hash: string): Promise<RealityNodeMeta> {
    // Get current max version
    const maxVersion = await this.getMaxVersion();
    const newVersion = maxVersion + 1;

    const meta: RealityNodeMeta = {
      key,
      version: newVersion,
      hash,
      updatedAt: Date.now(),
    };

    // Use conditional write to ensure atomicity
    const command = {
      TableName: this.tableName,
      Item: this.metaToDocument(meta),
      ConditionExpression: 'attribute_not_exists(#key) OR #version < :newVersion',
      ExpressionAttributeNames: {
        '#key': 'key',
        '#version': 'version',
      },
      ExpressionAttributeValues: {
        ':newVersion': { N: String(newVersion) },
      },
    };

    try {
      await this.client.send(this.createPutItemCommand(command));
      return meta;
    } catch (error) {
      // Retry with incremented version if conditional check failed
      if ((error as { name?: string }).name === 'ConditionalCheckFailedException') {
        return this.incrementVersion(key, hash);
      }
      throw error;
    }
  }

  async listChangedSince(version: number): Promise<RealityNodeMeta[]> {
    if (this.versionIndexName) {
      // Use GSI for efficient query
      const command = {
        TableName: this.tableName,
        IndexName: this.versionIndexName,
        KeyConditionExpression: '#version > :version',
        ExpressionAttributeNames: {
          '#version': 'version',
        },
        ExpressionAttributeValues: {
          ':version': { N: String(version) },
        },
      };

      const result = await this.client.send(this.createQueryCommand(command)) as {
        Items?: DynamoDBDocument[];
      };

      return (result.Items ?? [])
        .map((item) => this.documentToMeta(item))
        .sort((a, b) => a.version - b.version);
    }

    // Fallback: scan the entire table (not recommended for large tables)
    const command = {
      TableName: this.tableName,
      FilterExpression: '#version > :version',
      ExpressionAttributeNames: {
        '#version': 'version',
      },
      ExpressionAttributeValues: {
        ':version': { N: String(version) },
      },
    };

    const result = await this.client.send(this.createScanCommand(command)) as {
      Items?: DynamoDBDocument[];
    };

    return (result.Items ?? [])
      .map((item) => this.documentToMeta(item))
      .sort((a, b) => a.version - b.version);
  }

  async getNodes(keys: string[]): Promise<Map<string, RealityNodeMeta>> {
    if (keys.length === 0) {
      return new Map();
    }

    // BatchGetItem for efficiency
    const command = {
      RequestItems: {
        [this.tableName]: {
          Keys: keys.map((key) => ({ key: { S: key } })),
        },
      },
    };

    const result = await this.client.send(this.createBatchGetItemCommand(command)) as {
      Responses?: { [tableName: string]: DynamoDBDocument[] };
    };

    const items = result.Responses?.[this.tableName] ?? [];
    const map = new Map<string, RealityNodeMeta>();

    for (const item of items) {
      const meta = this.documentToMeta(item);
      map.set(meta.key, meta);
    }

    return map;
  }

  async getMaxVersion(): Promise<number> {
    // Scan to find max version (consider using a separate counter item for production)
    const command = {
      TableName: this.tableName,
      ProjectionExpression: '#version',
      ExpressionAttributeNames: {
        '#version': 'version',
      },
    };

    const result = await this.client.send(this.createScanCommand(command)) as {
      Items?: Array<{ version: { N: string } }>;
    };

    const items = result.Items ?? [];
    if (items.length === 0) return 0;

    return Math.max(...items.map((item) => parseInt(item.version.N, 10)));
  }

  async deleteNode(key: string): Promise<void> {
    const command = {
      TableName: this.tableName,
      Key: {
        key: { S: key },
      },
    };

    await this.client.send(this.createDeleteItemCommand(command));
  }

  async isHealthy(): Promise<boolean> {
    try {
      const command = {
        TableName: this.tableName,
        Limit: 1,
      };
      await this.client.send(this.createScanCommand(command));
      return true;
    } catch {
      return false;
    }
  }

  private documentToMeta(doc: DynamoDBDocument): RealityNodeMeta {
    return {
      key: doc.key.S,
      version: parseInt(doc.version.N, 10),
      hash: doc.hash.S,
      updatedAt: parseInt(doc.updatedAt.N, 10),
    };
  }

  private metaToDocument(meta: RealityNodeMeta): DynamoDBDocument {
    return {
      key: { S: meta.key },
      version: { N: String(meta.version) },
      hash: { S: meta.hash },
      updatedAt: { N: String(meta.updatedAt) },
    };
  }

  // Command factory methods (to be replaced with actual AWS SDK commands)
  private createGetItemCommand(input: unknown): { __type: 'GetItem'; input: unknown } {
    return { __type: 'GetItem', input };
  }

  private createPutItemCommand(input: unknown): { __type: 'PutItem'; input: unknown } {
    return { __type: 'PutItem', input };
  }

  private createDeleteItemCommand(input: unknown): { __type: 'DeleteItem'; input: unknown } {
    return { __type: 'DeleteItem', input };
  }

  private createQueryCommand(input: unknown): { __type: 'Query'; input: unknown } {
    return { __type: 'Query', input };
  }

  private createScanCommand(input: unknown): { __type: 'Scan'; input: unknown } {
    return { __type: 'Scan', input };
  }

  private createBatchGetItemCommand(input: unknown): { __type: 'BatchGetItem'; input: unknown } {
    return { __type: 'BatchGetItem', input };
  }
}

/**
 * Create DynamoDB storage adapter
 */
export function createDynamoDBStorage(config: DynamoDBStorageConfig): DynamoDBStorage {
  return new DynamoDBStorage(config);
}

/**
 * CloudFormation template for DynamoDB table
 */
export const DYNAMODB_CLOUDFORMATION = `
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
