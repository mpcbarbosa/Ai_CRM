const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  // Mark failed migration as rolled back so Prisma can re-apply it
  await client.query(`
    UPDATE "_prisma_migrations" 
    SET rolled_back_at = NOW()
    WHERE migration_name = '20260221000002_update_lead_status'
    AND finished_at IS NULL
    AND rolled_back_at IS NULL
  `);
  
  console.log('Migration 000002 marked as rolled back');
  await client.end();
}

main().catch(console.error);
