import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Settings, 
  MapPin, 
  PlayCircle, 
  Volume2, 
  Monitor, 
  Info, 
  Trash2, 
  ChevronRight, 
  ChevronLeft,
  Users,
  Activity
} from 'lucide-react';
import { useSystem } from '../context/SystemContext';
import { PREFECTURES } from '../constants/prefectures';
import { diagnostics } from '../lib/diagnostics';

type SettingsCategory = 'reception' | 'channels' | 'profiles' | 'playback' | 'audio' | 'display' | 'system' | 'maintenance' | 'diagnostics';

export const SettingsMenu: React.FC = () => {
  const { 
    settings, 
    updateSettings, 
    isSettingsVisible, 
    setIsSettingsVisible, 
    playSystemSound,
    selectedAreaCode,
    channels,
    orderedChannels,
    toggleChannelVisibility,
    moveChannel,
    resetChannelLineup,
    resetSystem,
    setIsSettingUp,
    currentProfile,
    setIsProfileSelectorVisible,
    setSleepTimer
  } = useSystem();

  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('reception');
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [isSubMenuFocused, setIsSubMenuFocused] = useState(false);
  
  const categories: { id: SettingsCategory; label: string; icon: any }[] = [
    { id: 'reception', label: '地域・受信設定', icon: MapPin },
    { id: 'channels', label: 'チャンネル設定', icon: Settings },
    { id: 'profiles', label: 'ユーザー設定', icon: Users },
    { id: 'playback', label: '再生設定', icon: PlayCircle },
    { id: 'audio', label: '音声設定', icon: Volume2 },
    { id: 'display', label: '表示設定', icon: Monitor },
    { id: 'system', label: '本体情報', icon: Info },
    { id: 'diagnostics', label: '診断・ログ', icon: Activity },
    { id: 'maintenance', label: '初期化・保守', icon: Trash2 },
  ];

  const currentPrefecture = PREFECTURES.find(p => p.areaCode === selectedAreaCode);

  const menuItems: Record<SettingsCategory, any[]> = {
    reception: [
      { label: '現在の地域', value: currentPrefecture?.name || '未設定', type: 'info' },
      { label: '地域設定の変更', type: 'action', action: () => { setIsSettingUp(true); setIsSettingsVisible(false); } },
      { label: 'チャンネル再スキャン', type: 'action', action: () => { setIsSettingUp(true); setIsSettingsVisible(false); } },
    ],
    channels: [
      { label: 'チャンネル設定のリセット', type: 'action', danger: true, action: resetChannelLineup, description: 'チャンネルの並び順と表示設定を初期状態に戻します。' },
      ...orderedChannels.map(ch => ({
        label: `${ch.number} ${ch.name}`,
        type: 'channel-organizer',
        channelId: ch.channelId,
        isHidden: (currentProfile?.hiddenChannels || []).includes(ch.channelId),
        description: ch.group
      }))
    ],
    profiles: [
      { label: '現在のユーザー', value: currentProfile?.name || 'NONE', type: 'info' },
      { label: 'ユーザーの切り替え', type: 'action', action: () => { setIsProfileSelectorVisible(true); setIsSettingsVisible(false); } },
      { label: 'ユーザーの追加・管理', type: 'action', action: () => { setIsProfileSelectorVisible(true); setIsSettingsVisible(false); } },
    ],
    playback: [
      { 
        label: '画質モード', 
        key: 'playback.quality', 
        options: ['Auto', 'HD', 'SD'],
        value: settings.playback.quality 
      },
      { 
        label: '信号切断時の自動再試行', 
        key: 'playback.autoRetry', 
        type: 'toggle',
        value: settings.playback.autoRetry 
      },
      { 
        label: 'フォールバック配信の使用', 
        key: 'playback.fallbackEnabled', 
        type: 'toggle',
        value: settings.playback.fallbackEnabled 
      },
      { 
        label: '選局時の切替効果', 
        key: 'playback.transitionEffect', 
        options: ['Standard', 'Fast', 'Smooth'],
        value: settings.playback.transitionEffect 
      },
      { 
        label: '音量正規化 (Normalization)', 
        key: 'playback.normalization', 
        type: 'toggle',
        value: settings.playback.normalization 
      },
    ],
    audio: [
      { 
        label: '主音量', 
        key: 'audio.masterVolume', 
        type: 'range',
        min: 0,
        max: 100,
        step: 5,
        value: settings.audio.masterVolume 
      },
      { 
        label: '操作音 (UI Sounds)', 
        key: 'audio.uiSounds', 
        type: 'toggle',
        value: settings.audio.uiSounds 
      },
      { 
        label: '環境音 (Ambient Hum)', 
        key: 'audio.ambientSound', 
        type: 'toggle',
        value: settings.audio.ambientSound 
      },
    ],
    display: [
      { 
        label: '走査線エフェクト (Scanlines)', 
        key: 'display.scanlines', 
        type: 'toggle',
        value: settings.display.scanlines 
      },
      { 
        label: 'ブルーム強度 (Bloom)', 
        key: 'display.bloomStrength', 
        options: ['Low', 'Normal', 'High'],
        value: settings.display.bloomStrength 
      },
      { 
        label: '周辺減光 (Vignette)', 
        key: 'display.vignette', 
        type: 'toggle',
        value: settings.display.vignette 
      },
      { 
        label: 'アトラクトモード', 
        key: 'display.attractMode', 
        type: 'toggle',
        value: settings.display.attractMode 
      },
      { 
        label: '時間帯テーマ設定', 
        key: 'display.themeMode', 
        options: ['Auto', 'Morning', 'Day', 'Evening', 'Late-Night'],
        value: settings.display.themeMode 
      },
    ],
    system: [
      { 
        label: 'スリープタイマー (Sleep Timer)', 
        key: 'timer.sleepTimer', 
        options: ['OFF', '15', '30', '60', '90', '120'],
        value: settings.timer.sleepTimer === null ? 'OFF' : String(settings.timer.sleepTimer),
        description: '指定時間後に自動的にスタンバイ状態に移行します。'
      },
      { label: 'システム名', value: 'テレビパル™ (TV-PAL)', type: 'info' },
      { label: '製品モデル', value: '73KQ-X Digital Receiver', type: 'info' },
      { label: 'ファームウェア', value: 'v2.1.0-rev.05', type: 'info' },
      { label: '地域コード', value: selectedAreaCode || 'NONE', type: 'info' },
      { label: '検出チャンネル数', value: `${channels.length} CH`, type: 'info' },
      { label: '信号処理モジュール', value: 'HLS-CORE v4.8', type: 'info' },
      { label: '稼働時間', value: diagnostics.getSystemReport().uptime, type: 'info' },
    ],
    diagnostics: [
      { label: 'システム診断レポート', type: 'action', action: () => { console.table(diagnostics.getSystemReport()); } },
      { label: 'ログのクリア', type: 'action', action: () => { diagnostics.clearLogs(); } },
      ...diagnostics.getLogs().slice(0, 10).map(log => ({
        label: `[${log.level}] ${log.module}`,
        value: log.message,
        type: 'info',
        description: new Date(log.timestamp).toLocaleTimeString()
      }))
    ],
    maintenance: [
      { label: 'お気に入り設定の消去', type: 'action', danger: true, action: () => {
        localStorage.removeItem('tvpal_favorites');
        window.location.reload();
      }},
      { label: '予約・リマインダーの消去', type: 'action', danger: true, action: () => {
        localStorage.removeItem('tvpal_reminders');
        window.location.reload();
      }},
      { label: '工場出荷時状態にリセット', type: 'action', danger: true, action: resetSystem },
    ],
  };

  const handleUpdate = (key: string, value: any) => {
    if (key === 'timer.sleepTimer') {
      const minutes = value === 'OFF' ? null : parseInt(value);
      setSleepTimer(minutes);
      playSystemSound('confirm');
      return;
    }
    const [section, field] = key.split('.');
    updateSettings({
      [section]: {
        ...(settings as any)[section],
        [field]: value
      }
    });
    playSystemSound('confirm');
  };

  useEffect(() => {
    if (!isSettingsVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const currentItems = menuItems[activeCategory];

      switch (e.key) {
        case 'ArrowUp':
          setFocusedIndex(prev => (prev > 0 ? prev - 1 : currentItems.length - 1));
          playSystemSound('click');
          break;
        case 'ArrowDown':
          setFocusedIndex(prev => (prev < currentItems.length - 1 ? prev + 1 : 0));
          playSystemSound('click');
          break;
        case 'ArrowLeft':
          if (!isSubMenuFocused) {
            // Switch categories
            const catIdx = categories.findIndex(c => c.id === activeCategory);
            const nextCatIdx = (catIdx - 1 + categories.length) % categories.length;
            setActiveCategory(categories[nextCatIdx].id);
            setFocusedIndex(0);
            playSystemSound('click');
          } else {
            const item = currentItems[focusedIndex];
            if (item.options) {
              const idx = item.options.indexOf(item.value);
              const nextIdx = (idx - 1 + item.options.length) % item.options.length;
              handleUpdate(item.key, item.options[nextIdx]);
            } else if (item.type === 'range') {
              handleUpdate(item.key, Math.max(item.min, item.value - item.step));
            } else if (item.type === 'toggle') {
              handleUpdate(item.key, !item.value);
            } else if (item.type === 'channel-organizer') {
              moveChannel(item.channelId, 'up');
            }
          }
          break;
        case 'ArrowRight':
          if (!isSubMenuFocused) {
            setIsSubMenuFocused(true);
            playSystemSound('confirm');
          } else {
            const item = currentItems[focusedIndex];
            if (item.options) {
              const idx = item.options.indexOf(item.value);
              const nextIdx = (idx + 1) % item.options.length;
              handleUpdate(item.key, item.options[nextIdx]);
            } else if (item.type === 'range') {
              handleUpdate(item.key, Math.min(item.max, item.value + item.step));
            } else if (item.type === 'toggle') {
              handleUpdate(item.key, !item.value);
            } else if (item.type === 'channel-organizer') {
              moveChannel(item.channelId, 'down');
            }
          }
          break;
        case 'Enter':
          const item = currentItems[focusedIndex];
          if (item.type === 'action') {
            item.action();
            playSystemSound('confirm');
          } else if (item.type === 'toggle') {
            handleUpdate(item.key, !item.value);
          } else if (item.type === 'channel-organizer') {
            toggleChannelVisibility(item.channelId);
          } else if (!isSubMenuFocused) {
            setIsSubMenuFocused(true);
            playSystemSound('confirm');
          }
          break;
        case 'Escape':
        case 'Backspace':
          if (isSubMenuFocused) {
            setIsSubMenuFocused(false);
            playSystemSound('back');
          } else {
            setIsSettingsVisible(false);
            playSystemSound('back');
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSettingsVisible, activeCategory, focusedIndex, isSubMenuFocused, settings, playSystemSound]);

  if (!isSettingsVisible) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-12 bg-black/60 backdrop-blur-md">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
        className="w-full max-w-5xl h-[700px] glossy-panel flex flex-col border-4 border-[#00f2ff]/30 shadow-[0_0_100px_rgba(0,0,0,0.8)]"
      >
        {/* Header */}
        <div className="p-8 border-b border-white/10 flex items-center justify-between bg-black/20">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#00f2ff] rounded flex items-center justify-center shadow-[0_0_20px_rgba(0,242,255,0.4)]">
              <Settings className="text-black" size={28} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white italic tracking-tighter uppercase">System Settings</h1>
              <div className="text-[10px] font-black text-[#00f2ff] tracking-[0.3em] uppercase opacity-60">テレビパル™ Receiver Configuration</div>
            </div>
          </div>
          <div className="flex items-center gap-6 text-[10px] font-black text-white/40 tracking-widest uppercase">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
              System Online
            </div>
            <div>Firmware v2.1.0</div>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar Categories */}
          <div className="w-72 border-r border-white/10 bg-black/20 p-4 flex flex-col gap-2">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.id;
              const isFocused = !isSubMenuFocused && isActive;
              
              return (
                <div
                  key={cat.id}
                  className={`
                    p-4 flex items-center gap-4 transition-all duration-200 cursor-pointer
                    ${isActive ? 'bg-[#00f2ff] text-black font-black italic' : 'text-white/60 hover:text-white'}
                    ${isFocused ? 'ring-4 ring-white/50 scale-[1.02] z-10 shadow-lg' : ''}
                  `}
                  onClick={() => {
                    setActiveCategory(cat.id);
                    setIsSubMenuFocused(false);
                    setFocusedIndex(0);
                    playSystemSound('click');
                  }}
                >
                  <Icon size={20} />
                  <span className="text-sm uppercase tracking-tight">{cat.label}</span>
                  {isActive && <ChevronRight size={16} className="ml-auto" />}
                </div>
              );
            })}
            
            <div className="mt-auto p-4 bg-black/40 border border-white/5 rounded">
              <div className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-2">Navigation Help</div>
              <div className="space-y-1 text-[9px] text-white/50 font-bold">
                <div className="flex justify-between"><span>MOVE</span> <span className="text-[#00f2ff]">↑ ↓</span></div>
                <div className="flex justify-between"><span>SELECT</span> <span className="text-[#00f2ff]">ENTER / →</span></div>
                <div className="flex justify-between"><span>BACK</span> <span className="text-[#00f2ff]">ESC / ←</span></div>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 p-8 overflow-auto custom-scrollbar bg-black/10">
            <div className="mb-8">
              <h2 className="text-xl font-black text-white italic uppercase tracking-widest border-b-2 border-[#00f2ff] inline-block pb-1 mb-2">
                {categories.find(c => c.id === activeCategory)?.label}
              </h2>
              <p className="text-xs text-white/40 font-bold tracking-tight">
                システムの設定を調整します。変更は即座に反映され、保存されます。
              </p>
            </div>

            <div className="space-y-2">
              {menuItems[activeCategory].map((item, idx) => {
                const isFocused = isSubMenuFocused && focusedIndex === idx;
                
                return (
                  <div
                    key={idx}
                    className={`
                      group p-4 flex items-center justify-between transition-all duration-150
                      ${isFocused ? 'bg-white/10 border-l-4 border-l-[#00f2ff] translate-x-2' : 'bg-white/5 border-l-4 border-l-transparent'}
                      ${item.danger ? 'hover:bg-red-900/20' : ''}
                    `}
                  >
                    <div className="flex flex-col">
                      <span className={`text-sm font-bold tracking-tight ${isFocused ? 'text-white' : 'text-white/70'}`}>
                        {item.label}
                      </span>
                      {item.description && (
                        <span className="text-[10px] text-white/30 font-medium">{item.description}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-4">
                      {item.type === 'info' && (
                        <span className="text-sm font-mono text-[#00f2ff] font-black">{item.value}</span>
                      )}

                      {item.type === 'toggle' && (
                        <div className={`
                          w-12 h-6 rounded-full p-1 transition-colors duration-300 flex items-center
                          ${item.value ? 'bg-[#00f2ff]' : 'bg-white/10'}
                        `}>
                          <motion.div 
                            animate={{ x: item.value ? 24 : 0 }}
                            className={`w-4 h-4 rounded-full ${item.value ? 'bg-black' : 'bg-white/40'}`}
                          />
                        </div>
                      )}

                      {item.options && (
                        <div className="flex items-center gap-3">
                          <ChevronLeft size={14} className={isFocused ? 'text-[#00f2ff] animate-pulse' : 'text-white/20'} />
                          <span className="text-xs font-black text-white min-w-[80px] text-center uppercase tracking-widest">
                            {item.value}
                          </span>
                          <ChevronRight size={14} className={isFocused ? 'text-[#00f2ff] animate-pulse' : 'text-white/20'} />
                        </div>
                      )}

                      {item.type === 'range' && (
                        <div className="flex items-center gap-4">
                          <div className="w-32 h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-[#00f2ff] shadow-[0_0_8px_#00f2ff]" 
                              style={{ width: `${item.value}%` }} 
                            />
                          </div>
                          <span className="text-xs font-mono text-white/60 w-8">{item.value}</span>
                        </div>
                      )}

                      {item.type === 'action' && (
                        <div className={`
                          px-4 py-1 rounded text-[10px] font-black uppercase tracking-widest border
                          ${item.danger ? 'border-red-500/50 text-red-500' : 'border-[#00f2ff]/50 text-[#00f2ff]'}
                          ${isFocused ? 'bg-white/10' : ''}
                        `}>
                          Execute
                        </div>
                      )}

                      {item.type === 'channel-organizer' && (
                        <div className="flex items-center gap-6">
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] font-black uppercase tracking-widest ${item.isHidden ? 'text-red-500' : 'text-green-500'}`}>
                              {item.isHidden ? 'Hidden' : 'Visible'}
                            </span>
                            <div className={`
                              w-8 h-4 rounded-full p-0.5 transition-colors duration-300 flex items-center
                              ${!item.isHidden ? 'bg-green-500' : 'bg-red-500/20'}
                            `}>
                              <motion.div 
                                animate={{ x: !item.isHidden ? 16 : 0 }}
                                className={`w-3 h-3 rounded-full ${!item.isHidden ? 'bg-black' : 'bg-red-500'}`}
                              />
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 border-l border-white/10 pl-4">
                            <div className={`p-1 rounded ${isFocused ? 'text-[#00f2ff] animate-pulse' : 'text-white/20'}`}>
                              <ChevronLeft size={14} />
                            </div>
                            <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Move</span>
                            <div className={`p-1 rounded ${isFocused ? 'text-[#00f2ff] animate-pulse' : 'text-white/20'}`}>
                              <ChevronRight size={14} />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-black/40 border-t border-white/10 flex items-center justify-between text-[9px] font-black text-white/20 uppercase tracking-[0.5em]">
          <div className="flex gap-8">
            <span>テレビパル™ RECEIVER SYSTEM</span>
            {activeCategory === 'channels' && isSubMenuFocused && (
              <div className="flex gap-4 text-[#00f2ff]">
                <span>ENTER: TOGGLE VISIBILITY</span>
                <span>←/→: MOVE CHANNEL</span>
              </div>
            )}
          </div>
          <span>© 2026 TV-PAL ELECTRONICS CO., LTD.</span>
        </div>
      </motion.div>
    </div>
  );
};
