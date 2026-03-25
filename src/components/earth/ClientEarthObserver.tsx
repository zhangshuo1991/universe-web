'use client';

import dynamic from 'next/dynamic';

const EarthObserver = dynamic(() => import('@/components/earth/EarthObserver'), {
  ssr: false,
  loading: () => <div className="viewerLoading">正在加载地球观测站...</div>
});

export default function ClientEarthObserver() {
  return <EarthObserver />;
}
