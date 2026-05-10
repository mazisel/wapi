import { webhookRepo } from "../db/repositories/webhook.repo.js";
import { generateHmacSignature } from "../utils/crypto.js";
import { logger } from "../utils/logger.js";
import {
  WEBHOOK_RETRY_DELAYS_MS,
  WEBHOOK_TIMEOUT_MS,
  type WebhookEvent,
} from "../config/constants.js";

async function sendWithRetry(
  url: string,
  secret: string | null,
  payload: string,
  attempt = 0
): Promise<void> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Wapi-Event": "webhook",
  };

  if (secret) {
    headers["X-Wapi-Signature"] = generateHmacSignature(payload, secret);
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    WEBHOOK_TIMEOUT_MS
  );

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: payload,
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
  } catch (err) {
    clearTimeout(timeout);

    if (attempt < WEBHOOK_RETRY_DELAYS_MS.length) {
      const delay = WEBHOOK_RETRY_DELAYS_MS[attempt];
      logger.warn({ url, attempt, delay }, "Webhook başarısız, yeniden deneniyor");
      await new Promise((r) => setTimeout(r, delay));
      return sendWithRetry(url, secret, payload, attempt + 1);
    }

    logger.error({ url, err }, "Webhook kalıcı olarak başarısız");
  } finally {
    clearTimeout(timeout);
  }
}

export const webhookDispatcher = {
  async fire(event: WebhookEvent, data: unknown): Promise<void> {
    const hooks = await webhookRepo.findActiveByEvent(event);
    if (hooks.length === 0) return;

    const payload = JSON.stringify({
      event,
      data,
      timestamp: new Date().toISOString(),
    });

    // Tüm webhook'ları paralel ateşle, birbirini bekleme
    await Promise.allSettled(
      hooks.map((hook) => sendWithRetry(hook.url, hook.secret, payload))
    );
  },
};
