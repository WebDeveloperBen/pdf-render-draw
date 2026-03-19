ALTER TABLE "subscription" ADD COLUMN "stripe_price_id" text;--> statement-breakpoint
ALTER TABLE "billing_activity" ADD COLUMN "stripe_event_id" text;--> statement-breakpoint
ALTER TABLE "stripe_plan" ADD CONSTRAINT "stripe_plan_stripe_product_id_unique" UNIQUE("stripe_product_id");--> statement-breakpoint
ALTER TABLE "billing_activity" ADD CONSTRAINT "billing_activity_stripe_event_id_unique" UNIQUE("stripe_event_id");