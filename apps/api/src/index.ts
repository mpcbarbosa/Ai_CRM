import Fastify from 'fastify';
import cors from '@fastify/cors';
import { ingestRoutes } from './routes/ingest';
import { settingsRoutes } from './routes/settings';
import { leadsRoutes } from './routes/leads';
import { logger } from './lib/logger';

const app = Fastify({ logger: false });
app.register(cors, { origin: true });

// Custom JSON parser that accepts both objects and arrays
app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
  // Treat empty body as `{}` instead of letting JSON.parse('') throw.
  // The frontend sends POSTs with `Content-Type: application/json` but no body
  // for several actions (migrate, discard, enrich) — without this guard, those
  // requests fail with HTTP 500 "Unexpected end of JSON input" before they
  // ever reach the route handler.
  const raw = (body as string) || '';
  try {
    done(null, raw.trim() ? JSON.parse(raw) : {});
  } catch (e) {
    done(e as Error, undefined);
  }
});

app.addContentTypeParser('text/plain', { parseAs: 'string' }, (req, body, done) => {
  try {
    done(null, JSON.parse(body as string));
  } catch (e) {
    done(null, body);
  }
});

app.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, (req, body, done) => {
  try {
    // Try JSON first
    done(null, JSON.parse(body as string));
  } catch {
    try {
      // Parse as form-urlencoded key=value&key2=value2
      const parsed: Record<string, string> = {};
      (body as string).split('&').forEach(pair => {
        const [k, v] = pair.split('=');
        if (k) parsed[decodeURIComponent(k)] = decodeURIComponent(v || '');
      });
      done(null, parsed);
    } catch {
      done(null, {});
    }
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
app.register(settingsRoutes);
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
