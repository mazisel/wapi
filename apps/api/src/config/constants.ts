export const QUEUE_NAME_PREFIX = "wapi:device";

export const RECONNECT_DELAYS_MS = [5_000, 10_000, 30_000, 60_000, 120_000];

export const MAX_RECONNECT_ATTEMPTS = 5;

export const TYPING_MS_PER_CHAR = 30;
export const TYPING_MIN_MS = 1_000;
export const TYPING_MAX_MS = 4_000;

export const WEBHOOK_RETRY_DELAYS_MS = [5_000, 30_000, 120_000];
export const WEBHOOK_TIMEOUT_MS = 10_000;

export const NUMBER_CACHE_POSITIVE_TTL_MS = 7 * 24 * 60 * 60 * 1_000;
export const NUMBER_CACHE_NEGATIVE_TTL_MS = 60 * 60 * 1_000;

export const WEBHOOK_EVENTS = [
  "message.sent",
  "message.delivered",
  "message.read",
  "message.failed",
  "message.received",
  "device.connected",
  "device.disconnected",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];
