export type CuratedRssSource = {
  id: string;
  name: string;
  feedUrl: string;
  category: 'world' | 'science' | 'space' | 'disaster' | 'geopolitics';
  priority: number;
  language: 'en';
  enabledByDefault: boolean;
};

export const CURATED_RSS_SOURCES: CuratedRssSource[] = [
  {
    id: 'bbc-world',
    name: 'BBC World',
    feedUrl: 'https://feeds.bbci.co.uk/news/world/rss.xml',
    category: 'world',
    priority: 5,
    language: 'en',
    enabledByDefault: true
  },
  {
    id: 'bbc-science',
    name: 'BBC Science',
    feedUrl: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml',
    category: 'science',
    priority: 4,
    language: 'en',
    enabledByDefault: true
  },
  {
    id: 'guardian-world',
    name: 'The Guardian World',
    feedUrl: 'https://www.theguardian.com/world/rss',
    category: 'world',
    priority: 4,
    language: 'en',
    enabledByDefault: true
  },
  {
    id: 'guardian-environment',
    name: 'The Guardian Environment',
    feedUrl: 'https://www.theguardian.com/environment/rss',
    category: 'science',
    priority: 3,
    language: 'en',
    enabledByDefault: true
  },
  {
    id: 'aljazeera',
    name: 'Al Jazeera',
    feedUrl: 'https://www.aljazeera.com/xml/rss/all.xml',
    category: 'geopolitics',
    priority: 4,
    language: 'en',
    enabledByDefault: true
  },
  {
    id: 'un-news',
    name: 'UN News',
    feedUrl: 'https://news.un.org/feed/subscribe/en/news/all/rss.xml',
    category: 'disaster',
    priority: 3,
    language: 'en',
    enabledByDefault: true
  },
  {
    id: 'nasa-breaking',
    name: 'NASA Breaking News',
    feedUrl: 'https://www.nasa.gov/rss/dyn/breaking_news.rss',
    category: 'space',
    priority: 4,
    language: 'en',
    enabledByDefault: true
  },
  {
    id: 'spacenews',
    name: 'SpaceNews',
    feedUrl: 'https://spacenews.com/feed/',
    category: 'space',
    priority: 3,
    language: 'en',
    enabledByDefault: true
  },
  {
    id: 'usgs-news',
    name: 'USGS News',
    feedUrl: 'https://www.usgs.gov/news/news-releases/feed',
    category: 'disaster',
    priority: 3,
    language: 'en',
    enabledByDefault: true
  }
];

