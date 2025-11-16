// src/components/Status.tsx
import React, { useState, useEffect, useRef } from 'react';
import { supabase, uploadStatusMedia, Profile, Status } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { X, Plus, Camera, Video, Image as ImageIcon, Edit3, Menu, ChevronLeft, ChevronRight, Clock, Archive, MessageSquare, User } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

const FOLLOW_ONLY_FEED = import.meta.env.VITE_FOLLOW_ONLY_FEED === 'true';

// Simple hook for mobile detection
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return isMobile;
};

// StatusTray Component
export const StatusTray: React.FC = () => {
  const { user, profile } = useAuth();
  const [activeStatuses, setActiveStatuses] = useState<{ [key: string]: Status }>({});
  const [ownStatus, setOwnStatus] = useState<Status | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    const fetchActiveStatuses = async () => {
      let query = supabase
        .from('statuses')
        .select('*, profiles!user_id(*)')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(50);

      // If follow-only, filter by follows (assuming a 'follows' table exists; adjust if needed)
      if (FOLLOW_ONLY_FEED) {
        // Placeholder: fetch follows and filter in JS or use RPC
        const { data: follows } = await supabase.from('follows').select('followed_id').eq('follower_id', user.id);  // Assume follows table
        const followIds = follows?.map(f => f.followed_id) || [];
        query = query.in('user_id', [user.id, ...followIds]);
      }

      const { data } = await query;
      if (!data) return;

      // Group by user_id, take latest per user
      const grouped: { [key: string]: Status } = {};
      data.forEach((status: Status) => {
        if (!grouped[status.user_id] || new Date(status.created_at) > new Date(grouped[status.user_id].created_at)) {
          grouped[status.user_id] = status;
        }
      });

      setActiveStatuses(grouped);

      // Ensure own is always tracked
      const own = grouped[user.id] || null;
      setOwnStatus(own);
    };

    fetchActiveStatuses();
    const interval = setInterval(fetchActiveStatuses, 30000);  // Refresh every 30s
    return () => clearInterval(interval);
  }, [user]);

  const handleOwnClick = () => {
    setShowStatusCreator(true);  // Trigger global modal via dispatchEvent or context; for simplicity, use custom event
    window.dispatchEvent(new CustomEvent('openStatusCreator'));
  };

  const handleOtherClick = (statusUserId: string) => {
    navigate(`/?status=${statusUserId}`);  // Or set global state
    window.dispatchEvent(new CustomEvent('openStatusViewer', { detail: { userId: statusUserId } }));
  };

  // Listen for creator open (from + click)
  useEffect(() => {
    const handleOpenCreator = () => setShowStatusCreator(true);
    window.addEventListener('openStatusCreator', handleOpenCreator);
    return () => window.removeEventListener('openStatusCreator', handleOpenCreator);
  }, []);

  const [showStatusCreator, setShowStatusCreator] = useState(false);

  return (
    <div className="flex space-x-4 p-4 overflow-x-auto scrollbar-hide bg-[rgb(var(--color-surface))] border-b border-[rgb(var(--color-border))]">
      {/* Own Circle */}
      <div className="flex flex-col items-center space-y-1 flex-shrink-0">
        <div 
          onClick={handleOwnClick}
          className="relative w-16 h-16 rounded-full border-2 border-dashed cursor-pointer group"
          style={{ borderColor: 'rgb(var(--color-border))' }}
        >
          <img 
            src={profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.username}`}
            className="w-full h-full rounded-full object-cover"
            alt="Your avatar"
          />
          {!ownStatus && (
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-[rgb(var(--color-primary))] rounded-full flex items-center justify-center group-hover:scale-110 transition">
              <Plus size={12} className="text-white" />
            </div>
          )}
          {ownStatus && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              <defs>
                <linearGradient id={`own-grad`} x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="rgb(var(--color-primary))" />
                  <stop offset="100%" stopColor="rgb(var(--color-accent))" />
                </linearGradient>
              </defs>
              <circle cx="50%" cy="50%" r="50%" fill="none" stroke="url(#own-grad)" strokeWidth="2" />
            </svg>
          )}
        </div>
        <span className="text-xs text-center text-[rgb(var(--color-text-secondary))] truncate w-16">Your Status</span>
      </div>

      {/* Others' Circles */}
      {Object.values(activeStatuses)
        .filter(s => s.user_id !== user?.id)
        .map((status) => (
          <div key={status.user_id} className="flex flex-col items-center space-y-1 flex-shrink-0">
            <div 
              onClick={() => handleOtherClick(status.user_id)}
              className="relative w-16 h-16 rounded-full cursor-pointer"
            >
              <img 
                src={status.profiles?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${status.profiles?.username}`}
                className="w-full h-full rounded-full object-cover"
                alt={status.profiles?.display_name}
              />
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                <defs>
                  <linearGradient id={`grad-${status.user_id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="rgb(var(--color-primary))" />
                    <stop offset="100%" stopColor="rgb(var(--color-accent))" />
                  </linearGradient>
                </defs>
                <circle cx="50%" cy="50%" r="50%" fill="none" stroke="url(#grad-${status.user_id})" strokeWidth="2" />
              </svg>
            </div>
            <span className="text-xs text-center text-[rgb(var(--color-text-secondary))] truncate w-16">
              {status.profiles?.display_name || status.profiles?.username}
            </span>
          </div>
        ))}
    </div>
  );
};

// StatusCreator Component (Modal for creation)
const StatusCreator: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { user } = useAuth();
  const [step, setStep] = useState<'capture' | 'upload' | 'edit'>('capture');
  const [mediaBlob, setMediaBlob] = useState<Blob | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [textOverlay, setTextOverlay] = useState({ text: '', x: 50, y: 50, fontSize: 24, color: 'white' });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  // Capture photo
  const capturePhoto = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await new Promise(resolve => videoRef.current?.addEventListener('loadedmetadata', resolve));
      const canvas = canvasRef.current;
      if (canvas && videoRef.current) {
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(videoRef.current, 0, 0);
        canvas.toBlob((blob) => {
          setMediaBlob(blob!);
          setMediaType('image');
          setStep('edit');
          stream.getTracks().forEach(track => track.stop());
        }, 'image/jpeg');
      }
    }
  };

  // Record video (long press simulation with hold button)
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const startRecord = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
    mediaRecorderRef.current = new MediaRecorder(stream);
    mediaRecorderRef.current.ondataavailable = (e) => chunksRef.current.push(e.data);
    mediaRecorderRef.current.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      setMediaBlob(blob);
      setMediaType('video');
      setStep('edit');
      stream.getTracks().forEach(track => track.stop());
      chunksRef.current = [];
    };
    mediaRecorderRef.current.start();
    setRecording(true);
  };

  const stopRecord = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  // Upload file
  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        setMediaType('image');
      } else if (file.type.startsWith('video/')) {
        setMediaType('video');
      }
      setMediaBlob(file);
      setStep('edit');
    }
  };

  // Drag text
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    const rect = editorRef.current?.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect!.left - textOverlay.x,
      y: e.clientY - rect!.top - textOverlay.y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !editorRef.current) return;
    const rect = editorRef.current.getBoundingClientRect();
    setTextOverlay(prev => ({
      ...prev,
      x: Math.max(0, Math.min(100, ((e.clientX - rect.left - dragOffset.x) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((e.clientY - rect.top - dragOffset.y) / rect.height) * 100)),
    }));
  };

  const handleMouseUp = () => setIsDragging(false);

  // Post status
  const handlePost = async () => {
    if (!user || !mediaBlob) return;
    const { data: upload } = await uploadStatusMedia(mediaBlob as File);
    if (upload) {
      const { error } = await supabase
        .from('statuses')
        .insert({
          media_url: upload.url,
          media_type: mediaType,
          text_overlay: textOverlay.text ? textOverlay : {},
        });
      if (!error) {
        onClose();
        setStep('capture');
        setMediaBlob(null);
        setTextOverlay({ text: '', x: 50, y: 50, fontSize: 24, color: 'white' });
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-black flex items-center justify-center p-4" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
      <div className="bg-[rgb(var(--color-surface))] rounded-2xl p-4 w-full max-w-md max-h-[90vh] overflow-y-auto relative">
        <button onClick={onClose} className="absolute top-2 right-2 p-1 hover:bg-[rgb(var(--color-surface-hover))]">
          <X size={20} />
        </button>

        {step === 'capture' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-center">Create Status</h2>
            <video ref={videoRef} className="w-full h-48 object-cover rounded" autoPlay muted />
            <div className="flex space-x-2">
              <button onClick={capturePhoto} className="flex-1 p-3 bg-[rgb(var(--color-primary))] text-white rounded-lg flex items-center justify-center space-x-2">
                <Camera size={20} /> <span>Photo</span>
              </button>
              <button 
                onMouseDown={startRecord} 
                onMouseUp={stopRecord} 
                onMouseLeave={stopRecord}
                className={`flex-1 p-3 rounded-lg flex items-center justify-center space-x-2 ${recording ? 'bg-red-500' : 'bg-[rgb(var(--color-accent))]'}`}
              >
                <Video size={20} /> <span>{recording ? 'Stop' : 'Video'}</span>
              </button>
            </div>
            <button onClick={() => fileInputRef.current?.click()} className="w-full p-3 bg-[rgb(var(--color-border))] text-[rgb(var(--color-text))] rounded-lg flex items-center justify-center space-x-2">
              <ImageIcon size={20} /> <span>Upload</span>
            </button>
            <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleUpload} className="hidden" />
          </div>
        )}

        {step === 'edit' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-center">Edit Status</h2>
            <div ref={editorRef} className="relative w-full h-64 bg-black rounded overflow-hidden cursor-move" style={{ position: 'relative' }}>
              {mediaType === 'image' && mediaBlob && (
                <img src={URL.createObjectURL(mediaBlob)} className="w-full h-full object-cover" alt="Preview" />
              )}
              {mediaType === 'video' && mediaBlob && (
                <video src={URL.createObjectURL(mediaBlob)} className="w-full h-full object-cover" controls muted />
              )}
              {textOverlay.text && (
                <div
                  className="absolute select-none pointer-events-none bg-black/50 text-white p-2 rounded"
                  style={{
                    left: `${textOverlay.x}%`,
                    top: `${textOverlay.y}%`,
                    fontSize: `${textOverlay.fontSize}px`,
                    color: textOverlay.color,
                  }}
                  onMouseDown={handleMouseDown}
                >
                  {textOverlay.text}
                </div>
              )}
            </div>
            <input
              type="text"
              placeholder="Add text..."
              value={textOverlay.text}
              onChange={(e) => setTextOverlay(prev => ({ ...prev, text: e.target.value }))}
              className="w-full p-2 border border-[rgb(var(--color-border))] rounded"
            />
            <div className="flex space-x-2 text-sm">
              <button onClick={() => setTextOverlay(prev => ({ ...prev, fontSize: prev.fontSize + 4 }))}><Edit3 size={16} /></button>
              <input type="color" value={textOverlay.color} onChange={(e) => setTextOverlay(prev => ({ ...prev, color: e.target.value }))} className="w-8 h-8" />
            </div>
            <button onClick={handlePost} className="w-full p-3 bg-[rgb(var(--color-primary))] text-white rounded-lg">
              Post Status
            </button>
          </div>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

// StatusViewer Component (Full screen for viewing)
const StatusViewer: React.FC<{ userId: string; onClose: () => void }> = ({ userId, onClose }) => {
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showText, setShowText] = useState(true);

  useEffect(() => {
    const fetchStatuses = async () => {
      const { data } = await supabase
        .from('statuses')
        .select('*, profiles!user_id(*)')
        .eq('user_id', userId)
        .gt('expires_at', new Date().toISOString())  // Active only
        .order('created_at', { ascending: true });
      setStatuses(data || []);
      if (data && data.length > 0) setCurrentIndex(0);
    };
    fetchStatuses();
  }, [userId]);

  if (statuses.length === 0) return null;

  const current = statuses[currentIndex];
  const overlay = current.text_overlay as any;

  return (
    <div className="fixed inset-0 z-[1000] bg-black flex flex-col" onClick={() => onClose()}>
      {/* Progress Bars */}
      <div className="flex space-x-2 p-2 absolute top-20 left-1/2 transform -translate-x-1/2 w-[90%] z-10">
        {statuses.map((_, idx) => (
          <div key={idx} className="flex-1 h-1 bg-white/30 rounded-full">
            <div className={`h-full bg-[rgb(var(--color-primary))] rounded-full transition-all ${idx <= currentIndex ? 'w-full' : 'w-0'}`} />
          </div>
        ))}
      </div>

      {/* Media */}
      <div className="flex-1 flex items-center justify-center relative">
        {current.media_type === 'image' && (
          <img src={current.media_url} className="max-w-full max-h-full object-contain" alt="Status" />
        )}
        {current.media_type === 'video' && (
          <video src={current.media_url} className="max-w-full max-h-full object-contain" autoPlay muted loop />
        )}
        {showText && overlay.text && (
          <div 
            className="absolute text-white text-xl font-bold p-2 bg-black/50 rounded"
            style={{ left: `${overlay.x}%`, top: `${overlay.y}%`, fontSize: overlay.fontSize }}
          >
            {overlay.text}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between p-4">
        <button onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}><ChevronLeft size={32} className="text-white" /></button>
        <button onClick={onClose} className="text-white"><X size={32} /></button>
        <button onClick={() => setCurrentIndex(Math.min(statuses.length - 1, currentIndex + 1))}><ChevronRight size={32} className="text-white" /></button>
      </div>
    </div>
  );
};

// StatusArchive Component
export const StatusArchive: React.FC = () => {
  const { user } = useAuth();
  const [allStatuses, setAllStatuses] = useState<Status[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<Status | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    const fetchAll = async () => {
      const { data } = await supabase
        .from('statuses')
        .select('*, profiles!user_id(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setAllStatuses(data || []);
    };
    fetchAll();
  }, [user]);

  const openArchiveViewer = (status: Status) => setSelectedStatus(status);

  if (allStatuses.length === 0) {
    return (
      <div className="p-8 text-center text-[rgb(var(--color-text-secondary))]">
        <Archive size={48} className="mx-auto mb-4 opacity-50" />
        <p>No statuses in your archive yet.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Status Archive</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {allStatuses.map((status) => (
          <div key={status.id} className="relative group cursor-pointer" onClick={() => openArchiveViewer(status)}>
            {status.media_type === 'image' ? (
              <img src={status.media_url} className="w-full aspect-square object-cover rounded" alt="Archive" />
            ) : (
              <video src={status.media_url} className="w-full aspect-square object-cover rounded" muted />
            )}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-end p-2 rounded">
              <span className="text-white text-sm truncate">{new Date(status.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Simple Viewer Modal */}
      {selectedStatus && (
        <div className="fixed inset-0 z-50 bg-black flex items-center justify-center p-4" onClick={() => setSelectedStatus(null)}>
          <div className="relative w-full max-w-md" onClick={e => e.stopPropagation()}>
            {selectedStatus.media_type === 'image' ? (
              <img src={selectedStatus.media_url} className="w-full rounded" alt="Full" />
            ) : (
              <video src={selectedStatus.media_url} className="w-full rounded" controls muted />
            )}
            <button onClick={() => setSelectedStatus(null)} className="absolute top-2 right-2 text-white"><X size={24} /></button>
          </div>
        </div>
      )}
    </div>
  );
};

// StatusSidebar Component
interface StatusSidebarProps {
  show: boolean;
  onClose: () => void;
  setView: (view: string) => void;
  view: string;
}

export const StatusSidebar: React.FC<StatusSidebarProps> = ({ show, onClose, setView, view }) => {
  const isMobile = useIsMobile();

  const menuItems = [
    { icon: <Menu size={20} />, label: 'Home', view: 'feed', onClick: () => { setView('feed'); if (isMobile) onClose(); } },
    { icon: <MessageSquare size={20} />, label: 'Messages', view: 'messages', onClick: () => { setView('messages'); if (isMobile) onClose(); } },
    { icon: <User size={20} />, label: 'Profile', view: 'profile', onClick: () => { setView('profile'); if (isMobile) onClose(); } },
    { icon: <Settings size={20} />, label: 'Settings', view: 'settings', onClick: () => { setView('settings'); if (isMobile) onClose(); } },
    { icon: <Archive size={20} />, label: 'Status Archive', view: 'archive', onClick: () => { setView('archive'); if (isMobile) onClose(); } },
  ];

  return (
    <div className={`
      fixed left-0 top-0 h-full w-64 bg-[rgb(var(--color-surface))] border-r border-[rgb(var(--color-border))] z-[99]
      ${isMobile ? (show ? 'translate-x-0' : '-translate-x-full') : 'translate-x-0'}
      transition-transform duration-300 shadow-lg
    `}>
      <div className="p-4 border-b border-[rgb(var(--color-border))]">
        <h1 className="text-xl font-bold text-[rgb(var(--color-text))]">Liaoverse</h1>
        {isMobile && <button onClick={onClose} className="mt-2 p-2 hover:bg-[rgb(var(--color-surface-hover))] rounded"><X size={20} /></button>}
      </div>
      <nav className="p-4 space-y-2">
        {menuItems.map((item, idx) => (
          <button
            key={idx}
            onClick={item.onClick}
            className={`w-full flex items-center space-x-3 p-3 rounded-lg transition ${
              view === item.view
                ? 'bg-[rgba(var(--color-primary),0.1)] text-[rgb(var(--color-primary))]'
                : 'text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-surface-hover))]'
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

// Global Modals (attach to window for cross-component)
export const Status: React.FC = () => {
  const [showCreator, setShowCreator] = useState(false);
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);

  useEffect(() => {
    const handleOpenCreator = () => setShowCreator(true);
    const handleOpenViewer = (e: any) => setViewerUserId(e.detail.userId);

    window.addEventListener('openStatusCreator', handleOpenCreator);
    window.addEventListener('openStatusViewer', handleOpenViewer);

    return () => {
      window.removeEventListener('openStatusCreator', handleOpenCreator);
      window.removeEventListener('openStatusViewer', handleOpenViewer);
    };
  }, []);

  return (
    <>
      {showCreator && <StatusCreator onClose={() => setShowCreator(false)} />}
      {viewerUserId && <StatusViewer userId={viewerUserId} onClose={() => setViewerUserId(null)} />}
    </>
  );
};
