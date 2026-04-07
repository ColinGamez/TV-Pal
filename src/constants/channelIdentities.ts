export interface ChannelIdentity {
  channelId: string;
  shortName: string;
  fullName: string;
  logo: string;
  group: string;
  accentColor: string;
  tagline?: string;
  description?: string;
  broadcastType: 'Terrestrial' | 'BS' | 'CS';
}

export const CHANNEL_IDENTITIES: Record<string, ChannelIdentity> = {
  'nhk-g': {
    channelId: 'nhk-g',
    shortName: 'NHK総合',
    fullName: 'NHK総合テレビジョン',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/NHK_General_TV_logo.svg/200px-NHK_General_TV_logo.svg.png',
    group: 'NHK',
    accentColor: '#00a0e9',
    tagline: '公共放送の総合力。',
    description: 'ニュース、ドキュメンタリー、ドラマ、バラエティなど、幅広いジャンルを網羅する日本最大の公共放送。',
    broadcastType: 'Terrestrial'
  },
  'nhk-e': {
    channelId: 'nhk-e',
    shortName: 'NHK Eテレ',
    fullName: 'NHK教育テレビジョン',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/NHK_Educational_TV_logo.svg/200px-NHK_Educational_TV_logo.svg.png',
    group: 'NHK',
    accentColor: '#8fc31f',
    tagline: '学び、育つ、Eテレ。',
    description: '教育、教養、文化、福祉、子供向け番組を中心に、知的好奇心を刺激するコンテンツを提供。',
    broadcastType: 'Terrestrial'
  },
  'ntv': {
    channelId: 'ntv',
    shortName: '日本テレビ',
    fullName: '日本テレビ放送網',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Nippon_TV_logo.svg/200px-Nippon_TV_logo.svg.png',
    group: '日本テレビ系列',
    accentColor: '#ffd700',
    tagline: '見たい、が、世界を変える。',
    description: '「笑点」「24時間テレビ」など、国民的人気番組を多数抱える民放キー局。',
    broadcastType: 'Terrestrial'
  },
  'tvasahi': {
    channelId: 'tvasahi',
    shortName: 'テレビ朝日',
    fullName: '株式会社テレビ朝日',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/TV_Asahi_logo.svg/200px-TV_Asahi_logo.svg.png',
    group: 'テレビ朝日系列',
    accentColor: '#ff0055',
    tagline: '未来を、ここから。',
    description: '「報道ステーション」「ドラえもん」など、報道とエンターテインメントの融合。',
    broadcastType: 'Terrestrial'
  },
  'tbs': {
    channelId: 'tbs',
    shortName: 'TBS',
    fullName: '株式会社TBSテレビ',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/TBS_logo.svg/200px-TBS_logo.svg.png',
    group: 'TBS系列',
    accentColor: '#255299',
    tagline: 'ときめく、ときを。',
    description: 'ドラマのTBSとして知られ、数々の名作ドラマを世に送り出してきた。',
    broadcastType: 'Terrestrial'
  },
  'tvtokyo': {
    channelId: 'tvtokyo',
    shortName: 'テレビ東京',
    fullName: '株式会社テレビ東京',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0d/TV_Tokyo_logo.svg/200px-TV_Tokyo_logo.svg.png',
    group: 'テレビ東京系列',
    accentColor: '#e60012',
    tagline: '独自路線で、世界を面白く。',
    description: 'アニメ、経済番組、そして独自のバラエティ番組で異彩を放つ。',
    broadcastType: 'Terrestrial'
  },
  'fujitv': {
    channelId: 'fujitv',
    shortName: 'フジテレビ',
    fullName: '株式会社フジテレビジョン',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Fuji_TV_logo.svg/200px-Fuji_TV_logo.svg.png',
    group: 'フジテレビ系列',
    accentColor: '#ed1c24',
    tagline: '楽しくなければテレビじゃない。',
    description: '「月9ドラマ」「バラエティ」など、常に時代の最先端を走る。',
    broadcastType: 'Terrestrial'
  },
  'tokyomx': {
    channelId: 'tokyomx',
    shortName: 'TOKYO MX',
    fullName: '東京メトロポリタンテレビジョン',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/TOKYO_MX_logo.svg/200px-TOKYO_MX_logo.svg.png',
    group: '独立放送局',
    accentColor: '#00a0e9',
    tagline: 'つなげる、つたえる。',
    description: '東京都を放送対象地域とする独立放送局。アニメファンの聖地としても知られる。',
    broadcastType: 'Terrestrial'
  }
};
