import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { CHANNEL_IDENTITIES, ChannelIdentity } from '../constants/channelIdentities';
import { diagnostics } from '../lib/diagnostics';

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

interface PresenceInfo {
  viewers: number;
  reactions: {
    like: number;
    eyes: number;
    fire: number;
  };
  isTrending?: boolean;
}

interface ActivityEvent {
  id: string;
  message: string;
  timestamp: number;
  type: 'watch' | 'switch' | 'reaction';
}

interface Favorites {
  channels: string[];
  programs: string[];
}

type ReservationType = 'reminder' | 'auto-tune';

interface Reservation {
  listingId: string;
  title: string;
  startTime: number;
  endTime: number;
  channelId: string;
  channelName: string;
  type: ReservationType;
  status: 'pending' | 'active' | 'completed' | 'missed';
  createdAt: number;
}

interface Session {
  lastChannelId: string | null;
  lastProgramId: string | null;
  lastTime: number | null;
  recentChannels: string[];
}

interface Profile {
  id: string;
  name: string;
  iconId: string;
  color: string;
  favorites: Favorites;
  reservations: Reservation[];
  session: Session;
  settings: SystemSettings;
  createdAt: number;
  channelOrder?: string[];
  hiddenChannels?: string[];
}

interface SystemSettings {
  playback: {
    quality: 'Auto' | 'HD' | 'SD';
    autoRetry: boolean;
    fallbackEnabled: boolean;
    transitionEffect: 'Standard' | 'Fast' | 'Smooth';
    normalization: boolean;
  };
  audio: {
    masterVolume: number;
    uiSounds: boolean;
    ambientSound: boolean;
  };
  display: {
    scanlines: boolean;
    bloomStrength: 'Low' | 'Normal' | 'High';
    vignette: boolean;
    attractMode: boolean;
    themeMode: 'Auto' | 'Morning' | 'Day' | 'Evening' | 'Late-Night';
  };
  timer: {
    sleepTimer: number | null;
  };
}

interface Channel {
  channelId: string;
  number: string;
  name: string;
  group: string;
  broad: string;
  identity?: ChannelIdentity;
  quality?: 'HD' | 'SD' | '4K';
}

interface StreamSource {
  url: string;
  label?: string;
  priority: number;
  health: 'online' | 'degraded' | 'offline';
  gainOffset?: number;
}

interface SystemContextType {
  watchingProgram: Program | null;
  setWatchingProgram: (program: Program | null) => void;
  isGuideVisible: boolean;
  setIsGuideVisible: (visible: boolean) => void;
  playSystemSound: (type: 'click' | 'confirm' | 'back' | 'error' | 'transition') => void;
  presence: Record<string, PresenceInfo>;
  activityLog: ActivityEvent[];
  addReaction: (listingId: string, type: 'like' | 'eyes' | 'fire') => void;
  favorites: Favorites;
  toggleFavoriteChannel: (channelId: string) => void;
  toggleFavoriteProgram: (programId: string) => void;
  reservations: Reservation[];
  addReservation: (program: Program, channelName: string, type: ReservationType) => { success: boolean; conflict?: Reservation };
  removeReservation: (listingId: string) => void;
  isReservationActive: (listingId: string) => boolean;
  activeNotification: Reservation | null;
  clearNotification: () => void;
  previousChannelId: string | null;
  recallChannel: () => void;
  session: Session;
  updateSession: (session: Partial<Session>) => void;
  atmosphere: 'morning' | 'day' | 'evening' | 'late-night';
  isIdle: boolean;
  resetIdleTimer: () => void;
  isStandby: boolean;
  setIsStandby: (val: boolean) => void;
  sleepTimerRemaining: number | null;
  isSleepTimerWarning: boolean;
  setSleepTimer: (minutes: number | null) => void;
  cancelSleepTimer: () => void;
  extendSleepTimer: (minutes: number) => void;
  // Playback state
  isWatching: boolean;
  watchingChannel: Channel | null;
  startWatching: (channelId: string) => void;
  stopWatching: () => void;
  nextChannel: () => void;
  prevChannel: () => void;
  getChannelIdentity: (channelId: string) => ChannelIdentity | null;
  getStreams: (channelId: string) => Promise<StreamSource[]>;
  channels: Channel[];
  orderedChannels: Channel[];
  visibleChannels: Channel[];
  toggleChannelVisibility: (channelId: string) => void;
  moveChannel: (channelId: string, direction: 'up' | 'down') => void;
  resetChannelLineup: () => void;
  guide: Record<string, Program[]>;
  setGuide: (guide: Record<string, Program[]>) => void;
  // Setup state
  setupComplete: boolean;
  selectedPrefecture: string | null;
  selectedAreaCode: string | null;
  completeSetup: (prefecture: string, areaCode: string) => void;
  isSettingUp: boolean;
  setIsSettingUp: (val: boolean) => void;
  // Settings
  settings: SystemSettings;
  updateSettings: (newSettings: Partial<SystemSettings>) => void;
  isSettingsVisible: boolean;
  setIsSettingsVisible: (visible: boolean) => void;
  resetSystem: () => void;
  // Detailed Playback State
  signalState: 'acquiring' | 'switching' | 'unavailable' | 'not-found' | 'stable';
  setSignalState: (state: 'acquiring' | 'switching' | 'unavailable' | 'not-found' | 'stable') => void;
  retryCount: number;
  setRetryCount: (count: number) => void;
  fallbackIndex: number;
  setFallbackIndex: (index: number) => void;
  lastPlaybackError: string | null;
  setLastPlaybackError: (error: string | null) => void;
  audioGain: number;
  setAudioGain: (gain: number) => void;
  // Profile state
  profiles: Profile[];
  currentProfile: Profile | null;
  createProfile: (name: string, iconId: string, color: string) => void;
  updateProfile: (id: string, updates: Partial<Profile>) => void;
  deleteProfile: (id: string) => void;
  switchProfile: (id: string) => void;
  isProfileSelectorVisible: boolean;
  setIsProfileSelectorVisible: (visible: boolean) => void;
}

const SystemContext = createContext<SystemContextType | undefined>(undefined);

export const SystemProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [watchingProgram, setWatchingProgram] = useState<Program | null>(null);
  const [isGuideVisible, setIsGuideVisible] = useState(true);
  const [presence, setPresence] = useState<Record<string, PresenceInfo>>({});
  const [activityLog, setActivityLog] = useState<ActivityEvent[]>([]);
  const [isIdle, setIsIdle] = useState(false);
  const [isStandby, setIsStandby] = useState(false);
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState<number | null>(null);
  const [isSleepTimerWarning, setIsSleepTimerWarning] = useState(false);
  const idleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resetIdleTimer = useCallback(() => {
    setIsIdle(false);
    if (isStandby) setIsStandby(false);
    if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
    idleTimeoutRef.current = setTimeout(() => {
      setIsIdle(true);
    }, 60000); // 1 minute idle
  }, []);
  const [atmosphere, setAtmosphere] = useState<'morning' | 'day' | 'evening' | 'late-night'>('day');
  const [guide, setGuide] = useState<Record<string, Program[]>>({});
  
  const [setupComplete, setSetupComplete] = useState<boolean>(() => {
    return localStorage.getItem('tvpal_setup_complete') === 'true';
  });
  const [selectedPrefecture, setSelectedPrefecture] = useState<string | null>(() => {
    return localStorage.getItem('tvpal_prefecture');
  });
  const [selectedAreaCode, setSelectedAreaCode] = useState<string | null>(() => {
    return localStorage.getItem('tvpal_area_code');
  });
  const [isSettingUp, setIsSettingUp] = useState(!setupComplete);
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);

  // Detailed Playback State
  const [signalState, setSignalState] = useState<'acquiring' | 'switching' | 'unavailable' | 'not-found' | 'stable'>('stable');
  const [retryCount, setRetryCount] = useState(0);
  const [fallbackIndex, setFallbackIndex] = useState(0);
  const [lastPlaybackError, setLastPlaybackError] = useState<string | null>(null);
  const [audioGain, setAudioGain] = useState(0);

  // Profile State
  const [profiles, setProfiles] = useState<Profile[]>(() => {
    const saved = localStorage.getItem('tvpal_profiles');
    if (saved) return JSON.parse(saved);
    return [];
  });

  const [currentProfileId, setCurrentProfileId] = useState<string | null>(() => {
    return localStorage.getItem('tvpal_current_profile_id');
  });

  const [isProfileSelectorVisible, setIsProfileSelectorVisible] = useState(false);

  const currentProfile = profiles.find(p => p.id === currentProfileId) || null;

  const DEFAULT_SETTINGS: SystemSettings = {
    playback: {
      quality: 'Auto',
      autoRetry: true,
      fallbackEnabled: true,
      transitionEffect: 'Standard',
      normalization: true,
    },
    audio: {
      masterVolume: 50,
      uiSounds: true,
      ambientSound: true,
    },
    display: {
      scanlines: true,
      bloomStrength: 'Normal',
      vignette: true,
      attractMode: true,
      themeMode: 'Auto',
    },
    timer: {
      sleepTimer: null,
    }
  };

  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [favorites, setFavorites] = useState<Favorites>({ channels: [], programs: [] });
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [session, setSession] = useState<Session>({ lastChannelId: null, lastProgramId: null, lastTime: null, recentChannels: [] });

  // Sync state with current profile
  useEffect(() => {
    if (currentProfile) {
      setSettings(currentProfile.settings);
      setFavorites(currentProfile.favorites);
      setReservations(currentProfile.reservations);
      setSession(currentProfile.session);
    } else {
      // If no profile selected, use defaults
      setSettings(DEFAULT_SETTINGS);
      setFavorites({ channels: [], programs: [] });
      setReservations([]);
      setSession({ lastChannelId: null, lastProgramId: null, lastTime: null, recentChannels: [] });
    }
  }, [currentProfileId]); // Only re-sync when profile ID changes

  // Persist profiles to localStorage
  useEffect(() => {
    if (profiles.length > 0) {
      localStorage.setItem('tvpal_profiles', JSON.stringify(profiles));
    }
  }, [profiles]);

  // Update current profile data whenever local state changes
  useEffect(() => {
    if (!currentProfileId) return;
    setProfiles(prev => prev.map(p => {
      if (p.id === currentProfileId) {
        return {
          ...p,
          settings,
          favorites,
          reservations,
          session
        };
      }
      return p;
    }));
  }, [settings, favorites, reservations, session, currentProfileId]);

  const updateSettings = useCallback((newSettings: Partial<SystemSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  const playSystemSound = useCallback((type: 'click' | 'confirm' | 'back' | 'error' | 'transition') => {
    if (!settings.audio.uiSounds) return;
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    const now = audioCtx.currentTime;
    const masterVol = settings.audio.masterVolume / 100;

    switch (type) {
      case 'click':
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(800, now);
        oscillator.frequency.exponentialRampToValueAtTime(400, now + 0.08);
        gainNode.gain.setValueAtTime(0.1 * masterVol, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01 * masterVol, now + 0.08);
        oscillator.start(now);
        oscillator.stop(now + 0.08);
        break;
      case 'confirm':
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(600, now);
        oscillator.frequency.exponentialRampToValueAtTime(1200, now + 0.15);
        gainNode.gain.setValueAtTime(0.1 * masterVol, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01 * masterVol, now + 0.15);
        oscillator.start(now);
        oscillator.stop(now + 0.15);
        break;
      case 'back':
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(1000, now);
        oscillator.frequency.exponentialRampToValueAtTime(500, now + 0.12);
        gainNode.gain.setValueAtTime(0.1 * masterVol, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01 * masterVol, now + 0.12);
        oscillator.start(now);
        oscillator.stop(now + 0.12);
        break;
      case 'error':
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(200, now);
        gainNode.gain.setValueAtTime(0.1 * masterVol, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01 * masterVol, now + 0.25);
        oscillator.start(now);
        oscillator.stop(now + 0.25);
        break;
      case 'transition':
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(1200, now);
        oscillator.frequency.exponentialRampToValueAtTime(1500, now + 0.5);
        gainNode.gain.setValueAtTime(0.02 * masterVol, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001 * masterVol, now + 0.5);
        oscillator.start(now);
        oscillator.stop(now + 0.5);
        break;
    }
  }, [settings.audio.uiSounds, settings.audio.masterVolume]);

  const setSleepTimer = useCallback((minutes: number | null) => {
    updateSettings({ timer: { sleepTimer: minutes } });
    if (minutes) {
      setSleepTimerRemaining(minutes * 60);
      setIsSleepTimerWarning(false);
      diagnostics.log('SYSTEM', 'TIMER', `SLEEP TIMER SET: ${minutes} MIN`);
    } else {
      setSleepTimerRemaining(null);
      setIsSleepTimerWarning(false);
      diagnostics.log('SYSTEM', 'TIMER', 'SLEEP TIMER DISABLED');
    }
  }, [updateSettings]);

  const cancelSleepTimer = useCallback(() => {
    setSleepTimer(null);
    playSystemSound('back');
  }, [setSleepTimer, playSystemSound]);

  const extendSleepTimer = useCallback((minutes: number) => {
    setSleepTimerRemaining(prev => (prev !== null ? prev + minutes * 60 : null));
    setIsSleepTimerWarning(false);
    playSystemSound('confirm');
    diagnostics.log('SYSTEM', 'TIMER', `SLEEP TIMER EXTENDED BY ${minutes} MIN`);
  }, [playSystemSound]);

  // Sleep Timer Logic
  useEffect(() => {
    if (sleepTimerRemaining === null) return;

    const interval = setInterval(() => {
      setSleepTimerRemaining(prev => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(interval);
          setIsStandby(true);
          setSleepTimer(null);
          return 0;
        }
        
        // Warning at 1 minute (60 seconds)
        if (prev === 61) {
          setIsSleepTimerWarning(true);
          playSystemSound('error');
        }

        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [sleepTimerRemaining, setSleepTimer, playSystemSound]);

  useEffect(() => {
    if (isStandby) {
      setIsWatching(false);
      setWatchingChannel(null);
      setIsGuideVisible(true);
      setSignalState('stable');
      diagnostics.log('SYSTEM', 'TIMER', 'SLEEP TIMER EXPIRED - ENTERING STANDBY');
    }
  }, [isStandby]);

  const resetSystem = useCallback(() => {
    localStorage.clear();
    window.location.reload();
  }, []);

  // Playback state
  const [isWatching, setIsWatching] = useState(false);
  const [watchingChannel, setWatchingChannel] = useState<Channel | null>(null);
  const [lastViewedChannelId, setLastViewedChannelId] = useState<string | null>(null);
  const [previousChannelId, setPreviousChannelId] = useState<string | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);

  const orderedChannels = React.useMemo(() => {
    if (!currentProfile) return channels;
    const order = currentProfile.channelOrder || [];
    if (order.length === 0) return channels;

    const ordered = [...channels].sort((a, b) => {
      const aIdx = order.indexOf(a.channelId);
      const bIdx = order.indexOf(b.channelId);
      
      if (aIdx === -1 && bIdx === -1) return 0;
      if (aIdx === -1) return 1;
      if (bIdx === -1) return -1;
      return aIdx - bIdx;
    });

    return ordered;
  }, [channels, currentProfile]);

  const visibleChannels = React.useMemo(() => {
    if (!currentProfile) return orderedChannels;
    const hidden = currentProfile.hiddenChannels || [];
    return orderedChannels.filter(ch => !hidden.includes(ch.channelId));
  }, [orderedChannels, currentProfile]);

  const updateProfile = useCallback((id: string, updates: Partial<Profile>) => {
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  }, []);

  const toggleChannelVisibility = useCallback((channelId: string) => {
    if (!currentProfile) return;
    const hidden = currentProfile.hiddenChannels || [];
    const newHidden = hidden.includes(channelId)
      ? hidden.filter(id => id !== channelId)
      : [...hidden, channelId];
    
    updateProfile(currentProfile.id, { hiddenChannels: newHidden });
    playSystemSound('confirm');
    diagnostics.log('SYSTEM', 'CHANNELS', `TOGGLE VISIBILITY: ${channelId} -> ${newHidden.includes(channelId) ? 'HIDDEN' : 'VISIBLE'}`);
  }, [currentProfile, updateProfile, playSystemSound]);

  const moveChannel = useCallback((channelId: string, direction: 'up' | 'down') => {
    if (!currentProfile) return;
    
    // Use orderedChannels as base for moving
    const currentOrder = orderedChannels.map(ch => ch.channelId);
    const idx = currentOrder.indexOf(channelId);
    if (idx === -1) return;

    const newOrder = [...currentOrder];
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;

    if (targetIdx >= 0 && targetIdx < newOrder.length) {
      [newOrder[idx], newOrder[targetIdx]] = [newOrder[targetIdx], newOrder[idx]];
      updateProfile(currentProfile.id, { channelOrder: newOrder });
      playSystemSound('confirm');
      diagnostics.log('SYSTEM', 'CHANNELS', `MOVE CHANNEL: ${channelId} ${direction}`);
    } else {
      playSystemSound('error');
    }
  }, [currentProfile, orderedChannels, updateProfile, playSystemSound]);

  const resetChannelLineup = useCallback(() => {
    if (!currentProfile) return;
    updateProfile(currentProfile.id, { channelOrder: [], hiddenChannels: [] });
    playSystemSound('confirm');
    diagnostics.log('SYSTEM', 'CHANNELS', 'RESET CHANNEL LINEUP');
  }, [currentProfile, updateProfile, playSystemSound]);

  const createProfile = useCallback((name: string, iconId: string, color: string) => {
    const newProfile: Profile = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      iconId,
      color,
      favorites: { channels: [], programs: [] },
      reservations: [],
      session: { lastChannelId: null, lastProgramId: null, lastTime: null, recentChannels: [] },
      settings: DEFAULT_SETTINGS,
      createdAt: Date.now()
    };
    setProfiles(prev => [...prev, newProfile]);
    playSystemSound('confirm');
    return newProfile.id;
  }, [playSystemSound]);

  const deleteProfile = useCallback((id: string) => {
    setProfiles(prev => prev.filter(p => p.id !== id));
    if (currentProfileId === id) {
      setCurrentProfileId(null);
      localStorage.removeItem('tvpal_current_profile_id');
    }
    playSystemSound('back');
  }, [currentProfileId, playSystemSound]);

  const switchProfile = useCallback((id: string) => {
    setCurrentProfileId(id);
    localStorage.setItem('tvpal_current_profile_id', id);
    setIsProfileSelectorVisible(false);
    playSystemSound('confirm');
  }, [playSystemSound]);
  
  const completeSetup = useCallback((prefecture: string, areaCode: string) => {
    setSetupComplete(true);
    setSelectedPrefecture(prefecture);
    setSelectedAreaCode(areaCode);
    setIsSettingUp(false);
    localStorage.setItem('tvpal_setup_complete', 'true');
    localStorage.setItem('tvpal_prefecture', prefecture);
    localStorage.setItem('tvpal_area_code', areaCode);
    playSystemSound('confirm');
  }, [playSystemSound]);

  const ambientAudioRef = useRef<{ hum: OscillatorNode; gain: GainNode } | null>(null);

  // Fetch channels on mount or when areaCode changes
  useEffect(() => {
    if (!setupComplete && !isSettingUp) return;
    
    const fetchChannels = async () => {
      try {
        diagnostics.log('SYSTEM', 'NETWORK', 'FETCHING CHANNELS...', { area: selectedAreaCode });
        const url = selectedAreaCode ? `/api/channels?area=${selectedAreaCode}` : '/api/channels';
        const res = await fetch(url);
        const data = await res.json();
        setChannels(data);
        diagnostics.log('INFO', 'NETWORK', `CHANNELS LOADED: ${data.length} CH`);
      } catch (e) {
        diagnostics.log('ERROR', 'NETWORK', 'FAILED TO FETCH CHANNELS', e);
        console.error("Failed to fetch channels", e);
      }
    };
    fetchChannels();
  }, [selectedAreaCode, setupComplete, isSettingUp]);

  const startWatching = useCallback((channelId: string) => {
    if (lastViewedChannelId === channelId) {
      setIsWatching(true);
      setIsGuideVisible(false);
      return;
    }

    const channel = channels.find(ch => ch.channelId === channelId);
    if (channel) {
      if (lastViewedChannelId) {
        setPreviousChannelId(lastViewedChannelId);
      }
      setLastViewedChannelId(channelId);
      setWatchingChannel(channel);
      setIsWatching(true);
      setIsGuideVisible(false);
      setSignalState('switching');
      setRetryCount(0);
      setFallbackIndex(0);
      setLastPlaybackError(null);
      playSystemSound('transition');
      
      // Update recent channels
      setSession(prev => ({
        ...prev,
        lastChannelId: channelId,
        recentChannels: [channelId, ...prev.recentChannels.filter(id => id !== channelId)].slice(0, 10)
      }));
    }
  }, [channels, playSystemSound, lastViewedChannelId]);

  const stopWatching = useCallback(() => {
    setIsWatching(false);
    setWatchingChannel(null);
    setIsGuideVisible(true);
    setSignalState('stable');
    playSystemSound('back');
  }, [playSystemSound]);

  const recallChannel = useCallback(() => {
    if (previousChannelId) {
      startWatching(previousChannelId);
    }
  }, [previousChannelId, startWatching]);

  const nextChannel = useCallback(() => {
    if (!watchingChannel) return;
    const list = visibleChannels;
    if (list.length === 0) return;
    const idx = list.findIndex(ch => ch.channelId === watchingChannel.channelId);
    const nextIdx = (idx + 1) % list.length;
    startWatching(list[nextIdx].channelId);
  }, [visibleChannels, watchingChannel, startWatching]);

  const prevChannel = useCallback(() => {
    if (!watchingChannel) return;
    const list = visibleChannels;
    if (list.length === 0) return;
    const idx = list.findIndex(ch => ch.channelId === watchingChannel.channelId);
    const prevIdx = (idx - 1 + list.length) % list.length;
    startWatching(list[prevIdx].channelId);
  }, [visibleChannels, watchingChannel, startWatching]);

  const getChannelIdentity = useCallback((channelId: string) => {
    // Try exact match first
    if (CHANNEL_IDENTITIES[channelId]) return CHANNEL_IDENTITIES[channelId];
    
    // Try partial match (e.g., if channelId is 'tokyo-ntv' and we have 'ntv')
    const key = Object.keys(CHANNEL_IDENTITIES).find(k => channelId.toLowerCase().includes(k.toLowerCase()));
    return key ? CHANNEL_IDENTITIES[key] : null;
  }, []);

  const getStreams = useCallback(async (channelId: string): Promise<StreamSource[]> => {
    try {
      diagnostics.log('SYSTEM', 'NETWORK', `FETCHING STREAMS FOR: ${channelId}`);
      const url = selectedAreaCode ? `/api/streams?channelId=${channelId}&area=${selectedAreaCode}` : `/api/streams?channelId=${channelId}`;
      const res = await fetch(url);
      const data = await res.json();
      diagnostics.log('INFO', 'NETWORK', `STREAMS LOADED: ${data.length} SOURCES`);
      return data;
    } catch (e) {
      diagnostics.log('ERROR', 'NETWORK', `FAILED TO FETCH STREAMS FOR: ${channelId}`, e);
      console.error("Failed to fetch streams", e);
      return [];
    }
  }, [selectedAreaCode]);

  // Atmosphere logic
  useEffect(() => {
    const updateAtmosphere = () => {
      if (settings.display.themeMode !== 'Auto') {
        setAtmosphere(settings.display.themeMode.toLowerCase() as any);
        return;
      }
      const hour = new Date().getHours();
      if (hour >= 5 && hour < 10) setAtmosphere('morning');
      else if (hour >= 10 && hour < 17) setAtmosphere('day');
      else if (hour >= 17 && hour < 21) setAtmosphere('evening');
      else setAtmosphere('late-night');
    };
    updateAtmosphere();
    const interval = setInterval(updateAtmosphere, 60000);
    return () => clearInterval(interval);
  }, [settings.display.themeMode]);

  // Ambient Audio logic
  useEffect(() => {
    if (!settings.audio.ambientSound) {
      if (ambientAudioRef.current) {
        ambientAudioRef.current.hum.stop();
        ambientAudioRef.current = null;
      }
      return;
    }
    const startAmbient = () => {
      if (ambientAudioRef.current) return;
      
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const hum = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      hum.type = 'sine';
      hum.frequency.setValueAtTime(50, audioCtx.currentTime); // Low hum
      gain.gain.setValueAtTime(0.01, audioCtx.currentTime); // Very soft
      
      hum.connect(gain);
      gain.connect(audioCtx.destination);
      hum.start();
      
      ambientAudioRef.current = { hum, gain };
    };

    const handleInteraction = () => {
      startAmbient();
      resetIdleTimer();
      window.removeEventListener('keydown', handleInteraction);
      window.removeEventListener('mousedown', handleInteraction);
    };

    window.addEventListener('keydown', handleInteraction);
    window.addEventListener('mousedown', handleInteraction);
    
    return () => {
      window.removeEventListener('keydown', handleInteraction);
      window.removeEventListener('mousedown', handleInteraction);
      if (ambientAudioRef.current) {
        ambientAudioRef.current.hum.stop();
      }
    };
  }, [resetIdleTimer]);

  useEffect(() => {
    resetIdleTimer();
    return () => {
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
    };
  }, [resetIdleTimer]);

  useEffect(() => {
    // We no longer sync individual states to localStorage here, 
    // as they are synced via the profiles effect.
  }, [favorites]);

  useEffect(() => {
    // We no longer sync individual states to localStorage here, 
    // as they are synced via the profiles effect.
  }, [reservations]);

  useEffect(() => {
    // We no longer sync individual states to localStorage here, 
    // as they are synced via the profiles effect.
  }, [session]);

  const toggleFavoriteChannel = useCallback((channelId: string) => {
    setFavorites(prev => ({
      ...prev,
      channels: prev.channels.includes(channelId)
        ? prev.channels.filter(id => id !== channelId)
        : [...prev.channels, channelId]
    }));
    playSystemSound('confirm');
  }, [playSystemSound]);

  const toggleFavoriteProgram = useCallback((programId: string) => {
    setFavorites(prev => ({
      ...prev,
      programs: prev.programs.includes(programId)
        ? prev.programs.filter(id => id !== programId)
        : [...prev.programs, programId]
    }));
    playSystemSound('confirm');
  }, [playSystemSound]);

  const addReservation = useCallback((program: Program, channelName: string, type: ReservationType) => {
    const conflict = reservations.find(r => 
      r.status === 'pending' &&
      ((program.startUtc >= r.startTime && program.startUtc < r.endTime) ||
       (program.endUtc > r.startTime && program.endUtc <= r.endTime))
    );

    if (conflict) {
      return { success: false, conflict };
    }

    const newRes: Reservation = {
      listingId: program.listingId,
      title: program.title,
      startTime: program.startUtc,
      endTime: program.endUtc,
      channelId: program.channelId,
      channelName: channelName,
      type,
      status: 'pending',
      createdAt: Date.now()
    };

    setReservations(prev => [...prev, newRes]);
    playSystemSound('confirm');
    return { success: true };
  }, [reservations, playSystemSound]);

  const removeReservation = useCallback((listingId: string) => {
    setReservations(prev => prev.filter(r => r.listingId !== listingId));
    playSystemSound('back');
  }, [playSystemSound]);

  const isReservationActive = useCallback((listingId: string) => {
    return reservations.some(r => r.listingId === listingId && r.status === 'pending');
  }, [reservations]);

  const [activeNotification, setActiveNotification] = useState<Reservation | null>(null);

  // Reservation Monitor
  useEffect(() => {
    const checkReservations = () => {
      const now = Date.now();
      
      setReservations(prev => {
        let changed = false;
        const next = prev.map(res => {
          if (res.status !== 'pending') return res;

          const startMs = res.startTime * 1000;
          const endMs = res.endTime * 1000;

          // Expiry check
          if (now > endMs) {
            changed = true;
            return { ...res, status: 'completed' as const };
          }

          // Trigger check (1 minute before)
          const timeToStart = startMs - now;
          if (timeToStart <= 60000 && timeToStart > 0 && !activeNotification) {
             // Side effects handled below
          }

          return res;
        });
        return changed ? next : prev;
      });

      // Actual trigger logic
      const upcoming = reservations.find(r => {
        if (r.status !== 'pending') return false;
        const startMs = r.startTime * 1000;
        const timeToStart = startMs - now;
        return timeToStart <= 60000 && timeToStart > -5000; // Allow 5 seconds after start
      });

      if (upcoming && (!activeNotification || activeNotification.listingId !== upcoming.listingId)) {
        const startMs = upcoming.startTime * 1000;
        if (upcoming.type === 'auto-tune' && now >= startMs && !isWatching) {
          startWatching(upcoming.channelId);
          setReservations(prev => prev.map(r => r.listingId === upcoming.listingId ? { ...r, status: 'active' as const } : r));
        } else {
          setActiveNotification(upcoming);
        }
      }
    };

    const interval = setInterval(checkReservations, 10000);
    return () => clearInterval(interval);
  }, [reservations, activeNotification, isWatching, startWatching]);

  const updateSession = useCallback((newSession: Partial<Session>) => {
    setSession(prev => ({ ...prev, ...newSession }));
  }, []);

  // Simulation logic
  useEffect(() => {
    const interval = setInterval(() => {
      setPresence(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(id => {
          const change = Math.floor(Math.random() * 21) - 10;
          next[id].viewers = Math.max(1, next[id].viewers + change);
          next[id].isTrending = next[id].viewers > 500;
        });
        return next;
      });

      if (Math.random() > 0.7) {
        const users = ['User772', 'TVFan_JP', 'RetroGamer', 'MidnightWatcher', 'GuideMaster'];
        const user = users[Math.floor(Math.random() * users.length)];
        const actions = [
          'が視聴を開始しました',
          'にチャンネルを切り替えました',
          'がリアクションしました 🔥'
        ];
        const action = actions[Math.floor(Math.random() * actions.length)];
        
        const newEvent: ActivityEvent = {
          id: Math.random().toString(36).substr(2, 9),
          message: `${user}${action}`,
          timestamp: Date.now(),
          type: 'watch'
        };
        setActivityLog(prev => [newEvent, ...prev].slice(0, 10));
      }
      
      // Idle tones
      if (isIdle && Math.random() > 0.8) {
        playSystemSound('transition');
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isIdle]);

  const addReaction = useCallback((listingId: string, type: 'like' | 'eyes' | 'fire') => {
    setPresence(prev => {
      const current = prev[listingId] || { viewers: Math.floor(Math.random() * 200) + 50, reactions: { like: 0, eyes: 0, fire: 0 } };
      return {
        ...prev,
        [listingId]: {
          ...current,
          reactions: {
            ...current.reactions,
            [type]: current.reactions[type] + 1
          }
        }
      };
    });
    playSystemSound('confirm');
  }, [playSystemSound]);

  return (
    <SystemContext.Provider value={{ 
      watchingProgram, 
      setWatchingProgram, 
      isGuideVisible, 
      setIsGuideVisible, 
      playSystemSound,
      presence,
      activityLog,
      addReaction,
      favorites,
      toggleFavoriteChannel,
      toggleFavoriteProgram,
      reservations,
      addReservation,
      removeReservation,
      isReservationActive,
      activeNotification,
      clearNotification: () => setActiveNotification(null),
      previousChannelId,
      recallChannel,
      session,
      updateSession,
      atmosphere,
      isIdle,
      resetIdleTimer,
      isStandby,
      setIsStandby,
      sleepTimerRemaining,
      isSleepTimerWarning,
      setSleepTimer,
      cancelSleepTimer,
      extendSleepTimer,
      isWatching,
      watchingChannel,
      startWatching,
      stopWatching,
      nextChannel,
      prevChannel,
      getChannelIdentity,
      getStreams,
      channels,
      orderedChannels,
      visibleChannels,
      toggleChannelVisibility,
      moveChannel,
      resetChannelLineup,
      guide,
      setGuide,
      setupComplete,
      selectedPrefecture,
      selectedAreaCode,
      completeSetup,
      isSettingUp,
      setIsSettingUp,
      settings,
      updateSettings,
      isSettingsVisible,
      setIsSettingsVisible,
      resetSystem,
      signalState,
      setSignalState,
      retryCount,
      setRetryCount,
      fallbackIndex,
      setFallbackIndex,
      lastPlaybackError,
      setLastPlaybackError,
      audioGain,
      setAudioGain,
      profiles,
      currentProfile,
      createProfile,
      updateProfile,
      deleteProfile,
      switchProfile,
      isProfileSelectorVisible,
      setIsProfileSelectorVisible
    }}>
      {children}
    </SystemContext.Provider>
  );
};

export const useSystem = () => {
  const context = useContext(SystemContext);
  if (context === undefined) {
    throw new Error('useSystem must be used within a SystemProvider');
  }
  return context;
};
