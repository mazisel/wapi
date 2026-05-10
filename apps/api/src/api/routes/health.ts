import type { FastifyInstance } from "fastify";
import { deviceRepo } from "../../db/repositories/device.repo.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", { config: { skipAuth: true } }, async (_req, reply) => {
    const devices = await deviceRepo.findAll();
    const connected = devices.filter((d) => d.status === "connected").length;

    reply.send({
      status: "ok",
      devices: {
        total: devices.length,
        connected,
        disconnected: devices.length - connected,
      },
    });
  });
}
