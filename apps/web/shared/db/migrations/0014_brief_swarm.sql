CREATE TABLE "user_file_state" (
	"user_id" text NOT NULL,
	"file_id" text NOT NULL,
	"viewport_scale" real DEFAULT 1 NOT NULL,
	"viewport_rotation" integer DEFAULT 0 NOT NULL,
	"viewport_scroll_left" real DEFAULT 0 NOT NULL,
	"viewport_scroll_top" real DEFAULT 0 NOT NULL,
	"viewport_current_page" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_file_state_user_id_file_id_pk" PRIMARY KEY("user_id","file_id")
);
--> statement-breakpoint
ALTER TABLE "user_file_state" ADD CONSTRAINT "user_file_state_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_file_state" ADD CONSTRAINT "user_file_state_file_id_project_file_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."project_file"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_file" DROP COLUMN "viewport_scale";--> statement-breakpoint
ALTER TABLE "project_file" DROP COLUMN "viewport_rotation";--> statement-breakpoint
ALTER TABLE "project_file" DROP COLUMN "viewport_scroll_left";--> statement-breakpoint
ALTER TABLE "project_file" DROP COLUMN "viewport_scroll_top";--> statement-breakpoint
ALTER TABLE "project_file" DROP COLUMN "viewport_current_page";