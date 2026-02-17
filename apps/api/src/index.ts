import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from 'dotenv';
import { ingestRoutes } from './routes/ingest';
import { leadsRoutes } from './routes/leads';
import { logger } from './lib/logger';

config();

const app = Fastify({ logger: false });

async function main() {
  await app.register(cors, { origin: true });

  await app.register(ingestRoutes);
  await app.register(leadsRoutes);

  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  const port = Number(process.env.PORT) || 3001;
  await app.listen({ port, host: '0.0.0.0' });
  logger.info({ port }, 'API server started');
}

main().catch((err) => {
  logger.error(err, 'Fatal error starting server');
  process.exit(1);
});
