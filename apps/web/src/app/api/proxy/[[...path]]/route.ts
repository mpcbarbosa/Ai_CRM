import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';

// Server-side proxy that forwards requests from the browser to the Fastify
// API. This is part of A1 in docs/revisao-geral.md — closing the
// unauthenticated API surface. Phase A1.a (this file) just sets up the
// plumbing; the actual Authorization header (Bearer ${API_SECRET_KEY}) gets
// added in Phase A1.b once the env var is populated on the web service.
//
// Why a proxy instead of fetching the API directly from the browser:
//   - The token must never reach the client bundle. By doing the forward
//     server-side, the token stays in process.env on the Next server.
//   - Centralizes auth, header sanitization, and (later) rate limiting.
//   - Lets us switch the API URL without rebuilding the client bundle.
//
// Path mapping: a request to /api/proxy/api/leads gets forwarded verbatim
// (minus the /api/proxy prefix) to ${API_BASE}/api/leads. Keep the second
// "/api/" in the client-side calls so the existing route paths in Fastify
// stay untouched.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const API_BASE = (
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'https://ai-crm-api-pcdn.onrender.com'
)
  .trim()
  .replace(/\/+$/, '');

function buildUpstreamUrl(
  pathSegments: string[] | undefined,
  search: string
): string {
  const path = (pathSegments || []).join('/');
  return `${API_BASE}/${path}${search}`;
}

// Only forward an allowlisted set of headers. We deliberately drop `host`,
// `origin`, `referer`, `cookie`, and anything related to caching so that the
// upstream sees a clean, predictable request.
// Takes an optional userName resolved from the session cookie below.
function pickForwardHeaders(req: NextRequest, userName: string | null): Headers {
  const out = new Headers();
  const ct = req.headers.get('content-type');
  if (ct) out.set('content-type', ct);
  // A3: the userName now comes from the session JWT, not from a header
  // sent by the client (which the client could forge). The legacy
  // x-user-name header from the client is ignored.
  if (userName) out.set('x-user-name', userName);
  const ui = req.headers.get('x-user-id');
  if (ui) out.set('x-user-id', ui);
  // Inject the shared secret so the Fastify side can authenticate the proxy.
  // We never read this on the client (it's server-side env only) so it stays
  // out of the browser bundle.
  const token = process.env.API_SECRET_KEY;
  if (token) out.set('authorization', `Bearer ${token}`);
  return out;
}

async function getUserNameFromCookie(req: NextRequest): Promise<string | null> {
  const cookie = req.cookies.get('crm_session');
  if (!cookie?.value) return null;
  const payload = await verifySession(cookie.value);
  return payload?.userName ?? null;
}

async function forward(
  req: NextRequest,
  params: { path?: string[] }
): Promise<NextResponse> {
  const url = new URL(req.url);
  const upstream = buildUpstreamUrl(params.path, url.search);

  const userName = await getUserNameFromCookie(req);

  const hasBody = !['GET', 'HEAD'].includes(req.method);
  const init: RequestInit = {
    method: req.method,
    headers: pickForwardHeaders(req, userName),
    body: hasBody ? await req.text() : undefined,
    redirect: 'manual',
  };

  let res: Response;
  try {
    res = await fetch(upstream, init);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: 'Proxy upstream error', detail: message, upstream },
      { status: 502 }
    );
  }

  const body = await res.text();
  return new NextResponse(body, {
    status: res.status,
    headers: {
      'content-type': res.headers.get('content-type') || 'application/json',
    },
  });
}

export async function GET(
  req: NextRequest,
  ctx: { params: { path?: string[] } }
) {
  return forward(req, ctx.params);
}
export async function POST(
  req: NextRequest,
  ctx: { params: { path?: string[] } }
) {
  return forward(req, ctx.params);
}
export async function PATCH(
  req: NextRequest,
  ctx: { params: { path?: string[] } }
) {
  return forward(req, ctx.params);
}
export async function PUT(
  req: NextRequest,
  ctx: { params: { path?: string[] } }
) {
  return forward(req, ctx.params);
}
export async function DELETE(
  req: NextRequest,
  ctx: { params: { path?: string[] } }
) {
  return forward(req, ctx.params);
}
