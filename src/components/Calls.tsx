// src/components/Calls.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, Profile } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, X } from 'lucide-react';
import Peer from 'peerjs';

// A simple reusable Modal component
const Modal = ({ children, onClose, wide = false }: { children: React.ReactNode, onClose: () => void, wide?: boolean }) => (
  <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4" onClick={onClose}>
    <div 
      className={`bg-[rgb(var(--color-surface))] rounded-lg shadow-xl p-6 w-full ${wide ? 'max-w-lg' : 'max-w-sm'} relative`} 
      onClick={(e) => e.stopPropagation()}
    >
      <button onClick={onClose} className="absolute top-3 right-3 p-1 rounded-full text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-surface-hover))]">
        <X size={20} />
      </button>
      {children}
    </div>
  </div>
);

// Modified to hold the PeerJS call object
type IncomingCall = {
  from: Profile;
  type: 'audio' | 'video';
  peerCall: Peer.MediaConnection; // From PeerJS
};

export const Calls = () => {
  const { user } = useAuth();
  
  // State for call management
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [callInProgress, setCallInProgress] = useState<{ with: Profile; type: 'audio' | 'video'; isCaller: boolean } | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null); // For UI errors

  // Refs for PeerJS
  const peerRef = useRef<Peer | null>(null);
  const activeCallRef = useRef<Peer.MediaConnection | null>(null);

  // --- WebRTC & Media Functions (Memoized) ---

  // 1. Get User Media (Mic/Cam)
  // This is now modified to handle permission errors gracefully
  const getMedia = useCallback(async (type: 'audio' | 'video') => {
    setMediaError(null);
    const constraints = {
      audio: true,
      video: type === 'video'
    };
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      if (type === 'video') setIsCamOff(false);
      setIsMuted(false);
      return stream;
    } catch (err: any) {
      console.error('Error getting user media:', err);
      // Set UI error based on permission denial
      if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
         setMediaError('No microphone or camera found.');
      } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
         if (type === 'video') {
             setMediaError('Microphone and/or Camera access denied.');
         } else {
             setMediaError('Microphone access denied.');
         }
      } else {
         setMediaError('Error accessing media devices.');
      }
      
      // Proceed with no stream
      setLocalStream(null); 
      setIsMuted(true);
      if (type === 'video') setIsCamOff(true);
      return null;
    }
  }, []);

  // 2. Clean up media and connection
  const cleanupCall = useCallback(() => {
    activeCallRef.current?.close();
    activeCallRef.current = null;
    
    localStream?.getTracks().forEach(track => track.stop());
    remoteStream?.getTracks().forEach(track => track.stop());
    
    setLocalStream(null);
    setRemoteStream(null);
    setCallInProgress(null);
    setIncomingCall(null);
    setIsMuted(false);
    setIsCamOff(false);
    setMediaError(null); // Clear errors
  }, [localStream, remoteStream]);

  // --- Call Action Functions (Memoized) ---

  // 4. Hang Up
  const handleHangUp = useCallback(() => {
    cleanupCall(); // PeerJS handles notifying the other user via 'close' event
  }, [cleanupCall]);
  
  // 5. Start a Call
  const startCall = useCallback(async (targetUser: Profile, type: 'audio' | 'video') => {
    if (!user || callInProgress || !peerRef.current) return;

    // Get stream. May return null if permissions denied, but we continue.
    const stream = await getMedia(type); 
    
    setCallInProgress({ with: targetUser, type, isCaller: true });
    
    const metadata = { from: user, type: type };
    const call = peerRef.current.call(targetUser.id, stream!, { metadata });
    
    activeCallRef.current = call;

    // Set up listeners for this outgoing call
    call.on('stream', (remoteStream) => {
      setRemoteStream(remoteStream);
    });
    call.on('close', () => {
      cleanupCall(); // Other user hung up
    });
    call.on('error', (err) => {
      console.error('Peer call error:', err);
      cleanupCall();
    });

  }, [user, callInProgress, getMedia, cleanupCall]);
  
  // 6. Answer a Call
  const answerCall = useCallback(async () => {
    if (!incomingCall || !user) return;

    // Get stream. May return null.
    const stream = await getMedia(incomingCall.type);

    setCallInProgress({ with: incomingCall.from, type: incomingCall.type, isCaller: false });
    
    // Answer the call
    incomingCall.peerCall.answer(stream!);
    
    activeCallRef.current = incomingCall.peerCall;

    // Set up listeners for this answered call
    incomingCall.peerCall.on('stream', (remoteStream) => {
      setRemoteStream(remoteStream);
    });
    incomingCall.peerCall.on('close', () => {
      cleanupCall(); // Caller hung up
    });
    incomingCall.peerCall.on('error', (err) => {
      console.error('Peer call error:', err);
      cleanupCall();
    });

    setIncomingCall(null);
  }, [user, incomingCall, getMedia, cleanupCall]);

  // 7. Deny a Call
  const denyCall = useCallback(() => {
     if(incomingCall) {
        incomingCall.peerCall.close(); // Just close the connection
     }
     setIncomingCall(null);
  }, [incomingCall]);

  // --- Event Listeners ---

  // Listen for 'startCall' window event from Messages.tsx
  useEffect(() => {
     const handleStartCall = (e: any) => {
        const { targetUser, type } = e.detail;
        startCall(targetUser, type);
     };
     window.addEventListener('startCall', handleStartCall);
     return () => window.removeEventListener('startCall', handleStartCall);
  }, [startCall]);

  // Initialize PeerJS and listen for incoming calls
  useEffect(() => {
    if (!user || peerRef.current) return;

    // Use the user's Supabase ID as their PeerJS ID
    const peer = new Peer(user.id);
    peerRef.current = peer;

    peer.on('open', (id) => {
      console.log('PeerJS connected with ID:', id);
    });

    // This REPLACES the Supabase 'call-offer' broadcast listener
    peer.on('call', (call) => {
      const metadata = call.metadata;
      
      // We are busy or already have an incoming call
      if (callInProgress || incomingCall) {
        call.close();
        return;
      }
      
      // Show incoming call modal
      setIncomingCall({
        from: metadata.from,
        type: metadata.type,
        peerCall: call
      });
    });

    peer.on('error', (err) => {
      console.error('PeerJS error:', err);
      // Handle different error types, e.g., 'network', 'peer-unavailable'
      if (err.type === 'peer-unavailable' && callInProgress && !remoteStream) {
        setMediaError(`${callInProgress.with.display_name} is offline.`);
      }
    });

    // Cleanup on unmount
    return () => {
      peer.destroy();
      peerRef.current = null;
    };
  }, [user, callInProgress, incomingCall]);


  // --- Media Toggles ---
  // Modified to check if tracks exist before toggling

  const toggleMute = () => {
    const audioTracks = localStream?.getAudioTracks() || [];
    if (audioTracks.length > 0) {
        audioTracks.forEach(track => {
            track.enabled = !track.enabled;
        });
        setIsMuted(!isMuted);
    } else {
        // No track, just set error
        setMediaError('No microphone track available.');
    }
  };

  const toggleCamera = () => {
    const videoTracks = localStream?.getVideoTracks() || [];
    if (videoTracks.length > 0) {
        videoTracks.forEach(track => {
            track.enabled = !track.enabled;
        });
        setIsCamOff(!isCamOff);
    } else {
        // No track, just set error
        setMediaError('No camera track available.');
    }
  };
  
  // --- Render Logic ---

  // 1. Incoming Call Modal
  if (incomingCall) {
    return (
      <Modal onClose={denyCall}>
        <div className="text-center text-[rgb(var(--color-text))]">
          <img
             src={incomingCall.from.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${incomingCall.from.username}`}
             className="w-24 h-24 rounded-full object-cover mx-auto mb-4"
             alt=""
          />
          <h3 className="text-xl font-bold">{incomingCall.from.display_name}</h3>
          <p className="text-[rgb(var(--color-text-secondary))]">
            Incoming {incomingCall.type} call...
          </p>
          <div className="flex justify-center gap-4 mt-6">
            <button
              onClick={denyCall}
              className="p-4 rounded-full bg-red-600 text-white transition hover:bg-red-700"
              title="Deny"
            >
              <PhoneOff size={24} />
            </button>
            <button
              onClick={answerCall}
              className="p-4 rounded-full bg-green-500 text-white transition hover:bg-green-600"
              title="Answer"
            >
              <Phone size={24} />
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  // 2. Call In Progress Modal
  if (callInProgress) {
     return (
        <Modal onClose={handleHangUp} wide={true}>
            <div className="text-center text-[rgb(var(--color-text))]">
                <h3 className="text-xl font-bold mb-2">
                    {callInProgress.isCaller && !remoteStream ? 'Ringing' : 'In call with'} {callInProgress.with.display_name}
                </h3>
                
                {/* Display Media Errors */}
                {mediaError && (
                  <p className="text-red-500 text-sm mb-3">{mediaError}</p>
                )}
                
                <div className="relative w-full aspect-video bg-black rounded-lg mb-4">
                    {/* Remote Video */}
                    <video 
                        ref={el => { if (el) el.srcObject = remoteStream; }} 
                        autoPlay 
                        playsInline 
                        className={`w-full h-full object-cover ${!remoteStream ? 'hidden' : ''}`}
                    />
                    {/* Avatar Fallback */}
                    {!remoteStream && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <img
                                src={callInProgress.with.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${callInProgress.with.username}`}
                                className="w-24 h-24 rounded-full object-cover opacity-50"
                                alt=""
                            />
                        </div>
                    )}
                    {/* Local Video */}
                    <video 
                        ref={el => { if (el) el.srcObject = localStream; }} 
                        autoPlay 
                        playsInline 
                        muted
                        className={`absolute bottom-4 right-4 w-32 h-24 rounded-lg object-cover border-2 border-white shadow-lg ${isCamOff || !localStream ? 'hidden' : ''}`}
                    />
                </div>

                {/* Call Controls */}
                <div className="flex justify-center gap-4 mt-6">
                    <button
                      onClick={toggleMute}
                      className={`p-3 rounded-full transition ${isMuted ? 'bg-red-600 text-white' : 'bg-[rgb(var(--color-surface-hover))] text-[rgb(var(--color-text))]'}`}
                      title={isMuted ? "Unmute" : "Mute"}
                    >
                      {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                    </button>
                    {callInProgress.type === 'video' && (
                        <button
                          onClick={toggleCamera}
                          className={`p-3 rounded-full transition ${isCamOff ? 'bg-red-600 text-white' : 'bg-[rgb(var(--color-surface-hover))] text-[rgb(var(--color-text))]'}`}
                          title={isCamOff ? "Turn camera on" : "Turn camera off"}
                        >
                          {isCamOff ? <VideoOff size={20} /> : <Video size={20} />}
                        </button>
                    )}
                    <button
                      onClick={handleHangUp}
                      className="p-4 rounded-full bg-red-600 text-white transition hover:bg-red-700"
                      title="Hang up"
                    >
                      <PhoneOff size={24} />
                    </button>
                </div>
            </div>
        </Modal>
     );
  }
  
  // 3. No call, render nothing
  return null;
};
