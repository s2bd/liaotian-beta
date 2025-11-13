// src/components/Calls.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, Profile } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, X } from 'lucide-react';

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

type CallPayload = {
  from: Profile;
  to?: Profile;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  type?: 'audio' | 'video';
};

export const Calls = () => {
  const { user } = useAuth();
  
  // State for call management
  const [incomingCall, setIncomingCall] = useState<CallPayload | null>(null);
  const [callInProgress, setCallInProgress] = useState<{ with: Profile; type: 'audio' | 'video'; isCaller: boolean } | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);

  // Refs for WebRTC and Supabase channel
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const callChannelRef = useRef<any>(null);

  // --- WebRTC & Media Functions (Memoized) ---

  // 1. Get User Media (Mic/Cam)
  const getMedia = useCallback(async (type: 'audio' | 'video') => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: type === 'video',
        audio: true
      });
      setLocalStream(stream);
      if (type === 'video') setIsCamOff(false);
      setIsMuted(false);
      return stream;
    } catch (err) {
      console.error('Error getting user media:', err);
      return null;
    }
  }, []);

  // 2. Clean up media and connection
  const cleanupCall = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    localStream?.getTracks().forEach(track => track.stop());
    remoteStream?.getTracks().forEach(track => track.stop());
    
    setLocalStream(null);
    setRemoteStream(null);
    setCallInProgress(null);
    setIncomingCall(null);
    setIsMuted(false);
    setIsCamOff(false);
  }, [localStream, remoteStream]);

  // 3. Setup Peer Connection
  const setupPeerConnection = useCallback((stream: MediaStream, targetUser: Profile) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] // Public STUN server
    });

    // Send ICE candidates to the other user
    pc.onicecandidate = (event) => {
      if (event.candidate && user) {
        callChannelRef.current?.broadcast({
          event: 'ice-candidate',
          payload: { 
            candidate: event.candidate,
            from: user,
            to: targetUser 
          }
        });
      }
    };

    // When remote stream is added
    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };

    // Add local tracks to the connection
    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    pcRef.current = pc;
    return pc;
  }, [user]);

  // --- Call Action Functions (Memoized) ---

  // 4. Hang Up
  const handleHangUp = useCallback((broadcast = true) => {
    if (broadcast && callInProgress && user) {
        callChannelRef.current?.broadcast({
            event: 'hang-up',
            payload: { from: user, to: callInProgress.with }
        });
    }
    cleanupCall();
  }, [callInProgress, user, cleanupCall]);
  
  // 5. Start a Call
  const startCall = useCallback(async (targetUser: Profile, type: 'audio' | 'video') => {
    if (!user || callInProgress) return;

    const stream = await getMedia(type);
    if (!stream) return; // User denied media
    
    setCallInProgress({ with: targetUser, type, isCaller: true });
    const pc = setupPeerConnection(stream, targetUser);
    
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // Send offer to target user
    callChannelRef.current?.broadcast({
      event: 'call-offer',
      payload: {
        from: user,
        to: targetUser,
        offer: offer,
        type: type
      }
    });
  }, [user, callInProgress, getMedia, setupPeerConnection]);
  
  // 6. Answer a Call
  const answerCall = useCallback(async () => {
    if (!incomingCall || !user) return;

    const stream = await getMedia(incomingCall.type!);
    if (!stream) {
        // User denied media, so deny the call
        handleHangUp(true); // Re-use hangup logic to deny
        return;
    }

    setCallInProgress({ with: incomingCall.from, type: incomingCall.type!, isCaller: false });
    const pc = setupPeerConnection(stream, incomingCall.from);
    
    await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer!));
    
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    // Send answer back
    callChannelRef.current?.broadcast({
      event: 'call-answer',
      payload: {
        answer: answer,
        from: user,
        to: incomingCall.from
      }
    });

    setIncomingCall(null);
  }, [user, incomingCall, getMedia, setupPeerConnection, handleHangUp]);

  // 7. Deny a Call
  const denyCall = useCallback(() => {
     if(incomingCall && user) {
        // Send a 'hang-up' message to deny
        callChannelRef.current?.broadcast({
            event: 'hang-up',
            payload: { from: user, to: incomingCall.from }
        });
     }
     setIncomingCall(null);
  }, [incomingCall, user]);

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

  // Listen for Supabase Realtime call events
  useEffect(() => {
    if (!user) return;

    const channelName = `call:${user.id}`;
    if (callChannelRef.current) {
      supabase.removeChannel(callChannelRef.current);
    }
    
    callChannelRef.current = supabase.channel(channelName);

    callChannelRef.current
      .on('broadcast', { event: 'call-offer' }, ({ payload }: { payload: CallPayload }) => {
        if (payload.to?.id === user.id && !callInProgress && !incomingCall) {
          setIncomingCall(payload);
        }
      })
      .on('broadcast', { event: 'call-answer' }, async ({ payload }: { payload: CallPayload }) => {
        if (payload.to?.id === user.id && callInProgress && callInProgress.isCaller) {
          await pcRef.current?.setRemoteDescription(new RTCSessionDescription(payload.answer!));
        }
      })
      .on('broadcast', { event: 'ice-candidate' }, async ({ payload }: { payload: CallPayload }) => {
        if (payload.to?.id === user.id && callInProgress) {
           await pcRef.current?.addIceCandidate(new RTCIceCandidate(payload.candidate!));
        }
      })
      .on('broadcast', { event: 'hang-up' }, ({ payload }: { payload: CallPayload }) => {
        // Other user hung up
        if (callInProgress && payload.from.id === callInProgress.with.id) {
          handleHangUp(false); // Just clean up, don't re-broadcast
        }
        // Other user denied call
        if (incomingCall && payload.from.id === incomingCall.from.id) {
          setIncomingCall(null);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(callChannelRef.current);
    };
  }, [user, callInProgress, incomingCall, handleHangUp]);


  // --- Media Toggles ---

  const toggleMute = () => {
    localStream?.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
    });
    setIsMuted(!isMuted);
  };

  const toggleCamera = () => {
    localStream?.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
    });
    setIsCamOff(!isCamOff);
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
        <Modal onClose={() => handleHangUp(true)} wide={true}>
            <div className="text-center text-[rgb(var(--color-text))]">
                <h3 className="text-xl font-bold mb-4">
                    {callInProgress.isCaller && !remoteStream ? 'Ringing' : 'In call with'} {callInProgress.with.display_name}
                </h3>
                
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
                        className={`absolute bottom-4 right-4 w-32 h-24 rounded-lg object-cover border-2 border-white shadow-lg ${isCamOff ? 'hidden' : ''}`}
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
                      onClick={() => handleHangUp(true)}
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
