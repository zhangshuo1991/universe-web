import type { Landmark } from '@/types/explorer';

export const FEATURED_LANDMARKS: Landmark[] = [
  {
    id: 'great-wall',
    name: '长城',
    regionName: '北京',
    country: '中国',
    lat: 40.4319,
    lon: 116.5704,
    category: 'history',
    description: '中国最具代表性的历史地标之一，适合观察华北城市带与山地边界。',
    cameraAltitude: 1_600_000
  },
  {
    id: 'shanghai-bund',
    name: '外滩',
    regionName: '上海',
    country: '中国',
    lat: 31.2400,
    lon: 121.4900,
    category: 'city',
    description: '长江入海口的城市地标，可快速切入上海与长三角相关新闻。',
    cameraAltitude: 1_300_000
  },
  {
    id: 'tokyo-tower',
    name: '东京塔',
    regionName: '东京',
    country: '日本',
    lat: 35.6586,
    lon: 139.7454,
    category: 'city',
    description: '东亚都市圈代表点位，适合查看东京及日本地区实时话题。',
    cameraAltitude: 1_500_000
  },
  {
    id: 'taj-mahal',
    name: '泰姬陵',
    regionName: '阿格拉',
    country: '印度',
    lat: 27.1751,
    lon: 78.0421,
    category: 'culture',
    description: '南亚经典文化地标，可用于探索印度北部区域动态。',
    cameraAltitude: 1_700_000
  },
  {
    id: 'burj-khalifa',
    name: '哈利法塔',
    regionName: '迪拜',
    country: '阿联酋',
    lat: 25.1972,
    lon: 55.2744,
    category: 'city',
    description: '海湾地区超高层地标，适合查看迪拜和中东商业新闻。',
    cameraAltitude: 1_500_000
  },
  {
    id: 'eiffel-tower',
    name: '埃菲尔铁塔',
    regionName: '巴黎',
    country: '法国',
    lat: 48.8584,
    lon: 2.2945,
    category: 'culture',
    description: '欧洲代表性文化地标，可作为巴黎和法国新闻入口。',
    cameraAltitude: 1_500_000
  },
  {
    id: 'colosseum',
    name: '罗马斗兽场',
    regionName: '罗马',
    country: '意大利',
    lat: 41.8902,
    lon: 12.4922,
    category: 'history',
    description: '地中海历史中心，可快速切到意大利与欧盟周边动态。',
    cameraAltitude: 1_400_000
  },
  {
    id: 'big-ben',
    name: '大本钟',
    regionName: '伦敦',
    country: '英国',
    lat: 51.5007,
    lon: -0.1246,
    category: 'city',
    description: '伦敦城市识别点，可用于查看英国政经与社会新闻。',
    cameraAltitude: 1_500_000
  },
  {
    id: 'statue-of-liberty',
    name: '自由女神像',
    regionName: '纽约',
    country: '美国',
    lat: 40.6892,
    lon: -74.0445,
    category: 'city',
    description: '北美都会入口点，适合查看纽约与美国东海岸新闻。',
    cameraAltitude: 1_600_000
  },
  {
    id: 'golden-gate-bridge',
    name: '金门大桥',
    regionName: '旧金山',
    country: '美国',
    lat: 37.8199,
    lon: -122.4783,
    category: 'city',
    description: '科技与海湾城市代表点位，适合切入美国西海岸新闻。',
    cameraAltitude: 1_600_000
  },
  {
    id: 'christ-the-redeemer',
    name: '救世基督像',
    regionName: '里约热内卢',
    country: '巴西',
    lat: -22.9519,
    lon: -43.2105,
    category: 'culture',
    description: '南美代表地标，可探索巴西和葡语地区热点。',
    cameraAltitude: 1_800_000
  },
  {
    id: 'machu-picchu',
    name: '马丘比丘',
    regionName: '库斯科',
    country: '秘鲁',
    lat: -13.1631,
    lon: -72.5450,
    category: 'history',
    description: '安第斯山区经典历史遗址，可观察南美内陆区域事件。',
    cameraAltitude: 1_800_000
  },
  {
    id: 'table-mountain',
    name: '桌山',
    regionName: '开普敦',
    country: '南非',
    lat: -33.9628,
    lon: 18.4098,
    category: 'nature',
    description: '非洲南端自然地标，适合切入开普敦与南部非洲新闻。',
    cameraAltitude: 2_000_000
  },
  {
    id: 'sydney-opera-house',
    name: '悉尼歌剧院',
    regionName: '悉尼',
    country: '澳大利亚',
    lat: -33.8568,
    lon: 151.2153,
    category: 'culture',
    description: '大洋洲最具辨识度的文化地标，可查看澳洲地区动态。',
    cameraAltitude: 1_700_000
  }
];

export function getLandmarkById(id: string | null | undefined) {
  if (!id) return null;
  return FEATURED_LANDMARKS.find((landmark) => landmark.id === id) ?? null;
}
