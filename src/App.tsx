import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { TVGuide } from './components/TVGuide';
import { ChannelPage } from './components/ChannelPage';
import { ProgramDetail } from './components/ProgramDetail';
import { BootScreen } from './components/BootScreen';
import { SearchScreen } from './components/SearchScreen';
import { DiscoveryRails } from './components/DiscoveryRails';
import { SystemOverlay } from './components/SystemOverlay';
import { ActivityTicker } from './components/ActivityTicker';
import { PROFILE_ICONS } from './constants/profileAssets';
import { ProfileSelector } from './components/ProfileSelector';
import { SystemProvider, useSystem } from './context/SystemContext';
import { Monitor, Calendar, Tv, Settings, Bell, User } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

import { TVPlayer } from './components/TVPlayer';
import { SystemSetup } from './components/SystemSetup';
import { SettingsMenu } from './components/SettingsMenu';
import { ReservationList } from './components/ReservationList';

const Navigation = () => {
  const location = useLocation();
  const { playSystemSound, setIsSettingsVisible, currentProfile, setIsProfileSelectorVisible } = useSystem();
  
  const getProfileIcon = (id: string) => {
    const asset = PROFILE_ICONS.find(i => i.id === id);
    return asset ? asset.icon : User;
  };

  const ProfileIcon = currentProfile ? getProfileIcon(currentProfile.iconId) : User;

  return (
    <nav className="h-12 flex items-center px-4 bg-[#001224] border-b border-[#333] relative z-50 shrink-0">
      <div className="flex items-center gap-2 mr-8">
        <div className="w-7 h-7 bg-gradient-to-br from-[#00f2ff] to-[#00a3e0] rounded-sm flex items-center justify-center shadow-[0_0_8px_#00f2ff] border border-white/30">
          <Tv className="text-[#001224]" size={16} />
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-sm font-black tracking-tighter text-white italic uppercase leading-none">TV-PAL<span className="text-[8px] align-top ml-0.5">™</span></span>
          <span className="text-[7px] font-bold text-[#00f2ff] tracking-[0.2em] uppercase opacity-60">SYSTEM INTERFACE</span>
        </div>
      </div>
      
      <div className="flex h-full items-center gap-1">
        <NavLink to="/" active={location.pathname === "/"} icon={<Calendar size={14} />} label="GUIDE" onClick={() => playSystemSound('click')} />
        <NavLink to="/reservations" active={location.pathname === "/reservations"} icon={<Bell size={14} />} label="RESERVATIONS" onClick={() => playSystemSound('click')} />
        <NavLink to="/discovery" active={location.pathname === "/discovery"} icon={<Monitor size={14} />} label="DISCOVER" onClick={() => playSystemSound('click')} />
        <NavLink to="/search" active={location.pathname === "/search"} icon={<Tv size={14} />} label="SEARCH" onClick={() => playSystemSound('click')} />
        <button 
          onClick={() => {
            playSystemSound('confirm');
            setIsSettingsVisible(true);
          }}
          className="h-full px-4 flex items-center gap-2 transition-all relative group hover:bg-[#1a3a5a]/30"
        >
          <span className="text-white/40 group-hover:text-white/80"><Settings size={14} /></span>
          <span className="text-[10px] font-black tracking-widest uppercase text-white/40 group-hover:text-white/80">SETTINGS</span>
        </button>
      </div>

      <div className="ml-auto flex items-center gap-4">
        {currentProfile && (
          <div 
            className="flex items-center gap-3 px-3 py-1 bg-white/5 rounded-full border border-white/10 cursor-pointer hover:bg-white/10 transition-all"
            onClick={() => {
              playSystemSound('confirm');
              setIsProfileSelectorVisible(true);
            }}
          >
            <div 
              className="w-6 h-6 rounded-full flex items-center justify-center border"
              style={{ borderColor: currentProfile.color, backgroundColor: `${currentProfile.color}20` }}
            >
              <ProfileIcon size={12} style={{ color: currentProfile.color }} />
            </div>
            <span className="text-[10px] font-black italic tracking-tighter text-white/80 uppercase">{currentProfile.name}</span>
          </div>
        )}
        <div className="flex flex-col items-end leading-none">
          <div className="text-[10px] font-black text-white tracking-tighter">
            {new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="text-[7px] font-bold text-[#00f2ff] tracking-widest uppercase opacity-40">STATION SYNC OK</div>
        </div>
        <div className="w-2 h-2 bg-[#00f2ff] rounded-full shadow-[0_0_5px_#00f2ff] animate-pulse" />
      </div>
    </nav>
  );
};

const NavLink = ({ to, active, icon, label, onClick }: { to: string, active: boolean, icon: React.ReactNode, label: string, onClick: () => void }) => (
  <Link 
    to={to} 
    onClick={onClick}
    className={`h-full px-4 flex items-center gap-2 transition-all relative group ${active ? 'bg-[#1a3a5a]/60' : 'hover:bg-[#1a3a5a]/30'}`}
  >
    <span className={`${active ? 'text-[#00f2ff]' : 'text-white/40 group-hover:text-white/80'}`}>{icon}</span>
    <span className={`text-[10px] font-black tracking-widest uppercase ${active ? 'text-white' : 'text-white/40 group-hover:text-white/80'}`}>{label}</span>
    {active && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00f2ff] shadow-[0_0_10px_#00f2ff]" />}
  </Link>
);

const ReservationNotification = () => {
  const { activeNotification, clearNotification, startWatching, playSystemSound } = useSystem();
  const navigate = useNavigate();

  if (!activeNotification) return null;

  return (
    <motion.div
      initial={{ x: 400, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 400, opacity: 0 }}
      className="fixed top-16 right-6 z-[200] w-80 glossy-panel border-l-4 border-l-[#cc00cc] bg-[#001224] p-4 shadow-[0_10px_40px_rgba(0,0,0,0.8)]"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-[#cc00cc] rounded flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(204,0,204,0.5)]">
          <Bell className="text-white" size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-black text-[#cc00cc] tracking-widest uppercase mb-1">視聴予約のお知らせ</div>
          <h4 className="text-sm font-black text-white italic truncate leading-tight mb-1">{activeNotification.title}</h4>
          <p className="text-[10px] font-bold text-white/40 uppercase">まもなく開始します ({activeNotification.channelName})</p>
          
          <div className="mt-3 flex gap-2">
            <button 
              onClick={() => {
                playSystemSound('confirm');
                startWatching(activeNotification.channelId);
                clearNotification();
                navigate('/');
              }}
              className="flex-1 py-1.5 bg-[#cc00cc] text-white text-[10px] font-black uppercase hover:brightness-110 transition-all"
            >
              切り替える
            </button>
            <button 
              onClick={() => {
                playSystemSound('back');
                clearNotification();
              }}
              className="px-3 py-1.5 bg-white/5 text-white/40 text-[10px] font-black uppercase hover:bg-white/10 transition-all"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const AppContent = () => {
  const [isBooting, setIsBooting] = useState(true);
  const [isCursorHidden, setIsCursorHidden] = useState(false);
  const cursorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const location = useLocation();
  
  const { 
    watchingProgram, 
    isGuideVisible, 
    atmosphere, 
    isIdle, 
    isWatching, 
    setupComplete, 
    isSettingUp,
    settings,
    isSettingsVisible,
    currentProfile,
    isProfileSelectorVisible,
    resetIdleTimer,
    isStandby,
    setIsStandby
  } = useSystem();

  // Cursor auto-hide for TV mode
  useEffect(() => {
    const handleMouseMove = () => {
      setIsCursorHidden(false);
      resetIdleTimer();
      if (cursorTimeoutRef.current) clearTimeout(cursorTimeoutRef.current);
      
      if (isWatching) {
        cursorTimeoutRef.current = setTimeout(() => {
          setIsCursorHidden(true);
        }, 3000);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('keydown', handleMouseMove);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('keydown', handleMouseMove);
      if (cursorTimeoutRef.current) clearTimeout(cursorTimeoutRef.current);
    };
  }, [isWatching, resetIdleTimer]);

  const bloomOpacity = settings.display.bloomStrength === 'High' ? 0.4 : settings.display.bloomStrength === 'Normal' ? 0.2 : 0.1;

  return (
    <div 
      className={`h-screen w-screen relative bg-[#000810] overflow-hidden ${isIdle ? 'idle-active' : ''} ${isStandby ? 'standby-active' : ''} ${isCursorHidden ? 'cursor-none' : ''}`} 
      data-atmosphere={atmosphere}
    >
      <AnimatePresence mode="wait">
        {isBooting && !isSettingUp && setupComplete && (
          <BootScreen key="boot" onComplete={() => setIsBooting(false)} />
        )}
        
        {(!setupComplete || isSettingUp) && (
          <SystemSetup key="setup" />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSettingsVisible && <SettingsMenu key="settings" />}
      </AnimatePresence>

      {/* Profile Selector */}
      <AnimatePresence>
        {(!currentProfile || isProfileSelectorVisible) && <ProfileSelector key="profiles" />}
      </AnimatePresence>

      <AnimatePresence>
        <ReservationNotification />
      </AnimatePresence>

      {/* Main System UI */}
      <div className={`relative w-full h-full transition-opacity duration-1000 ${(!setupComplete || isSettingUp) ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <div className="bg-ambient" />
        
        <div className="h-full flex flex-col relative z-10">
          <div className={`transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${isGuideVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full pointer-events-none'}`}>
            <Navigation />
          </div>

          <ActivityTicker />
          
          <main className={`flex-1 relative transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${watchingProgram && isGuideVisible ? 'h-auto' : 'h-full'}`}>
            <AnimatePresence mode="wait">
              <Routes location={location} key={location.pathname}>
                <Route path="/" element={
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
                    className="h-full"
                  >
                    <TVGuide />
                  </motion.div>
                } />
                <Route path="/channel/:channelId" element={
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.05 }}
                    transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
                    className="h-full"
                  >
                    <ChannelPage />
                  </motion.div>
                } />
                <Route path="/program/:listingId" element={
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
                    className="h-full"
                  >
                    <ProgramDetail />
                  </motion.div>
                } />
                <Route path="/reservations" element={
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
                    className="h-full"
                  >
                    <ReservationList />
                  </motion.div>
                } />
                <Route path="/search" element={
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
                    className="h-full"
                  >
                    <SearchScreen />
                  </motion.div>
                } />
                <Route path="/discovery" element={
                  <motion.div
                    initial={{ opacity: 0, scale: 1.1 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
                    className="h-full"
                  >
                    <DiscoveryRails />
                  </motion.div>
                } />
              </Routes>
            </AnimatePresence>
          </main>

          <SystemOverlay />
        </div>
      </div>

      {/* TV Playback Mode */}
      <AnimatePresence>
        {isWatching && (
          <motion.div
            initial={{ scale: 1.1, filter: 'blur(10px) brightness(2)', opacity: 0 }}
            animate={{ scale: 1, filter: 'blur(0) brightness(1)', opacity: 1 }}
            exit={{ scale: 0.9, filter: 'blur(5px)', opacity: 0 }}
            transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
            className="fixed inset-0 z-[100]"
          >
            <TVPlayer />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Screen Effects Layer */}
      <div className="screen-effects">
        {settings.display.scanlines && <div className="scanlines" />}
        <div className="pixel-grid" />
        {settings.display.vignette && <div className="vignette" />}
        <div className="bloom" style={{ opacity: bloomOpacity }} />
      </div>

      {/* Idle Mode Elements */}
      <div className="idle-overlay" />
      {isIdle && !isStandby && (
        <div className="idle-message animate-pulse">
          SYSTEM STANDBY... PRESS ANY KEY
        </div>
      )}

      {/* Standby Mode Elements */}
      <AnimatePresence>
        {isStandby && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] bg-black flex flex-col items-center justify-center cursor-none"
            onClick={() => {
              setIsStandby(false);
              resetIdleTimer();
            }}
          >
            <div className="w-2 h-2 bg-red-600 rounded-full shadow-[0_0_10px_rgba(220,38,38,0.8)] mb-4 animate-pulse" />
            <div className="text-[10px] font-black text-white/20 tracking-[0.5em] uppercase italic">
              STANDBY
            </div>
            <div className="mt-20 text-[8px] font-bold text-white/5 uppercase tracking-widest">
              PRESS ANY KEY TO WAKE
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function App() {
  return (
    <SystemProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </SystemProvider>
  );
}
