import QRCode from "qrcode";
import type { WebSocket } from "ws";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

type QrSubscriber = {
  ws: WebSocket;
  timer: ReturnType<typeof setTimeout>;
};

const subscribers = new Map<string, Set<QrSubscriber>>();

const qrTokens = new Map<string, { deviceId: string; expiresAt: number }>();

export function registerQrToken(token: string, deviceId: string): void {
  qrTokens.set(token, {
    deviceId,
    expiresAt: Date.now() + config.QR_TOKEN_TTL_MS,
  });
}

export function validateQrToken(token: string, deviceId: string): boolean {
  const entry = qrTokens.get(token);
  if (!entry) return false;
  if (entry.deviceId !== deviceId) return false;
  if (Date.now() > entry.expiresAt) {
    qrTokens.delete(token);
    return false;
  }
  qrTokens.delete(token);
  return true;
}

export function subscribeQr(deviceId: string, ws: WebSocket): void {
  const timer = setTimeout(() => {
    sendToDevice(deviceId, { type: "timeout" });
    ws.close();
  }, config.QR_WS_TIMEOUT_MS);

  const subscriber: QrSubscriber = { ws, timer };

  if (!subscribers.has(deviceId)) {
    subscribers.set(deviceId, new Set());
  }
  subscribers.get(deviceId)!.add(subscriber);

  ws.on("close", () => {
    clearTimeout(timer);
    subscribers.get(deviceId)?.delete(subscriber);
  });
}

export async function broadcastQr(deviceId: string, qrString: string): Promise<void> {
  try {
    const png = await QRCode.toDataURL(qrString);
    sendToDevice(deviceId, { type: "qr", data: png });
  } catch (err) {
    logger.error({ err, deviceId }, "QR PNG oluşturulamadı");
  }
}

export function broadcastConnected(deviceId: string, phone: string): void {
  sendToDevice(deviceId, { type: "connected", data: { phone } });
  cleanupDeviceSubscribers(deviceId);
}

export function broadcastDisconnected(deviceId: string): void {
  sendToDevice(deviceId, { type: "disconnected" });
  cleanupDeviceSubscribers(deviceId);
}

function sendToDevice(deviceId: string, payload: unknown): void {
  const subs = subscribers.get(deviceId);
  if (!subs) return;
  const json = JSON.stringify(payload);
  for (const sub of subs) {
    if (sub.ws.readyState === sub.ws.OPEN) {
      sub.ws.send(json);
    }
  }
}

function cleanupDeviceSubscribers(deviceId: string): void {
  const subs = subscribers.get(deviceId);
  if (!subs) return;
  for (const sub of subs) {
    clearTimeout(sub.timer);
  }
  subscribers.delete(deviceId);
}
