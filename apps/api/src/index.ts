import * as Sentry from '@sentry/node';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { ingestRoutes } from './routes/ingest';
import { settingsRoutes } from './routes/settings';
import { leadsRoutes } from './routes/leads';
import { logger } from './lib/logger';

// Initialize Sentry early so unhandled exceptions captured by setErrorHandler
// below get reported. No-op if SENTRY_DSN is unset (typical for local dev).
// G2 in docs/revisao-geral.md.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    // Errors are always captured at 100%; traces sampled to keep free-tier
    // quota healthy. Adjust if we ever need fuller request tracing.
    tracesSampleRate: 0.1,
  });
  logger.info('Sentry initialized');
}

const app = Fastify({ logger: false });
app.register(cors, { origin: true });

// Send unhandled exceptions to Sentry while preserving Fastify's default
// error response (so the client behavior stays identical). Only fires for
// errors that bubbled out of handlers — intentional reply.code(4xx).send()
// is not an exception and doesn't reach here.
app.setErrorHandler((error, request, reply) => {
  if (process.env.SENTRY_DSN) {
    Sentry.withScope((scope) => {
      scope.setTag('http.url', request.url);
      scope.setTag('http.method', request.method);
      scope.setContext('request', {
        userAgent: request.headers['user-agent'] || 'unknown',
      });
      Sentry.captureException(error);
    });
  }
  reply.send(error);
});

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

// A1.b.2: require Authorization: Bearer ${API_SECRET_KEY} on every /api/* call.
// Exceptions:
//   - /health: no auth, used by Render's health check and by us for sanity probes.
//   - /api/ingest/gobii: validates its own GOBII_WEBHOOK_TOKEN per request — the
//     Gobii agents don't have API_SECRET_KEY and shouldn't.
// In dev (no API_SECRET_KEY in env) the hook lets requests through with a
// warning so local development without secrets keeps working.
app.addHook('preHandler', async (req, reply) => {
  if (req.url === '/health') return;
  if (req.url.startsWith('/api/ingest/gobii')) return;
  if (!req.url.startsWith('/api/')) return;

  const expectedToken = process.env.API_SECRET_KEY;
  if (!expectedToken) {
    logger.warn({ url: req.url }, 'API_SECRET_KEY not configured; allowing unauthenticated request');
    return;
  }
  const auth = (req.headers['authorization'] as string) || '';
  const match = /^Bearer\s+(.+)$/i.exec(auth);
  if (!match || match[1].trim() !== expectedToken) {
    logger.warn({ url: req.url, hasAuth: !!auth }, 'Rejected unauthenticated request');
    return reply.code(401).send({ error: 'Unauthorized' });
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
