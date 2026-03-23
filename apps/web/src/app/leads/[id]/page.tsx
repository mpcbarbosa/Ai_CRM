import nextDynamic from 'next/dynamic';

export const dynamic = 'force-dynamic';

const LeadPage = nextDynamic(() => import('../../LeadPageV2'), { ssr: false });

export default function Page({ params }: { params: { id: string } }) {
  return <LeadPage leadId={params.id} />;
}
