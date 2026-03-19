ALTER TABLE "admin_audit_log" DROP CONSTRAINT "admin_audit_log_admin_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "stripe_plan" ADD COLUMN "annual_discount_price_id" text;--> statement-breakpoint
ALTER TABLE "stripe_plan" ADD COLUMN "lookup_key" text;--> statement-breakpoint
ALTER TABLE "stripe_plan" ADD COLUMN "limits" jsonb;--> statement-breakpoint
ALTER TABLE "stripe_plan" ADD COLUMN "trial_days" integer;--> statement-breakpoint
ALTER TABLE "stripe_plan" ADD COLUMN "group" text;--> statement-breakpoint
ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_admin_id_user_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_activity" ADD CONSTRAINT "billing_activity_subscription_id_subscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscription"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id");