CREATE TABLE "project_file" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"pdf_url" text NOT NULL,
	"pdf_file_name" text NOT NULL,
	"pdf_file_size" integer NOT NULL,
	"page_count" integer DEFAULT 0 NOT NULL,
	"annotation_count" integer DEFAULT 0 NOT NULL,
	"uploaded_by" text NOT NULL,
	"last_viewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project" ALTER COLUMN "pdf_url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ALTER COLUMN "pdf_file_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ALTER COLUMN "pdf_file_size" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ALTER COLUMN "page_count" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "project_file" ADD CONSTRAINT "project_file_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_file" ADD CONSTRAINT "project_file_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "projectFile_projectId_idx" ON "project_file" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "projectFile_createdAt_idx" ON "project_file" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "projectFile_uploadedBy_idx" ON "project_file" USING btree ("uploaded_by");