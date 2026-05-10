import path from "path";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { deviceRepo } from "../../db/repositories/device.repo.js";
import { statsRepo } from "../../db/repositories/message.repo.js";
import { deviceManager } from "../../whatsapp/manager.js";
import {
  registerQrToken,
  validateQrToken,
  subscribeQr,
} from "../../whatsapp/qr.js";
import { generateId, generateQrToken } from "../../utils/crypto.js";
import { config } from "../../config/index.js";

const createDeviceSchema = z.object({
  name: z.string().min(1).max(100),
});

export async function deviceRoutes(app: FastifyInstance) {
  app.post("/devices", async (request, reply) => {
    const body = createDeviceSchema.parse(request.body);
    const id = generateId();
    const sessionDir = path.join(config.SESSION_BASE_DIR, id);

    const device = await deviceRepo.create({
      id,
      name: body.name,
      sessionDir,
      status: "pending",
    });

    // Baileys bağlantısını başlat
    deviceManager.createDevice(id).catch(() => {});

    const token = generateQrToken();
    registerQrToken(token, id);

    reply.code(201).send({
      id: device.id,
      name: device.name,
      status: device.status,
      qr_ws_url: `/ws/qr/${id}`,
      qr_token: token,
      created_at: device.createdAt,
    });
  });

  app.get("/devices", async (_request, reply) => {
    const devices = await deviceRepo.findAll();
    reply.send({ devices });
  });

  app.get("/devices/:deviceId", async (request, reply) => {
    const { deviceId } = request.params as { deviceId: string };
    const device = await deviceRepo.findById(deviceId);

    if (!device) {
      return reply.code(404).send({ error: "Cihaz bulunamadı" });
    }

    const stats = await statsRepo.getToday(deviceId);

    reply.send({ ...device, today_stats: stats });
  });

  app.delete("/devices/:deviceId", async (request, reply) => {
    const { deviceId } = request.params as { deviceId: string };
    const device = await deviceRepo.findById(deviceId);

    if (!device) {
      return reply.code(404).send({ error: "Cihaz bulunamadı" });
    }

    await deviceManager.removeDevice(deviceId);
    await deviceRepo.delete(deviceId);

    reply.send({ success: true });
  });

  app.post("/devices/:deviceId/reconnect", async (request, reply) => {
    const { deviceId } = request.params as { deviceId: string };
    const device = await deviceRepo.findById(deviceId);

    if (!device) {
      return reply.code(404).send({ error: "Cihaz bulunamadı" });
    }

    await deviceManager.createDevice(deviceId);
    reply.send({ success: true });
  });

  app.get("/devices/:deviceId/qr-token", async (request, reply) => {
    const { deviceId } = request.params as { deviceId: string };
    const device = await deviceRepo.findById(deviceId);

    if (!device) {
      return reply.code(404).send({ error: "Cihaz bulunamadı" });
    }

    // Bağlı değilse yeniden bağlanmayı tetikle — QR üretilsin
    if (!deviceManager.isConnected(deviceId)) {
      deviceManager.createDevice(deviceId).catch(() => {});
    }

    const token = generateQrToken();
    registerQrToken(token, deviceId);

    reply.send({
      token,
      expires_in: Math.floor(config.QR_TOKEN_TTL_MS / 1000),
    });
  });

}
