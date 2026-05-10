import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { webhookRepo } from "../../db/repositories/webhook.repo.js";
import { generateId } from "../../utils/crypto.js";
import { WEBHOOK_EVENTS } from "../../config/constants.js";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url(),
  secret: z.string().optional(),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1),
});

export async function webhookRoutes(app: FastifyInstance) {
  app.post("/webhooks", async (request, reply) => {
    const body = createSchema.parse(request.body);

    const webhook = await webhookRepo.create({
      id: generateId(),
      name: body.name,
      url: body.url,
      secret: body.secret ?? null,
      events: body.events,
      isActive: true,
    });

    reply.code(201).send(webhook);
  });

  app.get("/webhooks", async (_request, reply) => {
    const hooks = await webhookRepo.findAll();
    reply.send({ webhooks: hooks });
  });

  app.delete("/webhooks/:webhookId", async (request, reply) => {
    const { webhookId } = request.params as { webhookId: string };
    await webhookRepo.delete(webhookId);
    reply.send({ success: true });
  });
}
