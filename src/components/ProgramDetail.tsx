import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { X, Play, Info, User, Calendar, Check, AlertTriangle } from 'lucide-react';
import { useSystem } from '../context/SystemContext';

interface CastMember {
  name: string;
  role: string | null;
  image: string | null;
}

interface ProgramDetailData {
  listingId: string;
  channelId: string;
  title: string;
  description: string | null;
  startUtc: number;
  endUtc: number;
  startJst: string;
  endJst: string;
  genre: string | null;
  channelName?: string;
  detail: {
    image: string | null;
    genre: string | null;
    description: string | null;
    letterBody: string | null;
    cast: CastMember[];
    masterTitle: string | null;
  } | null;
}

export const ProgramDetail: React.FC = () => {
  const { listingId } = useParams();
  const navigate = useNavigate();
  const { 
    playSystemSound, 
    addReservation, 
    removeReservation, 
    isReservationActive,
    reservations,
    startWatching
  } = useSystem();
  const [program, setProgram] = useState<ProgramDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showResMenu, setShowResMenu] = useState(false);
  const [conflict, setConflict] = useState<any>(null);

  const isReserved = isReservationActive(listingId || '');
  const currentRes = reservations.find(r => r.listingId === listingId);

  const handleBack = useCallback(() => {
    playSystemSound('back');
    navigate(-1);
  }, [navigate, playSystemSound]);

  const handleToggleReservation = (type: 'reminder' | 'auto-tune') => {
    if (!program) return;
    
    if (isReserved) {
      removeReservation(program.listingId);
    } else {
      const result = addReservation(
        {
          listingId: program.listingId,
          channelId: program.channelId,
          title: program.title,
          startUtc: program.startUtc,
          endUtc: program.endUtc,
          startJst: program.startJst,
          endJst: program.endJst,
          genre: program.genre,
          genreClass: null,
          description: program.description
        },
        program.channelName || 'Unknown Channel',
        type
      );

      if (!result.success) {
        setConflict(result.conflict);
        playSystemSound('error');
      } else {
        setShowResMenu(false);
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Backspace') {
        handleBack();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleBack]);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const res = await fetch(`/api/program/${listingId}`);
        const data = await res.json();
        setProgram(data);
      } catch (error) {
        console.error("Failed to fetch program detail", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [listingId]);

  if (loading) return null;
  if (!program) return <div>Program not found</div>;

  const detail = program.detail;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80"
      onClick={handleBack}
    >
      <div 
        className="w-full max-w-4xl glossy-panel border-4 border-[#4a90e2] flex flex-col max-h-[85vh] shadow-[0_0_50px_rgba(0,0,0,1)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glossy Header */}
        <div className="h-12 flex items-center px-6 bg-gradient-to-r from-[#1e3c72] to-[#2a5298] border-b-2 border-[#4a90e2] glossy shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-[#00f2ff] rounded-sm flex items-center justify-center shadow-[0_0_10px_#00f2ff]">
              <Info className="text-[#001a2c]" size={14} />
            </div>
            <h2 className="text-sm font-black tracking-widest text-white italic uppercase">PROGRAM INFORMATION</h2>
          </div>
          <button 
            onClick={handleBack}
            className="ml-auto w-8 h-8 flex items-center justify-center bg-red-600 border border-red-400 text-white hover:bg-red-500 transition-colors shadow-lg"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-6 bg-[#001a2c] custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Left Column: Image & Time */}
            <div className="md:col-span-4 space-y-4">
              <div className="aspect-video border-2 border-[#4a90e2] bg-black shadow-lg overflow-hidden">
                <img 
                  src={detail?.image || `https://picsum.photos/seed/${program.title}/800/450`} 
                  alt={program.title}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div className="bg-[#1a3a5a] border border-[#4a90e2]/50 p-3 shadow-inner">
                <div className="text-[10px] font-black text-[#00f2ff] mb-1 uppercase tracking-tighter">BROADCAST TIME</div>
                <div className="text-lg font-black text-white leading-none">
                  {program.startJst.split(' ')[1].slice(0, 5)} - {program.endJst.split(' ')[1].slice(0, 5)}
                </div>
                <div className="text-[11px] font-bold opacity-60 mt-1">
                  {program.startJst.split(' ')[0].replace(/-/g, '/')}
                </div>
              </div>

              <div className="bg-[#1a3a5a] border border-[#4a90e2]/50 p-3 shadow-inner">
                <div className="text-[10px] font-black text-[#00f2ff] mb-1 uppercase tracking-tighter">GENRE</div>
                <div className="text-[12px] font-bold text-white">
                  {detail?.genre || program.genre || "GENERAL"}
                </div>
              </div>
            </div>

            {/* Right Column: Text & Cast */}
            <div className="md:col-span-8 space-y-6">
              <div>
                <h1 className="text-2xl font-black tracking-tighter mb-3 text-white border-b border-[#4a90e2]/30 pb-2">
                  {program.title}
                </h1>
                <div className="bg-[#000c18] p-4 border border-[#1a3a5a] shadow-inner">
                  <p className="text-[13px] leading-relaxed text-white/90 font-medium whitespace-pre-wrap">
                    {detail?.description || program.description}
                  </p>
                </div>
              </div>

              {detail?.cast && detail.cast.length > 0 && (
                <div className="space-y-3">
                  <div className="text-[11px] font-black text-[#00f2ff] border-b border-[#4a90e2]/30 pb-1 uppercase tracking-widest">
                    CAST / TALENT
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {detail.cast.slice(0, 9).map((member, i) => (
                      <div key={i} className="flex items-center gap-2 p-1.5 bg-[#1a3a5a]/50 border border-[#4a90e2]/20">
                        <div className="w-8 h-8 bg-[#001a2c] border border-[#4a90e2]/30 shrink-0 overflow-hidden">
                          {member.image ? (
                            <img src={member.image} alt={member.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center opacity-20"><User size={14} /></div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold text-white truncate">{member.name}</p>
                          {member.role && <p className="text-[9px] text-[#00f2ff] opacity-60 truncate uppercase">{member.role}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="h-16 shrink-0 bg-[#1a3a5a] border-t-2 border-[#4a90e2] flex items-center px-6 gap-3 glossy relative">
          <button 
            onClick={() => {
              if (program) {
                startWatching(program.channelId);
                navigate('/');
              }
            }}
            className="h-10 px-6 bg-gradient-to-b from-[#00f2ff] to-[#00a3e0] text-[#001a2c] font-black text-sm border-2 border-white/50 shadow-lg hover:brightness-110 active:scale-95 transition-all flex items-center gap-2"
          >
            <Play size={16} fill="currentColor" />
            WATCH NOW
          </button>
          
          <div className="relative">
            <button 
              onClick={() => isReserved ? removeReservation(program.listingId) : setShowResMenu(!showResMenu)}
              className={`h-10 px-6 font-black text-sm border-2 shadow-lg active:scale-95 transition-all flex items-center gap-2 ${
                isReserved 
                  ? 'bg-[#cc00cc] text-white border-white/40' 
                  : 'bg-[#2c3e50] text-white border-white/20 hover:bg-[#34495e]'
              }`}
            >
              <Calendar size={16} />
              {isReserved ? (currentRes?.type === 'auto-tune' ? '視聴予約中' : 'お知らせ設定中') : '予約設定'}
              {isReserved && <Check size={14} />}
            </button>

            {showResMenu && !isReserved && (
              <div className="absolute bottom-full left-0 mb-2 w-48 bg-[#1a3a5a] border-2 border-[#4a90e2] shadow-2xl glossy overflow-hidden z-50">
                <button 
                  onClick={() => handleToggleReservation('reminder')}
                  className="w-full p-3 text-left hover:bg-[#4a90e2]/20 text-white text-xs font-black border-b border-white/10 flex flex-col gap-0.5"
                >
                  <span>お知らせ予約</span>
                  <span className="text-[9px] opacity-40 font-bold uppercase">Reminder only</span>
                </button>
                <button 
                  onClick={() => handleToggleReservation('auto-tune')}
                  className="w-full p-3 text-left hover:bg-[#4a90e2]/20 text-white text-xs font-black flex flex-col gap-0.5"
                >
                  <span className="text-[#00f2ff]">視聴予約</span>
                  <span className="text-[9px] opacity-40 font-bold uppercase">Auto-tune at start</span>
                </button>
              </div>
            )}
          </div>

          {conflict && (
            <div className="absolute bottom-full left-0 mb-2 w-72 bg-red-900 border-2 border-red-500 p-4 shadow-2xl glossy z-[60]">
              <div className="flex items-start gap-3">
                <AlertTriangle className="text-red-400 shrink-0" size={20} />
                <div>
                  <div className="text-xs font-black text-white uppercase mb-1">予約の競合が発生しました</div>
                  <div className="text-[10px] text-white/70 leading-tight mb-3">
                    以下の番組と時間が重なっています：<br/>
                    <span className="text-white font-bold">「{conflict.title}」</span>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setConflict(null)}
                      className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white text-[10px] font-black uppercase"
                    >
                      閉じる
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="ml-auto text-[10px] font-black text-white/40 italic">
            EVENT ID: {listingId?.split('-').pop()}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
