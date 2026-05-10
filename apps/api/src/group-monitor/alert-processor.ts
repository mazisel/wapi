import { Worker, type Job } from "bullmq";
import { redisConnection } from "../queue/message-queue.js";
import { logger } from "../utils/logger.js";
import { groupAlertRepo, groupMonitorRepo } from "../db/repositories/group-monitor.repo.js";
import { deviceManager } from "../whatsapp/manager.js";
import { ALERT_QUEUE_NAME, enqueueWave2, type AlertJobData } from "./alert-queue.js";

let alertWorker: Worker<AlertJobData> | null = null;

export function startAlertWorker(): Worker<AlertJobData> {
  if (alertWorker) return alertWorker;

  alertWorker = new Worker<AlertJobData>(
    ALERT_QUEUE_NAME,
    async (job: Job<AlertJobData>) => {
      const { alertId, wave } = job.data;
      if (wave === 1) {
        await processWave1(alertId);
      } else {
        await processWave2(alertId);
      }
    },
    { connection: redisConnection, concurrency: 5 }
  );

  alertWorker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "Alert job başarısız");
  });

  return alertWorker;
}

async function processWave1(alertId: string): Promise<void> {
  const alert = await groupAlertRepo.findById(alertId);
  if (!alert || alert.status !== "watching") return;

  const monitor = await groupMonitorRepo.findById(alert.monitorId);
  if (!monitor) return;

  const socket = deviceManager.getSocket(monitor.deviceId);
  if (!socket) {
    logger.warn({ alertId, deviceId: monitor.deviceId }, "Wave1: socket bulunamadı");
    return;
  }

  const groupName = monitor.groupName ?? monitor.groupJid;
  const text =
    `⚠️ *${groupName}* grubunda yanıtsız mesaj!\n` +
    `Gönderen: ${alert.senderName ?? alert.senderJid}\n` +
    `Mesaj: ${alert.messageText ?? "(içerik yok)"}\n` +
    `Lütfen ilgilenin.`;

  for (const jid of monitor.alertGroupJids ?? []) {
    try {
      await socket.sendMessage(jid, { text });
    } catch (err) {
      logger.error({ err, jid, alertId }, "Wave1 grup mesajı gönderilemedi");
    }
  }

  await groupAlertRepo.updateStatus(alertId, "wave1_sent", { wave1SentAt: new Date() });
  logger.info({ alertId }, "Wave1 tamamlandı, wave2 planlanıyor");

  await enqueueWave2(alertId);
}

async function processWave2(alertId: string): Promise<void> {
  const alert = await groupAlertRepo.findById(alertId);
  if (!alert || alert.status !== "wave1_sent") return;

  const monitor = await groupMonitorRepo.findById(alert.monitorId);
  if (!monitor) return;

  const socket = deviceManager.getSocket(monitor.deviceId);
  if (!socket) {
    logger.warn({ alertId, deviceId: monitor.deviceId }, "Wave2: socket bulunamadı");
    return;
  }

  const groupName = monitor.groupName ?? monitor.groupJid;
  const text =
    `⚠️ *${groupName}* grubunda 10 dk süredir yanıt verilmedi!\n` +
    `Gönderen: ${alert.senderName ?? alert.senderJid}\n` +
    `Mesaj: ${alert.messageText ?? "(içerik yok)"}`;

  for (const contact of monitor.alertContacts ?? []) {
    const jid = contact.includes("@") ? contact : `${contact.replace(/\D/g, "")}@s.whatsapp.net`;
    try {
      await socket.sendMessage(jid, { text });
    } catch (err) {
      logger.error({ err, jid, alertId }, "Wave2 DM gönderilemedi");
    }
  }

  await groupAlertRepo.updateStatus(alertId, "wave2_sent", { wave2SentAt: new Date() });
  logger.info({ alertId }, "Wave2 tamamlandı");
}
