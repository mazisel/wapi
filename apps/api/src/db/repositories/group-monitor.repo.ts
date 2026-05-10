import { db } from "../index.js";
import { groupMonitors, groupAlerts } from "@wapi/db";
import { eq, and, ne } from "drizzle-orm";
import type { NewGroupMonitor, NewGroupAlert } from "@wapi/db";

export const groupMonitorRepo = {
  async create(data: NewGroupMonitor) {
    const [row] = await db.insert(groupMonitors).values(data).returning();
    return row;
  },

  async findAll() {
    return db.select().from(groupMonitors);
  },

  async findById(id: string) {
    const [row] = await db
      .select()
      .from(groupMonitors)
      .where(eq(groupMonitors.id, id));
    return row ?? null;
  },

  async findByGroupJidAndDevice(groupJid: string, deviceId: string) {
    const [row] = await db
      .select()
      .from(groupMonitors)
      .where(
        and(
          eq(groupMonitors.groupJid, groupJid),
          eq(groupMonitors.deviceId, deviceId),
          eq(groupMonitors.isActive, true)
        )
      );
    return row ?? null;
  },

  async update(id: string, data: Partial<NewGroupMonitor>) {
    const [row] = await db
      .update(groupMonitors)
      .set(data)
      .where(eq(groupMonitors.id, id))
      .returning();
    return row ?? null;
  },

  async delete(id: string) {
    await db.delete(groupMonitors).where(eq(groupMonitors.id, id));
  },
};

export const groupAlertRepo = {
  async create(data: NewGroupAlert) {
    const [row] = await db.insert(groupAlerts).values(data).returning();
    return row;
  },

  async findById(id: string) {
    const [row] = await db
      .select()
      .from(groupAlerts)
      .where(eq(groupAlerts.id, id));
    return row ?? null;
  },

  async findOpenByMonitor(monitorId: string) {
    return db
      .select()
      .from(groupAlerts)
      .where(
        and(
          eq(groupAlerts.monitorId, monitorId),
          ne(groupAlerts.status, "resolved")
        )
      );
  },

  async listByMonitor(monitorId: string) {
    return db
      .select()
      .from(groupAlerts)
      .where(eq(groupAlerts.monitorId, monitorId));
  },

  async updateStatus(
    id: string,
    status: "watching" | "wave1_sent" | "wave2_sent" | "resolved",
    extra?: {
      wave1SentAt?: Date;
      wave2SentAt?: Date;
      resolvedAt?: Date;
      resolvedBy?: string;
    }
  ) {
    const [row] = await db
      .update(groupAlerts)
      .set({ status, ...extra })
      .where(eq(groupAlerts.id, id))
      .returning();
    return row ?? null;
  },

  async resolveOpenAlerts(monitorId: string, resolvedBy: string) {
    await db
      .update(groupAlerts)
      .set({ status: "resolved", resolvedAt: new Date(), resolvedBy })
      .where(
        and(
          eq(groupAlerts.monitorId, monitorId),
          ne(groupAlerts.status, "resolved")
        )
      );
  },
};
