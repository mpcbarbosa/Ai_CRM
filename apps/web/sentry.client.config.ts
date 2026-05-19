// Client-side Sentry config (browser).
// Loaded automatically by @sentry/nextjs at module init time.
// The DSN must be NEXT_PUBLIC_* because it ends up in the client bundle
// (this is intentional — Sentry DSNs are designed to be public).
// G2 in docs/revisao-geral.md.
import * as Sentry from '@sentry/nextjs';

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,
    // Session replay: capture full session on errors for triage, sample 10%
    // of all sessions for general visibility. Disabled if quota is tight.
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
  });
}
