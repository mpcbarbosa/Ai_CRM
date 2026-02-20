'use client';
import dynamic from 'next/dynamic';

export const runtime = 'edge';

const LeadPage = dynamic(() => import('../../LeadPage'), { ssr: false });

export default function Page({ params }: { params: { id: string } }) {
  return <LeadPage leadId={params.id} />;
}
