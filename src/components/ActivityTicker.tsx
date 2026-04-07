import React from 'react';
import { useSystem } from '../context/SystemContext';
import { motion, AnimatePresence } from 'motion/react';
import { Activity } from 'lucide-react';

export const ActivityTicker: React.FC = () => {
  const { activityLog, isGuideVisible } = useSystem();

  return (
    <div className={`fixed top-14 left-0 right-0 z-[100] h-8 bg-black/60 border-b border-[#4a90e2]/30 backdrop-blur-md overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${isGuideVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full'}`}>
      <div className="flex items-center h-full px-4 gap-4">
        <div className="flex items-center gap-2 text-[#00f2ff] shrink-0">
          <Activity size={14} className="animate-pulse" />
          <span className="text-[10px] font-black tracking-tighter uppercase italic">SYSTEM LOG</span>
        </div>
        
        <div className="flex-1 overflow-hidden relative h-full">
          <AnimatePresence mode="popLayout">
            {activityLog.length > 0 && (
              <motion.div
                key={activityLog[0].id}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -20, opacity: 0 }}
                transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
                className="flex items-center h-full text-[11px] font-bold text-white/80 tracking-tight"
              >
                <span className="text-[#4a90e2] mr-2">[{new Date(activityLog[0].timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
                {activityLog[0].message}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="text-[9px] font-black text-[#00f2ff]/40 tracking-widest uppercase">
          LIVE NETWORK STATUS: OPTIMAL
        </div>
      </div>
      
      {/* Ticker Shine */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/5 to-transparent h-[1px]" />
    </div>
  );
};
