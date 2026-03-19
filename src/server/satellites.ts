import { z } from 'zod';

const SATELLITE_GROUPS = {
  stations: {
    label: 'Stations',
    satellites: [
      { catnr: 25544, label: 'ISS', color: '#f7b955' },
      { catnr: 48274, label: 'Tiangong', color: '#a78bfa' }
    ]
  },
  weather: {
    label: 'Weather',
    satellites: [
      { catnr: 43013, label: 'NOAA-20', color: '#fb7185' },
      { catnr: 33591, label: 'NOAA-19', color: '#38bdf8' },
      { catnr: 37849, label: 'Suomi NPP', color: '#34d399' }
    ]
  },
  science: {
    label: 'Science',
    satellites: [
      { catnr: 20580, label: 'Hubble', color: '#5eead4' },
      { catnr: 25994, label: 'Terra', color: '#f59e0b' },
      { catnr: 27424, label: 'Aqua', color: '#60a5fa' }
    ]
  }
} as const;

export const satelliteCategorySchema = z.enum(['all', 'stations', 'weather', 'science']);
export type SatelliteCategoryId = z.infer<typeof satelliteCategorySchema>;

const ommSchema = z.object({
  OBJECT_NAME: z.string(),
  OBJECT_ID: z.string(),
  EPOCH: z.string(),
  MEAN_MOTION: z.union([z.number(), z.string()]),
  ECCENTRICITY: z.union([z.number(), z.string()]),
  INCLINATION: z.union([z.number(), z.string()]),
  RA_OF_ASC_NODE: z.union([z.number(), z.string()]),
  ARG_OF_PERICENTER: z.union([z.number(), z.string()]),
  MEAN_ANOMALY: z.union([z.number(), z.string()]),
  EPHEMERIS_TYPE: z.union([z.literal(0), z.literal('0')]).optional(),
  CLASSIFICATION_TYPE: z.enum(['U', 'C']).optional(),
  NORAD_CAT_ID: z.union([z.number(), z.string()]),
  ELEMENT_SET_NO: z.union([z.number(), z.string()]),
  REV_AT_EPOCH: z.union([z.number(), z.string()]).optional(),
  BSTAR: z.union([z.number(), z.string()]),
  MEAN_MOTION_DOT: z.union([z.number(), z.string()]),
  MEAN_MOTION_DDOT: z.union([z.number(), z.string()])
});

type GroupKey = Exclude<SatelliteCategoryId, 'all'>;

type GroupItem = (typeof SATELLITE_GROUPS)[GroupKey]['satellites'][number];

export type SatelliteFeedItem = GroupItem & { omm: z.infer<typeof ommSchema> };

export function getSatelliteCategories(locale: 'en' | 'zh' = 'en') {
  const i18n = locale === 'zh'
    ? {
        all: '全部',
        stations: '空间站',
        weather: '气象',
        science: '科学'
      }
    : {
        all: 'All',
        stations: SATELLITE_GROUPS.stations.label,
        weather: SATELLITE_GROUPS.weather.label,
        science: SATELLITE_GROUPS.science.label
      };

  return [
    {
      id: 'all' as const,
      label: i18n.all,
      count:
        SATELLITE_GROUPS.stations.satellites.length +
        SATELLITE_GROUPS.weather.satellites.length +
        SATELLITE_GROUPS.science.satellites.length
    },
    { id: 'stations' as const, label: i18n.stations, count: SATELLITE_GROUPS.stations.satellites.length },
    { id: 'weather' as const, label: i18n.weather, count: SATELLITE_GROUPS.weather.satellites.length },
    { id: 'science' as const, label: i18n.science, count: SATELLITE_GROUPS.science.satellites.length }
  ];
}

function getCategoryItems(category: SatelliteCategoryId): readonly GroupItem[] {
  if (category === 'all') {
    return [
      ...SATELLITE_GROUPS.stations.satellites,
      ...SATELLITE_GROUPS.weather.satellites,
      ...SATELLITE_GROUPS.science.satellites
    ];
  }
  return SATELLITE_GROUPS[category].satellites;
}

async function fetchSatellite(catnr: number) {
  const url = `https://celestrak.org/NORAD/elements/gp.php?CATNR=${catnr}&FORMAT=json`;
  const response = await fetch(url, {
    next: { revalidate: 900 },
    headers: {
      'User-Agent': 'universe-web-earth-observer/0.1 (satellite layer fetcher)'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch satellite ${catnr}`);
  }

  const parsed = z.array(ommSchema).parse(await response.json());
  if (!parsed[0]) {
    throw new Error(`No OMM data returned for ${catnr}`);
  }

  return parsed[0];
}

export async function getSatelliteFeed(category: SatelliteCategoryId) {
  const selectedItems = getCategoryItems(category);
  const settled = await Promise.allSettled(
    selectedItems.map(async (item) => ({
      ...item,
      omm: await fetchSatellite(item.catnr)
    }))
  );

  const satellites = settled
    .filter((result): result is PromiseFulfilledResult<SatelliteFeedItem> => result.status === 'fulfilled')
    .map((result) => result.value);

  return {
    activeCategory: category,
    categories: getSatelliteCategories(),
    failedCount: settled.length - satellites.length,
    satellites
  };
}
