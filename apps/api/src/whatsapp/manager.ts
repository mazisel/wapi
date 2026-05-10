import path from "path";
import fs from "fs/promises";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";
import { deviceRepo } from "../db/repositories/device.repo.js";
import { WhatsAppSocket } from "./socket.js";
import type { WASocket } from "@whiskeysockets/baileys";

class DeviceManager {
  private sockets = new Map<string, WhatsAppSocket>();

  async initialize(): Promise<void> {
    const activeDevices = await deviceRepo.findActive();
    logger.info(`${activeDevices.length} bağlı cihaz yükleniyor`);

    await Promise.all(
      activeDevices.map((device) =>
        this.connect(device.id, device.sessionDir).catch((err) =>
          logger.error({ err, deviceId: device.id }, "Cihaz başlatılamadı")
        )
      )
    );
  }

  async connect(deviceId: string, sessionDir: string): Promise<void> {
    const absDir = path.resolve(sessionDir);
    await fs.mkdir(absDir, { recursive: true });

    const socket = new WhatsAppSocket(deviceId, absDir);
    this.sockets.set(deviceId, socket);
    await socket.initialize();
  }

  async createDevice(id: string): Promise<void> {
    const sessionDir = path.join(config.SESSION_BASE_DIR, id);
    await this.connect(id, sessionDir);
  }

  async removeDevice(deviceId: string): Promise<void> {
    const socket = this.sockets.get(deviceId);
    if (socket) {
      await socket.destroy();
      this.sockets.delete(deviceId);
    }

    const sessionDir = path.resolve(config.SESSION_BASE_DIR, deviceId);
    await fs.rm(sessionDir, { recursive: true, force: true });
  }

  getSocket(deviceId: string): WASocket | null {
    return this.sockets.get(deviceId)?.getSocket() ?? null;
  }

  isConnected(deviceId: string): boolean {
    const socket = this.sockets.get(deviceId)?.getSocket();
    return socket?.user != null;
  }
}

export const deviceManager = new DeviceManager();
