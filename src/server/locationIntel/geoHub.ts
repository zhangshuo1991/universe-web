import type { GeoHub, GeoHubMatch, GeoHubPriority } from '@/types/explorer';

const GEO_HUBS: GeoHub[] = [
  {
    id: 'taiwan-strait',
    name: '台湾海峡',
    region: '东亚',
    country: '国际水域',
    lat: 24.6,
    lon: 119.8,
    kind: 'strategic',
    priority: 'critical',
    aliases: ['Taiwan Strait', 'Formosa Strait'],
    keywords: ['taiwan strait', 'taipei', 'taiwan', 'formosa strait', 'pla drills'],
    description: '连接中国大陆与台湾的重要海域，适合观察区域军事与航运变化。'
  },
  {
    id: 'gaza',
    name: '加沙',
    region: '中东',
    country: '巴勒斯坦',
    lat: 31.47,
    lon: 34.47,
    kind: 'conflict',
    priority: 'critical',
    aliases: ['Gaza', 'Gaza Strip'],
    keywords: ['gaza', 'gaza strip', 'rafah', 'khan younis'],
    description: '长期高关注冲突地区，适合结合新闻和火点变化持续观察。'
  },
  {
    id: 'jerusalem',
    name: '耶路撒冷',
    region: '中东',
    country: '以色列',
    lat: 31.7683,
    lon: 35.2137,
    kind: 'capital',
    priority: 'major',
    aliases: ['Jerusalem'],
    keywords: ['jerusalem', 'israel cabinet', 'knesset'],
    description: '中东政治和宗教议题的高频中心。'
  },
  {
    id: 'kyiv',
    name: '基辅',
    region: '东欧',
    country: '乌克兰',
    lat: 50.4501,
    lon: 30.5234,
    kind: 'capital',
    priority: 'critical',
    aliases: ['Kyiv', 'Kiev'],
    keywords: ['kyiv', 'kiev', 'ukraine', 'zelenskyy'],
    description: '东欧局势的核心观察点，可结合天气、新闻和轨道观测做持续追踪。'
  },
  {
    id: 'red-sea',
    name: '红海',
    region: '中东',
    country: '国际水域',
    lat: 20.5,
    lon: 38.6,
    kind: 'strategic',
    priority: 'critical',
    aliases: ['Red Sea'],
    keywords: ['red sea', 'bab el-mandeb', 'shipping disruption'],
    description: '全球航运咽喉与地区安全议题的叠加区域。'
  },
  {
    id: 'suez',
    name: '苏伊士运河',
    region: '中东',
    country: '埃及',
    lat: 30.5,
    lon: 32.3,
    kind: 'strategic',
    priority: 'critical',
    aliases: ['Suez Canal'],
    keywords: ['suez', 'suez canal', 'canal traffic'],
    description: '适合观察航运、贸易和区域安全信号。'
  },
  {
    id: 'hormuz',
    name: '霍尔木兹海峡',
    region: '中东',
    country: '国际水域',
    lat: 26.56,
    lon: 56.25,
    kind: 'strategic',
    priority: 'critical',
    aliases: ['Strait of Hormuz', 'Hormuz'],
    keywords: ['hormuz', 'strait of hormuz', 'persian gulf shipping'],
    description: '能源航运与中东态势变化的关键观察点。'
  },
  {
    id: 'tehran',
    name: '德黑兰',
    region: '中东',
    country: '伊朗',
    lat: 35.6892,
    lon: 51.389,
    kind: 'capital',
    priority: 'major',
    aliases: ['Tehran'],
    keywords: ['tehran', 'iran', 'irgc', 'iranian capital'],
    description: '中东议题与区域外交、军事动向的重要中心。'
  },
  {
    id: 'dubai',
    name: '迪拜',
    region: '海湾',
    country: '阿联酋',
    lat: 25.2048,
    lon: 55.2708,
    kind: 'capital',
    priority: 'major',
    aliases: ['Dubai'],
    keywords: ['dubai', 'uae', 'jebel ali'],
    description: '商业、航运和海湾地区新闻的高频入口。'
  },
  {
    id: 'tokyo',
    name: '东京',
    region: '东亚',
    country: '日本',
    lat: 35.6762,
    lon: 139.6503,
    kind: 'capital',
    priority: 'major',
    aliases: ['Tokyo'],
    keywords: ['tokyo', 'japan', 'japanese capital'],
    description: '适合观察地震、科技和东北亚新闻的交叉信号。'
  },
  {
    id: 'seoul',
    name: '首尔',
    region: '东亚',
    country: '韩国',
    lat: 37.5665,
    lon: 126.978,
    kind: 'capital',
    priority: 'major',
    aliases: ['Seoul'],
    keywords: ['seoul', 'south korea', 'korean peninsula'],
    description: '韩半岛与东北亚政治、科技新闻的重要节点。'
  },
  {
    id: 'pyongyang',
    name: '平壤',
    region: '东亚',
    country: '朝鲜',
    lat: 39.0392,
    lon: 125.7625,
    kind: 'capital',
    priority: 'major',
    aliases: ['Pyongyang'],
    keywords: ['pyongyang', 'north korea', 'dprk'],
    description: '适合关注东北亚安全、导弹和外交议题。'
  },
  {
    id: 'beijing',
    name: '北京',
    region: '东亚',
    country: '中国',
    lat: 39.9042,
    lon: 116.4074,
    kind: 'capital',
    priority: 'major',
    aliases: ['Beijing'],
    keywords: ['beijing', 'china', 'chinese capital'],
    description: '东亚政策、航天和科技动态的重要中心。'
  },
  {
    id: 'shanghai',
    name: '上海',
    region: '东亚',
    country: '中国',
    lat: 31.2304,
    lon: 121.4737,
    kind: 'capital',
    priority: 'watch',
    aliases: ['Shanghai'],
    keywords: ['shanghai', 'yangtze delta'],
    description: '适合观察长三角城市群与东亚科技财经新闻。'
  },
  {
    id: 'cape-canaveral',
    name: '卡纳维拉尔角',
    region: '北美',
    country: '美国',
    lat: 28.3922,
    lon: -80.6077,
    kind: 'spaceport',
    priority: 'major',
    aliases: ['Cape Canaveral', 'Kennedy Space Center'],
    keywords: ['cape canaveral', 'kennedy space center', 'space launch florida'],
    description: '适合航天发射、气象与轨道观测联动探索。'
  },
  {
    id: 'vandenberg',
    name: '范登堡太空基地',
    region: '北美',
    country: '美国',
    lat: 34.742,
    lon: -120.5724,
    kind: 'spaceport',
    priority: 'watch',
    aliases: ['Vandenberg', 'Vandenberg Space Force Base'],
    keywords: ['vandenberg', 'space force base', 'california launch'],
    description: '西海岸航天发射和极轨任务的重要节点。'
  },
  {
    id: 'wenchang',
    name: '文昌航天发射场',
    region: '东亚',
    country: '中国',
    lat: 19.6145,
    lon: 110.9511,
    kind: 'spaceport',
    priority: 'major',
    aliases: ['Wenchang', 'Wenchang Spacecraft Launch Site'],
    keywords: ['wenchang', 'hainan launch site', 'long march launch'],
    description: '适合观察中国航天任务和热带天气条件。'
  },
  {
    id: 'baikonur',
    name: '拜科努尔航天发射场',
    region: '中亚',
    country: '哈萨克斯坦',
    lat: 45.9203,
    lon: 63.3422,
    kind: 'spaceport',
    priority: 'watch',
    aliases: ['Baikonur'],
    keywords: ['baikonur', 'soyuz launch', 'roscosmos'],
    description: '传统航天发射中心，适合航天任务背景观察。'
  },
  {
    id: 'iceland-atlantic',
    name: '冰岛北大西洋天气区',
    region: '北大西洋',
    country: '冰岛',
    lat: 64.9631,
    lon: -19.0208,
    kind: 'weather',
    priority: 'watch',
    aliases: ['Iceland', 'North Atlantic'],
    keywords: ['iceland storm', 'north atlantic weather', 'atlantic cyclone'],
    description: '适合关注北大西洋风暴和航运天气。'
  },
  {
    id: 'philippines-typhoon',
    name: '菲律宾台风走廊',
    region: '东南亚',
    country: '菲律宾',
    lat: 14.5995,
    lon: 121.0,
    kind: 'weather',
    priority: 'major',
    aliases: ['Philippines', 'Typhoon Corridor'],
    keywords: ['philippines typhoon', 'manila weather', 'west pacific storm'],
    description: '适合结合天气、灾害和卫星图层观察台风活动。'
  },
  {
    id: 'ring-of-fire-japan',
    name: '日本火山地震带',
    region: '东亚',
    country: '日本',
    lat: 36.2048,
    lon: 138.2529,
    kind: 'science',
    priority: 'major',
    aliases: ['Japan Ring of Fire'],
    keywords: ['japan earthquake', 'japan volcano', 'pacific ring of fire'],
    description: '适合地震、火山和卫星天气图层联动探索。'
  },
  {
    id: 'andes-volcano',
    name: '安第斯火山带',
    region: '南美',
    country: '智利',
    lat: -24.2,
    lon: -68.5,
    kind: 'science',
    priority: 'watch',
    aliases: ['Andes Volcano Belt'],
    keywords: ['andes volcano', 'chile volcano', 'peru volcano'],
    description: '南美火山和地壳活动的高价值观察区。'
  },
  {
    id: 'san-francisco',
    name: '旧金山湾区',
    region: '北美',
    country: '美国',
    lat: 37.7749,
    lon: -122.4194,
    kind: 'capital',
    priority: 'watch',
    aliases: ['San Francisco', 'Bay Area'],
    keywords: ['san francisco', 'bay area', 'silicon valley'],
    description: '科技、航天公司与地球观测话题经常交汇的区域。'
  },
  {
    id: 'new-york',
    name: '纽约',
    region: '北美',
    country: '美国',
    lat: 40.7128,
    lon: -74.006,
    kind: 'capital',
    priority: 'watch',
    aliases: ['New York', 'NYC'],
    keywords: ['new york', 'nyc', 'un headquarters'],
    description: '国际组织、媒体和全球新闻的高频入口。'
  }
];

const PRIORITY_WEIGHT: Record<GeoHubPriority, number> = {
  critical: 40,
  major: 28,
  watch: 18
};

export function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[`’']/g, '')
    .replace(/&amp;/g, '&')
    .replace(/[^a-z0-9\u4e00-\u9fff\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueStrings(values: string[]) {
  return values.filter((value, index, all) => value && all.indexOf(value) === index);
}

function buildScoredMatch(hub: GeoHub, matchedTerms: string[]): GeoHubMatch {
  const longTermBonus = matchedTerms.reduce((total, term) => total + Math.min(12, Math.floor(term.length / 3)), 0);
  return {
    hubId: hub.id,
    hubName: hub.name,
    kind: hub.kind,
    priority: hub.priority,
    score: PRIORITY_WEIGHT[hub.priority] + matchedTerms.length * 8 + longTermBonus,
    matchedTerms
  };
}

export function getGeoHubCatalog() {
  return GEO_HUBS;
}

export function getGeoHubById(id: string) {
  return GEO_HUBS.find((hub) => hub.id === id) ?? null;
}

export function getFeaturedGeoHubs(limit = 6) {
  return GEO_HUBS.filter((hub) => hub.priority !== 'watch').slice(0, limit);
}

export function getRecommendedGeoHubs(limit = 6) {
  return GEO_HUBS.filter((hub) => hub.kind === 'science' || hub.kind === 'spaceport' || hub.kind === 'weather').slice(0, limit);
}

export function inferGeoHubMatches(text: string, limit = 5): GeoHubMatch[] {
  const haystack = normalizeText(text);
  if (!haystack) {
    return [];
  }

  const matches = GEO_HUBS.flatMap((hub) => {
    const terms = uniqueStrings([hub.name, ...hub.aliases, ...hub.keywords]).filter((term) => term.length >= 3);
    const matchedTerms = terms.filter((term) => haystack.includes(normalizeText(term)));
    return matchedTerms.length > 0 ? [buildScoredMatch(hub, matchedTerms)] : [];
  });

  return matches.sort((a, b) => b.score - a.score).slice(0, limit);
}

function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const earthRadiusKm = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

export function findNearbyGeoHubs(lat: number, lon: number, radiusKm = 600, limit = 3) {
  return GEO_HUBS.map((hub) => ({
    hub,
    distanceKm: haversineDistanceKm(lat, lon, hub.lat, hub.lon)
  }))
    .filter((entry) => entry.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit)
    .map((entry) => entry.hub);
}

