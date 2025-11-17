// src/components/Notifications.tsx

import { useEffect, useState } from 'react';
import { supabase, Profile } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { X, Heart, MessageCircle, UserPlus, Zap, Trash2 } from 'lucide-react'; 
import { useNavigate } from 'react-router-dom';

// 1. Define the TypeScript type for a Notification, based on the proposed schema
interface Notification {
  id: string;
  recipient_id: string;
  actor_id: string;
  type: 'like' | 'comment' | 'follow';
  entity_id: string; // The ID of the post, comment, etc.
  is_read: boolean;
  created_at: string;
  // Join data from actor's profile - RENAMED from 'profiles' to 'actor'
  actor: { // <-- RENAMED TO AVOID AMBIGUITY
    username: string;
    display_name: string;
    avatar_url: string;
  } | null;
}

const getNotificationIcon = (type: Notification['type']) => {
  switch (type) {
    case 'like':
      return <Heart size={16} className="text-red-500 fill-red-500" />;
    case 'comment':
      return <MessageCircle size={16} className="text-blue-500 fill-blue-500" />;
    case 'follow':
      return <UserPlus size={16} className="text-green-500" />;
    default:
      return <Zap size={16} className="text-[rgb(var(--color-text-secondary))]" />;
  }
};

const getNotificationText = (notif: Notification) => {
  switch (notif.type) {
    case 'like':
      return 'liked your post.';
    case 'comment':
      return 'commented on your post.';
    case 'follow':
      return 'started following you.';
    default:
      return 'sent you a notification.';
  }
};


export const Notifications = ({ onClose }: { onClose: () => void }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [isClearing, setIsClearing] = useState(false); // NEW STATE FOR CLEAR ALL

  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const fetchNotifications = async () => {
      // FIX: Removed internal comment from the select string.
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          actor:profiles!notifications_actor_id_fkey (username, display_name, avatar_url)
        `)
        .eq('recipient_id', user.id)
        // Only fetch the 50 most recent, read or unread
        .order('created_at', { ascending: false }) 
        .limit(50);

      if (error) {
        console.error('Error fetching notifications:', error); 
      } else {
        setNotifications((data as Notification[]) || []);
      }
      setLoading(false);
    };

    fetchNotifications();
    
    // Real-time listeners remain the same...
    const channel = supabase.channel(`notifications-${user.id}`)
    
    channel.on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'notifications', 
        filter: `recipient_id=eq.${user.id}`
      }, () => {
        // Re-fetch on insert to get the full notification object including actor profile
        fetchNotifications(); 
    })
    
    channel.on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'notifications',
      filter: `recipient_id=eq.${user.id}`
    }, (payload) => {
      // Update the notification in the list if its read status changes
      setNotifications(prev => prev.map(n => 
        n.id === payload.new.id ? { ...n, is_read: payload.new.is_read as boolean } : n
      ));
    });
    
    channel.on('postgres_changes', {
      event: 'DELETE',
      schema: 'public',
      table: 'notifications',
      filter: `recipient_id=eq.${user.id}`
    }, (payload) => {
      // Remove deleted notification from the list
      setNotifications(prev => prev.filter(n => n.id !== payload.old.id));
    });
    
    channel.subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };

  }, [user]);

  // NEW: Clear All Seen Function
  const handleClearAllSeen = async () => {
    if (!user || isClearing) return;

    setIsClearing(true);
    
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('recipient_id', user.id)
      .eq('is_read', true); // Only delete ones that have been read

    if (error) {
      console.error('Error clearing notifications:', error);
    } else {
      // Optimistically update UI
      setNotifications(prev => prev.filter(n => !n.is_read));
    }

    setIsClearing(false);
  };
  
  const handleNotificationClick = (notif: Notification) => {
    // 1. Mark notification as read in the UI
    if (!notif.is_read) {
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
        // 2. Update status in database (optional, this will happen eventually via the channel listener on the update)
        // supabase.from('notifications').update({ is_read: true }).eq('id', notif.id).match({ recipient_id: user.id });
    }
    
    onClose();
    if (notif.type === 'follow') {
      if (notif.actor?.username) {
        navigate(`/?${notif.actor.username}`);
      }
    } else {
      // Placeholder for post navigation logic
      // e.g. navigate(`/post/${notif.entity_id}`);
    }
  };


  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex justify-end" onClick={onClose}>
      <div 
        className="w-full max-w-sm h-full bg-[rgb(var(--color-background))] shadow-xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-[rgb(var(--color-surface))] border-b border-[rgb(var(--color-border))] p-4 flex justify-between items-center z-10">
          <h2 className="text-xl font-bold text-[rgb(var(--color-text))]">Notifications</h2>
          <div className='flex items-center gap-2'>
            {/* NEW: Clear All Seen Button */}
            <button
              onClick={handleClearAllSeen} 
              // Disable if clearing or if no notifications are marked as read
              disabled={isClearing || !notifications.some(n => n.is_read)} 
              className="text-sm p-1 px-3 rounded-full text-red-600 border border-red-600 hover:bg-red-600 hover:text-[rgb(var(--color-text-on-primary))] transition disabled:opacity-50"
              title="Clear all seen notifications"
            >
              <Trash2 size={16} className='inline mr-1'/>
              {isClearing ? 'Clearing...' : 'Clear All Seen'}
            </button>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-[rgb(var(--color-surface-hover))] transition text-[rgb(var(--color-text))]">
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="flex flex-col">
          {/* ... loading and empty states ... */}
          {loading && (
            <div className="p-4 text-center text-[rgb(var(--color-text-secondary))]">
              Loading notifications...
            </div>
          )}
          
          {!loading && notifications.length === 0 && (
            <div className="p-12 text-center text-[rgb(var(--color-text-secondary))]">
              You're all caught up! No notifications.
            </div>
          )}

          {!loading && notifications.length > 0 && (
            <div>
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`flex items-start gap-4 p-3 border-b border-[rgb(var(--color-border))] cursor-pointer hover:bg-[rgb(var(--color-surface-hover))] transition ${
                    !notif.is_read ? 'bg-[rgba(var(--color-primary),0.05)]' : ''
                  }`}
                >
                  {/* Icon Column */}
                  <div className="w-6 h-6 flex items-center justify-center pt-1">
                    {getNotificationIcon(notif.type)}
                  </div>
                  
                  {/* Avatar and Text Column */}
                  <div className="flex-1 min-w-0 flex items-start gap-3">
                    <img
                      src={notif.actor?.avatar_url || '/default-avatar.png'} // <-- CHANGED TO notif.actor
                      alt={notif.actor?.username || 'user'}
                      className="w-10 h-10 rounded-full object-cover"
                      onClick={(e) => {
                          e.stopPropagation();
                          if (notif.actor?.username) {
                              onClose();
                              navigate(`/?${notif.actor.username}`);
                          }
                      }}
                    />
                    <div className="flex-1">
                      <p className="text-[rgb(var(--color-text))] break-words">
                        <span className="font-bold cursor-pointer hover:underline"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (notif.actor?.username) {
                                    onClose();
                                    navigate(`/?${notif.actor.username}`);
                                }
                            }}
                        >
                          {notif.actor?.display_name || 'User'} {/* <-- CHANGED TO notif.actor */}
                        </span>
                        {' '}
                        {getNotificationText(notif)}
                      </p>
                      <span className="text-xs text-[rgb(var(--color-text-secondary))]\">
                        {new Date(notif.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
