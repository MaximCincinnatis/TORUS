#!/bin/bash

# Deploy to Vercel production
# This script uses the VERCEL_TOKEN from .env file

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Check if VERCEL_TOKEN is set
if [ -z "$VERCEL_TOKEN" ]; then
  echo "Error: VERCEL_TOKEN not found in .env file"
  exit 1
fi

echo "Deploying to Vercel production..."
npx vercel --token $VERCEL_TOKEN --prod --yes

echo "Deployment complete!"