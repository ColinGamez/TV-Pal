import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, WifiOff, Loader2 } from 'lucide-react';

interface SignalOverlayProps {
  state: 'acquiring' | 'switching' | 'unavailable' | 'not-found' | 'stable';
}

export const SignalOverlay: React.FC<SignalOverlayProps> = ({ state }) => {
  if (state === 'stable') return null;

  const getMessage = () => {
    switch (state) {
      case 'acquiring':
        return '信号を取得しています…';
      case 'switching':
        return 'チャンネルを切り替えています…';
      case 'unavailable':
        return '一時的に受信できません';
      case 'not-found':
        return '放送信号が見つかりません';
      default:
        return '';
    }
  };

  const getIcon = () => {
    switch (state) {
      case 'acquiring':
      case 'switching':
        return <Loader2 className="animate-spin text-[#00f2ff]" size={32} />;
      case 'unavailable':
        return <WifiOff className="text-yellow-500" size={32} />;
      case 'not-found':
        return <AlertTriangle className="text-red-500" size={32} />;
      default:
        return null;
    }
  };

  return (
    <div className="absolute inset-0 z-[150] flex items-center justify-center pointer-events-none">
      <AnimatePresence mode="wait">
        <motion.div
          key={state}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.1 }}
          className="bg-black/80 backdrop-blur-xl border-2 border-white/10 p-8 rounded-lg flex flex-col items-center gap-4 shadow-[0_0_50px_rgba(0,0,0,0.5)]"
        >
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
            {getIcon()}
          </div>
          <div className="text-xl font-black text-white tracking-widest italic uppercase">
            {getMessage()}
          </div>
          
          {/* Hardware-style progress bar for acquiring/switching */}
          {(state === 'acquiring' || state === 'switching') && (
            <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden mt-2">
              <motion.div 
                className="h-full bg-[#00f2ff]"
                animate={{ 
                  x: [-200, 200],
                }}
                transition={{ 
                  repeat: Infinity, 
                  duration: 1.5, 
                  ease: "linear" 
                }}
              />
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
