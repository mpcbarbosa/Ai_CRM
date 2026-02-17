import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from 'dotenv';
import { ingestRoutes } from './routes/ingest';
import { leadsRoutes } from './routes/leads';
import { logger } from './lib/logger';

config();

const app = Fastify({ logger: false });

app.register(cors, { origin: '*' });

// Health check
app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

// Routes
app.register(ingestRoutes);
app.register(leadsRoutes);

const PORT = Number(process.env.PORT || 3000);

app.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
  if (err) { logger.error(err); process.exit(1); }
  logger.info('Ai CRM API running on port ' + PORT);
});
