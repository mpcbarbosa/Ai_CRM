import dynamic from 'next/dynamic';

export const runtime = 'edge';

const Dashboard = dynamic(() => import('./Dashboard'), { ssr: false });

export default function Page() {
  return <Dashboard />;
}
