import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { generateId } from "../../utils/crypto.js";
import { groupMonitorRepo, groupAlertRepo } from "../../db/repositories/group-monitor.repo.js";
import { deviceRepo } from "../../db/repositories/device.repo.js";
import { deviceManager } from "../../whatsapp/manager.js";

const createMonitorSchema = z.object({
  device_id: z.string().min(1),
  group_jid: z.string().min(1),
  group_name: z.string().optional(),
  team_numbers: z.array(z.string()).default([]),
  alert_group_jids: z.array(z.string()).default([]),
  alert_contacts: z.array(z.string()).default([]),
});

const updateMonitorSchema = createMonitorSchema.partial().extend({
  is_active: z.boolean().optional(),
});

export async function groupMonitorRoutes(app: FastifyInstance) {
  // List all monitors
  app.get("/group-monitors", async (_req, reply) => {
    const monitors = await groupMonitorRepo.findAll();
    reply.send({ monitors });
  });

  // Create monitor
  app.post("/group-monitors", async (request, reply) => {
    const body = createMonitorSchema.parse(request.body);

    const device = await deviceRepo.findById(body.device_id);
    if (!device) return reply.code(404).send({ error: "Cihaz bulunamadı" });

    const monitor = await groupMonitorRepo.create({
      id: generateId(),
      deviceId: body.device_id,
      groupJid: body.group_jid,
      groupName: body.group_name,
      teamNumbers: body.team_numbers,
      alertGroupJids: body.alert_group_jids,
      alertContacts: body.alert_contacts,
      isActive: true,
    });

    reply.code(201).send({ monitor });
  });

  // Get monitor
  app.get("/group-monitors/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const monitor = await groupMonitorRepo.findById(id);
    if (!monitor) return reply.code(404).send({ error: "Monitör bulunamadı" });
    reply.send({ monitor });
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

    reply.send({ monitor });
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
    reply.send({ alerts });
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
