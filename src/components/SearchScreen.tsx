import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSystem } from '../context/SystemContext';
import { motion, AnimatePresence } from 'motion/react';
import { Search as SearchIcon, Tv, Calendar, ChevronRight, Star } from 'lucide-react';

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
  group: string;
  broad: string;
}

export const SearchScreen: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ programs: Program[], channels: Channel[] }>({ programs: [], channels: [] });
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [allPrograms, setAllPrograms] = useState<Program[]>([]);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { playSystemSound, favorites, toggleFavoriteChannel, toggleFavoriteProgram, reservations, addReservation, removeReservation, isReservationActive, getChannelIdentity } = useSystem();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [chRes, guideRes] = await Promise.all([
          fetch('/api/channels'),
          fetch(`/api/guide?start=${Math.floor(Date.now() / 1000)}&end=${Math.floor(Date.now() / 1000) + 24 * 3600}`)
        ]);
        const chData = await chRes.json();
        const guideData = await guideRes.json();
        setChannels(chData);
        setAllPrograms(Object.values(guideData).flat() as Program[]);
      } catch (error) {
        console.error("Failed to fetch search data", error);
      }
    };
    fetchData();
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults({ programs: [], channels: [] });
      return;
    }

    const q = query.toLowerCase();
    const filteredChannels = channels.filter(ch => ch.name.toLowerCase().includes(q) || ch.number.includes(q));
    const filteredPrograms = allPrograms.filter(p => p.title.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q) || p.genre?.toLowerCase().includes(q));
    
    setResults({ programs: filteredPrograms.slice(0, 20), channels: filteredChannels });
    setFocusedIndex(0);
  }, [query, channels, allPrograms]);

  const totalResults = results.channels.length + results.programs.length;

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(prev => Math.min(prev + 1, totalResults - 1));
      playSystemSound('click');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(prev => Math.max(prev - 1, 0));
      playSystemSound('click');
    } else if (e.key === 'Enter') {
      if (totalResults > 0) {
        playSystemSound('confirm');
        if (focusedIndex < results.channels.length) {
          navigate(`/channel/${results.channels[focusedIndex].channelId}`);
        } else {
          navigate(`/program/${results.programs[focusedIndex - results.channels.length].listingId}`);
        }
      }
    } else if (e.key === 'Escape') {
      playSystemSound('back');
      navigate('/');
    } else if (e.key === 'f' || e.key === 'F') {
      if (totalResults > 0) {
        if (focusedIndex < results.channels.length) {
          toggleFavoriteChannel(results.channels[focusedIndex].channelId);
        } else {
          toggleFavoriteProgram(results.programs[focusedIndex - results.channels.length].listingId);
        }
        playSystemSound('confirm');
      }
    } else if (e.key === 'r' || e.key === 'R') {
      if (totalResults > 0 && focusedIndex >= results.channels.length) {
        const prog = results.programs[focusedIndex - results.channels.length];
        if (isReservationActive(prog.listingId)) {
          removeReservation(prog.listingId);
        } else {
          const ch = channels.find(c => c.channelId === prog.channelId);
          addReservation(prog, ch?.name || 'Unknown', 'reminder');
        }
        playSystemSound('confirm');
      }
    }
  }, [focusedIndex, totalResults, results, navigate, playSystemSound, toggleFavoriteChannel, toggleFavoriteProgram, isReservationActive, removeReservation, addReservation, channels]);

  return (
    <div className="h-full flex flex-col bg-[#000c18] p-10 gap-8 overflow-hidden" onKeyDown={handleKeyDown}>
      {/* Search Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#1a3a5a] border-2 border-[#4a90e2] flex items-center justify-center text-[#00f2ff] shadow-[0_0_15px_rgba(0,242,255,0.3)]">
            <SearchIcon size={24} />
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-white italic uppercase">番組検索</h1>
        </div>
        
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="番組名、チャンネル、ジャンルを入力..."
            className="w-full bg-[#1a3a5a]/50 border-2 border-[#4a90e2]/30 rounded-lg px-6 py-4 text-2xl font-bold text-white placeholder-white/20 focus:outline-none focus:border-[#00f2ff] focus:bg-[#1a3a5a]/80 transition-all shadow-inner"
          />
          <div className="absolute right-6 top-1/2 -translate-y-1/2 flex gap-4">
             <div className="flex items-center gap-2 text-[10px] font-black text-white/40"><span className="w-5 h-5 rounded border border-white/20 flex items-center justify-center">F</span> FAV</div>
             <div className="flex items-center gap-2 text-[10px] font-black text-white/40"><span className="w-5 h-5 rounded border border-white/20 flex items-center justify-center">R</span> REMIND</div>
          </div>
        </div>
      </div>

      {/* Results Area */}
      <div className="flex-1 overflow-auto custom-scrollbar pr-4">
        <AnimatePresence mode="wait">
          {query.trim() === '' ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
              className="h-full flex flex-col items-center justify-center text-white/20 italic"
            >
              <SearchIcon size={64} className="mb-4" />
              <p className="text-xl font-black tracking-widest uppercase">Enter search query</p>
            </motion.div>
          ) : totalResults === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
              className="h-full flex flex-col items-center justify-center text-white/20 italic"
            >
              <p className="text-xl font-black tracking-widest uppercase">No results found</p>
            </motion.div>
          ) : (
            <div className="space-y-8">
              {results.channels.length > 0 && (
                <div className="space-y-4">
                  <h2 className="text-sm font-black text-[#4a90e2] tracking-widest uppercase border-b border-[#4a90e2]/20 pb-2 flex items-center gap-2">
                    <Tv size={14} /> チャンネル
                  </h2>
                  <div className="grid grid-cols-1 gap-2">
                    {results.channels.map((ch, i) => {
                      const isFocused = focusedIndex === i;
                      const isFav = favorites.channels.includes(ch.channelId);
                      const identity = getChannelIdentity(ch.channelId);
                      const accentColor = identity?.accentColor || '#4a90e2';

                      return (
                        <div
                          key={ch.channelId}
                          className={`glossy-panel p-4 flex items-center justify-between cursor-pointer transition-all border-l-4 ${isFocused ? 'focused border-[#00f2ff] bg-[#1a3a5a]' : 'hover:bg-[#1a3a5a]/30'}`}
                          style={{ borderLeftColor: isFocused ? '#00f2ff' : accentColor }}
                          onClick={() => {
                            playSystemSound('confirm');
                            navigate(`/channel/${ch.channelId}`);
                          }}
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-white rounded flex items-center justify-center overflow-hidden p-1 shrink-0">
                              {identity?.logo ? (
                                <img src={identity.logo} alt={ch.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                              ) : (
                                <span className="text-[#001a2c] font-black text-lg">{ch.number}</span>
                              )}
                            </div>
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-black text-[#00f2ff] italic tracking-tighter">CH {ch.number}</span>
                                <span className="text-xl font-bold text-white uppercase italic tracking-tighter">{identity?.shortName || ch.name}</span>
                                {isFav && <Star size={14} className="text-yellow-400 fill-yellow-400" />}
                              </div>
                              <span className="text-[10px] font-bold text-white/30 tracking-widest uppercase">{identity?.group || ch.group} BROADCAST</span>
                            </div>
                          </div>
                          <ChevronRight className={isFocused ? 'text-[#00f2ff]' : 'text-white/20'} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {results.programs.length > 0 && (
                <div className="space-y-4">
                  <h2 className="text-sm font-black text-[#4a90e2] tracking-widest uppercase border-b border-[#4a90e2]/20 pb-2 flex items-center gap-2">
                    <Calendar size={14} /> 番組
                  </h2>
                  <div className="grid grid-cols-1 gap-2">
                    {results.programs.map((p, i) => {
                      const idx = i + results.channels.length;
                      const isFocused = focusedIndex === idx;
                      const isFav = favorites.programs.includes(p.listingId);
                      const reservation = reservations.find(r => r.listingId === p.listingId && r.status === 'pending');
                      return (
                        <div
                          key={p.listingId}
                          className={`glossy-panel p-4 flex items-center justify-between cursor-pointer transition-all ${isFocused ? 'focused border-[#00f2ff] bg-[#1a3a5a]' : 'hover:bg-[#1a3a5a]/30'}`}
                          onClick={() => navigate(`/program/${p.listingId}`)}
                        >
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] font-black text-[#00f2ff] bg-[#00f2ff]/10 px-2 py-0.5 rounded">CH {p.channelId}</span>
                              <span className="text-[10px] font-bold text-white/40">{p.startJst}</span>
                              {isFav && <Star size={14} className="text-yellow-400 fill-yellow-400" />}
                              {reservation && <Calendar size={14} className={reservation.type === 'auto-tune' ? 'text-[#cc00cc]' : 'text-white/40'} />}
                            </div>
                            <span className="text-xl font-bold text-white">{p.title}</span>
                          </div>
                          <ChevronRight className={isFocused ? 'text-[#00f2ff]' : 'text-white/20'} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="h-10 tv-chrome shrink-0 flex items-center px-6 text-[10px] font-black text-white/40 tracking-widest gap-8">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded border border-white/20 flex items-center justify-center text-[8px]">↑↓</div>
          <span>選択</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-4 rounded border border-white/20 flex items-center justify-center text-[8px]">ENTER</div>
          <span>決定</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-4 rounded border border-white/20 flex items-center justify-center text-[8px]">ESC</div>
          <span>戻る</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded border border-white/20 flex items-center justify-center text-[8px]">F</div>
          <span>お気に入り</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded border border-white/20 flex items-center justify-center text-[8px]">R</div>
          <span>予約</span>
        </div>
      </div>
    </div>
  );
};
