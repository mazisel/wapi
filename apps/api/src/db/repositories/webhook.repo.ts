import { eq } from "drizzle-orm";
import { db } from "../index.js";
import { webhooks, type Webhook, type NewWebhook } from "@wapi/db";

export const webhookRepo = {
  async create(data: NewWebhook): Promise<Webhook> {
    const [wh] = await db.insert(webhooks).values(data).returning();
    return wh;
  },

  async findAll(): Promise<Webhook[]> {
    return db.select().from(webhooks);
  },

  async findActive(): Promise<Webhook[]> {
    return db
      .select()
      .from(webhooks)
      .where(eq(webhooks.isActive, true));
  },

  async findActiveByEvent(event: string): Promise<Webhook[]> {
    const all = await this.findActive();
    return all.filter((wh) => wh.events.includes(event));
  },

  async delete(id: string): Promise<void> {
    await db.delete(webhooks).where(eq(webhooks.id, id));
  },
};
