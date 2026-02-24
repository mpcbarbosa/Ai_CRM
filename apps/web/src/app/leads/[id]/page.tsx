'use client';
import dynamic from 'next/dynamic';

const LeadPage = dynamic(() => import('../../LeadPageV2'), { ssr: false });

export default function Page({ params }: { params: { id: string } }) {
  return <LeadPage leadId={params.id} />;
}
