import Fastify from 'fastify';
import cors from '@fastify/cors';
import { ingestRoutes } from './routes/ingest';
import { leadsRoutes } from './routes/leads';
import { logger } from './lib/logger';

const app = Fastify({ logger: false });

app.register(cors, { origin: true });

// Handle requests with no Content-Type header (webhooks)
app.addContentTypeParser('text/plain', { parseAs: 'string' }, (req, body, done) => {
  try {
    done(null, JSON.parse(body as string));
  } catch (e) {
    done(null, body);
  }
});

app.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, (req, body, done) => {
  try {
    done(null, JSON.parse(body as string));
  } catch (e) {
    done(null, body);
  }
});

// Catch-all for webhooks sending no Content-Type
app.addHook('preValidation', async (req) => {
  if (!req.headers['content-type'] && req.body === undefined) {
    try {
      const raw = await new Promise<string>((resolve) => {
        let data = '';
        (req.raw as any).on('data', (chunk: any) => data += chunk);
        (req.raw as any).on('end', () => resolve(data));
      });
      (req as any).body = raw ? JSON.parse(raw) : {};
    } catch {
      (req as any).body = {};
    }
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
