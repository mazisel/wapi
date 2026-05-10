import Fastify from "fastify";
import websocket from "@fastify/websocket";
import cors from "@fastify/cors";
import { authHook } from "./hooks/auth.js";
import { healthRoutes } from "./routes/health.js";
import { apiKeyRoutes } from "./routes/api-keys.js";
import { webhookRoutes } from "./routes/webhooks.js";
import { deviceRoutes } from "./routes/devices.js";
import { messageRoutes } from "./routes/messages.js";
import {
  validateQrToken,
  subscribeQr,
} from "../whatsapp/qr.js";

export async function buildServer() {
  const app = Fastify({ logger: false, trustProxy: true });

  await app.register(websocket);
  await app.register(cors, { origin: true });

  // Auth hook — /health ve /ws/* hariç her route'a uygulanır
  app.addHook("onRequest", async (request, reply) => {
    const url = request.url.split("?")[0];
    if (url === "/health") return;
    if (url.startsWith("/ws/")) return;
    await authHook(request, reply);
  });

  // Public
  await app.register(healthRoutes);

  // WebSocket QR — prefix dışında, kısa süreli token ile kimlik doğrulama
  app.get("/ws/qr/:deviceId", { websocket: true }, (socket, request) => {
    const { deviceId } = request.params as { deviceId: string };
    const token = (request.query as Record<string, string>).token;

    if (!token || !validateQrToken(token, deviceId)) {
      socket.send(
        JSON.stringify({ type: "error", data: { message: "Geçersiz token" } })
      );
      socket.close();
      return;
    }

    subscribeQr(deviceId, socket);
  });

  // API v1
  await app.register(
    async (api) => {
      await api.register(apiKeyRoutes);
      await api.register(webhookRoutes);
      await api.register(deviceRoutes);
      await api.register(messageRoutes);
    },
    { prefix: "/api/v1" }
  );

  return app;
}
