import dynamic from 'next/dynamic';

const LoginPage = dynamic(() => import('./LoginClient'), { ssr: false });

export default function Page() {
  return <LoginPage />;
}
