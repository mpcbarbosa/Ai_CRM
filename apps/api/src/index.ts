import Fastify from 'fastify';
import { ingestRoutes } from './routes/ingest';
import { leadsRoutes } from './routes/leads';
import { logger } from './lib/logger';

const app = Fastify({ logger: false });

// Accept any content-type as JSON (for webhooks without Content-Type header)
app.addContentTypeParser('*', { parseAs: 'string' }, (req, body, done) => {
  try {
    const parsed = typeof body === 'string' && body.trim() ? JSON.parse(body) : body;
    done(null, parsed);
  } catch (err) {
    done(null, body);
  }
});

app.register(ingestRoutes);
app.register(leadsRoutes);

app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

const start = async () => {
  try {
    const port = Number(process.env.PORT || 10000);
    await app.listen({ port, host: '0.0.0.0' });
    logger.info(`Ai CRM API running on port ${port}`);
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
};

start();
