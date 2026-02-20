'use client';
import dynamic from 'next/dynamic';
import { use } from 'react';

export const runtime = 'edge';

const LeadPage = dynamic(() => import('../../LeadPage'), { ssr: false });

export default function Page({ params }) {
  const { id } = use(params);
  return <LeadPage leadId={id} />;
}
