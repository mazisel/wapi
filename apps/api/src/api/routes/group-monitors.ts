import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { generateId } from "../../utils/crypto.js";
import { groupMonitorRepo, groupAlertRepo } from "../../db/repositories/group-monitor.repo.js";
import { deviceRepo } from "../../db/repositories/device.repo.js";
import { deviceManager } from "../../whatsapp/manager.js";
import type { GroupAlert, GroupMonitor } from "@wapi/db";

const groupTargetSchema = z.object({
  group_jid: z.string().min(1),
  group_name: z.string().optional(),
});

const createMonitorSchema = z.object({
  device_id: z.string().min(1),
  group_jid: z.string().min(1).optional(),
  group_name: z.string().optional(),
  groups: z.array(groupTargetSchema).optional(),
  team_numbers: z.array(z.string()).default([]),
  alert_group_jids: z.array(z.string()).default([]),
  alert_contacts: z.array(z.string()).default([]),
}).superRefine((body, ctx) => {
  if (!body.group_jid && (!body.groups || body.groups.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "En az bir grup seçilmelidir",
      path: ["groups"],
    });
  }
});

const updateMonitorSchema = z.object({
  group_jid: z.string().min(1).optional(),
  group_name: z.string().optional(),
  team_numbers: z.array(z.string()).optional(),
  alert_group_jids: z.array(z.string()).optional(),
  alert_contacts: z.array(z.string()).optional(),
  is_active: z.boolean().optional(),
});

function serializeMonitor(monitor: GroupMonitor) {
  return {
    id: monitor.id,
    device_id: monitor.deviceId,
    group_jid: monitor.groupJid,
    group_name: monitor.groupName,
    team_numbers: monitor.teamNumbers,
    alert_group_jids: monitor.alertGroupJids,
    alert_contacts: monitor.alertContacts,
    is_active: monitor.isActive,
    created_at: monitor.createdAt,
  };
}

function serializeAlert(alert: GroupAlert) {
  return {
    id: alert.id,
    monitor_id: alert.monitorId,
    trigger_msg_id: alert.triggerMsgId,
    sender_jid: alert.senderJid,
    sender_name: alert.senderName,
    message_text: alert.messageText,
    status: alert.status,
    resolved_by: alert.resolvedBy,
    wave1_sent_at: alert.wave1SentAt,
    wave2_sent_at: alert.wave2SentAt,
    resolved_at: alert.resolvedAt,
    created_at: alert.createdAt,
  };
}

export async function groupMonitorRoutes(app: FastifyInstance) {
  // List all monitors
  app.get("/group-monitors", async (_req, reply) => {
    const monitors = await groupMonitorRepo.findAll();
    reply.send({ monitors: monitors.map(serializeMonitor) });
  });

  // Create one or more monitors
  app.post("/group-monitors", async (request, reply) => {
    const body = createMonitorSchema.parse(request.body);

    const device = await deviceRepo.findById(body.device_id);
    if (!device) return reply.code(404).send({ error: "Cihaz bulunamadı" });

    const requestedTargets = body.groups?.length
      ? body.groups
      : [{ group_jid: body.group_jid!, group_name: body.group_name }];
    const targets = Array.from(
      new Map(
        requestedTargets.map((target) => [target.group_jid, target])
      ).values()
    );

    const monitors = await Promise.all(
      targets.map((target) =>
        groupMonitorRepo.create({
          id: generateId(),
          deviceId: body.device_id,
          groupJid: target.group_jid,
          groupName: target.group_name,
          teamNumbers: body.team_numbers,
          alertGroupJids: body.alert_group_jids,
          alertContacts: body.alert_contacts,
          isActive: true,
        })
      )
    );

    const serializedMonitors = monitors.map(serializeMonitor);
    reply.code(201).send({
      monitor: serializedMonitors[0],
      monitors: serializedMonitors,
    });
  });

  // Get monitor
  app.get("/group-monitors/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const monitor = await groupMonitorRepo.findById(id);
    if (!monitor) return reply.code(404).send({ error: "Monitör bulunamadı" });
    reply.send({ monitor: serializeMonitor(monitor) });
  });

  // Update monitor
  app.put("/group-monitors/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateMonitorSchema.parse(request.body);

    const existing = await groupMonitorRepo.findById(id);
    if (!existing) return reply.code(404).send({ error: "Monitör bulunamadı" });

    const monitor = await groupMonitorRepo.update(id, {
      ...(body.group_jid !== undefined && { groupJid: body.group_jid }),
      ...(body.group_name !== undefined && { groupName: body.group_name }),
      ...(body.team_numbers !== undefined && { teamNumbers: body.team_numbers }),
      ...(body.alert_group_jids !== undefined && { alertGroupJids: body.alert_group_jids }),
      ...(body.alert_contacts !== undefined && { alertContacts: body.alert_contacts }),
      ...(body.is_active !== undefined && { isActive: body.is_active }),
    });

    reply.send({ monitor: monitor ? serializeMonitor(monitor) : null });
  });

  // Delete monitor
  app.delete("/group-monitors/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await groupMonitorRepo.findById(id);
    if (!existing) return reply.code(404).send({ error: "Monitör bulunamadı" });
    await groupMonitorRepo.delete(id);
    reply.send({ success: true });
  });

  // List alerts for a monitor
  app.get("/group-monitors/:id/alerts", async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await groupMonitorRepo.findById(id);
    if (!existing) return reply.code(404).send({ error: "Monitör bulunamadı" });
    const alerts = await groupAlertRepo.listByMonitor(id);
    reply.send({ alerts: alerts.map(serializeAlert) });
  });

  // Live group list from Baileys
  app.get("/devices/:deviceId/groups", async (request, reply) => {
    const { deviceId } = request.params as { deviceId: string };
    const device = await deviceRepo.findById(deviceId);
    if (!device) return reply.code(404).send({ error: "Cihaz bulunamadı" });

    const socket = deviceManager.getSocket(deviceId);
    if (!socket) {
      return reply.code(503).send({ error: "Cihaz bağlı değil" });
    }

    try {
      const groups = await socket.groupFetchAllParticipating();
      const list = Object.values(groups).map((g) => ({
        jid: g.id,
        name: g.subject,
        participant_count: g.participants?.length ?? 0,
      }));
      reply.send({ groups: list });
    } catch (err) {
      reply.code(500).send({ error: "Gruplar alınamadı" });
    }
  });
}
