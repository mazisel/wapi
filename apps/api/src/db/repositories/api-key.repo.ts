import { eq } from "drizzle-orm";
import { db } from "../index.js";
import { apiKeys, type ApiKey, type NewApiKey } from "@wapi/db";

export const apiKeyRepo = {
  async create(data: NewApiKey): Promise<ApiKey> {
    const [key] = await db.insert(apiKeys).values(data).returning();
    return key;
  },

  async findByHash(hash: string): Promise<ApiKey | undefined> {
    const [key] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.keyHash, hash));
    return key;
  },

  async findAll(): Promise<ApiKey[]> {
    return db.select().from(apiKeys);
  },

  async deactivate(id: string): Promise<void> {
    await db
      .update(apiKeys)
      .set({ isActive: false })
      .where(eq(apiKeys.id, id));
  },

  async touchLastUsed(id: string): Promise<void> {
    await db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, id));
  },
};
