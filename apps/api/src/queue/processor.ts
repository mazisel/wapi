import { Worker, type Job } from "bullmq";
import { QUEUE_NAME_PREFIX } from "../config/constants.js";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";
import { redisConnection, type MessageJobData } from "./message-queue.js";
import { checkRateLimit, checkMinGap, recordSent } from "../spam/rate-limiter.js";
import { calculateDelay, sleep } from "../spam/delay-engine.js";
import { simulateTyping } from "../spam/typing-sim.js";
import { deviceManager } from "../whatsapp/manager.js";
import { messageRepo, statsRepo } from "../db/repositories/message.repo.js";
import { webhookDispatcher } from "../webhooks/dispatcher.js";
import { db } from "../db/index.js";
import { rateLimitState } from "@wapi/db";
import { eq, sql } from "drizzle-orm";

const activeWorkers = new Map<string, Worker<MessageJobData>>();

export function startWorker(deviceId: string): Worker<MessageJobData> {
  if (activeWorkers.has(deviceId)) {
    return activeWorkers.get(deviceId)!;
  }

  const worker = new Worker<MessageJobData>(
    `${QUEUE_NAME_PREFIX}:${deviceId}:messages`,
    async (job: Job<MessageJobData>) => {
      await processMessage(job);
    },
    {
      connection: redisConnection,
      concurrency: 1,
    }
  );

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err, deviceId }, "Mesaj işleme hatası");
  });

  activeWorkers.set(deviceId, worker);
  return worker;
}

async function processMessage(job: Job<MessageJobData>): Promise<void> {
  const { messageId, deviceId, toJid, text } = job.data;
  const log = logger.child({ messageId, deviceId });

  // Rate limit kontrolü (stale job koruması)
  const limitResult = await checkRateLimit(deviceId);
  if (!limitResult.allowed) {
    log.warn({ reason: limitResult.reason }, "Rate limit aşıldı, job yeniden kuyruklanıyor");
    // Geciktirerek yeniden dene
    await job.moveToDelayed(Date.now() + limitResult.retry_after_ms);
    return;
  }

  // MIN_GAP kontrolü
  if (!checkMinGap(deviceId)) {
    await sleep(config.MIN_MSG_GAP_MS);
  }

  // Saatlik sayacı oku (gecikme hesabı için)
  const [state] = await db
    .select({ hourlyCount: rateLimitState.hourlyCount })
    .from(rateLimitState)
    .where(eq(rateLimitState.deviceId, deviceId));

  const hourlyCount = state?.hourlyCount ?? 0;

  // İnsan gibi gecikme
  const delay = calculateDelay(hourlyCount);
  log.debug({ delay }, "Gönderim gecikmesi bekleniyor");
  await sleep(delay);

  // Socket kontrolü
  const socket = deviceManager.getSocket(deviceId);
  if (!socket) {
    throw new Error(`Cihaz bağlı değil: ${deviceId}`);
  }

  // Durum güncelle → sending
  await messageRepo.updateStatus(messageId, "sending");

  // Yazma simülasyonu
  await simulateTyping(socket, toJid, text);

  // Mesaj gönder
  const sent = await socket.sendMessage(toJid, { text });
  const waId = sent?.key?.id;

  // Başarılı
  recordSent(deviceId);
  await messageRepo.updateStatus(messageId, "sent", {
    waMsgId: waId,
    sentAt: new Date(),
  });
  await statsRepo.incrementSent(deviceId);

  await webhookDispatcher.fire("message.sent", {
    message_id: messageId,
    device_id: deviceId,
    to: toJid,
    wa_msg_id: waId,
    sent_at: new Date().toISOString(),
  });

  log.info({ waId }, "Mesaj gönderildi");
}

export async function ensureWorker(deviceId: string): Promise<void> {
  startWorker(deviceId);
}
