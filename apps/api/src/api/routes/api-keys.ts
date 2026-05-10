import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { apiKeyRepo } from "../../db/repositories/api-key.repo.js";
import { generateApiKey, generateId } from "../../utils/crypto.js";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  device_ids: z.array(z.string()).optional(),
});

export async function apiKeyRoutes(app: FastifyInstance) {
  app.post("/api-keys", async (request, reply) => {
    const body = createSchema.parse(request.body);
    const { raw, hash, prefix } = generateApiKey();

    const apiKey = await apiKeyRepo.create({
      id: generateId(),
      name: body.name,
      keyHash: hash,
      keyPrefix: prefix,
      deviceIds: body.device_ids ?? null,
      isActive: true,
    });

    reply.code(201).send({
      id: apiKey.id,
      name: apiKey.name,
      key: raw,
      prefix,
      device_ids: body.device_ids ?? null,
      created_at: apiKey.createdAt,
    });
  });

  app.get("/api-keys", async (_request, reply) => {
    const keys = await apiKeyRepo.findAll();
    reply.send({
      api_keys: keys.map((k) => ({
        id: k.id,
        name: k.name,
        prefix: k.keyPrefix,
        device_ids: k.deviceIds,
        is_active: k.isActive,
        created_at: k.createdAt,
        last_used_at: k.lastUsedAt,
      })),
    });
  });

  app.delete("/api-keys/:keyId", async (request, reply) => {
    const { keyId } = request.params as { keyId: string };
    await apiKeyRepo.deactivate(keyId);
    reply.send({ success: true });
  });
}
