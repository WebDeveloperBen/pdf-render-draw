#!/bin/bash
# Setup Cloudflare Worker secrets from environment variables
# Usage (from repo root): set -a && source .env && set +a && apps/web/scripts/setup-secrets.sh

set -eo pipefail

# Resolve to apps/web directory (where wrangler.toml lives)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WEB_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

ALL_SECRETS=(
  # Required
  DATABASE_URL
  BETTER_AUTH_SECRET
  BETTER_AUTH_URL
  R2_PUBLIC_URL
  R2_BUCKET_NAME
  # OAuth
  GOOGLE_CLIENT_ID
  GOOGLE_CLIENT_SECRET
  GITHUB_CLIENT_ID
  GITHUB_CLIENT_SECRET
  # Stripe
  STRIPE_SECRET_KEY
  STRIPE_WEBHOOK_SECRET
  STRIPE_PUBLISHABLE_KEY
  # AI
  ANTHROPIC_API_KEY
  AZURE_OPENAI_API_KEY
  AZURE_OPENAI_ENDPOINT
  AZURE_OPENAI_DEPLOYMENT
  # Email
  RESEND_API_KEY
  EMAIL_FROM
  # Feature flags
  FEATURE_ROOM_DETECTION
  FEATURE_ROOM_SMART_DETECT
  FEATURE_ROOM_AI_DETECT
  FEATURE_ROOM_DEBUG_PLAN
)

echo "🔐 Cloudflare Worker Secrets Setup"
echo "==================================="

set_count=0
skip_count=0

for name in "${ALL_SECRETS[@]}"; do
  value="${!name:-}"
  if [[ -z "$value" ]]; then
    echo "  ⏭  $name — not set, skipping"
    ((skip_count++))
    continue
  fi
  # Use --cwd to ensure wrangler finds wrangler.toml, pipe value via stdin
  if echo "$value" | npx wrangler secret put "$name" --cwd "$WEB_DIR" 2>&1 | grep -q "Success"; then
    echo "  ✅ $name"
    ((set_count++))
  else
    echo "  ❌ $name — failed"
  fi
done

echo ""
echo "Done: $set_count set, $skip_count skipped"
