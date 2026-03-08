DROP INDEX "apiKey_userId_idx";--> statement-breakpoint
CREATE INDEX "apikey_userId_idx" ON "api_key" USING btree ("user_id");