CREATE TABLE "api_key" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"start" text,
	"prefix" text,
	"key" text NOT NULL,
	"user_id" text NOT NULL,
	"refill_interval" integer,
	"refill_amount" integer,
	"last_refill_at" timestamp,
	"enabled" boolean DEFAULT true NOT NULL,
	"rate_limit_enabled" boolean DEFAULT false NOT NULL,
	"rate_limit_time_window" integer,
	"rate_limit_max" integer,
	"request_count" integer DEFAULT 0 NOT NULL,
	"remaining" integer,
	"last_request" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"permissions" text,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "project" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"pdf_url" text NOT NULL,
	"pdf_file_name" text NOT NULL,
	"pdf_file_size" integer NOT NULL,
	"thumbnail_url" text,
	"page_count" integer DEFAULT 0 NOT NULL,
	"annotation_count" integer DEFAULT 0 NOT NULL,
	"last_viewed_at" timestamp,
	"created_by" text NOT NULL,
	"organization_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_share" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"token" text NOT NULL,
	"created_by" text NOT NULL,
	"expires_at" timestamp,
	"password" text,
	"allow_download" boolean DEFAULT true NOT NULL,
	"allow_annotations" boolean DEFAULT false NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"last_viewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_share_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_share" ADD CONSTRAINT "project_share_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_share" ADD CONSTRAINT "project_share_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "apiKey_userId_idx" ON "api_key" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "project_createdBy_idx" ON "project" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "project_organizationId_idx" ON "project" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "project_createdAt_idx" ON "project" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "projectShare_projectId_idx" ON "project_share" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "projectShare_token_idx" ON "project_share" USING btree ("token");--> statement-breakpoint
CREATE INDEX "projectShare_createdBy_idx" ON "project_share" USING btree ("created_by");