CREATE TABLE "project_share_recipient" (
	"id" text PRIMARY KEY NOT NULL,
	"share_id" text NOT NULL,
	"email" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"invited_at" timestamp DEFAULT now() NOT NULL,
	"first_viewed_at" timestamp,
	"last_viewed_at" timestamp,
	"view_count" integer DEFAULT 0 NOT NULL,
	"user_id" text
);
--> statement-breakpoint
ALTER TABLE "project_share" RENAME COLUMN "allow_annotations" TO "allow_notes";--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "is_guest" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "guest_organization_id" text;--> statement-breakpoint
ALTER TABLE "project_share" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "project_share" ADD COLUMN "share_type" text DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "project_share" ADD COLUMN "message" text;--> statement-breakpoint
ALTER TABLE "project_share_recipient" ADD CONSTRAINT "project_share_recipient_share_id_project_share_id_fk" FOREIGN KEY ("share_id") REFERENCES "public"."project_share"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_share_recipient" ADD CONSTRAINT "project_share_recipient_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "projectShareRecipient_shareId_idx" ON "project_share_recipient" USING btree ("share_id");--> statement-breakpoint
CREATE INDEX "projectShareRecipient_email_idx" ON "project_share_recipient" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "projectShareRecipient_share_email_idx" ON "project_share_recipient" USING btree ("share_id","email");--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_guest_organization_id_organization_id_fk" FOREIGN KEY ("guest_organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;