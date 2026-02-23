#!/bin/bash
set -e

# Navigate to apps/api directory (where this script lives in scripts/)
cd "$(dirname "$0")/.."

SCHEMA="../../prisma/schema.prisma"

echo "==> Resolving any failed migrations..."
npx prisma migrate resolve --rolled-back 20260223000001_notes_tasks_contact_opp --schema=$SCHEMA 2>/dev/null || true

echo "==> Running migrations..."
npx prisma migrate deploy --schema=$SCHEMA

echo "==> Starting server..."
npm start
