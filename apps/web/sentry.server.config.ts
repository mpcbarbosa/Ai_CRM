// Server-side Sentry config (Node runtime).
// Loaded via apps/web/instrumentation.ts when NEXT_RUNTIME === 'nodejs'.
// G2 in docs/revisao-geral.md.
import * as Sentry from '@sentry/nextjs';

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;

if (DSN) {
  Sentry.init({
    dsn: DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,
  });
}
