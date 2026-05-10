import type { WASocket, proto } from "@whiskeysockets/baileys";
import { generateId } from "../utils/crypto.js";
import { fromJid } from "../utils/phone.js";
import { incomingRepo } from "../db/repositories/message.repo.js";
import { messageRepo } from "../db/repositories/message.repo.js";
import { webhookDispatcher } from "../webhooks/dispatcher.js";
import { logger } from "../utils/logger.js";
import { handleGroupMessage } from "../group-monitor/monitor-service.js";

export function bindMessageEvents(socket: WASocket, deviceId: string) {
  socket.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      if (msg.key.fromMe) {
        await handleOutgoingUpdate(msg, deviceId);
        continue;
      }

      const jid = msg.key.remoteJid ?? "";
      if (jid.endsWith("@g.us")) {
        await handleGroupIncoming(msg, deviceId);
      } else {
        await handleIncomingMessage(msg, deviceId);
      }
    }
  });

  socket.ev.on("message-receipt.update", async (updates) => {
    for (const update of updates) {
      const msgId = update.key.id;
      if (!msgId) continue;

      const receipt = update.receipt;
      if (receipt.receiptTimestamp) {
        const msg = await findMessageByWaId(msgId, deviceId);
        if (!msg) continue;

        await messageRepo.updateStatus(msg.id, "delivered", {
          deliveredAt: new Date(receipt.receiptTimestamp * 1000),
        });
        await webhookDispatcher.fire("message.delivered", {
          message_id: msg.id,
          device_id: deviceId,
          wa_msg_id: msgId,
        });
      }
    }
  });
}

async function handleIncomingMessage(
  msg: proto.IWebMessageInfo,
  deviceId: string
) {
  try {
    const from = fromJid(msg.key.remoteJid ?? "");
    const body =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      "";

    const incoming = await incomingRepo.create({
      id: generateId(),
      deviceId,
      fromNumber: from,
      body,
      type: "text",
      waMsgId: msg.key.id ?? undefined,
      webhookSent: false,
    });

    if (incoming) {
      await webhookDispatcher.fire("message.received", {
        id: incoming.id,
        device_id: deviceId,
        from: from,
        body,
        received_at: incoming.receivedAt,
      });
      await incomingRepo.markWebhookSent(incoming.id);
    }
  } catch (err) {
    logger.error({ err, deviceId }, "Gelen mesaj işlenirken hata");
  }
}

async function handleGroupIncoming(
  msg: proto.IWebMessageInfo,
  deviceId: string
) {
  try {
    const groupJid = msg.key.remoteJid!;
    const senderJid = msg.key.participant ?? "";
    const senderName = msg.pushName ?? undefined;
    const body =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      "";

    await incomingRepo.create({
      id: generateId(),
      deviceId,
      fromNumber: fromJid(senderJid || groupJid),
      body,
      type: "text",
      waMsgId: msg.key.id ?? undefined,
      webhookSent: false,
      groupJid,
      senderJid,
      isGroup: true,
    });

    await handleGroupMessage({
      deviceId,
      groupJid,
      senderJid,
      senderName,
      text: body,
      waMsgId: msg.key.id ?? undefined,
    });
  } catch (err) {
    logger.error({ err, deviceId }, "Grup mesajı işlenirken hata");
  }
}

async function handleOutgoingUpdate(
  msg: proto.IWebMessageInfo,
  deviceId: string
) {
  if (!msg.key.id) return;
  const waStatus = msg.status;
  if (!waStatus) return;

  const dbMsg = await findMessageByWaId(msg.key.id, deviceId);
  if (!dbMsg) return;

  if (waStatus >= 3) {
    // DELIVERY_ACK
    await messageRepo.updateStatus(dbMsg.id, "delivered", {
      deliveredAt: new Date(),
    });
    await webhookDispatcher.fire("message.delivered", {
      message_id: dbMsg.id,
      device_id: deviceId,
    });
  }

  if (waStatus >= 4) {
    // READ
    await messageRepo.updateStatus(dbMsg.id, "read", {
      readAt: new Date(),
    });
    await webhookDispatcher.fire("message.read", {
      message_id: dbMsg.id,
      device_id: deviceId,
    });
  }
}

async function findMessageByWaId(waId: string, deviceId: string) {
  // wa_msg_id üzerinden arama — şimdilik basit
  const { messages: rows } = await messageRepo.list({ deviceId });
  return rows.find((m) => m.waMsgId === waId);
}
