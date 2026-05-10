import { logger } from "../utils/logger.js";
import { generateId } from "../utils/crypto.js";
import { groupMonitorRepo, groupAlertRepo } from "../db/repositories/group-monitor.repo.js";
import { enqueueWave1, cancelAlertJobs } from "./alert-queue.js";

function normalizeNumber(jid: string): string {
  return jid.replace(/@.*/, "").replace(/:\d+/, "");
}

export async function handleGroupMessage(opts: {
  deviceId: string;
  groupJid: string;
  senderJid: string;
  senderName?: string;
  text: string;
  waMsgId?: string;
}): Promise<void> {
  const { deviceId, groupJid, senderJid, senderName, text, waMsgId } = opts;

  const monitor = await groupMonitorRepo.findByGroupJidAndDevice(groupJid, deviceId);
  if (!monitor) return;

  const senderNumber = normalizeNumber(senderJid);
  const isTeam = (monitor.teamNumbers ?? []).some(
    (n) => normalizeNumber(n) === senderNumber
  );

  if (isTeam) {
    // Ekip üyesi yazdı → açık uyarıları kapat
    const open = await groupAlertRepo.findOpenByMonitor(monitor.id);
    if (open.length > 0) {
      await groupAlertRepo.resolveOpenAlerts(monitor.id, senderJid);
      await Promise.all(open.map((a) => cancelAlertJobs(a.id)));
      logger.info(
        { monitorId: monitor.id, resolvedBy: senderJid, count: open.length },
        "Grup uyarıları çözüldü, kuyruk işleri iptal edildi"
      );
    }
    return;
  }

  // Dışarıdan mesaj — açık uyarı var mı?
  const open = await groupAlertRepo.findOpenByMonitor(monitor.id);
  if (open.length > 0) return; // Zaten izleniyor

  const alert = await groupAlertRepo.create({
    id: generateId(),
    monitorId: monitor.id,
    triggerMsgId: waMsgId,
    senderJid,
    senderName,
    messageText: text,
    status: "watching",
  });

  await enqueueWave1(alert.id);

  logger.info(
    { alertId: alert.id, groupJid, senderJid },
    "Grup uyarısı oluşturuldu, wave1 planlandı"
  );
}
