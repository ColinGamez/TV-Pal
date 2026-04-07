import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSystem } from '../context/SystemContext';
import { Calendar, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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

const HOUR_WIDTH = 300;
const ROW_HEIGHT = 80;
const CHANNEL_COL_WIDTH = 160;

export const TVGuide: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  const [focusedProgramId, setFocusedProgramId] = useState<string | null>(null);
  const [focusedChannelId, setFocusedChannelId] = useState<string | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { 
    setWatchingProgram, 
    playSystemSound, 
    isGuideVisible, 
    setIsGuideVisible, 
    presence, 
    favorites, 
    toggleFavoriteProgram, 
    reservations, 
    addReservation,
    removeReservation,
    isReservationActive,
    session,
    updateSession,
    isIdle,
    startWatching,
    previousChannelId,
    recallChannel,
    guide,
    setGuide,
    visibleChannels,
    selectedAreaCode,
    setupComplete,
    getChannelIdentity
  } = useSystem();

  // Start time for the grid (rounded down to the nearest hour)
  const [baseTime, setBaseTime] = useState(() => {
    const now = Math.floor(Date.now() / 1000);
    return now - (now % 3600);
  });

  const startTime = baseTime;
  const hours = Array.from({ length: 24 }, (_, i) => startTime + i * 3600);

  const recommendedPrograms = useMemo(() => {
    const live = Object.values(guide).flat().filter(p => p.startUtc <= now && p.endUtc > now);
    return live
      .map(p => ({ ...p, presence: presence[p.listingId] || { viewers: 0, reactions: { like: 0, eyes: 0, fire: 0 } } }))
      .sort((a, b) => b.presence.viewers - a.presence.viewers)
      .slice(0, 3);
  }, [guide, now, presence]);

  // Attract Mode logic
  useEffect(() => {
    if (!isIdle || !isGuideVisible) return;

    const attractInterval = setInterval(() => {
      // Pick a random trending or recommended program to focus on
      const allPrograms = Object.values(guide).flat();
      const trending = allPrograms.filter(p => (presence[p.listingId]?.viewers || 0) > 300);
      const pool = trending.length > 0 ? trending : recommendedPrograms;
      
      if (pool.length > 0) {
        const randomProg = pool[Math.floor(Math.random() * pool.length)];
        setFocusedProgramId(randomProg.listingId);
        setFocusedChannelId(randomProg.channelId);
        // No sound for attract mode shifts to keep it ambient
      }
    }, 8000); // Shift every 8 seconds

    return () => clearInterval(attractInterval);
  }, [isIdle, isGuideVisible, guide, presence, recommendedPrograms]);

  const focusedProgram = useMemo(() => {
    if (!focusedChannelId || !focusedProgramId) return null;
    return (guide[focusedChannelId] || []).find(p => p.listingId === focusedProgramId) || null;
  }, [focusedChannelId, focusedProgramId, guide]);

  useEffect(() => {
    if (!setupComplete) return;

    const fetchData = async () => {
      try {
        const areaParam = selectedAreaCode ? `area=${selectedAreaCode}` : '';
        const [guideRes] = await Promise.all([
          fetch(`/api/guide?start=${startTime}&end=${startTime + 24 * 3600}${areaParam ? '&' + areaParam : ''}`)
        ]);
        const guideData = await guideRes.json();
        setGuide(guideData);
        
        // Restore session or initial focus
        if (visibleChannels.length > 0) {
          const restoredChId = session.lastChannelId || visibleChannels[0].channelId;
          const restoredProgId = session.lastProgramId;
          
          const chPrograms = guideData[restoredChId] || [];
          const liveProg = restoredProgId 
            ? chPrograms.find((p: Program) => p.listingId === restoredProgId) 
            : chPrograms.find((p: Program) => p.startUtc <= now && p.endUtc > now) || chPrograms[0];
          
          if (liveProg) {
            setFocusedProgramId(liveProg.listingId);
            setFocusedChannelId(restoredChId);
          } else {
            const firstChId = visibleChannels[0].channelId;
            const firstChPrograms = guideData[firstChId] || [];
            const defaultProg = firstChPrograms.find((p: Program) => p.startUtc <= now && p.endUtc > now) || firstChPrograms[0];
            if (defaultProg) {
              setFocusedProgramId(defaultProg.listingId);
              setFocusedChannelId(firstChId);
            }
          }
        }
      } catch (error) {
        console.error("Failed to fetch guide data", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 60000);
    return () => clearInterval(interval);
  }, [startTime, setupComplete, selectedAreaCode]);

  useEffect(() => {
    if (focusedProgram) {
      setWatchingProgram(focusedProgram);
      updateSession({ lastChannelId: focusedChannelId, lastProgramId: focusedProgramId });
      
      if (isGuideVisible) {
        const el = document.getElementById(`prog-${focusedProgram.listingId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
        }
      }
    }
  }, [focusedProgramId, focusedProgram, setWatchingProgram, isGuideVisible, updateSession]);

  const jumpToTime = (offsetHours: number) => {
    const target = Math.floor(Date.now() / 1000) + offsetHours * 3600;
    setBaseTime(target - (target % 3600));
    playSystemSound('confirm');
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (loading) return;

    const currentProg = focusedProgram;
    if (!currentProg || !focusedChannelId) return;

    const channelIndex = visibleChannels.findIndex(ch => ch.channelId === focusedChannelId);
    const channelPrograms = guide[focusedChannelId] || [];
    const programIndex = channelPrograms.findIndex(p => p.listingId === focusedProgramId);

    let nextProg: Program | null = null;
    let nextChannelId = focusedChannelId;

    switch (e.key) {
      case 'ArrowUp':
        if (channelIndex > 0) {
          nextChannelId = visibleChannels[channelIndex - 1].channelId;
          const nextChProgs = guide[nextChannelId] || [];
          const midTime = (currentProg.startUtc + currentProg.endUtc) / 2;
          nextProg = nextChProgs.find(p => p.startUtc <= midTime && p.endUtc > midTime) || nextChProgs[0];
        }
        break;
      case 'ArrowDown':
        if (channelIndex < visibleChannels.length - 1) {
          nextChannelId = visibleChannels[channelIndex + 1].channelId;
          const nextChProgs = guide[nextChannelId] || [];
          const midTime = (currentProg.startUtc + currentProg.endUtc) / 2;
          nextProg = nextChProgs.find(p => p.startUtc <= midTime && p.endUtc > midTime) || nextChProgs[0];
        }
        break;
      case 'ArrowLeft':
        if (isGuideVisible && programIndex > 0) {
          nextProg = channelPrograms[programIndex - 1];
        }
        break;
      case 'ArrowRight':
        if (isGuideVisible && programIndex < channelPrograms.length - 1) {
          nextProg = channelPrograms[programIndex + 1];
        }
        break;
      case 'Enter':
        if (isGuideVisible && focusedChannelId) {
          playSystemSound('confirm');
          startWatching(focusedChannelId);
        } else {
          playSystemSound('confirm');
          setIsGuideVisible(true);
        }
        return;
      case 'Escape':
      case 'Backspace':
        e.preventDefault();
        playSystemSound('back');
        setIsGuideVisible(!isGuideVisible);
        return;
      case 'q':
      case 'Q':
        if (previousChannelId) {
          playSystemSound('confirm');
          recallChannel();
        }
        return;
      case 'f':
      case 'F':
        toggleFavoriteProgram(focusedProgramId!);
        return;
      case 'r':
      case 'R':
        if (isReservationActive(currentProg.listingId)) {
          removeReservation(currentProg.listingId);
        } else {
          // Default to reminder for quick shortcut
          const ch = visibleChannels.find(c => c.channelId === focusedChannelId);
          addReservation(currentProg, ch?.name || 'Unknown', 'reminder');
        }
        return;
      default:
        return;
    }

    if (nextProg) {
      e.preventDefault();
      playSystemSound('click');
      setFocusedProgramId(nextProg.listingId);
      setFocusedChannelId(nextChannelId);
    }
  }, [visibleChannels, focusedChannelId, focusedProgramId, focusedProgram, guide, loading, navigate, playSystemSound, isGuideVisible, setIsGuideVisible, toggleFavoriteProgram, addReservation, removeReservation, isReservationActive, startWatching]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const getPosition = (time: number) => {
    return ((time - startTime) / 3600) * HOUR_WIDTH;
  };

  const getWidth = (start: number, end: number) => {
    return ((end - start) / 3600) * HOUR_WIDTH;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#000c18]">
        <div className="glossy-panel p-10 border-4 border-[#4a90e2]">
          <p className="text-2xl font-black italic tracking-[0.2em] text-white animate-pulse">LOADING EPG DATA...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full flex flex-col overflow-hidden bg-[#000810] border-t border-[#333] transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${isGuideVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
      {/* Top Bar: Recommended & Time Jumps - Integrated Frame */}
      <div className="flex h-10 bg-[#001224] border-b border-[#333] shrink-0">
        {/* Recommended Section */}
        <div className="flex-1 flex items-center px-4 gap-4 overflow-hidden border-r border-[#333]">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-2 h-2 bg-[#00f2ff] rounded-full shadow-[0_0_8px_#00f2ff]" />
            <span className="text-[10px] font-black text-[#00f2ff] tracking-widest uppercase italic">HOT STATIONS</span>
          </div>
          <div className="flex gap-4 overflow-hidden">
            {recommendedPrograms.map(p => (
              <div 
                key={p.listingId} 
                className="flex items-center gap-2 px-3 py-1 bg-[#002b4d] border border-[#4a90e2]/30 rounded-sm cursor-pointer hover:bg-[#1a3a5a] transition-all hover:border-[#00f2ff]/50 group"
                onClick={() => navigate(`/program/${p.listingId}`)}
              >
                <span className="text-[9px] font-black text-[#00f2ff] group-hover:scale-110 transition-transform">{p.channelId}</span>
                <span className="text-[11px] font-bold text-white truncate max-w-[150px]">{p.title}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Time Jumps */}
        <div className="flex items-center px-4 gap-2 bg-[#000810]">
          <button onClick={() => jumpToTime(0)} className="px-3 py-1 text-[10px] font-black text-white/40 hover:text-[#00f2ff] hover:bg-[#1a3a5a] rounded-sm transition-colors">NOW</button>
          <button onClick={() => jumpToTime(4)} className="px-3 py-1 text-[10px] font-black text-white/40 hover:text-[#00f2ff] hover:bg-[#1a3a5a] rounded-sm transition-colors">TONIGHT</button>
        </div>
      </div>

      {/* Timeline Header */}
      <div className="flex h-10 bg-[#000] shrink-0 border-b border-[#333]">
        <div 
          className="flex-shrink-0 border-r border-[#333] flex items-center justify-center font-black text-[11px] bg-[#1a3a5a] text-[#00f2ff] tracking-widest italic"
          style={{ width: CHANNEL_COL_WIDTH }}
        >
          STATION
        </div>
        <div className="flex-1 overflow-hidden relative" ref={scrollRef}>
          <div className="flex absolute top-0 left-0 h-full">
            {hours.map((h) => (
              <div 
                key={h} 
                className="h-full border-r border-[#333]/50 flex items-center px-4 text-[11px] font-black text-white/60 bg-[#000]"
                style={{ width: HOUR_WIDTH }}
              >
                <span className="text-[#00f2ff] mr-3">{new Date(h * 1000).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</span>
                <span className="opacity-40 text-[9px]">{new Date(h * 1000).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="flex-1 overflow-auto relative bg-[#000810]" ref={gridRef}>
        <div className="flex min-h-full">
          {/* Channel Column */}
          <div 
            className="flex-shrink-0 sticky left-0 z-20 bg-[#000810] border-r border-[#333]"
            style={{ width: CHANNEL_COL_WIDTH }}
          >
            {visibleChannels.map((ch) => {
              const isFav = favorites.channels.includes(ch.channelId);
              const identity = getChannelIdentity(ch.channelId);
              const accentColor = identity?.accentColor || (ch.group === 'NHK' ? '#00a0e9' : '#4a90e2');

              return (
                <div 
                  key={ch.channelId} 
                  className={`border-b border-[#1a3a5a]/20 flex flex-col justify-center px-3 transition-colors group relative ${focusedChannelId === ch.channelId ? 'bg-[#1a3a5a]/40' : 'hover:bg-[#1a3a5a]/20'}`}
                  style={{ height: ROW_HEIGHT }}
                  onClick={() => {
                    setFocusedChannelId(ch.channelId);
                    playSystemSound('click');
                    navigate(`/channel/${ch.channelId}`);
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 bg-white rounded-sm flex items-center justify-center overflow-hidden p-0.5 shrink-0">
                      {identity?.logo ? (
                        <img src={identity.logo} alt={ch.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="text-[#001a2c] font-black text-[8px]">{ch.number}</span>
                      )}
                    </div>
                    <span className="text-[9px] font-black text-white/40 tracking-tighter">CH {ch.number}</span>
                    {isFav && <Star size={8} className="text-yellow-400 fill-yellow-400 ml-auto" />}
                  </div>
                  <span className={`font-black text-[11px] leading-tight truncate uppercase italic ${focusedChannelId === ch.channelId ? 'text-[#00f2ff]' : 'text-white/80 group-hover:text-[#00f2ff]'}`}>{identity?.shortName || ch.name}</span>
                  
                  {/* Channel Accent */}
                  <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: accentColor }} />
                </div>
              );
            })}
          </div>

          {/* Programs Grid */}
          <div className="flex-1 relative">
            {/* Current Time Line */}
            <div 
              className="absolute top-0 bottom-0 w-[2px] bg-[#00f2ff] z-10 shadow-[0_0_10px_#00f2ff]"
              style={{ left: getPosition(now) }}
            >
              <div className="absolute top-0 -left-[4px] w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[8px] border-t-[#00f2ff]" />
            </div>

            {visibleChannels.map((ch) => (
              <div 
                key={ch.channelId} 
                className="border-b border-[#1a3a5a]/10 relative bg-[#000810]"
                style={{ height: ROW_HEIGHT }}
              >
                {(guide[ch.channelId] || []).map((p) => {
                  const width = getWidth(p.startUtc, p.endUtc);
                  const left = getPosition(p.startUtc);
                  
                  if (left + width < 0 || left > 24 * HOUR_WIDTH) return null;

                  const isLive = p.startUtc <= now && p.endUtc > now;
                  const isFocused = focusedProgramId === p.listingId;
                  const isFav = favorites.programs.includes(p.listingId);
                  const reservation = reservations.find(r => r.listingId === p.listingId && r.status === 'pending');
                  const progress = isLive ? ((now - p.startUtc) / (p.endUtc - p.startUtc)) * 100 : 0;
                  const pPresence = presence[p.listingId] || { viewers: 0, reactions: { like: 0, eyes: 0, fire: 0 } };
                  const isTrending = pPresence.viewers > 500 || pPresence.isTrending;

                  return (
                    <div
                      id={`prog-${p.listingId}`}
                      key={p.listingId}
                      className={`absolute top-0 bottom-0 epg-cell p-1.5 overflow-hidden cursor-pointer transition-all hover:z-10 group ${
                        isLive ? 'active' : ''
                      } ${isFocused ? 'focused' : ''}`}
                      style={{ 
                        left: Math.max(0, left), 
                        width: Math.min(width, 24 * HOUR_WIDTH - left)
                      }}
                      onClick={() => {
                        setFocusedProgramId(p.listingId);
                        setFocusedChannelId(ch.channelId);
                        playSystemSound('confirm');
                        navigate(`/program/${p.listingId}`);
                      }}
                    >
                      <div className="flex flex-col h-full relative">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-epg-time">
                            {p.startJst.split(' ')[1].slice(0, 5)}
                          </span>
                          <div className="flex gap-0.5">
                            {isTrending && <span className="badge-trending">HOT</span>}
                            {isLive && <span className="badge-live">LIVE</span>}
                            {isFav && <Star size={8} className="text-yellow-400 fill-yellow-400" />}
                            {reservation && (
                              <div className={`w-3 h-3 rounded-px flex items-center justify-center ${reservation.type === 'auto-tune' ? 'bg-[#cc00cc]' : 'bg-white/20'}`}>
                                <Calendar size={8} className="text-white" />
                              </div>
                            )}
                          </div>
                        </div>
                        <span className="text-epg-title line-clamp-2">
                          {p.title}
                        </span>
                        
                        {isLive && (
                          <div className="progress-bar-container mt-auto">
                            <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mini Preview Panel - Integrated Hardware Frame */}
      <AnimatePresence>
        {focusedProgram && isGuideVisible && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="h-28 bg-[#001224] border-t border-[#333] flex p-3 gap-4 shrink-0 z-30 shadow-[0_-4px_20px_rgba(0,0,0,0.8)]"
          >
            <div className="w-40 h-full bg-[#000] rounded-sm border border-[#333] flex flex-col items-center justify-center gap-1 shrink-0 overflow-hidden relative">
               <div className="text-[8px] font-black text-[#00f2ff] uppercase tracking-widest opacity-60">CH {focusedProgram.channelId}</div>
               <div className="text-xl font-black text-white italic">{new Date(focusedProgram.startUtc * 1000).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</div>
               <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
            </div>
            
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-0.5">
                <h3 className="text-lg font-black text-white truncate tracking-tight">{focusedProgram.title}</h3>
                <div className="flex gap-1">
                  {focusedProgram.genre && <span className="text-[8px] font-black bg-[#4a90e2]/20 text-[#4a90e2] px-1.5 py-0.5 rounded-px border border-[#4a90e2]/30">{focusedProgram.genre}</span>}
                </div>
              </div>
              <p className="text-[11px] text-white/50 line-clamp-2 leading-tight max-w-2xl">
                {focusedProgram.description}
              </p>
            </div>

            <div className="w-40 flex flex-col justify-center gap-1.5 border-l border-[#333] pl-4 shrink-0">
              <div className="text-[8px] font-black text-white/30 uppercase tracking-widest">SYSTEM ACTIONS</div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1 text-[9px] font-bold text-white/40"><span className="w-3.5 h-3.5 rounded-px border border-white/10 flex items-center justify-center">F</span> FAV</div>
                <div className="flex items-center gap-1 text-[9px] font-bold text-white/40"><span className="w-3.5 h-3.5 rounded-px border border-white/10 flex items-center justify-center">R</span> {isReservationActive(focusedProgram.listingId) ? 'CANCEL RES' : 'RESERVE'}</div>
              </div>
              {isReservationActive(focusedProgram.listingId) && (
                <div className="text-[8px] font-black text-[#cc00cc] uppercase animate-pulse">予約済み</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer / Status Bar - Integrated Frame */}
      <div className="h-6 bg-[#000] shrink-0 flex items-center px-3 text-[9px] font-black text-white/40 tracking-tighter border-t border-[#333]">
        <div className="flex items-center gap-4 w-full">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 bg-[#cc0000] rounded-full" />
            <span>BROADCAST</span>
          </div>
          <div className="flex items-center gap-3 ml-4 border-l border-white/10 pl-4">
             <span className="text-[#00f2ff]/60">NAV: ARROWS</span>
             <span className="text-[#00f2ff]/60">SELECT: ENTER</span>
             <span className="text-[#00f2ff]/60">EXIT: ESC</span>
          </div>
          <div className="ml-auto opacity-30 italic">
            TV-PAL™ SYSTEM v2.0.05 | REVISION 73KQ
          </div>
        </div>
      </div>
    </div>
  );
};
