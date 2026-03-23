import dynamic from 'next/dynamic';

const SettingsPage = dynamic(() => import('./SettingsClient'), { ssr: false });

export default function Page() {
  return <SettingsPage />;
}
