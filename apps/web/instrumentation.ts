// Next.js entry point for server-side instrumentation.
// Called once at server startup, dispatches to the right Sentry config
// based on which runtime is initializing.
// https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}
