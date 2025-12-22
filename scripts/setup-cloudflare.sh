#!/bin/bash
set -e

# ============================================
# Cloudflare Infrastructure Setup Script
# ============================================
# This script sets up all Cloudflare resources needed for the PDF Annotator app.
# Run once per environment (production, staging, etc.)
#
# Prerequisites:
#   - wrangler CLI installed: npm install -g wrangler
#   - Logged in to Cloudflare: wrangler login
#   - Neon database created with connection string ready
#
# Usage:
#   ./scripts/setup-cloudflare.sh
#   ./scripts/setup-cloudflare.sh --env production
#   ./scripts/setup-cloudflare.sh --env preview

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
PROJECT_NAME="pdf-annotator"
R2_BUCKET_NAME="pdf-annotator-assets"
HYPERDRIVE_NAME="pdf-annotator-db"
ENV=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --env)
      ENV="$2"
      shift 2
      ;;
    --project)
      PROJECT_NAME="$2"
      shift 2
      ;;
    --help)
      echo "Usage: $0 [options]"
      echo ""
      echo "Options:"
      echo "  --env <name>      Environment name (production, preview)"
      echo "  --project <name>  Project name (default: pdf-annotator)"
      echo "  --help            Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Add environment suffix if specified
if [ -n "$ENV" ]; then
  R2_BUCKET_NAME="${R2_BUCKET_NAME}-${ENV}"
  HYPERDRIVE_NAME="${HYPERDRIVE_NAME}-${ENV}"
fi

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  Cloudflare Infrastructure Setup${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""
echo -e "Project:    ${GREEN}${PROJECT_NAME}${NC}"
echo -e "R2 Bucket:  ${GREEN}${R2_BUCKET_NAME}${NC}"
echo -e "Hyperdrive: ${GREEN}${HYPERDRIVE_NAME}${NC}"
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
  echo -e "${RED}Error: wrangler CLI not found${NC}"
  echo "Install with: npm install -g wrangler"
  exit 1
fi

# Check if logged in
echo -e "${YELLOW}Checking Cloudflare authentication...${NC}"
if ! wrangler whoami &> /dev/null; then
  echo -e "${RED}Error: Not logged in to Cloudflare${NC}"
  echo "Run: wrangler login"
  exit 1
fi
echo -e "${GREEN}✓ Authenticated${NC}"
echo ""

# ============================================
# Step 1: Create R2 Bucket
# ============================================
echo -e "${YELLOW}Step 1: Creating R2 bucket...${NC}"

if wrangler r2 bucket list | grep -q "$R2_BUCKET_NAME"; then
  echo -e "${GREEN}✓ R2 bucket '$R2_BUCKET_NAME' already exists${NC}"
else
  wrangler r2 bucket create "$R2_BUCKET_NAME"
  echo -e "${GREEN}✓ R2 bucket '$R2_BUCKET_NAME' created${NC}"
fi
echo ""

# ============================================
# Step 2: Create Hyperdrive Connection
# ============================================
echo -e "${YELLOW}Step 2: Setting up Hyperdrive...${NC}"

# Check if Hyperdrive already exists
EXISTING_HYPERDRIVE=$(wrangler hyperdrive list 2>/dev/null | grep "$HYPERDRIVE_NAME" || true)

if [ -n "$EXISTING_HYPERDRIVE" ]; then
  echo -e "${GREEN}✓ Hyperdrive '$HYPERDRIVE_NAME' already exists${NC}"
  HYPERDRIVE_ID=$(echo "$EXISTING_HYPERDRIVE" | awk '{print $1}')
else
  # Prompt for database connection string
  echo -e "${BLUE}Enter your Neon PostgreSQL connection string:${NC}"
  echo "(format: postgres://user:password@host/database)"
  read -r -s DATABASE_URL
  echo ""

  if [ -z "$DATABASE_URL" ]; then
    echo -e "${YELLOW}⚠ Skipping Hyperdrive setup (no connection string provided)${NC}"
    echo "You can create it later with:"
    echo "  wrangler hyperdrive create $HYPERDRIVE_NAME --connection-string=\"\$DATABASE_URL\""
  else
    RESULT=$(wrangler hyperdrive create "$HYPERDRIVE_NAME" --connection-string="$DATABASE_URL" 2>&1)
    HYPERDRIVE_ID=$(echo "$RESULT" | grep -oP 'id: \K[a-f0-9-]+' || echo "")
    echo -e "${GREEN}✓ Hyperdrive '$HYPERDRIVE_NAME' created${NC}"
  fi
fi
echo ""

# ============================================
# Step 3: Configure Secrets
# ============================================
echo -e "${YELLOW}Step 3: Configuring secrets...${NC}"
echo "You'll be prompted to enter each secret value."
echo "(Press Enter to skip a secret)"
echo ""

configure_secret() {
  local secret_name=$1
  local description=$2

  echo -e "${BLUE}$secret_name${NC} - $description"
  read -r -s -p "Value (hidden): " secret_value
  echo ""

  if [ -n "$secret_value" ]; then
    echo "$secret_value" | wrangler pages secret put "$secret_name" --project-name="$PROJECT_NAME" 2>/dev/null || \
    echo "$secret_value" | wrangler secret put "$secret_name" 2>/dev/null || true
    echo -e "${GREEN}✓ Set $secret_name${NC}"
  else
    echo -e "${YELLOW}⚠ Skipped $secret_name${NC}"
  fi
}

# Required secrets
configure_secret "BETTER_AUTH_SECRET" "Auth encryption key (generate with: openssl rand -base64 32)"
configure_secret "BETTER_AUTH_URL" "Your app's public URL (e.g., https://app.example.com)"
configure_secret "DATABASE_URL" "Neon PostgreSQL connection string"
configure_secret "R2_PUBLIC_URL" "Public URL for R2 assets (e.g., https://assets.example.com)"

echo ""
echo -e "${BLUE}Optional secrets (press Enter to skip):${NC}"
configure_secret "STRIPE_SECRET_KEY" "Stripe secret key"
configure_secret "STRIPE_PUBLISHABLE_KEY" "Stripe publishable key"
configure_secret "RESEND_API_KEY" "Resend email API key"
configure_secret "ANTHROPIC_API_KEY" "Anthropic API key for AI features"

echo ""

# ============================================
# Step 4: Update wrangler.toml
# ============================================
echo -e "${YELLOW}Step 4: Updating wrangler.toml...${NC}"

if [ -n "$HYPERDRIVE_ID" ]; then
  # Update the Hyperdrive ID in wrangler.toml
  if grep -q 'id = ""' wrangler.toml; then
    sed -i.bak "s/id = \"\"/id = \"$HYPERDRIVE_ID\"/" wrangler.toml
    rm -f wrangler.toml.bak
    echo -e "${GREEN}✓ Updated Hyperdrive ID in wrangler.toml${NC}"
  else
    echo -e "${YELLOW}⚠ Please manually update the Hyperdrive ID in wrangler.toml${NC}"
    echo "  id = \"$HYPERDRIVE_ID\""
  fi
fi

# Update bucket name if using environment suffix
if [ -n "$ENV" ]; then
  sed -i.bak "s/bucket_name = \"pdf-annotator-assets\"/bucket_name = \"$R2_BUCKET_NAME\"/" wrangler.toml
  rm -f wrangler.toml.bak
  echo -e "${GREEN}✓ Updated R2 bucket name in wrangler.toml${NC}"
fi

echo ""

# ============================================
# Summary
# ============================================
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  Setup Complete!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "Resources created:"
echo -e "  ${GREEN}✓${NC} R2 Bucket: $R2_BUCKET_NAME"
if [ -n "$HYPERDRIVE_ID" ]; then
  echo -e "  ${GREEN}✓${NC} Hyperdrive: $HYPERDRIVE_NAME (ID: $HYPERDRIVE_ID)"
fi
echo ""
echo "Next steps:"
echo "  1. Configure R2 public access (custom domain or R2.dev URL)"
echo "  2. Push your code to trigger GitHub Actions deployment"
echo "  3. Run database migrations: pnpm db:push"
echo ""
echo "To deploy manually:"
echo "  pnpm build && wrangler pages deploy .output/public"
echo ""
