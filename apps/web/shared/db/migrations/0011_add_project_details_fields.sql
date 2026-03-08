ALTER TABLE "project" ADD COLUMN "reference" text;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "site_address" text;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "suburb" text;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "postcode" text;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "client_name" text;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "client_email" text;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "client_phone" text;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "priority" text DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "tags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "notes" text;