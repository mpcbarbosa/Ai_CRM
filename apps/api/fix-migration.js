const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    await prisma.$executeRawUnsafe(
      "UPDATE \"_prisma_migrations\" SET rolled_back_at = NOW() WHERE migration_name = '20260221000002_update_lead_status' AND finished_at IS NULL AND rolled_back_at IS NULL"
    );
    console.log('Migration 000002 marked as rolled back');
  } catch(e) {
    console.log('Fix migration error (may be ok):', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
