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

  private async connect(deviceId: string, sessionDir: string): Promise<void> {
    // Varsa önce eski socket'ı temizle
    const existing = this.sockets.get(deviceId);
    if (existing) {
      await existing.destroy().catch(() => {});
      this.sockets.delete(deviceId);
    }

    const absDir = path.resolve(sessionDir);
    await fs.mkdir(absDir, { recursive: true });

    const socket = new WhatsAppSocket(deviceId, absDir);
    this.sockets.set(deviceId, socket);
    try {
      await socket.initialize();
    } catch (err) {
      this.sockets.delete(deviceId);
      throw err;
    }
  }

  async createDevice(id: string): Promise<void> {
    // Zaten çalışan bir socket varsa yeniden başlatma
    if (this.sockets.has(id)) {
      logger.info({ deviceId: id }, "Socket zaten mevcut, atlanıyor");
      return;
    }
    const sessionDir = path.join(config.SESSION_BASE_DIR, id);
    await this.connect(id, sessionDir);
  }

  // Kullanıcı QR taramak istediğinde çağrılır:
  // mevcut oturumu temizler, yeni Baileys socket başlatır → her zaman QR üretilir
  async startQRSession(id: string): Promise<void> {
    const existing = this.sockets.get(id);
    if (existing) {
      await existing.destroy().catch(() => {});
      this.sockets.delete(id);
    }
    const sessionDir = path.join(config.SESSION_BASE_DIR, id);
    // Eski oturum dosyalarını temizle → Baileys yeni QR üretir
    await fs.rm(sessionDir, { recursive: true, force: true });
    await this.connect(id, sessionDir);
  }

  async removeDevice(deviceId: string): Promise<void> {
    const socket = this.sockets.get(deviceId);
    if (socket) {
      await socket.destroy().catch(() => {});
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
