import {
  pgTable,
  text,
  boolean,
  integer,
  timestamp,
  date,
  primaryKey,
} from "drizzle-orm/pg-core";

export const devices = pgTable("devices", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  status: text("status", {
    enum: ["pending", "connected", "disconnected", "banned"],
  })
    .notNull()
    .default("pending"),
  sessionDir: text("session_dir").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const apiKeys = pgTable("api_keys", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull(),
  keyPrefix: text("key_prefix").notNull(),
  deviceIds: text("device_ids").array(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
});

export const messages = pgTable("messages", {
  id: text("id").primaryKey(),
  deviceId: text("device_id")
    .notNull()
    .references(() => devices.id, { onDelete: "cascade" }),
  toNumber: text("to_number").notNull(),
  body: text("body").notNull(),
  type: text("type", { enum: ["text", "image", "document", "audio"] })
    .notNull()
    .default("text"),
  status: text("status", {
    enum: ["queued", "sending", "sent", "delivered", "read", "failed"],
  })
    .notNull()
    .default("queued"),
  error: text("error"),
  waMsgId: text("wa_msg_id"),
  apiKeyId: text("api_key_id").references(() => apiKeys.id),
  queuedAt: timestamp("queued_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  readAt: timestamp("read_at", { withTimezone: true }),
  retryCount: integer("retry_count").notNull().default(0),
});

export const incomingMessages = pgTable("incoming_messages", {
  id: text("id").primaryKey(),
  deviceId: text("device_id")
    .notNull()
    .references(() => devices.id, { onDelete: "cascade" }),
  fromNumber: text("from_number").notNull(),
  body: text("body"),
  type: text("type").default("text"),
  waMsgId: text("wa_msg_id").unique(),
  receivedAt: timestamp("received_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  webhookSent: boolean("webhook_sent").notNull().default(false),
  groupJid: text("group_jid"),
  senderJid: text("sender_jid"),
  isGroup: boolean("is_group").notNull().default(false),
});

export const webhooks = pgTable("webhooks", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  secret: text("secret"),
  events: text("events").array().notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const deviceStats = pgTable(
  "device_stats",
  {
    deviceId: text("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    messagesSent: integer("messages_sent").notNull().default(0),
    messagesFailed: integer("messages_failed").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.deviceId, t.date] })]
);

export const rateLimitState = pgTable("rate_limit_state", {
  deviceId: text("device_id")
    .primaryKey()
    .references(() => devices.id, { onDelete: "cascade" }),
  hourlyCount: integer("hourly_count").notNull().default(0),
  hourlyWindow: timestamp("hourly_window", { withTimezone: true }),
  dailyCount: integer("daily_count").notNull().default(0),
  dailyDate: date("daily_date"),
});

export const validatedNumbers = pgTable("validated_numbers", {
  jid: text("jid").primaryKey(),
  isRegistered: boolean("is_registered").notNull(),
  validatedAt: timestamp("validated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const groupMonitors = pgTable("group_monitors", {
  id: text("id").primaryKey(),
  deviceId: text("device_id")
    .notNull()
    .references(() => devices.id, { onDelete: "cascade" }),
  groupJid: text("group_jid").notNull(),
  groupName: text("group_name"),
  teamNumbers: text("team_numbers").array().notNull().default([]),
  alertGroupJids: text("alert_group_jids").array().notNull().default([]),
  alertContacts: text("alert_contacts").array().notNull().default([]),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const groupAlerts = pgTable("group_alerts", {
  id: text("id").primaryKey(),
  monitorId: text("monitor_id")
    .notNull()
    .references(() => groupMonitors.id, { onDelete: "cascade" }),
  triggerMsgId: text("trigger_msg_id"),
  senderJid: text("sender_jid").notNull(),
  senderName: text("sender_name"),
  messageText: text("message_text"),
  status: text("status", {
    enum: ["watching", "wave1_sent", "wave2_sent", "resolved"],
  })
    .notNull()
    .default("watching"),
  resolvedBy: text("resolved_by"),
  wave1SentAt: timestamp("wave1_sent_at", { withTimezone: true }),
  wave2SentAt: timestamp("wave2_sent_at", { withTimezone: true }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Device = typeof devices.$inferSelect;
export type NewDevice = typeof devices.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type IncomingMessage = typeof incomingMessages.$inferSelect;
export type NewIncomingMessage = typeof incomingMessages.$inferInsert;
export type Webhook = typeof webhooks.$inferSelect;
export type NewWebhook = typeof webhooks.$inferInsert;
export type DeviceStats = typeof deviceStats.$inferSelect;
export type RateLimitState = typeof rateLimitState.$inferSelect;
export type GroupMonitor = typeof groupMonitors.$inferSelect;
export type NewGroupMonitor = typeof groupMonitors.$inferInsert;
export type GroupAlert = typeof groupAlerts.$inferSelect;
export type NewGroupAlert = typeof groupAlerts.$inferInsert;
