const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(__dirname, '../../'),
  env: {
    // IMPORTANT: this fallback is inlined into the client bundle at build time.
    // If the Render service doesn't have NEXT_PUBLIC_API_URL set, this is what
    // the bundle ships with. It MUST point at the production API, not localhost,
    // otherwise every fetch from the deployed web app goes nowhere and the
    // dashboard renders empty (0 leads, 0 prospects, etc.). Local dev should
    // either run with NEXT_PUBLIC_API_URL=http://localhost:3000 in apps/web/.env
    // or just talk to the production API.
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://ai-crm-api-pcdn.onrender.com'
  },
  experimental: {
    // Skip prerendering of not-found and error pages
    missingSuspenseWithCSRBailout: false,
  }
}

module.exports = nextConfig
