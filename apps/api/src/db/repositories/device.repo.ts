import { eq, and } from "drizzle-orm";
import { db } from "../index.js";
import { devices, type Device, type NewDevice } from "@wapi/db";

export const deviceRepo = {
  async create(data: NewDevice): Promise<Device> {
    const [device] = await db.insert(devices).values(data).returning();
    return device;
  },

  async findById(id: string): Promise<Device | undefined> {
    const [device] = await db
      .select()
      .from(devices)
      .where(eq(devices.id, id));
    return device;
  },

  async findAll(): Promise<Device[]> {
    return db.select().from(devices);
  },

  async findActive(): Promise<Device[]> {
    return db
      .select()
      .from(devices)
      .where(eq(devices.status, "connected"));
  },

  async updateStatus(
    id: string,
    status: Device["status"],
    phone?: string
  ): Promise<void> {
    await db
      .update(devices)
      .set({
        status,
        ...(phone ? { phone } : {}),
        updatedAt: new Date(),
      })
      .where(eq(devices.id, id));
  },

  async delete(id: string): Promise<void> {
    await db.delete(devices).where(eq(devices.id, id));
  },
};
