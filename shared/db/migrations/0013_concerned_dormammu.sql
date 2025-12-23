ALTER TABLE "project_file" ADD COLUMN "viewport_scale" real DEFAULT 1;--> statement-breakpoint
ALTER TABLE "project_file" ADD COLUMN "viewport_rotation" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "project_file" ADD COLUMN "viewport_scroll_left" real DEFAULT 0;--> statement-breakpoint
ALTER TABLE "project_file" ADD COLUMN "viewport_scroll_top" real DEFAULT 0;--> statement-breakpoint
ALTER TABLE "project_file" ADD COLUMN "viewport_current_page" integer DEFAULT 1;