#!/bin/bash
set -e

SCHEMA="../../prisma/schema.prisma"

echo "==> Resolving any failed migrations..."
# Mark the failed migration as rolled back so it can be retried
npx prisma migrate resolve --rolled-back 20260223000001_notes_tasks_contact_opp --schema=$SCHEMA 2>/dev/null || true

echo "==> Running migrations..."
npx prisma migrate deploy --schema=$SCHEMA

echo "==> Starting server..."
npm start
