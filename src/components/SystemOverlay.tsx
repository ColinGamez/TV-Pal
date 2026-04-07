import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useSystem } from '../context/SystemContext';
import { Tv, Calendar, User } from 'lucide-react';
import { PROFILE_ICONS } from '../constants/profileAssets';

export const SystemOverlay: React.FC = () => {
  const { 
    watchingProgram, 
    isGuideVisible, 
    presence, 
    addReaction, 
    isReservationActive, 
    reservations, 
    currentProfile, 
    previousChannelId,
    sleepTimerRemaining,
    isSleepTimerWarning,
    cancelSleepTimer,
    extendSleepTimer
  } = useSystem();
  const [progress, setProgress] = useState(0);

  const getProfileIcon = (id: string) => {
    const asset = PROFILE_ICONS.find(i => i.id === id);
    return asset ? asset.icon : User;
  };

  const ProfileIcon = currentProfile ? getProfileIcon(currentProfile.iconId) : User;

  const pPresence = watchingProgram ? presence[watchingProgram.listingId] || { viewers: 0, reactions: { like: 0, eyes: 0, fire: 0 } } : null;
  const isReserved = watchingProgram ? isReservationActive(watchingProgram.listingId) : false;
  const currentRes = watchingProgram ? reservations.find(r => r.listingId === watchingProgram.listingId) : null;

  useEffect(() => {
    if (!watchingProgram) return;

    const calculateProgress = () => {
      const now = Date.now();
      const start = watchingProgram.startUtc * 1000;
      const end = watchingProgram.endUtc * 1000;
      const total = end - start;
      const current = now - start;
      const percent = Math.max(0, Math.min(100, (current / total) * 100));
      setProgress(percent);
    };

    calculateProgress();
    const interval = setInterval(calculateProgress, 10000);
    return () => clearInterval(interval);
  }, [watchingProgram]);

  return (
    <>
      <AnimatePresence>
        {isSleepTimerWarning && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[9500] w-[400px] glossy-panel border-l-4 border-l-orange-500 bg-[#001224] p-4 shadow-[0_10px_40px_rgba(0,0,0,0.8)]"
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-orange-500 rounded flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(249,115,22,0.5)]">
                <span className="text-white text-xl">⏰</span>
              </div>
              <div className="flex-1">
                <div className="text-[10px] font-black text-orange-500 tracking-widest uppercase mb-1">スリープタイマー</div>
                <h4 className="text-sm font-black text-white italic leading-tight mb-1">まもなくスタンバイに移行します</h4>
                <p className="text-[10px] font-bold text-white/40 uppercase">残り時間: {Math.floor(sleepTimerRemaining || 0)}秒</p>
                
                <div className="mt-3 flex gap-2">
                  <button 
                    onClick={cancelSleepTimer}
                    className="flex-1 py-1.5 bg-white/5 text-white/60 text-[10px] font-black uppercase hover:bg-white/10 transition-all border border-white/10"
                  >
                    解除
                  </button>
                  <button 
                    onClick={() => extendSleepTimer(15)}
                    className="flex-1 py-1.5 bg-orange-500 text-white text-[10px] font-black uppercase hover:brightness-110 transition-all"
                  >
                    15分延長
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {watchingProgram && (
        <motion.div 
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
          className={`fixed bottom-0 left-0 right-0 z-[9000] h-24 osd-panel flex items-center px-10 gap-8 transition-all duration-500 ${!isGuideVisible ? 'bg-black/90 border-t-4 border-[#00f2ff]' : ''}`}
        >
          {/* Channel Info */}
          <div className="flex items-center gap-4 border-r border-[#4a90e2]/30 pr-8">
            <div className="w-12 h-12 bg-gradient-to-br from-[#00f2ff] to-[#00a3e0] rounded flex items-center justify-center shadow-[0_0_15px_rgba(0,242,255,0.4)] border border-white/40">
              <Tv className="text-[#001a2c]" size={24} />
            </div>
            <div>
              <div className="text-[10px] font-black text-[#00f2ff] uppercase tracking-widest opacity-60">NOW WATCHING</div>
              <div className="text-xl font-black text-white italic tracking-tighter">CH {watchingProgram.channelId}</div>
            </div>
          </div>

          {/* Program Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-2xl font-black text-white truncate tracking-tight">{watchingProgram.title}</h2>
              <div className="badge-live">LIVE</div>
              {isReserved && (
                <div className={`flex items-center gap-1.5 text-[10px] font-black px-2 py-0.5 rounded border ${currentRes?.type === 'auto-tune' ? 'bg-[#cc00cc] text-white border-white/40' : 'bg-white/10 text-white/60 border-white/20'}`}>
                  <Calendar size={10} />
                  {currentRes?.type === 'auto-tune' ? '視聴予約中' : 'お知らせ設定中'}
                </div>
              )}
              {pPresence && pPresence.viewers > 100 && (
                <div className="text-[10px] font-black text-[#00f2ff] bg-[#00f2ff]/10 px-2 py-0.5 rounded border border-[#00f2ff]/30">
                  視聴中: {pPresence.viewers}人
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex-1 h-3 bg-black/40 border border-[#4a90e2]/20 rounded-full overflow-hidden relative">
                <motion.div 
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#00f2ff] to-[#00a3e0] shadow-[0_0_10px_#00f2ff]"
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <div className="text-[11px] font-black text-white/50 tracking-widest">
                {watchingProgram.startJst.split(' ')[1].slice(0, 5)} - {watchingProgram.endJst.split(' ')[1].slice(0, 5)}
              </div>
            </div>
          </div>

          {/* Reactions */}
          <div className="flex items-center gap-4 px-8 border-l border-[#4a90e2]/30">
            <button 
              onClick={() => addReaction(watchingProgram.listingId, 'fire')}
              className="group flex flex-col items-center gap-1 hover:scale-110 transition-transform"
            >
              <span className="text-xl">🔥</span>
              <span className="text-[9px] font-black text-white/40">{pPresence?.reactions.fire || 0}</span>
            </button>
            <button 
              onClick={() => addReaction(watchingProgram.listingId, 'like')}
              className="group flex flex-col items-center gap-1 hover:scale-110 transition-transform"
            >
              <span className="text-xl">👍</span>
              <span className="text-[9px] font-black text-white/40">{pPresence?.reactions.like || 0}</span>
            </button>
          </div>

          {/* Actions Hint */}
          <div className="flex items-center gap-6 pl-8 border-l border-[#4a90e2]/30 relative">
             <div className="absolute -top-6 right-0 text-[7px] font-black text-white/20 tracking-[0.4em] uppercase whitespace-nowrap">
               TV-PAL™ OS v2.1.0-REV.05 | DIGITAL MEDIA CENTER
             </div>
             {currentProfile && (
               <div className="flex flex-col items-center gap-1 group cursor-pointer">
                 <div 
                   className="w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all shadow-lg"
                   style={{ borderColor: currentProfile.color, backgroundColor: `${currentProfile.color}20` }}
                 >
                   <ProfileIcon size={20} style={{ color: currentProfile.color }} />
                 </div>
                 <span className="text-[8px] font-black italic tracking-tighter uppercase" style={{ color: currentProfile.color }}>{currentProfile.name}</span>
               </div>
             )}
             <div className="flex flex-col items-center gap-1">
               <div className="w-8 h-8 rounded-full border-2 border-white/20 flex items-center justify-center text-white/40 text-[10px] font-black">
                 {isGuideVisible ? 'BACK' : 'ESC'}
               </div>
               <span className="text-[8px] font-bold text-white/30 uppercase">{isGuideVisible ? 'LIVE' : 'GUIDE'}</span>
             </div>
             <div className="flex flex-col items-center gap-1">
               <div className="w-8 h-8 rounded-full border-2 border-white/20 flex items-center justify-center text-white/40 text-[10px] font-black">ENTER</div>
               <span className="text-[8px] font-bold text-white/30 uppercase">INFO</span>
             </div>
             {previousChannelId && (
               <div className="flex flex-col items-center gap-1">
                 <div className="w-8 h-8 rounded-full border-2 border-[#00f2ff]/40 flex items-center justify-center text-[#00f2ff]/60 text-[10px] font-black">Q</div>
                 <span className="text-[8px] font-bold text-[#00f2ff]/40 uppercase">RECALL</span>
               </div>
             )}
             {sleepTimerRemaining !== null && (
               <div className="flex flex-col items-center gap-1">
                 <div className="w-8 h-8 rounded-full border-2 border-orange-500/40 flex items-center justify-center text-orange-500/60 text-[10px] font-black">
                   {Math.ceil(sleepTimerRemaining / 60)}
                 </div>
                 <span className="text-[8px] font-bold text-orange-500/40 uppercase">SLEEP</span>
               </div>
             )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
};
