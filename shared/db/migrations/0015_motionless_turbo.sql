CREATE TABLE "detected_room" (
	"id" text PRIMARY KEY NOT NULL,
	"file_id" text NOT NULL,
	"project_id" text NOT NULL,
	"page_num" integer NOT NULL,
	"polygon" jsonb NOT NULL,
	"bounds" jsonb NOT NULL,
	"area" double precision NOT NULL,
	"centroid_x" double precision NOT NULL,
	"centroid_y" double precision NOT NULL,
	"room_label" text,
	"confidence" double precision,
	"source" text DEFAULT 'poc-client' NOT NULL,
	"visible" boolean DEFAULT true NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_file_state" ALTER COLUMN "viewport_rotation" SET DATA TYPE real;--> statement-breakpoint
ALTER TABLE "detected_room" ADD CONSTRAINT "detected_room_file_id_project_file_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."project_file"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "detected_room" ADD CONSTRAINT "detected_room_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "detected_room" ADD CONSTRAINT "detected_room_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "detected_room_file_page_idx" ON "detected_room" USING btree ("file_id","page_num");--> statement-breakpoint
CREATE INDEX "detected_room_file_page_visible_idx" ON "detected_room" USING btree ("file_id","page_num","visible");--> statement-breakpoint
CREATE INDEX "detected_room_project_idx" ON "detected_room" USING btree ("project_id");