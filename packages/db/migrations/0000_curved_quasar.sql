CREATE TABLE "api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"key_hash" text NOT NULL,
	"key_prefix" text NOT NULL,
	"device_ids" text[],
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "device_stats" (
	"device_id" text NOT NULL,
	"date" date NOT NULL,
	"messages_sent" integer DEFAULT 0 NOT NULL,
	"messages_failed" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "device_stats_device_id_date_pk" PRIMARY KEY("device_id","date")
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"session_dir" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incoming_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"device_id" text NOT NULL,
	"from_number" text NOT NULL,
	"body" text,
	"type" text DEFAULT 'text',
	"wa_msg_id" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"webhook_sent" boolean DEFAULT false NOT NULL,
	CONSTRAINT "incoming_messages_wa_msg_id_unique" UNIQUE("wa_msg_id")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"device_id" text NOT NULL,
	"to_number" text NOT NULL,
	"body" text NOT NULL,
	"type" text DEFAULT 'text' NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"error" text,
	"wa_msg_id" text,
	"api_key_id" text,
	"queued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"retry_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit_state" (
	"device_id" text PRIMARY KEY NOT NULL,
	"hourly_count" integer DEFAULT 0 NOT NULL,
	"hourly_window" timestamp with time zone,
	"daily_count" integer DEFAULT 0 NOT NULL,
	"daily_date" date
);
--> statement-breakpoint
CREATE TABLE "validated_numbers" (
	"jid" text PRIMARY KEY NOT NULL,
	"is_registered" boolean NOT NULL,
	"validated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhooks" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"secret" text,
	"events" text[] NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "device_stats" ADD CONSTRAINT "device_stats_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incoming_messages" ADD CONSTRAINT "incoming_messages_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_limit_state" ADD CONSTRAINT "rate_limit_state_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE no action ON UPDATE no action;