// src/components/Messages.tsx
import { useEffect, useState, useRef } from 'react';
import { supabase, Message, Profile } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Send, BadgeCheck, Search, ArrowLeft, X, Image } from 'lucide-react'; // Added Image icon

export const Messages = () => {
  const [conversations, setConversations] = useState<Profile[]>([]);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [showImageInput, setShowImageInput] = useState(false); // New state for image URL input visibility
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // REUSABLE CHANNELS
  const typingChannelRef = useRef<any>(null);
  const outgoingTypingChannelRef = useRef<any>(null);

  const { user } = useAuth();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const goToProfile = async (profileId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', profileId)
      .single();
    if (data) {
      window.history.replaceState({}, '', `/?${data.username}`);
    }
    window.dispatchEvent(new CustomEvent('navigateToProfile', { detail: profileId }));
  };

  // Load conversations (sorted by latest message)
  const loadConversations = async () => {
    const { data } = await supabase
      .from('messages')
      .select(`
        id,
        sender_id,
        recipient_id,
        created_at,
        sender:profiles!sender_id(id, username, display_name, avatar_url, verified),
        recipient:profiles!recipient_id(id, username, display_name, avatar_url, verified)
      `)
      .or(`sender_id.eq.${user!.id},recipient_id.eq.${user!.id}`)
      .order('created_at', { ascending: false });

    const convMap = new Map<string, { profile: Profile; latest: string }>();
    data?.forEach((msg: any) => {
      const other = msg.sender_id === user!.id ? msg.recipient : msg.sender;
      if (other) {
        const existing = convMap.get(other.id);
        if (!existing || msg.created_at > existing.latest) {
          convMap.set(other.id, { profile: other, latest: msg.created_at });
        }
      }
    });

    const sorted = Array.from(convMap.values())
      .sort((a, b) => b.latest.localeCompare(a.latest))
      .map(c => c.profile);

    setConversations(sorted);
  };

  useEffect(() => {
  const handleOpenDM = (e: any) => {
    const profile = e.detail;
    if (profile && profile.id !== user?.id) {
      setSelectedUser(profile);
      setShowSidebar(false);
      setSearchQuery('');
    }
  };

  window.addEventListener('openDirectMessage', handleOpenDM);
  return () => window.removeEventListener('openDirectMessage', handleOpenDM);
}, [user]);

  useEffect(() => {
    if (user) loadConversations();
  }, [user]);

  // Search users
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const search = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .or(`username.ilike.%${searchQuery}%,display_name.ilike.%${searchQuery}%`)
        .neq('id', user!.id)
        .limit(20);
      setSearchResults(data || []);
    };
    const debounce = setTimeout(search, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  // Main chat effect
  useEffect(() => {
    if (!selectedUser) {
      // Cleanup channels when leaving chat
      if (typingChannelRef.current) {
        typingChannelRef.current.unsubscribe();
        typingChannelRef.current = null;
      }
      if (outgoingTypingChannelRef.current) {
        outgoingTypingChannelRef.current.unsubscribe();
        outgoingTypingChannelRef.current = null;
      }
      return;
    }

    loadMessages(selectedUser.id);
    setShowSidebar(false);

    // === MESSAGE LISTENER ===
    const messageChannel = supabase
      .channel(`messages:${selectedUser.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const msg = payload.new as Message;
          if (
            (msg.sender_id === user!.id && msg.recipient_id === selectedUser.id) ||
            (msg.sender_id === selectedUser.id && msg.recipient_id === user!.id)
          ) {
            setMessages((prev) => [...prev, msg]);
            scrollToBottom();
            loadConversations(); // Update order
          }
        }
      )
      .subscribe();

    // === INCOMING TYPING (from other user) ===
    const incomingChannelName = `typing:${selectedUser.id}:${user!.id}`;
    typingChannelRef.current = supabase.channel(incomingChannelName);

    typingChannelRef.current
      .on('presence', { event: 'sync' }, () => {
        const state = typingChannelRef.current.presenceState();
        const typing = Object.values(state).flat().some((p: any) => p.typing === true);
        setIsOtherTyping(typing);
      })
      .subscribe();

    // === OUTGOING TYPING (send to other user) ===
    const outgoingChannelName = `typing:${user!.id}:${selectedUser.id}`;
    outgoingTypingChannelRef.current = supabase.channel(outgoingChannelName);

    outgoingTypingChannelRef.current
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await outgoingTypingChannelRef.current.track({ typing: false });
        }
      });

    return () => {
      supabase.removeChannel(messageChannel);
      if (typingChannelRef.current) {
        typingChannelRef.current.unsubscribe();
        typingChannelRef.current = null;
      }
      if (outgoingTypingChannelRef.current) {
        outgoingTypingChannelRef.current.untrack();
        outgoingTypingChannelRef.current.unsubscribe();
        outgoingTypingChannelRef.current = null;
      }
    };
  }, [selectedUser, user]);

  // Send typing status (only if channel is ready)
  const sendTypingStatus = async (typing: boolean) => {
    if (!outgoingTypingChannelRef.current) return;
    try {
      await outgoingTypingChannelRef.current.track({ typing });
    } catch (err) {
      // Ignore if not subscribed yet
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setContent(value);

    if (value.trim()) {
      sendTypingStatus(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        sendTypingStatus(false);
      }, 1000);
    } else {
      sendTypingStatus(false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && !imageUrl.trim() || !selectedUser) return; // Allow sending *only* an image

    sendTypingStatus(false);
    const { data } = await supabase
      .from('messages')
      .insert({
        sender_id: user!.id,
        recipient_id: selectedUser.id,
        content,
        image_url: imageUrl || null,
      })
      .select()
      .single();

    if (data) {
      setContent('');
      setImageUrl('');
      setShowImageInput(false);
    }
  };

  const loadMessages = async (recipientId: string) => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(
        `and(sender_id.eq.${user!.id},recipient_id.eq.${recipientId}),and(sender_id.eq.${recipientId},recipient_id.eq.${user!.id})`
      )
      .order('created_at', { ascending: true });
    setMessages(data || []);
    setTimeout(scrollToBottom, 100);
  };

  const displayList = searchQuery ? searchResults : conversations;

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Sidebar (Conversations List) - Always visible on desktop, conditionally on mobile */}
      <div className={`w-full md:w-96 bg-white border-r border-gray-200 flex-shrink-0 flex flex-col transition-transform duration-300 ease-in-out ${showSidebar ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} md:relative fixed inset-y-0 left-0 z-40 md:z-auto`}>
        <div className="p-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h2 className="text-3xl font-extrabold text-gray-800 mb-4">Chats</h2>
          <div className="relative">
            <Search size={20} className="absolute left-3 top-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search people..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-orange-500 bg-gray-50"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {displayList.length === 0 && (
            <div className="p-8 text-center text-gray-400">
              {searchQuery ? 'No users found' : 'No conversations yet'}
            </div>
          )}

          {displayList.map((u) => (
            <button
              key={u.id}
              onClick={() => {
                setSelectedUser(u);
                setShowSidebar(false); // Hide sidebar on selection for mobile
                setSearchQuery('');
              }}
              className={`w-full flex items-center gap-3 p-4 transition border-b border-gray-100 ${selectedUser?.id === u.id ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
            >
              <img
                src={u.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.username}`}
                className="w-14 h-14 rounded-full object-cover"
                alt=""
              />
              <div className="text-left flex-1 min-w-0">
                <div className="font-semibold flex items-center gap-1 truncate">
                  {u.display_name}
                  {u.verified && <BadgeCheck size={16} className="text-orange-500 flex-shrink-0" />}
                </div>
                <div className="text-sm text-gray-500 truncate">@{u.username}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat Area - Full width on mobile when sidebar is hidden, fills remaining space on desktop */}
      <div className={`flex-1 flex flex-col bg-white transition-all duration-300 ease-in-out ${selectedUser ? '' : 'hidden md:flex'}`}>
        {selectedUser ? (
          <>
            {/* Chat Header */}
            <div className="bg-white border-b border-gray-200 p-3 flex items-center gap-3 sticky top-0 z-20 shadow-sm">
              <button onClick={() => setShowSidebar(true)} className="md:hidden p-1 rounded-full hover:bg-gray-100 transition">
                <ArrowLeft size={24} className="text-gray-600" />
              </button>
              <button onClick={() => goToProfile(selectedUser.id)} className="flex items-center gap-3 flex-1 min-w-0">
                <img
                  src={selectedUser.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedUser.username}`}
                  className="w-10 h-10 rounded-full object-cover"
                  alt=""
                />
                <div className="text-left min-w-0">
                  <div className="font-bold flex items-center gap-1 truncate">
                    {selectedUser.display_name}
                    {selectedUser.verified && <BadgeCheck size={16} className="text-orange-500 flex-shrink-0" />}
                  </div>
                  <div className="text-sm text-gray-500 truncate">@{selectedUser.username}</div>
                </div>
              </button>
            </div>

            {/* Message Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-100">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender_id === user!.id ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] md:max-w-[65%] px-3 py-2 rounded-xl shadow-md ${
                      msg.sender_id === user!.id
                        ? 'bg-orange-500 text-white rounded-br-none' // Custom bubble shape
                        : 'bg-white text-gray-900 border border-gray-200 rounded-tl-none' // Custom bubble shape
                    }`}
                  >
                    {msg.image_url && (
                      <img src={msg.image_url} className="mb-2 rounded-lg max-w-full h-auto" alt="Message" />
                    )}
                    <p className="whitespace-pre-wrap break-words text-sm">{msg.content}</p>
                    <span
                      className={`text-[10px] block mt-1.5 text-right ${
                        msg.sender_id === user!.id ? 'text-orange-200/90' : 'text-gray-500'
                      }`}
                    >
                      {new Date(msg.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              ))}

              {/* OTHER USER TYPING - iMessage/Telegram style typing indicator */}
              {isOtherTyping && (
                <div className="flex justify-start">
                  <div className="bg-white px-3 py-2 rounded-xl shadow-sm border border-gray-200 rounded-tl-none">
                    <div className="flex gap-1 items-end">
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '200ms' }}></span>
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '400ms' }}></span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form onSubmit={sendMessage} className="p-3 bg-white border-t border-gray-200">
              {/* Optional: Image URL Input - Visibility toggle */}
              {showImageInput && (
                <div className="mb-3">
                  <input
                    type="url"
                    placeholder="Paste Image URL here..."
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                </div>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowImageInput(!showImageInput)}
                  className={`p-2 rounded-full transition ${showImageInput ? 'bg-orange-100 text-orange-600' : 'text-gray-500 hover:bg-gray-100'}`}
                  title="Attach Image URL"
                >
                  <Image size={24} />
                </button>
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={content}
                  onChange={handleInputChange}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-full focus:outline-none focus:border-orange-500 text-base"
                />
                <button
                  type="submit"
                  disabled={!content.trim() && !imageUrl.trim()} // Can send message or image alone
                  className={`p-2 rounded-full transition ${(!content.trim() && !imageUrl.trim()) ? 'bg-gray-300 text-gray-500' : 'bg-orange-500 text-white hover:bg-orange-600'}`}
                >
                  <Send size={24} />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 flex-col">
            <span className="text-xl font-semibold mb-2">Welcome to Messages</span>
            <span className="text-center px-8">
              {showSidebar ? 'Select a chat on the left to start messaging.' : 'Tap the arrow to open the chat list.'}
            </span>
            <button onClick={() => setShowSidebar(true)} className="md:hidden mt-4 bg-orange-500 text-white px-4 py-2 rounded-full hover:bg-orange-600 transition">
              <ArrowLeft className="mr-2 inline" /> Back to Chats
            </button>
          </div>
        )}
      </div>

      {/* Overlay for mobile when sidebar is open */}
      {showSidebar && !selectedUser && (
        <div onClick={() => setShowSidebar(false)} className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden" />
      )}
    </div>
  );
};