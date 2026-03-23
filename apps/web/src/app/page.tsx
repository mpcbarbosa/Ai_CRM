import dynamic from 'next/dynamic';

export const dynamic = 'force-dynamic';

const Dashboard = dynamic(() => import('./Dashboard'), { ssr: false });

export default function Page() {
  return <Dashboard />;
}
