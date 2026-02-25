import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  const correctPassword = process.env.CRM_PASSWORD;

  if (!correctPassword || password !== correctPassword) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set('crm_session', process.env.SESSION_SECRET!, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  });
  return response;
}
