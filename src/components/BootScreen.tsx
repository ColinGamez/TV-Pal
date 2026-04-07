import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';

export const BootScreen: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [status, setStatus] = useState('SYSTEM INITIALIZING...');
  const [progress, setProgress] = useState(0);
  const [bootLogs, setBootLogs] = useState<string[]>([]);

  useEffect(() => {
    const logs = [
      'TV-PAL™ BIOS v2.0.05 (C) 2006-2010',
      'CPU: MIPS R5900 294.912 MHz',
      'MEMORY: 32MB RDRAM CHECK... OK',
      'I/O CONTROLLER: INITIALIZING...',
      'NETWORK: CONNECTING TO SATELLITE...',
      'SIGNAL: 1080i DIGITAL BROADCAST DETECTED',
      'CHANNEL SCAN: 001... 002... 003... 004...',
      'EPG DATA: DOWNLOADING 24H SCHEDULE...',
      'SYSTEM READY.'
    ];

    const sequence = [
      { status: 'SYSTEM INITIALIZING...', delay: 500, progress: 10, logIdx: 0 },
      { status: 'MEMORY CHECK...', delay: 800, progress: 30, logIdx: 2 },
      { status: 'NETWORK CONNECTING...', delay: 1200, progress: 50, logIdx: 4 },
      { status: 'CHANNEL SCANNING...', delay: 1500, progress: 75, logIdx: 6 },
      { status: 'EPG DATA LOADING...', delay: 1000, progress: 90, logIdx: 7 },
      { status: 'TV-PAL™ READY', delay: 500, progress: 100, logIdx: 8 },
    ];

    let currentStep = 0;
    let isMounted = true;

    const runSequence = async () => {
      if (!isMounted) return;

      if (currentStep < sequence.length) {
        const step = sequence[currentStep];
        
        // Real health check on network step
        if (step.status === 'NETWORK CONNECTING...') {
          try {
            const res = await fetch('/api/health');
            const data = await res.json();
            if (data.status !== 'ok') throw new Error('Backend unhealthy');
          } catch (e) {
            setStatus('NETWORK ERROR - RETRYING...');
            setBootLogs(prev => [...prev, 'ERR: BACKEND UNREACHABLE. CHECKING LOCAL CACHE...']);
            await new Promise(r => setTimeout(r, 2000));
          }
        }

        setStatus(step.status);
        setProgress(step.progress);
        setBootLogs(prev => [...prev, logs[step.logIdx]]);
        
        setTimeout(() => {
          currentStep++;
          runSequence();
        }, step.delay);
      } else {
        setTimeout(() => {
          if (isMounted) onComplete();
        }, 800);
      }
    };

    runSequence();
    return () => { isMounted = false; };
  }, [onComplete]);

  return (
    <motion.div 
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.5, ease: "easeInOut" }}
      className="fixed inset-0 boot-screen"
    >
      <div className="screen-effects">
        <div className="scanlines" />
        <div className="pixel-grid" />
      </div>
      
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        className="text-center flex flex-col items-center"
      >
        <h1 className="boot-logo">テレビパル<span className="text-sm align-top">™</span></h1>
        
        <div className="boot-info font-mono">
          {bootLogs.map((log, i) => (
            <div key={i} className="animate-in fade-in slide-in-from-left-4 duration-300">
              {log}
            </div>
          ))}
        </div>

        <div className="space-y-4 flex flex-col items-center mt-8">
          <div className="boot-loader">
            <motion.div 
              className="boot-loader-bar"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, ease: "easeInOut" }}
            />
          </div>
          
          <p className="text-[#00f2ff] font-black tracking-[0.3em] text-[10px] uppercase opacity-60 animate-pulse">
            {status}
          </p>
        </div>
      </motion.div>
      
      <div className="absolute bottom-10 text-white/10 text-[8px] font-bold tracking-[0.8em] uppercase italic">
        Hardware Revision 73KQ-X / Digital Media Center
      </div>
    </motion.div>
  );
};
