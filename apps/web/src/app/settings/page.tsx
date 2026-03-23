import nextDynamic from 'next/dynamic';

export const dynamic = 'force-dynamic';

const SettingsPage = nextDynamic(() => import('./SettingsClient'), { ssr: false });

export default function Page() {
  return <SettingsPage />;
}
