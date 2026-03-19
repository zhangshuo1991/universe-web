'use client';

import dynamic from 'next/dynamic';

const EarthExperience = dynamic(() => import('@/components/earth/EarthExperience'), {
  ssr: false,
  loading: () => <div className="viewerLoading">正在装载观测穹顶...</div>
});

export function ClientEarthExperience() {
  return <EarthExperience />;
}
