import { NextRequest, NextResponse } from 'next/server';
import { signSession, SESSION_MAX_AGE_SECONDS } from '@/lib/session';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const password = typeof body?.password === 'string' ? body.password : '';
  const userNameRaw = typeof body?.userName === 'string' ? body.userName : '';
  const userName = userNameRaw.trim().slice(0, 50);

  const correctPassword = process.env.CRM_PASSWORD;
  if (!correctPassword || password !== correctPassword) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!userName) {
    return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });
  }

  // A3: cookie is now a signed JWT carrying the userName instead of being
  // the literal SESSION_SECRET. Backends (audit log etc.) read the userName
  // via x-user-name header injected by the proxy from this same JWT.
  let token: string;
  try {
    token = await signSession({ userName });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'session sign failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const response = NextResponse.json({ ok: true, userName });
  response.cookies.set('crm_session', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: '/',
  });
  return response;
}
