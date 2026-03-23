import dynamic from 'next/dynamic';

export const dynamic = 'force-dynamic';

const LoginPage = dynamic(() => import('./LoginClient'), { ssr: false });

export default function Page() {
  return <LoginPage />;
}
