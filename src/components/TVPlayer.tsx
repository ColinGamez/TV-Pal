import React, { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { useSystem } from '../context/SystemContext';
import { diagnostics } from '../lib/diagnostics';
import { motion, AnimatePresence } from 'motion/react';
import { Info, Clock, Volume2, AlertCircle, RefreshCw, LayoutGrid } from 'lucide-react';
import { SignalOverlay } from './SignalOverlay';

export const TVPlayer: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const { 
    watchingChannel, 
    stopWatching, 
    nextChannel, 
    prevChannel, 
    playSystemSound,
    guide,
    selectedAreaCode,
    signalState,
    setSignalState,
    retryCount,
    setRetryCount,
    fallbackIndex,
    setFallbackIndex,
    lastPlaybackError,
    setLastPlaybackError,
    setAudioGain,
    settings,
    getChannelIdentity,
    getStreams,
    previousChannelId,
    recallChannel
  } = useSystem();
  
  const [showOSD, setShowOSD] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [isRecall, setIsRecall] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const osdTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fadeIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const currentProgram = watchingChannel ? (guide[watchingChannel.channelId] || []).find(p => {
    const now = Math.floor(Date.now() / 1000);
    return p.startUtc <= now && p.endUtc > now;
  }) : null;

  const nextProgram = watchingChannel ? (guide[watchingChannel.channelId] || []).find(p => {
    const now = Math.floor(Date.now() / 1000);
    return p.startUtc > now;
  }) : null;

  const progress = currentProgram ? ((Math.floor(Date.now() / 1000) - currentProgram.startUtc) / (currentProgram.endUtc - currentProgram.startUtc)) * 100 : 0;

  const resetOSDTimeout = useCallback(() => {
    setShowOSD(true);
    if (osdTimeoutRef.current) clearTimeout(osdTimeoutRef.current);
    osdTimeoutRef.current = setTimeout(() => {
      setShowOSD(false);
    }, 4000);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!watchingChannel || !videoRef.current) return;

    let isMounted = true;

    const loadStream = async () => {
      try {
        const streams = await getStreams(watchingChannel.channelId);
        if (!isMounted) return;

        if (!streams || streams.length === 0) {
          setSignalState('not-found');
          return;
        }

        if (signalState === 'stable') {
          setSignalState('acquiring');
        }

        const currentStream = streams[fallbackIndex] || streams[0];
        if (!currentStream) {
          setSignalState('not-found');
          return;
        }

        const currentUrl = currentStream.url;
        diagnostics.log('SYSTEM', 'PLAYER', `ACQUIRING SIGNAL: ${currentUrl}`);

        // Set audio gain
        const effectiveGain = settings.playback.normalization ? (currentStream.gainOffset || 0) : 0;
        setAudioGain(effectiveGain);

        const video = videoRef.current;
        if (!video) return;

        // Apply volume smoothing and gain
        const masterVol = settings.audio.masterVolume / 100;
        const targetVolume = masterVol * Math.pow(10, effectiveGain / 20);
        video.volume = 0; // Start at 0 for smoothing

        const fadeIn = () => {
          let vol = 0;
          if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
          fadeIntervalRef.current = setInterval(() => {
            vol += 0.05;
            if (vol >= targetVolume) {
              video.volume = targetVolume;
              if (fadeIntervalRef.current) {
                clearInterval(fadeIntervalRef.current);
                fadeIntervalRef.current = null;
              }
            } else {
              video.volume = vol;
            }
          }, 50);
        };

        const handleError = (error: any) => {
          console.error("Playback error:", error);
          setLastPlaybackError(error.toString());

          if (settings.playback.autoRetry && retryCount < 2) {
            setRetryCount(retryCount + 1);
            setSignalState('acquiring');
          } else if (settings.playback.fallbackEnabled && fallbackIndex < streams.length - 1) {
            setFallbackIndex(fallbackIndex + 1);
            setRetryCount(0);
            setSignalState('acquiring');
          } else {
            setSignalState('unavailable');
          }
        };

        if (Hls.isSupported()) {
          if (hlsRef.current) {
            hlsRef.current.destroy();
          }
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            manifestLoadingMaxRetry: 3,
            levelLoadingMaxRetry: 3,
          });

          hls.loadSource(currentUrl);
          hls.attachMedia(video);
          hlsRef.current = hls;

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            diagnostics.log('INFO', 'PLAYER', 'MANIFEST PARSED, STARTING PLAYBACK');
            video.play().then(() => {
              setSignalState('stable');
              diagnostics.log('INFO', 'PLAYER', 'SIGNAL STABLE');
              fadeIn();
            }).catch(handleError);
          });

          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (data.fatal) {
              diagnostics.log('ERROR', 'PLAYER', `FATAL HLS ERROR: ${data.type}`, data);
              handleError(data.type);
            }
          });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = currentUrl;
          const onLoadedMetadata = () => {
            video.play().then(() => {
              setSignalState('stable');
              fadeIn();
            }).catch(handleError);
          };
          video.addEventListener('loadedmetadata', onLoadedMetadata);
          video.addEventListener('error', handleError);

          return () => {
            video.removeEventListener('loadedmetadata', onLoadedMetadata);
            video.removeEventListener('error', handleError);
          };
        }
      } catch (err) {
        console.error("Failed to load stream:", err);
        setSignalState('unavailable');
      }
    };

    loadStream();
    resetOSDTimeout();

    return () => {
      isMounted = false;
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
      if (fadeIntervalRef.current) {
        clearInterval(fadeIntervalRef.current);
        fadeIntervalRef.current = null;
      }
    };
  }, [watchingChannel?.channelId, fallbackIndex, retryCount, resetOSDTimeout, selectedAreaCode, setSignalState, setRetryCount, setFallbackIndex, setLastPlaybackError, setAudioGain, getStreams, settings.playback.autoRetry, settings.playback.fallbackEnabled, settings.playback.normalization, settings.audio.masterVolume]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      resetOSDTimeout();
      
      switch (e.key) {
        case 'ArrowUp':
          nextChannel();
          break;
        case 'ArrowDown':
          prevChannel();
          break;
        case 'q':
        case 'Q':
          if (previousChannelId) {
            setIsRecall(true);
            recallChannel();
            setTimeout(() => setIsRecall(false), 2000);
          }
          break;
        case 'Enter':
          setShowInfo(prev => !prev);
          playSystemSound('confirm');
          break;
        case 'Escape':
        case 'Backspace':
          stopWatching();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextChannel, prevChannel, stopWatching, playSystemSound, resetOSDTimeout, previousChannelId, recallChannel]);

  if (!watchingChannel) return null;

  const identity = getChannelIdentity(watchingChannel.channelId);
  const accentColor = identity?.accentColor || '#00f2ff';

  return (
    <div className="w-full h-full bg-black flex items-center justify-center overflow-hidden">
      {/* Video Element */}
      <video 
        ref={videoRef} 
        className="w-full h-full object-cover"
        playsInline
      />

      {/* Signal State Overlay */}
      <SignalOverlay state={signalState} />

      {/* Error Recovery Screen */}
      <AnimatePresence>
        {(signalState === 'unavailable' || signalState === 'not-found') && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[200] bg-[#000810] flex flex-col items-center justify-center p-12"
          >
            <div className="w-full max-w-2xl glossy-panel p-12 border-4 border-red-900/50 flex flex-col items-center gap-8">
              <div className="w-24 h-24 rounded-full bg-red-950/30 flex items-center justify-center border-2 border-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
                <AlertCircle className="text-red-500" size={48} />
              </div>
              
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-black text-white italic tracking-widest uppercase">受信エラーが発生しました</h2>
                <p className="text-white/60 font-bold tracking-tight">
                  {signalState === 'not-found' ? '放送信号が見つかりません。チャンネル設定を確認してください。' : '一時的に受信できません。電波状況を確認してください。'}
                </p>
                {lastPlaybackError && (
                  <div className="mt-4 px-4 py-2 bg-black/40 rounded font-mono text-[10px] text-red-400/60 uppercase tracking-tighter">
                    ERROR_CODE: {lastPlaybackError}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4 w-full mt-4">
                <button 
                  onClick={() => {
                    setRetryCount(0);
                    setFallbackIndex(0);
                    setSignalState('acquiring');
                    playSystemSound('confirm');
                  }}
                  className="flex flex-col items-center gap-2 p-4 bg-white/5 border border-white/10 rounded hover:bg-white/10 transition-colors group"
                >
                  <RefreshCw className="text-[#00f2ff] group-hover:rotate-180 transition-transform duration-500" size={24} />
                  <span className="text-[10px] font-black text-white/60 uppercase">Retry</span>
                </button>
                <button 
                  onClick={() => {
                    nextChannel();
                  }}
                  className="flex flex-col items-center gap-2 p-4 bg-white/5 border border-white/10 rounded hover:bg-white/10 transition-colors group"
                >
                  <LayoutGrid className="text-[#00f2ff]" size={24} />
                  <span className="text-[10px] font-black text-white/60 uppercase">Switch</span>
                </button>
                <button 
                  onClick={() => {
                    stopWatching();
                  }}
                  className="flex flex-col items-center gap-2 p-4 bg-white/5 border border-white/10 rounded hover:bg-white/10 transition-colors group"
                >
                  <LayoutGrid className="text-[#00f2ff]" size={24} />
                  <span className="text-[10px] font-black text-white/60 uppercase">Guide</span>
                </button>
              </div>
            </div>
            
            <div className="mt-12 text-[10px] font-black text-white/20 tracking-[0.5em] uppercase italic">
              TV-PAL™ RECEIVER SYSTEM | SIGNAL RECOVERY MODE
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* OSD Overlay */}
      <AnimatePresence>
        {showOSD && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
            className="absolute bottom-12 left-12 right-12 z-[110]"
          >
            <div className="osd-panel p-6 flex items-end gap-8 border-l-4" style={{ borderLeftColor: accentColor }}>
              {/* Channel Info */}
              <div className="flex flex-col gap-1 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white rounded flex items-center justify-center overflow-hidden p-1 shrink-0 border border-white/10">
                    {identity?.logo ? (
                      <img src={identity.logo} alt={watchingChannel.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="text-[#001a2c] font-black text-xl">{watchingChannel.number}</span>
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-3xl font-black italic text-white tracking-tighter leading-none">
                      {watchingChannel.number}
                    </span>
                    <span className="text-lg font-bold uppercase tracking-tight leading-none mt-1" style={{ color: accentColor }}>
                      {identity?.shortName || watchingChannel.name}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-1">
                   <span className="badge-live">LIVE</span>
                   <span className="text-[10px] font-bold text-white/40 tracking-widest uppercase">
                     {identity?.broadcastType || watchingChannel.broad.toUpperCase()} BROADCAST
                   </span>
                </div>
              </div>

              {/* Program Info */}
              <div className="flex-1 min-w-0 flex flex-col justify-end pb-1">
                <div className="text-xl font-black text-white truncate mb-1 uppercase tracking-tight">
                  {currentProgram ? currentProgram.title : 'LIVE BROADCAST'}
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex-1 h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/10">
                    <div className="h-full shadow-[0_0_8px_currentColor]" style={{ width: `${progress}%`, backgroundColor: accentColor, color: accentColor }} />
                  </div>
                  <span className="text-xs font-mono text-white/60">
                    {currentProgram ? `${new Date(currentProgram.startUtc * 1000).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} - ${new Date(currentProgram.endUtc * 1000).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}` : '--:-- - --:--'}
                  </span>
                </div>
              </div>

              {/* System Stats */}
              <div className="flex flex-col items-end gap-1 shrink-0 opacity-60">
                <div className="flex items-center gap-2 text-[10px] font-black text-white">
                  <Volume2 size={12} style={{ color: accentColor }} />
                  STEREO
                </div>
                <div className="text-[10px] font-black text-white">
                  {settings.playback.quality === 'Auto' ? '1080i HD' : settings.playback.quality + ' MODE'}
                </div>
                <div className="text-[10px] font-black" style={{ color: accentColor }}>
                  {currentTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Extended Info Panel */}
      <AnimatePresence>
        {showInfo && (
          <motion.div
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 100, opacity: 0 }}
            className="absolute top-12 right-12 bottom-12 w-96 z-[120]"
          >
            <div className="glossy-panel h-full p-8 flex flex-col gap-6 border-r-4 border-r-[#ff00ff]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#ff00ff] rounded flex items-center justify-center shadow-[0_0_15px_#ff00ff]">
                  <Info className="text-white" size={24} />
                </div>
                <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">Program Info</h2>
              </div>

              <div className="flex-1 overflow-auto pr-2 custom-scrollbar">
                <div className="mb-6">
                  <div className="text-[#00f2ff] text-xs font-black tracking-widest mb-1 uppercase">Current Program</div>
                  <h3 className="text-xl font-bold text-white leading-tight mb-2">
                    {currentProgram ? currentProgram.title : 'Live Broadcast'}
                  </h3>
                  <div className="flex items-center gap-4 text-xs text-white/60 font-mono mb-4">
                    <span className="flex items-center gap-1"><Clock size={12} /> {currentProgram ? `${new Date(currentProgram.startUtc * 1000).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} - ${new Date(currentProgram.endUtc * 1000).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}` : '--:-- - --:--'}</span>
                    <span className="bg-white/10 px-2 py-0.5 rounded uppercase">{currentProgram?.genre || 'GENERAL'}</span>
                  </div>
                  <p className="text-sm text-white/70 leading-relaxed">
                    {currentProgram?.description || 'No description available for this broadcast.'}
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="text-[#ff00ff] text-xs font-black tracking-widest mb-1 uppercase">Next Program</div>
                  <div className="p-4 bg-black/30 border border-white/10 rounded">
                    <div className="text-xs font-mono text-white/40 mb-1">
                      {nextProgram ? `${new Date(nextProgram.startUtc * 1000).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} - ${new Date(nextProgram.endUtc * 1000).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}` : '--:--'}
                    </div>
                    <div className="text-sm font-bold text-white">
                      {nextProgram ? nextProgram.title : 'Coming Soon'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-white/10">
                <div className="flex items-center justify-between text-[10px] font-black text-white/40 tracking-widest">
                  <span>TV-PAL™ SYSTEM</span>
                  <span>OSD v2.0.05</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Channel Switch Indicator (Briefly shown on switch) */}
      <AnimatePresence mode="wait">
        <motion.div
          key={watchingChannel.channelId}
          initial={{ scale: 1.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="absolute top-12 left-12 bg-black/60 backdrop-blur-md px-6 py-3 border-l-4 border-l-[#00f2ff] z-[130] flex items-center gap-4"
        >
          <div className="text-4xl font-black text-white italic tracking-tighter">
            {watchingChannel.number}
          </div>
          {isRecall && (
            <div className="px-2 py-1 bg-[#00f2ff] text-black text-[10px] font-black italic tracking-widest uppercase rounded-sm">
              RECALL
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
