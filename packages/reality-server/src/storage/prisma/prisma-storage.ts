/**
 * @rootlodge/reality-server - Prisma Storage Adapter
 * 
 * Prisma ORM integration for Reality storage.
 */

import type { RealityStorage, RealityNodeMeta } from '../../types';

/**
 * Prisma client interface (minimal subset)
 */
export interface PrismaClient {
  realityNode: {
    findUnique: (args: { where: { key: string } }) => Promise<PrismaRealityNode | null>;
    findMany: (args: { where?: unknown; orderBy?: unknown }) => Promise<PrismaRealityNode[]>;
    upsert: (args: {
      where: { key: string };
      create: PrismaRealityNodeInput;
      update: PrismaRealityNodeInput;
    }) => Promise<PrismaRealityNode>;
    delete: (args: { where: { key: string } }) => Promise<void>;
    aggregate: (args: { _max: { version: true } }) => Promise<{ _max: { version: number | null } }>;
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
export interface PrismaStorageConfig {
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
export class PrismaStorage implements RealityStorage {
  private prisma: PrismaClient;

  constructor(config: PrismaStorageConfig) {
    this.prisma = config.prisma;
  }

  async getNode(key: string): Promise<RealityNodeMeta | null> {
    const node = await this.prisma.realityNode.findUnique({
      where: { key },
    });

    if (!node) return null;

    return {
      key: node.key,
      version: Number(node.version),
      hash: node.hash,
      updatedAt: Number(node.updatedAt),
    };
  }

  async setNode(meta: RealityNodeMeta): Promise<void> {
    await this.prisma.realityNode.upsert({
      where: { key: meta.key },
      create: {
        key: meta.key,
        version: BigInt(meta.version),
        hash: meta.hash,
        updatedAt: BigInt(meta.updatedAt),
      },
      update: {
        version: BigInt(meta.version),
        hash: meta.hash,
        updatedAt: BigInt(meta.updatedAt),
      },
    });
  }

  async incrementVersion(key: string, hash: string): Promise<RealityNodeMeta> {
    return this.prisma.$transaction(async (tx) => {
      // Get current max version
      const result = await tx.realityNode.aggregate({
        _max: { version: true },
      });

      const maxVersion = result._max.version ?? BigInt(0);
      const newVersion = Number(maxVersion) + 1;

      const meta: RealityNodeMeta = {
        key,
        version: newVersion,
        hash,
        updatedAt: Date.now(),
      };

      await tx.realityNode.upsert({
        where: { key },
        create: {
          key: meta.key,
          version: BigInt(meta.version),
          hash: meta.hash,
          updatedAt: BigInt(meta.updatedAt),
        },
        update: {
          version: BigInt(meta.version),
          hash: meta.hash,
          updatedAt: BigInt(meta.updatedAt),
        },
      });

      return meta;
    });
  }

  async listChangedSince(version: number): Promise<RealityNodeMeta[]> {
    const nodes = await this.prisma.realityNode.findMany({
      where: {
        version: { gt: BigInt(version) },
      },
      orderBy: {
        version: 'asc',
      },
    });

    return nodes.map((node) => ({
      key: node.key,
      version: Number(node.version),
      hash: node.hash,
      updatedAt: Number(node.updatedAt),
    }));
  }

  async getNodes(keys: string[]): Promise<Map<string, RealityNodeMeta>> {
    if (keys.length === 0) {
      return new Map();
    }

    const nodes = await this.prisma.realityNode.findMany({
      where: {
        key: { in: keys },
      },
    });

    const map = new Map<string, RealityNodeMeta>();
    for (const node of nodes) {
      map.set(node.key, {
        key: node.key,
        version: Number(node.version),
        hash: node.hash,
        updatedAt: Number(node.updatedAt),
      });
    }

    return map;
  }

  async getMaxVersion(): Promise<number> {
    const result = await this.prisma.realityNode.aggregate({
      _max: { version: true },
    });

    return Number(result._max.version ?? 0);
  }

  async deleteNode(key: string): Promise<void> {
    try {
      await this.prisma.realityNode.delete({
        where: { key },
      });
    } catch {
      // Ignore if not found
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Create Prisma storage adapter
 */
export function createPrismaStorage(config: PrismaStorageConfig): PrismaStorage {
  return new PrismaStorage(config);
}

/**
 * Prisma schema for Reality nodes
 */
export const PRISMA_SCHEMA = `
model RealityNode {
  key       String   @id @db.VarChar(255)
  version   BigInt
  hash      String   @db.VarChar(64)
  updatedAt BigInt   @map("updated_at")

  @@index([version])
  @@map("reality_nodes")
}
`;
