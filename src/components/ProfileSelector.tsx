import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useSystem } from '../context/SystemContext';
import { PROFILE_ICONS, PROFILE_COLORS } from '../constants/profileAssets';
import { Plus, User, Settings, Trash2, ChevronLeft, Check } from 'lucide-react';

export const ProfileSelector: React.FC = () => {
  const { 
    profiles, 
    currentProfile, 
    switchProfile, 
    createProfile, 
    deleteProfile, 
    updateProfile,
    playSystemSound,
    isProfileSelectorVisible
  } = useSystem();

  const [mode, setMode] = useState<'select' | 'create' | 'edit'>('select');
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  
  // Create/Edit state
  const [newName, setNewName] = useState('');
  const [newIconId, setNewIconId] = useState('user');
  const [newColor, setNewColor] = useState(PROFILE_COLORS[0]);

  // Auto-select if only one profile exists and we're in select mode
  useEffect(() => {
    if (profiles.length === 1 && !currentProfile && mode === 'select') {
      const timer = setTimeout(() => {
        switchProfile(profiles[0].id);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [profiles, currentProfile, mode, switchProfile]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (mode === 'select') {
      const totalItems = profiles.length + 1; // +1 for "Add Profile"
      switch (e.key) {
        case 'ArrowLeft':
          setFocusedIndex(prev => (prev > 0 ? prev - 1 : totalItems - 1));
          playSystemSound('click');
          break;
        case 'ArrowRight':
          setFocusedIndex(prev => (prev < totalItems - 1 ? prev + 1 : 0));
          playSystemSound('click');
          break;
        case 'Enter':
          if (focusedIndex < profiles.length) {
            switchProfile(profiles[focusedIndex].id);
          } else {
            setMode('create');
            setNewName(`USER ${profiles.length + 1}`);
            setNewIconId('user');
            setNewColor(PROFILE_COLORS[profiles.length % PROFILE_COLORS.length]);
            setFocusedIndex(0);
            playSystemSound('confirm');
          }
          break;
      }
    }
  }, [mode, profiles, focusedIndex, switchProfile, playSystemSound]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleCreate = () => {
    if (newName.trim()) {
      createProfile(newName.trim(), newIconId, newColor);
      setMode('select');
      setFocusedIndex(profiles.length);
    }
  };

  const handleUpdate = () => {
    if (editingProfileId && newName.trim()) {
      updateProfile(editingProfileId, {
        name: newName.trim(),
        iconId: newIconId,
        color: newColor
      });
      setMode('select');
    }
  };

  const getIcon = (id: string) => {
    const asset = PROFILE_ICONS.find(i => i.id === id);
    return asset ? asset.icon : User;
  };

  if (currentProfile && !isProfileSelectorVisible) return null;

  return (
    <div className="fixed inset-0 z-[10000] bg-black flex items-center justify-center overflow-hidden">
      {/* Background Effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a3a5a] to-black opacity-40" />
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
      
      <AnimatePresence mode="wait">
        {mode === 'select' && (
          <motion.div
            key="select"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
            className="relative z-10 flex flex-col items-center"
          >
            <div className="mb-12 text-center">
              <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase mb-2">
                Who is watching?
              </h1>
              <div className="text-[10px] font-black text-[#00f2ff] tracking-[0.4em] uppercase opacity-60">
                ユーザープロファイルを選択してください
              </div>
            </div>

            <div className="flex gap-8 items-center">
              {profiles.map((profile, idx) => {
                const isFocused = focusedIndex === idx;
                const Icon = getIcon(profile.iconId);
                
                return (
                  <motion.div
                    key={profile.id}
                    whileHover={{ scale: 1.05 }}
                    className={`
                      relative flex flex-col items-center gap-4 transition-all duration-300
                      ${isFocused ? 'scale-110' : 'opacity-60 grayscale-[0.5]'}
                    `}
                    onClick={() => switchProfile(profile.id)}
                  >
                    <div 
                      className={`
                        w-32 h-32 rounded-2xl border-4 flex items-center justify-center transition-all duration-300
                        ${isFocused ? 'shadow-[0_0_40px_rgba(0,242,255,0.4)]' : 'border-white/10'}
                      `}
                      style={{ 
                        borderColor: isFocused ? profile.color : 'rgba(255,255,255,0.1)',
                        backgroundColor: isFocused ? `${profile.color}10` : 'rgba(255,255,255,0.05)'
                      }}
                    >
                      <Icon size={64} style={{ color: isFocused ? profile.color : 'white' }} />
                      
                      {isFocused && (
                        <motion.div 
                          layoutId="focus-ring"
                          className="absolute -inset-2 border-2 border-[#00f2ff] rounded-3xl opacity-40 animate-pulse"
                        />
                      )}
                    </div>
                    <span className={`text-lg font-black italic tracking-tight ${isFocused ? 'text-white' : 'text-white/40'}`}>
                      {profile.name}
                    </span>
                    
                    {isFocused && (
                      <div className="absolute -bottom-12 flex gap-4">
                        <button 
                          className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingProfileId(profile.id);
                            setNewName(profile.name);
                            setNewIconId(profile.iconId);
                            setNewColor(profile.color);
                            setMode('edit');
                            playSystemSound('confirm');
                          }}
                        >
                          <Settings size={16} />
                        </button>
                        <button 
                          className="p-2 rounded-full bg-white/5 hover:bg-red-500/20 text-white/40 hover:text-red-500 transition-all"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteProfile(profile.id);
                            playSystemSound('back');
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </motion.div>
                );
              })}

              {/* Add Profile Button */}
              <motion.div
                whileHover={{ scale: 1.05 }}
                className={`
                  relative flex flex-col items-center gap-4 transition-all duration-300
                  ${focusedIndex === profiles.length ? 'scale-110' : 'opacity-60 grayscale'}
                `}
                onClick={() => setMode('create')}
              >
                <div 
                  className={`
                    w-32 h-32 rounded-2xl border-4 border-dashed flex items-center justify-center transition-all duration-300
                    ${focusedIndex === profiles.length ? 'border-[#00f2ff] bg-[#00f2ff]/10 shadow-[0_0_40px_rgba(0,242,255,0.2)]' : 'border-white/10 bg-white/5'}
                  `}
                >
                  <Plus size={48} className={focusedIndex === profiles.length ? 'text-[#00f2ff]' : 'text-white/20'} />
                  {focusedIndex === profiles.length && (
                    <motion.div 
                      layoutId="focus-ring"
                      className="absolute -inset-2 border-2 border-[#00f2ff] rounded-3xl opacity-40 animate-pulse"
                    />
                  )}
                </div>
                <span className={`text-lg font-black italic tracking-tight ${focusedIndex === profiles.length ? 'text-white' : 'text-white/40'}`}>
                  ADD PROFILE
                </span>
              </motion.div>
            </div>

            {profiles.length === 0 && (
              <div className="mt-12 p-4 bg-[#00f2ff]/10 border border-[#00f2ff]/30 rounded-lg text-[#00f2ff] text-xs font-bold animate-pulse">
                PLEASE CREATE A PROFILE TO CONTINUE
              </div>
            )}
          </motion.div>
        )}

        {(mode === 'create' || mode === 'edit') && (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            className="relative z-10 w-full max-w-2xl glossy-panel p-12 flex flex-col gap-8"
          >
            <div className="flex items-center gap-4 border-b border-white/10 pb-6">
              <div className="w-12 h-12 bg-[#00f2ff] rounded flex items-center justify-center shadow-[0_0_20px_rgba(0,242,255,0.4)]">
                <User className="text-black" size={28} />
              </div>
              <div>
                <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase">
                  {mode === 'create' ? 'Create Profile' : 'Edit Profile'}
                </h2>
                <div className="text-[10px] font-black text-[#00f2ff] tracking-[0.3em] uppercase opacity-60">
                  ユーザー設定の編集
                </div>
              </div>
            </div>

            <div className="space-y-8">
              {/* Name Input */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">Profile Name</label>
                <input 
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value.toUpperCase())}
                  maxLength={12}
                  className="w-full bg-black/40 border-2 border-white/10 rounded-lg px-6 py-4 text-2xl font-black italic text-white focus:border-[#00f2ff] focus:outline-none transition-all"
                  autoFocus
                />
              </div>

              {/* Icon Selection */}
              <div className="space-y-4">
                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">Select Icon</label>
                <div className="grid grid-cols-6 gap-4">
                  {PROFILE_ICONS.map((item) => {
                    const Icon = item.icon;
                    const isSelected = newIconId === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setNewIconId(item.id);
                          playSystemSound('click');
                        }}
                        className={`
                          aspect-square rounded-lg border-2 flex items-center justify-center transition-all
                          ${isSelected ? 'bg-white/10 border-[#00f2ff] text-[#00f2ff] shadow-[0_0_15px_rgba(0,242,255,0.3)]' : 'bg-white/5 border-white/5 text-white/20 hover:text-white/60'}
                        `}
                      >
                        <Icon size={24} />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Color Selection */}
              <div className="space-y-4">
                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">Select Color</label>
                <div className="flex gap-4">
                  {PROFILE_COLORS.map((color) => {
                    const isSelected = newColor === color;
                    return (
                      <button
                        key={color}
                        onClick={() => {
                          setNewColor(color);
                          playSystemSound('click');
                        }}
                        className={`
                          w-10 h-10 rounded-full border-4 transition-all
                          ${isSelected ? 'scale-125 border-white shadow-[0_0_15px_white]' : 'border-transparent opacity-60 hover:opacity-100'}
                        `}
                        style={{ backgroundColor: color }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-8 flex gap-4">
              <button
                onClick={() => {
                  setMode('select');
                  playSystemSound('back');
                }}
                className="flex-1 py-4 rounded-lg bg-white/5 text-white font-black italic tracking-widest uppercase hover:bg-white/10 transition-all flex items-center justify-center gap-2"
              >
                <ChevronLeft size={20} /> Cancel
              </button>
              <button
                onClick={mode === 'create' ? handleCreate : handleUpdate}
                disabled={!newName.trim()}
                className="flex-1 py-4 rounded-lg bg-[#00f2ff] text-black font-black italic tracking-widest uppercase hover:bg-[#00f2ff]/80 transition-all flex items-center justify-center gap-2 disabled:opacity-30"
              >
                {mode === 'create' ? 'Create' : 'Save'} <Check size={20} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer Help */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-8 text-[10px] font-black text-white/20 tracking-widest uppercase">
        <div className="flex items-center gap-2"><span className="w-5 h-5 rounded border border-white/10 flex items-center justify-center">← →</span> MOVE</div>
        <div className="flex items-center gap-2"><span className="w-5 h-5 rounded border border-white/10 flex items-center justify-center">ENTER</span> SELECT</div>
        {mode !== 'select' && <div className="flex items-center gap-2"><span className="w-5 h-5 rounded border border-white/10 flex items-center justify-center">ESC</span> BACK</div>}
      </div>
    </div>
  );
};
