const path = require('path');

const DEFAULT_API_URL = 'https://ai-crm-api-pcdn.onrender.com';

// Normalize NEXT_PUBLIC_API_URL. The render.yaml binds this var to
// `fromService.property: host`, which yields a bare hostname like
// "ai-crm-api-pcdn.onrender.com" — no scheme. Without normalization the
// browser treats `fetch('ai-crm-api-pcdn.onrender.com/api/leads')` as a
// path relative to the web origin and the dashboard renders empty.
// Also strips trailing slashes so route concatenation stays clean.
function normalizeApiUrl(raw) {
  if (!raw || typeof raw !== 'string') return DEFAULT_API_URL;
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return DEFAULT_API_URL;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  return 'https://' + trimmed;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(__dirname, '../../'),
  env: {
    // IMPORTANT: this value is inlined into the client bundle at build time.
    // It MUST be a fully-qualified URL (scheme + host) — see normalizeApiUrl
    // above for why bare hostnames from `fromService.property: host` need
    // fixing up.
    NEXT_PUBLIC_API_URL: normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL)
  },
  experimental: {
    // Skip prerendering of not-found and error pages
    missingSuspenseWithCSRBailout: false,
  }
}

module.exports = nextConfig
