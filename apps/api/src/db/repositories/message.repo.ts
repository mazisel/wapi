import { eq, and, desc, gte, lte, sql } from "drizzle-orm";
import { db } from "../index.js";
import {
  messages,
  incomingMessages,
  deviceStats,
  type Message,
  type NewMessage,
  type IncomingMessage,
  type NewIncomingMessage,
} from "@wapi/db";

export const messageRepo = {
  async create(data: NewMessage): Promise<Message> {
    const [msg] = await db.insert(messages).values(data).returning();
    return msg;
  },

  async findById(id: string): Promise<Message | undefined> {
    const [msg] = await db
      .select()
      .from(messages)
      .where(eq(messages.id, id));
    return msg;
  },

  async list(params: {
    deviceId?: string;
    status?: Message["status"];
    fromDate?: Date;
    toDate?: Date;
    page?: number;
    limit?: number;
  }): Promise<{ messages: Message[]; total: number }> {
    const { deviceId, status, fromDate, toDate, page = 1, limit = 50 } = params;
    const conditions = [];
    if (deviceId) conditions.push(eq(messages.deviceId, deviceId));
    if (status) conditions.push(eq(messages.status, status));
    if (fromDate) conditions.push(gte(messages.queuedAt, fromDate));
    if (toDate) conditions.push(lte(messages.queuedAt, toDate));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [{ count }]] = await Promise.all([
      db
        .select()
        .from(messages)
        .where(where)
        .orderBy(desc(messages.queuedAt))
        .limit(limit)
        .offset((page - 1) * limit),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(messages)
        .where(where),
    ]);

    return { messages: rows, total: count };
  },

  async updateStatus(
    id: string,
    status: Message["status"],
    extras?: Partial<Pick<Message, "error" | "waMsgId" | "sentAt" | "deliveredAt" | "readAt">>
  ): Promise<void> {
    await db
      .update(messages)
      .set({ status, ...extras })
      .where(eq(messages.id, id));
  },

  async incrementRetry(id: string): Promise<void> {
    await db
      .update(messages)
      .set({ retryCount: sql`${messages.retryCount} + 1` })
      .where(eq(messages.id, id));
  },
};

export const incomingRepo = {
  async create(data: NewIncomingMessage): Promise<IncomingMessage> {
    const [msg] = await db
      .insert(incomingMessages)
      .values(data)
      .onConflictDoNothing()
      .returning();
    return msg;
  },

  async markWebhookSent(id: string): Promise<void> {
    await db
      .update(incomingMessages)
      .set({ webhookSent: true })
      .where(eq(incomingMessages.id, id));
  },
};

export const statsRepo = {
  async incrementSent(deviceId: string): Promise<void> {
    const today = new Date().toISOString().split("T")[0];
    await db
      .insert(deviceStats)
      .values({ deviceId, date: today, messagesSent: 1, messagesFailed: 0 })
      .onConflictDoUpdate({
        target: [deviceStats.deviceId, deviceStats.date],
        set: { messagesSent: sql`${deviceStats.messagesSent} + 1` },
      });
  },

  async incrementFailed(deviceId: string): Promise<void> {
    const today = new Date().toISOString().split("T")[0];
    await db
      .insert(deviceStats)
      .values({ deviceId, date: today, messagesSent: 0, messagesFailed: 1 })
      .onConflictDoUpdate({
        target: [deviceStats.deviceId, deviceStats.date],
        set: { messagesFailed: sql`${deviceStats.messagesFailed} + 1` },
      });
  },

  async getToday(deviceId: string) {
    const today = new Date().toISOString().split("T")[0];
    const [row] = await db
      .select()
      .from(deviceStats)
      .where(
        and(eq(deviceStats.deviceId, deviceId), eq(deviceStats.date, today))
      );
    return row ?? { messagesSent: 0, messagesFailed: 0 };
  },
};
