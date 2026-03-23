import nextDynamic from 'next/dynamic';

export const dynamic = 'force-dynamic';

const Dashboard = nextDynamic(() => import('./Dashboard'), { ssr: false });

export default function Page() {
  return <Dashboard />;
}
