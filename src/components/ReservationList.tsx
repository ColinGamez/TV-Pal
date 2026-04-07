import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, Clock, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useSystem } from '../context/SystemContext';

export const ReservationList: React.FC = () => {
  const { reservations, removeReservation, playSystemSound, getChannelIdentity } = useSystem();
  const [focusedIndex, setFocusedIndex] = useState(0);

  const upcoming = reservations
    .filter(r => r.status === 'pending')
    .sort((a, b) => a.startTime - b.startTime);
    
  const history = reservations
    .filter(r => r.status !== 'pending')
    .sort((a, b) => b.startTime - a.startTime)
    .slice(0, 10);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (upcoming.length === 0) return;
      
      switch (e.key) {
        case 'ArrowUp':
          setFocusedIndex(prev => (prev > 0 ? prev - 1 : upcoming.length - 1));
          playSystemSound('click');
          break;
        case 'ArrowDown':
          setFocusedIndex(prev => (prev < upcoming.length - 1 ? prev + 1 : 0));
          playSystemSound('click');
          break;
        case 'Enter':
          // Maybe show options or just remove?
          break;
        case 'Delete':
        case 'Backspace':
          if (upcoming[focusedIndex]) {
            removeReservation(upcoming[focusedIndex].listingId);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [upcoming, focusedIndex, removeReservation, playSystemSound]);

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', weekday: 'short' });
  };

  return (
    <div className="flex-1 flex flex-col p-8 overflow-hidden bg-black/20">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-[#cc00cc] rounded flex items-center justify-center shadow-[0_0_20px_rgba(204,0,204,0.4)]">
            <Calendar className="text-white" size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white italic tracking-tighter uppercase">Reservation List</h1>
            <div className="text-[10px] font-black text-[#cc00cc] tracking-[0.3em] uppercase opacity-60">予約・視聴予約一覧</div>
          </div>
        </div>
        <div className="flex items-center gap-4 text-[10px] font-black text-white/40 tracking-widest uppercase">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#cc00cc]" />
            {upcoming.length} UPCOMING
          </div>
        </div>
      </div>

      <div className="flex-1 flex gap-8 overflow-hidden">
        {/* Upcoming Reservations */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="text-xs font-black text-white/30 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Clock size={14} /> Upcoming Reservations
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2">
            <AnimatePresence mode="popLayout">
              {upcoming.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-white/20 gap-4 border-2 border-dashed border-white/5 rounded-lg">
                  <Calendar size={48} strokeWidth={1} />
                  <div className="text-sm font-bold uppercase tracking-widest">No upcoming reservations</div>
                </div>
              ) : (
                upcoming.map((res, idx) => {
                  const isFocused = focusedIndex === idx;
                  const timeToStart = res.startTime - Date.now();
                  const isStartingSoon = timeToStart < 300000; // 5 mins

                  return (
                    <motion.div
                      key={res.listingId}
                      layout
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
                      className={`
                        group relative p-4 glossy-panel border-l-4 transition-all duration-200
                        ${isFocused ? 'border-l-[#cc00cc] bg-white/10 translate-x-2' : 'border-l-transparent bg-white/5'}
                      `}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-white rounded flex items-center justify-center overflow-hidden p-1 shrink-0 border border-white/10">
                            {getChannelIdentity(res.channelId)?.logo ? (
                              <img src={getChannelIdentity(res.channelId)!.logo} alt={res.channelName} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                            ) : (
                              <span className="text-[#001a2c] font-black text-xl">{res.channelId.slice(0, 2)}</span>
                            )}
                          </div>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-px ${res.type === 'auto-tune' ? 'bg-[#cc00cc] text-white' : 'bg-white/20 text-white/60'}`}>
                                {res.type === 'auto-tune' ? '視聴予約' : 'お知らせ'}
                              </span>
                              <span className="text-xs font-mono text-white/40">{formatDate(res.startTime)}</span>
                            </div>
                            <h3 className="text-lg font-black text-white italic tracking-tight">{res.title}</h3>
                            <div className="flex items-center gap-3 text-xs font-bold text-white/60">
                              <span className="text-[#00f2ff]">{getChannelIdentity(res.channelId)?.shortName || res.channelName}</span>
                              <span className="opacity-40">|</span>
                              <span>{formatTime(res.startTime)} - {formatTime(res.endTime)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          {isStartingSoon && (
                            <div className="flex items-center gap-1 text-[#cc00cc] text-[10px] font-black animate-pulse">
                              <AlertCircle size={12} /> まもなく開始
                            </div>
                          )}
                          <button 
                            onClick={() => removeReservation(res.listingId)}
                            className="p-2 text-white/20 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                      
                      {isFocused && (
                        <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-[#cc00cc] shadow-[0_0_10px_#cc00cc]" />
                      )}
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* History / Status Sidebar */}
        <div className="w-80 flex flex-col gap-6">
          <div className="flex flex-col gap-4">
            <div className="text-xs font-black text-white/30 uppercase tracking-widest flex items-center gap-2">
              <CheckCircle2 size={14} /> History
            </div>
            <div className="space-y-2">
              {history.map(res => (
                <div key={res.listingId} className="p-3 bg-black/40 border border-white/5 rounded-sm flex flex-col gap-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-black text-white/20 uppercase">{res.status}</span>
                    <span className="text-[9px] font-mono text-white/20">{formatDate(res.startTime)}</span>
                  </div>
                  <div className="text-xs font-bold text-white/60 truncate">{res.title}</div>
                </div>
              ))}
              {history.length === 0 && (
                <div className="p-8 text-center text-[10px] font-black text-white/10 uppercase tracking-widest border border-dashed border-white/5">
                  No history
                </div>
              )}
            </div>
          </div>

          <div className="mt-auto p-4 bg-[#cc00cc]/10 border border-[#cc00cc]/30 rounded-sm">
            <div className="text-[9px] font-black text-[#cc00cc] mb-2 uppercase tracking-widest">System Info</div>
            <div className="space-y-1 text-[10px] text-white/40 font-bold">
              <div className="flex justify-between"><span>AUTO-TUNE</span> <span className="text-white/60">ENABLED</span></div>
              <div className="flex justify-between"><span>CONFLICT CHECK</span> <span className="text-white/60">ACTIVE</span></div>
              <div className="flex justify-between"><span>STORAGE</span> <span className="text-white/60">LOCAL</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Controls */}
      <div className="mt-8 pt-4 border-t border-white/10 flex items-center justify-between text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">
        <div className="flex gap-6">
          <span className="flex items-center gap-2"><span className="w-4 h-4 rounded-px border border-white/20 flex items-center justify-center">↑↓</span> SELECT</span>
          <span className="flex items-center gap-2"><span className="w-8 h-4 rounded-px border border-white/20 flex items-center justify-center">BACK</span> RETURN</span>
          <span className="flex items-center gap-2"><span className="w-8 h-4 rounded-px border border-white/20 flex items-center justify-center">DEL</span> CANCEL RESERVATION</span>
        </div>
        <div className="italic">TV-PAL™ RESERVATION MODULE v1.0</div>
      </div>
    </div>
  );
};
