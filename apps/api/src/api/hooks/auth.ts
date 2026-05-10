import type { FastifyRequest, FastifyReply } from "fastify";
import { hashApiKey } from "../../utils/crypto.js";
import { apiKeyRepo } from "../../db/repositories/api-key.repo.js";
import { config } from "../../config/index.js";

export async function authHook(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    reply.code(401).send({ error: "Yetkilendirme başlığı eksik" });
    return;
  }

  const token = authHeader.slice(7);

  // Master key kontrolü
  if (token === config.MASTER_API_KEY) {
    request.apiKeyId = "master";
    request.allowedDeviceIds = null;
    return;
  }

  // Normal API key kontrolü
  const hash = hashApiKey(token);
  const apiKey = await apiKeyRepo.findByHash(hash);

  if (!apiKey || !apiKey.isActive) {
    reply.code(401).send({ error: "Geçersiz API anahtarı" });
    return;
  }

  await apiKeyRepo.touchLastUsed(apiKey.id);
  request.apiKeyId = apiKey.id;
  request.allowedDeviceIds = apiKey.deviceIds ?? null;
}

declare module "fastify" {
  interface FastifyRequest {
    apiKeyId: string;
    allowedDeviceIds: string[] | null;
  }
}
