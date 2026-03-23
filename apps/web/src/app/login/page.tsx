import nextDynamic from 'next/dynamic';

export const dynamic = 'force-dynamic';

const LoginPage = nextDynamic(() => import('./LoginClient'), { ssr: false });

export default function Page() {
  return <LoginPage />;
}
