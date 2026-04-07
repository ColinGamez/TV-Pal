import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSystem } from '../context/SystemContext';
import { motion } from 'motion/react';
import { Play, Clock, Star, TrendingUp, Film, Tv, Trophy, Newspaper, ChevronRight } from 'lucide-react';

interface Program {
  listingId: string;
  channelId: string;
  title: string;
  startUtc: number;
  endUtc: number;
  startJst: string;
  endJst: string;
  genre: string | null;
  genreClass: string | null;
  description: string | null;
}

interface Channel {
  channelId: string;
  number: string;
  name: string;
  broad: string;
  group: string;
}

interface RailProps {
  title: string;
  icon: React.ReactNode;
  programs: Program[];
}

const Rail: React.FC<RailProps> = ({ title, icon, programs }) => {
  const navigate = useNavigate();
  const { playSystemSound } = useSystem();

  if (programs.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#1a3a5a] border border-[#4a90e2]/30 flex items-center justify-center text-[#00f2ff]">
            {icon}
          </div>
          <h2 className="text-xl font-black tracking-tighter text-white italic uppercase">{title}</h2>
        </div>
        <button className="text-[10px] font-black text-[#4a90e2] hover:text-[#00f2ff] transition-colors flex items-center gap-1 tracking-widest uppercase italic">
          View All <ChevronRight size={12} />
        </button>
      </div>
      
      <div className="flex gap-6 overflow-x-auto px-8 pb-6 custom-scrollbar scroll-smooth">
        {programs.map((p, i) => (
          <motion.div
            key={p.listingId}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
            className="flex-shrink-0 w-64 glossy-panel p-4 cursor-pointer hover:border-[#00f2ff] transition-all group relative overflow-hidden"
            onClick={() => {
              playSystemSound('confirm');
              navigate(`/program/${p.listingId}`);
            }}
          >
            <div className="flex justify-between items-start mb-2">
              <span className="text-[10px] font-black text-[#00f2ff] bg-[#00f2ff]/10 px-2 py-0.5 rounded border border-[#00f2ff]/20">
                CH {p.channelId}
              </span>
              <span className="text-[10px] font-bold text-white/40">
                {p.startJst.split(' ')[1].slice(0, 5)}
              </span>
            </div>
            <h3 className="font-bold text-sm text-white line-clamp-2 group-hover:text-[#00f2ff] transition-colors mb-2 h-10">
              {p.title}
            </h3>
            <p className="text-[11px] text-white/50 line-clamp-2 leading-tight">
              {p.description}
            </p>
            
            {/* Glossy overlay */}
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          </motion.div>
        ))}
      </div>
    </div>
  );
};

interface StationRailProps {
  title: string;
  icon: React.ReactNode;
  channels: Channel[];
}

const StationRail: React.FC<StationRailProps> = ({ title, icon, channels }) => {
  const navigate = useNavigate();
  const { playSystemSound, getChannelIdentity } = useSystem();

  if (channels.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#1a3a5a] border border-[#4a90e2]/30 flex items-center justify-center text-[#00f2ff]">
            {icon}
          </div>
          <h2 className="text-xl font-black tracking-tighter text-white italic uppercase">{title}</h2>
        </div>
      </div>
      
      <div className="flex gap-6 overflow-x-auto px-8 pb-6 custom-scrollbar scroll-smooth">
        {channels.map((ch, i) => {
          const identity = getChannelIdentity(ch.channelId);
          const accentColor = identity?.accentColor || '#4a90e2';
          
          return (
            <motion.div
              key={ch.channelId}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className="flex-shrink-0 w-48 glossy-panel p-6 cursor-pointer hover:border-[#00f2ff] transition-all group relative overflow-hidden flex flex-col items-center text-center gap-4"
              onClick={() => {
                playSystemSound('confirm');
                navigate(`/channel/${ch.channelId}`);
              }}
            >
              <div className="w-20 h-20 bg-white rounded-lg flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.1)] border border-white/10 overflow-hidden p-2">
                {identity?.logo ? (
                  <img src={identity.logo} alt={ch.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                ) : (
                  <span className="text-[#001a2c] font-black text-3xl">{ch.number}</span>
                )}
              </div>
              
              <div className="space-y-1">
                <h3 className="font-black text-sm text-white uppercase italic tracking-tighter group-hover:text-[#00f2ff] transition-colors">
                  {identity?.shortName || ch.name}
                </h3>
                <p className="text-[10px] font-bold text-white/30 tracking-widest uppercase">
                  CH {ch.number}
                </p>
              </div>

              {/* Station Accent */}
              <div className="absolute bottom-0 left-0 right-0 h-1" style={{ backgroundColor: accentColor }} />
              
              {/* Glossy overlay */}
              <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export const DiscoveryRails: React.FC = () => {
  const [allPrograms, setAllPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const { presence, favorites, reservations, currentProfile, session, visibleChannels } = useSystem();
  const now = Math.floor(Date.now() / 1000);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const startTime = now - 3600;
        const endTime = now + 12 * 3600;
        const [guideRes] = await Promise.all([
          fetch(`/api/guide?start=${startTime}&end=${endTime}`)
        ]);
        const guideData = await guideRes.json();
        const flattened = Object.values(guideData).flat() as Program[];
        setAllPrograms(flattened);
      } catch (error) {
        console.error("Failed to fetch discovery data", error);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const watchlist = useMemo(() => 
    allPrograms.filter(p => favorites.programs.includes(p.listingId) || reservations.some(r => r.listingId === p.listingId))
      .sort((a, b) => a.startUtc - b.startUtc),
    [allPrograms, favorites.programs, reservations]
  );

  const favoriteChannels = useMemo(() => 
    visibleChannels.filter(ch => favorites.channels.includes(ch.channelId)),
    [visibleChannels, favorites.channels]
  );

  const recentChannels = useMemo(() => 
    visibleChannels.filter(ch => session.recentChannels.includes(ch.channelId))
      .sort((a, b) => session.recentChannels.indexOf(a.channelId) - session.recentChannels.indexOf(b.channelId)),
    [visibleChannels, session.recentChannels]
  );

  if (loading) return null;

  const onAir = allPrograms.filter(p => p.startUtc <= now && p.endUtc > now);
  const startingSoon = allPrograms.filter(p => p.startUtc > now && p.startUtc < now + 7200);
  const popular = [...onAir].sort((a, b) => (presence[b.listingId]?.viewers || 0) - (presence[a.listingId]?.viewers || 0));
  
  const movies = allPrograms.filter(p => p.genreClass?.includes('movie') || p.genre?.includes('映画'));
  const anime = allPrograms.filter(p => p.genreClass?.includes('anime') || p.genre?.includes('アニメ'));
  const sports = allPrograms.filter(p => p.genreClass?.includes('sports') || p.genre?.includes('スポーツ'));
  const news = allPrograms.filter(p => p.genreClass?.includes('news') || p.genre?.includes('ニュース'));

  return (
    <div className="py-8 space-y-12 bg-[#000c18] min-h-full overflow-auto custom-scrollbar">
      {/* Hero Section / Featured */}
      <div className="mx-8 relative h-64 glossy-panel overflow-hidden border-2 border-[#4a90e2]/40 group">
        <div className="absolute inset-0 bg-gradient-to-r from-[#001a2c] via-[#001a2c]/80 to-transparent z-10" />
        <div className="absolute inset-0 bg-[url('https://picsum.photos/seed/broadcast/1200/400')] bg-cover bg-center opacity-40 group-hover:scale-105 transition-transform duration-1000" />
        
        <div className="relative z-20 h-full flex flex-col justify-center p-10 space-y-4">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-[#00f2ff] text-[#001a2c] font-black text-[10px] rounded italic">FEATURED NOW</span>
            <span className="text-[#00f2ff] font-black text-[10px] tracking-widest uppercase">GuidePal™ Selection</span>
          </div>
          <h1 className="text-5xl font-black text-white italic tracking-tighter leading-none">DISCOVER THE BEST OF TV</h1>
          <p className="text-lg text-white/60 max-w-xl font-medium">Explore trending programs, live broadcasts, and personalized recommendations across all stations.</p>
        </div>
      </div>

      {watchlist.length > 0 && (
        <Rail title={currentProfile ? `${currentProfile.name}のマイリスト` : "マイリスト"} icon={<Star size={16} className="fill-current" />} programs={watchlist.slice(0, 10)} />
      )}

      {recentChannels.length > 0 && (
        <StationRail title="最近見たチャンネル" icon={<Clock size={16} />} channels={recentChannels} />
      )}

      <StationRail title={currentProfile ? `${currentProfile.name}のお気に入り` : "お気に入りチャンネル"} icon={<Tv size={16} />} channels={favoriteChannels} />

      <Rail title="今放送中" icon={<Play size={16} />} programs={onAir.slice(0, 10)} />
      <Rail title="人気番組" icon={<TrendingUp size={16} />} programs={popular.slice(0, 10)} />
      <Rail title="まもなく放送" icon={<Clock size={16} />} programs={startingSoon.slice(0, 10)} />
      <Rail title="映画" icon={<Film size={16} />} programs={movies.slice(0, 10)} />
      <Rail title="アニメ" icon={<Tv size={16} />} programs={anime.slice(0, 10)} />
      <Rail title="スポーツ" icon={<Trophy size={16} />} programs={sports.slice(0, 10)} />
      <Rail title="ニュース" icon={<Newspaper size={16} />} programs={news.slice(0, 10)} />
    </div>
  );
};
