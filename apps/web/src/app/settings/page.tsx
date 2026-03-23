import dynamic from 'next/dynamic';

export const dynamic = 'force-dynamic';

const SettingsPage = dynamic(() => import('./SettingsClient'), { ssr: false });

export default function Page() {
  return <SettingsPage />;
}
