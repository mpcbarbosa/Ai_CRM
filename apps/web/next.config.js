const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(__dirname, '../../'),
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
  },
  experimental: {
    // Skip prerendering of not-found and error pages
    missingSuspenseWithCSRBailout: false,
  }
}

module.exports = nextConfig
