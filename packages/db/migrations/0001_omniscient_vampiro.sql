ALTER TABLE "device_stats" DROP CONSTRAINT "device_stats_device_id_devices_id_fk";
--> statement-breakpoint
ALTER TABLE "incoming_messages" DROP CONSTRAINT "incoming_messages_device_id_devices_id_fk";
--> statement-breakpoint
ALTER TABLE "messages" DROP CONSTRAINT "messages_device_id_devices_id_fk";
--> statement-breakpoint
ALTER TABLE "rate_limit_state" DROP CONSTRAINT "rate_limit_state_device_id_devices_id_fk";
--> statement-breakpoint
ALTER TABLE "device_stats" ADD CONSTRAINT "device_stats_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incoming_messages" ADD CONSTRAINT "incoming_messages_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_limit_state" ADD CONSTRAINT "rate_limit_state_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;