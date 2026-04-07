import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useSystem } from '../context/SystemContext';
import { PREFECTURES } from '../constants/prefectures';
import { ChevronRight, Check, Search, Radio, Settings } from 'lucide-react';

type SetupStep = 'BOOT' | 'INTERRUPT' | 'REGION' | 'SCAN' | 'SUMMARY';

export const SystemSetup: React.FC = () => {
  const { completeSetup, playSystemSound, setupComplete, setIsSettingUp } = useSystem();
  const [step, setStep] = useState<SetupStep>(setupComplete ? 'REGION' : 'BOOT');
  const [selectedPrefIndex, setSelectedPrefIndex] = useState(12); // Default to Tokyo (index 12)
  const [scanProgress, setScanProgress] = useState(0);
  const [scanMessage, setScanMessage] = useState('');
  const [foundChannels, setFoundChannels] = useState(0);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  // Boot sequence
  useEffect(() => {
    if (step === 'BOOT') {
      const timer = setTimeout(() => setStep('INTERRUPT'), 2500);
      return () => clearTimeout(timer);
    }
    if (step === 'INTERRUPT') {
      const timer = setTimeout(() => setStep('REGION'), 3000);
      return () => clearTimeout(timer);
    }
  }, [step]);

  // Scan simulation
  useEffect(() => {
    if (step === 'SCAN') {
      const messages = [
        '受信チャンネルを確認しています…',
        '地上デジタル信号を検出中…',
        '放送エリアを特定しています…',
        '番組表データを取得しています…',
        'システム設定を更新中…'
      ];
      
      let currentMsgIdx = 0;
      const interval = setInterval(() => {
        setScanProgress(prev => {
          const next = prev + (Math.random() * 15);
          if (next >= 100) {
            clearInterval(interval);
            setFoundChannels(Math.floor(Math.random() * 5) + 6); // 6-10 channels
            setStep('SUMMARY');
            playSystemSound('confirm');
            return 100;
          }
          
          // Update message every 20%
          const msgIdx = Math.floor(next / 20);
          if (msgIdx !== currentMsgIdx && msgIdx < messages.length) {
            currentMsgIdx = msgIdx;
            setScanMessage(messages[msgIdx]);
            playSystemSound('click');
          }
          
          return next;
        });
      }, 400);
      
      return () => clearInterval(interval);
    }
  }, [step, playSystemSound]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (step !== 'REGION' && step !== 'SUMMARY') return;

    if (step === 'REGION') {
      switch (e.key) {
        case 'ArrowUp':
          setSelectedPrefIndex(prev => Math.max(0, prev - 1));
          playSystemSound('click');
          break;
        case 'ArrowDown':
          setSelectedPrefIndex(prev => Math.min(PREFECTURES.length - 1, prev + 1));
          playSystemSound('click');
          break;
        case 'Enter':
          setStep('SCAN');
          playSystemSound('confirm');
          break;
        case 'Escape':
        case 'Backspace':
          if (setupComplete) {
            setIsSettingUp(false);
            playSystemSound('back');
          }
          break;
      }
    } else if (step === 'SUMMARY') {
      if (e.key === 'Enter') {
        const pref = PREFECTURES[selectedPrefIndex];
        completeSetup(pref.name, pref.areaCode);
      }
    }
  }, [step, selectedPrefIndex, completeSetup, playSystemSound]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Auto-scroll the region list
  useEffect(() => {
    if (step === 'REGION' && scrollRef.current) {
      const activeItem = scrollRef.current.children[selectedPrefIndex] as HTMLElement;
      if (activeItem) {
        activeItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [selectedPrefIndex, step]);

  return (
    <div className="fixed inset-0 z-[2000] bg-black flex items-center justify-center font-sans overflow-hidden">
      <AnimatePresence mode="wait">
        {step === 'BOOT' && (
          <motion.div 
            key="boot"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-8"
          >
            <div className="text-6xl font-black text-white italic tracking-tighter">テレビパル™</div>
            <div className="flex flex-col items-center gap-2">
              <div className="text-xs font-mono text-[#00cc00] opacity-60">SYSTEM INITIALIZING...</div>
              <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-white"
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 2, ease: "easeInOut" }}
                />
              </div>
            </div>
            <div className="text-[10px] font-mono text-white/30 absolute bottom-12">
              (C) 2006-2010 TV-PAL SYSTEMS CO., LTD.
            </div>
          </motion.div>
        )}

        {step === 'INTERRUPT' && (
          <motion.div 
            key="interrupt"
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex flex-col items-center gap-6 text-center"
          >
            <div className="w-16 h-16 rounded-full border-2 border-[#00f2ff] flex items-center justify-center mb-4 shadow-[0_0_15px_rgba(0,242,255,0.4)]">
              <Settings className="text-[#00f2ff] animate-spin-slow" size={32} />
            </div>
            <h2 className="text-3xl font-black text-white tracking-tight">初期設定が必要です</h2>
            <p className="text-white/60 text-sm max-w-xs leading-relaxed">
              放送信号を受信するために、<br />
              お住まいの地域の受信設定を開始します。
            </p>
            <div className="mt-4 px-4 py-2 bg-[#1a3a5a] border border-[#4a90e2]/40 text-[#00f2ff] text-xs font-black tracking-widest animate-pulse">
              地域設定を開始します
            </div>
          </motion.div>
        )}

        {step === 'REGION' && (
          <motion.div 
            key="region"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="w-full max-w-2xl flex flex-col gap-8 px-12"
          >
            <div className="flex flex-col gap-1">
              <div className="text-[#00f2ff] text-xs font-black tracking-widest uppercase">Step 01 / 03</div>
              <h2 className="text-4xl font-black text-white tracking-tighter italic">地域設定 (PREFECTURE)</h2>
              <div className="h-0.5 w-full bg-gradient-to-r from-[#00f2ff] to-transparent opacity-30 mt-2" />
            </div>

            <div className="flex gap-8 h-[400px]">
              {/* Region List */}
              <div className="flex-1 glossy-panel border-2 border-[#4a90e2]/40 overflow-hidden flex flex-col">
                <div className="bg-[#1a3a5a] px-4 py-2 border-b border-[#4a90e2]/40 text-[10px] font-black text-white/60 tracking-widest">都道府県を選択してください</div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2" ref={scrollRef}>
                  {PREFECTURES.map((pref, idx) => (
                    <div 
                      key={pref.id}
                      className={`flex items-center justify-between px-4 py-3 mb-1 rounded-sm transition-all cursor-pointer ${
                        selectedPrefIndex === idx 
                          ? 'bg-[#00f2ff] text-black font-black shadow-[0_0_15px_rgba(0,242,255,0.4)]' 
                          : 'text-white/60 hover:bg-white/5'
                      }`}
                      onClick={() => {
                        setSelectedPrefIndex(idx);
                        playSystemSound('click');
                      }}
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-[10px] opacity-40 font-mono">{String(idx + 1).padStart(2, '0')}</span>
                        <span className="text-lg tracking-tight">{pref.name}</span>
                      </div>
                      {selectedPrefIndex === idx && <ChevronRight size={20} />}
                    </div>
                  ))}
                </div>
              </div>

              {/* Info Sidebar */}
              <div className="w-48 flex flex-col gap-4">
                <div className="p-4 bg-[#001224] border border-white/10 rounded-sm">
                  <div className="text-[8px] font-black text-white/30 uppercase tracking-widest mb-2">Selected Region</div>
                  <div className="text-2xl font-black text-[#00f2ff]">{PREFECTURES[selectedPrefIndex].region}</div>
                  <div className="text-xs text-white/60 mt-1">{PREFECTURES[selectedPrefIndex].en}</div>
                </div>
                <div className="mt-auto p-4 bg-[#cc0000]/10 border border-[#cc0000]/30 rounded-sm">
                  <div className="text-[9px] font-black text-[#cc0000] mb-1">HELP</div>
                  <p className="text-[10px] text-white/40 leading-tight">
                    上下キーで選択し、決定キーでスキャンを開始します。
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px] font-black text-white/30 border-t border-white/10 pt-4">
              <div className="flex gap-4">
                <span className="flex items-center gap-1"><span className="w-4 h-4 rounded-px border border-white/20 flex items-center justify-center">↑↓</span> 選択</span>
                <span className="flex items-center gap-1"><span className="w-8 h-4 rounded-px border border-white/20 flex items-center justify-center">ENTER</span> 決定</span>
                {setupComplete && <span className="flex items-center gap-1"><span className="w-8 h-4 rounded-px border border-white/20 flex items-center justify-center">ESC</span> 戻る</span>}
              </div>
              <div className="italic">TV-PAL™ INITIAL SETUP WIZARD</div>
            </div>
          </motion.div>
        )}

        {step === 'SCAN' && (
          <motion.div 
            key="scan"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="w-full max-w-xl flex flex-col items-center gap-12"
          >
            <div className="flex flex-col items-center gap-2">
              <div className="w-20 h-20 rounded-full border-4 border-white/5 flex items-center justify-center relative">
                <Radio className="text-[#00f2ff] animate-pulse" size={40} />
                <motion.div 
                  className="absolute inset-0 rounded-full border-4 border-[#00f2ff]"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: scanProgress / 100 }}
                  style={{ rotate: -90 }}
                />
              </div>
              <div className="text-[#00f2ff] text-xs font-black tracking-widest mt-4">SCANNING BROADCASTS...</div>
            </div>

            <div className="w-full flex flex-col gap-4">
              <div className="flex justify-between items-end">
                <div className="text-xl font-black text-white italic tracking-tighter">{scanMessage || '初期化中…'}</div>
                <div className="text-2xl font-mono text-[#00f2ff]">{Math.floor(scanProgress)}%</div>
              </div>
              <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden border border-white/10">
                <motion.div 
                  className="h-full bg-gradient-to-r from-[#00f2ff] to-[#4a90e2] shadow-[0_0_15px_rgba(0,242,255,0.5)]"
                  style={{ width: `${scanProgress}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 w-full">
              <div className="p-4 bg-[#001224] border border-white/10 rounded-sm flex items-center gap-4">
                <Search className="text-white/20" size={20} />
                <div>
                  <div className="text-[8px] font-black text-white/30 uppercase">Detected Signals</div>
                  <div className="text-xl font-black text-white">ISDB-T / BS / CS</div>
                </div>
              </div>
              <div className="p-4 bg-[#001224] border border-white/10 rounded-sm flex items-center gap-4">
                <Check className="text-white/20" size={20} />
                <div>
                  <div className="text-[8px] font-black text-white/30 uppercase">Status</div>
                  <div className="text-xl font-black text-[#00cc00]">STABLE</div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {step === 'SUMMARY' && (
          <motion.div 
            key="summary"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            className="w-full max-w-lg glossy-panel border-4 border-[#00f2ff]/40 p-12 flex flex-col items-center text-center gap-8"
          >
            <div className="w-16 h-16 rounded-full bg-[#00cc00] flex items-center justify-center shadow-[0_0_20px_rgba(0,204,0,0.4)]">
              <Check className="text-black" size={32} strokeWidth={4} />
            </div>
            
            <div className="flex flex-col gap-2">
              <h2 className="text-3xl font-black text-white tracking-tighter italic">設定が完了しました</h2>
              <p className="text-white/50 text-sm">放送エリアの設定とチャンネルスキャンが正常に終了しました。</p>
            </div>

            <div className="w-full grid grid-cols-1 gap-2">
              <div className="flex justify-between items-center p-4 bg-black/40 border border-white/10 rounded-sm">
                <span className="text-xs font-black text-white/40 uppercase tracking-widest">Selected Area</span>
                <span className="text-xl font-black text-[#00f2ff]">{PREFECTURES[selectedPrefIndex].name}</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-black/40 border border-white/10 rounded-sm">
                <span className="text-xs font-black text-white/40 uppercase tracking-widest">Channels Found</span>
                <span className="text-xl font-black text-[#00f2ff]">{foundChannels} CHANNELS</span>
              </div>
            </div>

            <div className="mt-4 flex flex-col items-center gap-4">
              <div className="px-8 py-3 bg-[#00f2ff] text-black font-black text-lg tracking-tighter italic shadow-[0_0_20px_rgba(0,242,255,0.4)] animate-pulse">
                ENTER SYSTEM
              </div>
              <div className="text-[10px] font-black text-white/30 flex items-center gap-2">
                <span className="w-8 h-4 rounded-px border border-white/20 flex items-center justify-center">ENTER</span>
                決定キーを押して番組表を表示します
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background Grid Accent */}
      <div className="absolute inset-0 pointer-events-none opacity-10">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]" />
      </div>
    </div>
  );
};
