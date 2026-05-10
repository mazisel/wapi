CREATE TABLE "group_alerts" (
	"id" text PRIMARY KEY NOT NULL,
	"monitor_id" text NOT NULL,
	"trigger_msg_id" text,
	"sender_jid" text NOT NULL,
	"sender_name" text,
	"message_text" text,
	"status" text DEFAULT 'watching' NOT NULL,
	"resolved_by" text,
	"wave1_sent_at" timestamp with time zone,
	"wave2_sent_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_monitors" (
	"id" text PRIMARY KEY NOT NULL,
	"device_id" text NOT NULL,
	"group_jid" text NOT NULL,
	"group_name" text,
	"team_numbers" text[] DEFAULT '{}' NOT NULL,
	"alert_group_jids" text[] DEFAULT '{}' NOT NULL,
	"alert_contacts" text[] DEFAULT '{}' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "incoming_messages" ADD COLUMN "group_jid" text;--> statement-breakpoint
ALTER TABLE "incoming_messages" ADD COLUMN "sender_jid" text;--> statement-breakpoint
ALTER TABLE "incoming_messages" ADD COLUMN "is_group" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "group_alerts" ADD CONSTRAINT "group_alerts_monitor_id_group_monitors_id_fk" FOREIGN KEY ("monitor_id") REFERENCES "public"."group_monitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_monitors" ADD CONSTRAINT "group_monitors_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;