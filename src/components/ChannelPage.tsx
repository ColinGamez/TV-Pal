import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ChevronLeft, Clock, Info, Star, Play, Radio, MapPin, Activity, ShieldCheck, Calendar } from 'lucide-react';
import { useSystem } from '../context/SystemContext';

interface Program {
  listingId: string;
  title: string;
  startUtc: number;
  endUtc: number;
  startJst: string;
  endJst: string;
  description: string | null;
  genre: string | null;
}

export const ChannelPage: React.FC = () => {
  const { channelId } = useParams();
  const navigate = useNavigate();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [now] = useState(Math.floor(Date.now() / 1000));
  const { favorites, toggleFavoriteChannel, playSystemSound, getChannelIdentity, channels, startWatching, selectedPrefecture } = useSystem();

  const channel = useMemo(() => channels.find(c => c.channelId === channelId), [channels, channelId]);
  const identity = useMemo(() => channelId ? getChannelIdentity(channelId) : null, [channelId, getChannelIdentity]);
  const isFav = favorites.channels.includes(channelId || '');

  useEffect(() => {
    const fetchChannelData = async () => {
      try {
        const res = await fetch(`/api/channel/${channelId}`);
        const data = await res.json();
        setPrograms(data);
      } catch (error) {
        console.error("Failed to fetch channel data", error);
      } finally {
        setLoading(false);
      }
    };

    fetchChannelData();
  }, [channelId]);

  if (loading) return (
    <div className="h-full flex items-center justify-center bg-[#000c18]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-[#00f2ff]/20 border-t-[#00f2ff] rounded-full animate-spin" />
        <div className="text-[10px] font-black text-[#00f2ff] tracking-[0.4em] animate-pulse uppercase">LOADING STATION DATA</div>
      </div>
    </div>
  );

  const currentProgram = programs.find(p => p.startUtc <= now && p.endUtc > now);
  const upcomingPrograms = programs.filter(p => p.startUtc > now);
  const accentColor = identity?.accentColor || '#00f2ff';

  return (
    <div className="h-full flex flex-col p-8 gap-8 overflow-auto custom-scrollbar bg-[#000c18] relative">
      {/* Station Branding Background */}
      <div 
        className="absolute top-0 right-0 w-1/2 h-full opacity-5 pointer-events-none"
        style={{ 
          background: `radial-gradient(circle at top right, ${accentColor}, transparent 70%)` 
        }}
      />

      {/* Station Header */}
      <div 
        className="flex items-center justify-between glossy-panel p-6 border-l-8 transition-all"
        style={{ borderLeftColor: accentColor }}
      >
        <div className="flex items-center gap-6">
          <button 
            onClick={() => {
              playSystemSound('back');
              navigate('/');
            }}
            className="w-12 h-12 bg-[#1a3a5a] border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all rounded-full text-white"
          >
            <ChevronLeft size={24} />
          </button>
          
          <div className="flex items-center gap-5">
            <div className="w-24 h-24 bg-white rounded-lg flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.1)] border-2 border-white/10 overflow-hidden p-2">
              {identity?.logo ? (
                <img src={identity.logo} alt={identity.shortName} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
              ) : (
                <span className="text-[#001a2c] font-black text-4xl">{channel?.number || '??'}</span>
              )}
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-3">
                <h1 className="text-5xl font-black tracking-tighter text-white italic uppercase leading-none">
                  {identity?.fullName || channel?.name || 'STATION'}
                </h1>
                <div 
                  className="px-3 py-1 text-[#001a2c] font-black text-[10px] rounded italic"
                  style={{ backgroundColor: accentColor }}
                >
                  {identity?.group || 'LOCAL BROADCAST'}
                </div>
              </div>
              <div className="flex items-center gap-4 mt-2">
                <p className="text-sm font-bold text-white/40 tracking-[0.3em] uppercase">
                  {identity?.broadcastType || 'Digital Terrestrial'} Broadcasting
                </p>
                <div className="w-1 h-1 bg-white/20 rounded-full" />
                <p className="text-sm font-bold text-white/40 tracking-[0.3em] uppercase">
                  CH {channel?.number || '---'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button 
            onClick={() => toggleFavoriteChannel(channelId || '')}
            className={`flex items-center gap-3 px-6 py-3 rounded-lg font-black italic transition-all border-2 ${isFav ? 'bg-yellow-400 text-[#001a2c] border-yellow-500' : 'bg-[#1a3a5a] text-white/60 border-white/10 hover:text-white hover:border-white/30'}`}
          >
            <Star size={20} className={isFav ? 'fill-[#001a2c]' : ''} />
            <span>{isFav ? 'FAVORITE STATION' : 'ADD TO FAVORITES'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-8">
          {/* Now On Air */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black italic text-white flex items-center gap-3">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_red]" />
                NOW ON AIR
              </h2>
              <div className="text-[10px] font-black tracking-widest" style={{ color: accentColor }}>LIVE FEED ACTIVE</div>
            </div>
            
            {currentProgram ? (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glossy-panel p-10 relative overflow-hidden group border-2 border-white/5 hover:border-white/20 transition-all"
              >
                <div className="relative z-10 space-y-6">
                  <div className="flex items-center gap-3 font-black italic" style={{ color: accentColor }}>
                    <Clock size={20} />
                    <span className="text-xl tracking-tighter">{currentProgram.startJst.split(' ')[1].slice(0, 5)} - {currentProgram.endJst.split(' ')[1].slice(0, 5)}</span>
                  </div>
                  <h3 className="text-6xl font-black tracking-tighter text-white italic leading-none group-hover:text-[#00f2ff] transition-colors">
                    {currentProgram.title}
                  </h3>
                  <p className="text-xl text-white/70 leading-relaxed max-w-3xl line-clamp-3 font-medium">
                    {currentProgram.description}
                  </p>
                  <div className="pt-6 flex gap-4">
                    <button 
                      onClick={() => {
                        playSystemSound('confirm');
                        if (channelId) startWatching(channelId);
                        navigate('/');
                      }}
                      className="px-10 py-4 bg-[#00f2ff] text-[#001a2c] rounded font-black italic transition-all hover:scale-105 shadow-[0_0_20px_rgba(0,242,255,0.3)] flex items-center gap-3"
                    >
                      <Play size={20} fill="currentColor" />
                      <span>WATCH NOW</span>
                    </button>
                    <button 
                      onClick={() => navigate(`/program/${currentProgram.listingId}`)}
                      className="px-10 py-4 bg-[#1a3a5a] text-white border border-white/10 rounded font-black italic transition-all hover:bg-white/10 flex items-center gap-3"
                    >
                      <Info size={20} />
                      <span>PROGRAM DETAILS</span>
                    </button>
                  </div>
                </div>
                
                {/* Decorative background element */}
                <div 
                  className="absolute -bottom-20 -right-20 w-96 h-96 blur-[100px] rounded-full opacity-10 group-hover:opacity-20 transition-all"
                  style={{ backgroundColor: accentColor }}
                />
              </motion.div>
            ) : (
              <div className="glossy-panel p-20 text-center opacity-30 italic border-dashed border-2 border-white/10">
                <p className="text-2xl font-black">NO LIVE BROADCAST AT THIS TIME</p>
              </div>
            )}
          </section>

          {/* Station Information Module */}
          <section className="space-y-4">
            <h2 className="text-xl font-black italic text-white flex items-center gap-3">
              <Info size={22} style={{ color: accentColor }} />
              STATION INFORMATION
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="glossy-panel p-6 border border-white/5 space-y-4">
                <div className="flex items-center gap-3">
                  <Radio size={20} style={{ color: accentColor }} />
                  <span className="text-xs font-black text-white/40 uppercase tracking-widest">Broadcast Network</span>
                </div>
                <div className="space-y-1">
                  <div className="text-xl font-black text-white italic">{identity?.fullName || channel?.name}</div>
                  <div className="text-sm font-bold text-white/60">{identity?.tagline || 'Regional Digital Broadcast Service'}</div>
                </div>
                <p className="text-xs text-white/40 leading-relaxed">
                  {identity?.description || 'This station provides high-quality digital broadcasting services to the local region, featuring a mix of news, entertainment, and cultural programming.'}
                </p>
              </div>

              <div className="glossy-panel p-6 border border-white/5 space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin size={16} style={{ color: accentColor }} />
                      <span className="text-[10px] font-black text-white/40 uppercase">Reception Area</span>
                    </div>
                    <span className="text-[10px] font-black text-white italic">{selectedPrefecture || 'Unknown'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity size={16} style={{ color: accentColor }} />
                      <span className="text-[10px] font-black text-white/40 uppercase">Signal Type</span>
                    </div>
                    <span className="text-[10px] font-black text-white italic">ISDB-T Digital</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={16} style={{ color: accentColor }} />
                      <span className="text-[10px] font-black text-white/40 uppercase">Status</span>
                    </div>
                    <span className="text-[10px] font-black text-green-400 italic">OPERATIONAL</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar size={16} style={{ color: accentColor }} />
                      <span className="text-[10px] font-black text-white/40 uppercase">Service ID</span>
                    </div>
                    <span className="text-[10px] font-black text-white italic">{channelId?.toUpperCase()}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Sidebar: Schedule */}
        <div className="space-y-6">
          <h2 className="text-xl font-black italic text-white flex items-center gap-3">
            <Clock size={22} style={{ color: accentColor }} />
            COMING UP NEXT
          </h2>
          
          <div className="space-y-3">
            {upcomingPrograms.slice(0, 10).map((p, i) => (
              <motion.div 
                key={p.listingId}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="glossy-panel p-5 hover:bg-white/5 cursor-pointer transition-all border border-white/5 group relative overflow-hidden"
                onClick={() => {
                  playSystemSound('confirm');
                  navigate(`/program/${p.listingId}`);
                }}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[11px] font-black italic tracking-tighter" style={{ color: accentColor }}>
                    {p.startJst.split(' ')[1].slice(0, 5)}
                  </span>
                  {p.genre && (
                    <span className="text-[9px] font-black px-2 py-0.5 bg-white/5 text-white/40 rounded border border-white/10 uppercase">
                      {p.genre}
                    </span>
                  )}
                </div>
                <h4 className="font-bold text-base text-white line-clamp-1 group-hover:text-[#00f2ff] transition-colors tracking-tight">
                  {p.title}
                </h4>
                
                {/* Hover indicator */}
                <div className="absolute left-0 top-0 bottom-0 w-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: accentColor }} />
              </motion.div>
            ))}
          </div>
          
          <button 
            onClick={() => navigate('/')}
            className="w-full py-4 glossy-panel border-white/5 text-[10px] font-black text-white/40 hover:text-white hover:border-white/20 transition-all uppercase tracking-[0.3em] italic"
          >
            VIEW FULL 24H GUIDE
          </button>
        </div>
      </div>
    </div>
  );
};
