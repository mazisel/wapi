import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { messageRepo } from "../../db/repositories/message.repo.js";
import { deviceRepo } from "../../db/repositories/device.repo.js";
import { enqueueMessage } from "../../queue/message-queue.js";
import { ensureWorker } from "../../queue/processor.js";
import { checkRateLimit } from "../../spam/rate-limiter.js";
import { isRegisteredOnWhatsApp } from "../../spam/number-validator.js";
import { generateId } from "../../utils/crypto.js";
import { toJid, isValidPhone } from "../../utils/phone.js";
import { calculateDelay } from "../../spam/delay-engine.js";

const sendSchema = z.object({
  device_id: z.string(),
  to: z.string(),
  type: z.literal("text").default("text"),
  text: z.string().min(1).max(4096),
  validate_number: z.boolean().default(true),
});

const bulkSendSchema = z.object({
  device_id: z.string(),
  messages: z
    .array(
      z.object({
        to: z.string(),
        text: z.string().min(1).max(4096),
      })
    )
    .min(1)
    .max(50),
});

export async function messageRoutes(app: FastifyInstance) {
  app.post("/messages/send", async (request, reply) => {
    const body = sendSchema.parse(request.body);

    // Cihaz kontrolü
    const device = await deviceRepo.findById(body.device_id);
    if (!device || device.status !== "connected") {
      return reply.code(422).send({ error: "Cihaz bağlı değil" });
    }

    // Cihaz izin kontrolü
    const { allowedDeviceIds } = request;
    if (allowedDeviceIds && !allowedDeviceIds.includes(body.device_id)) {
      return reply.code(403).send({ error: "Bu cihaza erişim yetkiniz yok" });
    }

    // Telefon numarası doğrulama
    if (!isValidPhone(body.to)) {
      return reply.code(422).send({ error: "Geçersiz telefon numarası" });
    }

    const jid = toJid(body.to);

    // WhatsApp kaydı kontrolü
    if (body.validate_number) {
      const registered = await isRegisteredOnWhatsApp(body.to, body.device_id);
      if (!registered) {
        return reply
          .code(422)
          .send({ error: "Bu numara WhatsApp'a kayıtlı değil" });
      }
    }

    // Rate limit kontrolü
    const limitResult = await checkRateLimit(body.device_id);
    if (!limitResult.allowed) {
      reply.header(
        "Retry-After",
        Math.ceil(limitResult.retry_after_ms / 1000).toString()
      );
      return reply.code(429).send({
        error: `Mesaj limiti aşıldı (${limitResult.reason})`,
        retry_after_ms: limitResult.retry_after_ms,
      });
    }

    // Mesajı DB'ye kaydet
    const messageId = generateId();
    await messageRepo.create({
      id: messageId,
      deviceId: body.device_id,
      toNumber: body.to,
      body: body.text,
      type: "text",
      status: "queued",
      apiKeyId: request.apiKeyId !== "master" ? request.apiKeyId : null,
    });

    // Kuyruğa ekle
    ensureWorker(body.device_id);
    await enqueueMessage({
      messageId,
      deviceId: body.device_id,
      toJid: jid,
      type: "text",
      text: body.text,
    });

    const estimatedDelayMs = calculateDelay(0);
    const estimatedSendAt = new Date(Date.now() + estimatedDelayMs);

    reply.code(202).send({
      message_id: messageId,
      status: "queued",
      estimated_send_at: estimatedSendAt.toISOString(),
    });
  });

  app.post("/messages/send-bulk", async (request, reply) => {
    const body = bulkSendSchema.parse(request.body);

    const device = await deviceRepo.findById(body.device_id);
    if (!device || device.status !== "connected") {
      return reply.code(422).send({ error: "Cihaz bağlı değil" });
    }

    const messageIds: string[] = [];
    let cumulativeDelay = 0;

    for (const item of body.messages) {
      if (!isValidPhone(item.to)) continue;

      const messageId = generateId();
      const jid = toJid(item.to);

      await messageRepo.create({
        id: messageId,
        deviceId: body.device_id,
        toNumber: item.to,
        body: item.text,
        type: "text",
        status: "queued",
        apiKeyId: request.apiKeyId !== "master" ? request.apiKeyId : null,
      });

      cumulativeDelay += calculateDelay(messageIds.length);

      ensureWorker(body.device_id);
      await enqueueMessage(
        {
          messageId,
          deviceId: body.device_id,
          toJid: jid,
          type: "text",
          text: item.text,
        },
        cumulativeDelay
      );

      messageIds.push(messageId);
    }

    reply.code(202).send({
      queued: messageIds.length,
      message_ids: messageIds,
    });
  });

  app.get("/messages/:messageId", async (request, reply) => {
    const { messageId } = request.params as { messageId: string };
    const msg = await messageRepo.findById(messageId);

    if (!msg) {
      return reply.code(404).send({ error: "Mesaj bulunamadı" });
    }

    reply.send(msg);
  });

  app.get("/messages", async (request, reply) => {
    const query = request.query as Record<string, string>;

    const { messages, total } = await messageRepo.list({
      deviceId: query.device_id,
      status: query.status as any,
      fromDate: query.from_date ? new Date(query.from_date) : undefined,
      toDate: query.to_date ? new Date(query.to_date) : undefined,
      page: query.page ? parseInt(query.page) : 1,
      limit: query.limit ? Math.min(parseInt(query.limit), 100) : 50,
    });

    reply.send({ messages, total, page: parseInt(query.page ?? "1") });
  });

  app.get("/metrics", async (_request, reply) => {
    const devices = await deviceRepo.findAll();
    const { statsRepo } = await import(
      "../../db/repositories/message.repo.js"
    );

    const metrics = await Promise.all(
      devices.map(async (device) => {
        const stats = await statsRepo.getToday(device.id);
        return {
          id: device.id,
          name: device.name,
          status: device.status,
          phone: device.phone,
          today_sent: stats.messagesSent,
          today_failed: stats.messagesFailed,
        };
      })
    );

    reply.send({ devices: metrics });
  });
}
