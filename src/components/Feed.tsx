// Feed.tsx
import { useEffect, useState, useRef } from 'react';
import { supabase, Post } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Send, BadgeCheck, Edit3 } from 'lucide-react';

const FOLLOW_ONLY_FEED = import.meta.env.VITE_FOLLOW_ONLY_FEED === 'true';

export const Feed = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const { user } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadPosts = async () => {
    let query = supabase.from('posts').select('*, profiles(*)').order('created_at', { ascending: false });
    if (FOLLOW_ONLY_FEED && user) {
    const { data: following } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id);

    const followingIds = following?.map(f => f.following_id) || [];
    const allowedIds = [...followingIds, user.id]; // ← THIS LINE ADDED

    query = query.in('user_id', allowedIds);
  }
    const { data } = await query;
    setPosts(data || []);
  };

  useEffect(() => {
    loadPosts();

    const channel = supabase.channel('public:posts').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, async (payload) => {
      if (FOLLOW_ONLY_FEED && user) {
    // Always show own posts
    if (payload.new.user_id === user.id) {
      const { data } = await supabase.from('posts').select('*, profiles(*)').eq('id', payload.new.id).single();
      if (data) setPosts(current => [data, ...current]);
      return;
    }

    const { data: followData } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id)
      .eq('following_id', payload.new.user_id);

    if (!followData?.length) return;
  }
      const { data } = await supabase.from('posts').select('*, profiles(*)').eq('id', payload.new.id).single();
      if (data) setPosts(current => [data, ...current]);
    }).subscribe();

    const handleScroll = () => {
      const scrolled = window.scrollY > 100;
      if (scrolled && isExpanded) setIsExpanded(false);
      setHasScrolled(scrolled);
    };
    window.addEventListener('scroll', handleScroll);
    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [user, isExpanded]);

  const createPost = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!content.trim()) return;

  // INSERT ONLY — DO NOT add to state here!
  await supabase
    .from('posts')
    .insert({ 
      user_id: user!.id, 
      content, 
      image_url: imageUrl || null 
    });

  // Reset form
  setContent('');
  setImageUrl('');
  setIsExpanded(false);
};

  const goToProfile = async (profileId: string) => {
    const { data } = await supabase.from('profiles').select('username').eq('id', profileId).single();
    if (data) {
      window.history.replaceState({}, '', `/?${data.username}`);
      window.dispatchEvent(new CustomEvent('navigateToProfile', { detail: profileId }));
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div ref={scrollRef} className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        {isExpanded ? (
          <form onSubmit={createPost} className="p-4 space-y-3">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's happening?"
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:border-orange-500 resize-none"
              autoFocus
            />
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="Image URL (optional)"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-full text-sm focus:outline-none focus:border-orange-500"
              />
              <button
                type="submit"
                disabled={!content.trim()}
                className="bg-orange-500 disabled:bg-gray-300 text-white px-6 py-2 rounded-full hover:bg-orange-600 flex items-center gap-2 font-semibold transition"
              >
                <Send size={16} />
                Post
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setIsExpanded(true)}
            className="w-full p-4 flex items-center gap-3 hover:bg-gray-50 transition"
          >
            <Edit3 size={20} className="text-gray-500" />
            <span className="text-gray-600">Write a post...</span>
          </button>
        )}
      </div>

      <div>
        {posts.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            {FOLLOW_ONLY_FEED ? 'No posts from people you follow yet.' : 'No posts yet. Be the first!'}
          </div>
        )}
        {posts.map((post) => (
          <div key={post.id} className="border-b border-gray-200 p-4 hover:bg-gray-50 transition bg-white">
            <div className="flex gap-4 items-start">
              <button onClick={() => goToProfile(post.user_id)} className="flex-shrink-0">
                <img
                  src={post.profiles?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.profiles?.username}`}
                  className="w-12 h-12 rounded-full hover:opacity-80 transition"
                  alt="Avatar"
                />
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 flex-wrap">
                  <button onClick={() => goToProfile(post.user_id)} className="font-bold hover:underline">
                    {post.profiles?.display_name}
                  </button>
                  {post.profiles?.verified && <BadgeCheck size={16} className="text-orange-500" />}
                  <span className="text-gray-500 text-sm">@{post.profiles?.username}</span>
                  <span className="text-gray-500 text-sm">· {new Date(post.created_at).toLocaleDateString()}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words">{post.content}</p>
                {post.image_url && (
                  <img src={post.image_url} className="mt-3 rounded-2xl max-h-96 object-cover w-full" alt="Post" />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};