'use client';

import dynamic from 'next/dynamic';

const SolarSystemExperience = dynamic(() => import('@/components/solar-system/SolarSystemExperience'), {
  ssr: false,
  loading: () => <div className="viewerLoading">Loading Solar System observatory...</div>
});

export function ClientSolarSystemExperience() {
  return <SolarSystemExperience />;
}
