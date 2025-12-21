ALTER TABLE "platform_admin" ALTER COLUMN "granted_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "platform_admin" DROP COLUMN "created_at";--> statement-breakpoint
ALTER TABLE "platform_admin" DROP COLUMN "updated_at";