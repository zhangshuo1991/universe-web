import { NextRequest, NextResponse } from 'next/server';

import { getSatelliteFeed, satelliteCategorySchema } from '@/server/satellites';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const category = satelliteCategorySchema.catch('all').parse(request.nextUrl.searchParams.get('category') ?? 'all');
  const locale = request.nextUrl.searchParams.get('locale');
  const feed = await getSatelliteFeed(category);

  return NextResponse.json({
    ...feed,
    categories:
      locale === 'zh'
        ? [
            { id: 'all', label: '全部', count: feed.categories[0].count },
            { id: 'stations', label: '空间站', count: feed.categories[1].count },
            { id: 'weather', label: '气象', count: feed.categories[2].count },
            { id: 'science', label: '科学', count: feed.categories[3].count }
          ]
        : feed.categories
  });
}
