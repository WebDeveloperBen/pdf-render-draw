CREATE TABLE "annotation" (
	"id" text PRIMARY KEY NOT NULL,
	"file_id" text NOT NULL,
	"project_id" text NOT NULL,
	"type" text NOT NULL,
	"page_num" integer NOT NULL,
	"data" jsonb NOT NULL,
	"created_by" text NOT NULL,
	"modified_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "annotation" ADD CONSTRAINT "annotation_file_id_project_file_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."project_file"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "annotation" ADD CONSTRAINT "annotation_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "annotation" ADD CONSTRAINT "annotation_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "annotation" ADD CONSTRAINT "annotation_modified_by_user_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "annotation_file_id_idx" ON "annotation" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "annotation_project_id_idx" ON "annotation" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "annotation_file_page_idx" ON "annotation" USING btree ("file_id","page_num");--> statement-breakpoint
CREATE INDEX "annotation_updated_at_idx" ON "annotation" USING btree ("file_id","updated_at");--> statement-breakpoint
CREATE INDEX "annotation_created_by_idx" ON "annotation" USING btree ("created_by");