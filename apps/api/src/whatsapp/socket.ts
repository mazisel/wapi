import baileysPkg, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  type WASocket,
} from "@whiskeysockets/baileys";

// CJS modülü tsx/ESM interop ile bazen { default: fn } olarak geliyor —
// her iki şekli de tolere et
const makeWASocket: any =
  typeof baileysPkg === "function"
    ? baileysPkg
    : (baileysPkg as any)?.default ?? baileysPkg;
import type { Boom } from "@hapi/boom";
import path from "path";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";
import { deviceRepo } from "../db/repositories/device.repo.js";
import { broadcastQr, broadcastConnected, broadcastDisconnected } from "./qr.js";
import { bindMessageEvents } from "./events.js";
import { webhookDispatcher } from "../webhooks/dispatcher.js";
import { RECONNECT_DELAYS_MS, MAX_RECONNECT_ATTEMPTS } from "../config/constants.js";

export class WhatsAppSocket {
  private socket: WASocket | null = null;
  private reconnectAttempts = 0;
  private isDestroyed = false;

  constructor(
    public readonly deviceId: string,
    private readonly sessionDir: string
  ) {}

  async initialize(): Promise<void> {
    if (this.isDestroyed) return;

    logger.info({ deviceId: this.deviceId }, "Baileys initialize başlıyor");

    const { version } = await fetchLatestBaileysVersion();
    logger.info(
      { deviceId: this.deviceId, version },
      "Baileys versiyonu alındı"
    );

    const { state, saveCreds } = await useMultiFileAuthState(this.sessionDir);
    logger.info(
      { deviceId: this.deviceId, hasCreds: !!state.creds.me },
      "Auth state yüklendi"
    );

    const log = logger.child({ deviceId: this.deviceId });

    const socket: WASocket = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, log as any),
      },
      printQRInTerminal: false,
      logger: log as any,
      browser: ["Wapi", "Chrome", "130.0.0"],
      generateHighQualityLinkPreview: false,
    });
    this.socket = socket;

    logger.info({ deviceId: this.deviceId }, "Baileys socket oluşturuldu");

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      logger.info(
        { deviceId: this.deviceId, connection, hasQr: !!qr },
        "connection.update"
      );

      if (qr) {
        await broadcastQr(this.deviceId, qr);
      }

      if (connection === "open") {
        this.reconnectAttempts = 0;
        const phone = socket.user?.id
          ? socket.user.id.split(":")[0]
          : undefined;

        await deviceRepo.updateStatus(this.deviceId, "connected", phone);
        broadcastConnected(this.deviceId, phone ?? "");
        await webhookDispatcher.fire("device.connected", {
          device_id: this.deviceId,
          phone,
        });
        log.info("Bağlantı açıldı");
      }

      if (connection === "close") {
        const statusCode =
          (lastDisconnect?.error as Boom)?.output?.statusCode ?? 0;

        log.warn({ statusCode }, "Bağlantı kapandı");

        if (statusCode === DisconnectReason.loggedOut) {
          await deviceRepo.updateStatus(this.deviceId, "banned");
          log.error("Cihaz bant dışı edildi");
          return;
        }

        await this.scheduleReconnect();
      }
    });

    bindMessageEvents(socket, this.deviceId);
  }

  private async scheduleReconnect(): Promise<void> {
    if (this.isDestroyed) return;
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      await deviceRepo.updateStatus(this.deviceId, "disconnected");
      broadcastDisconnected(this.deviceId);
      await webhookDispatcher.fire("device.disconnected", {
        device_id: this.deviceId,
      });
      return;
    }

    const delay = RECONNECT_DELAYS_MS[this.reconnectAttempts] ?? 120_000;
    this.reconnectAttempts++;

    logger.info(
      { deviceId: this.deviceId, attempt: this.reconnectAttempts, delay },
      `${delay}ms sonra yeniden bağlanılıyor`
    );

    setTimeout(() => this.initialize(), delay);
  }

  getSocket(): WASocket | null {
    return this.socket;
  }

  async destroy(): Promise<void> {
    this.isDestroyed = true;
    try {
      await this.socket?.logout();
    } catch {
      // socket bağlı olmayabilir, logout hatasını yoksay
    }
    try {
      this.socket?.end(undefined);
    } catch {
      // ignore
    }
    this.socket = null;
  }
}
