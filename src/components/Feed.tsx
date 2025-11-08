// Feed.tsx
import { useEffect, useState, useRef } from 'react';
import { supabase, Post, uploadMedia } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Send, BadgeCheck, Edit3, Image, FileText, X, Paperclip } from 'lucide-react';

const FOLLOW_ONLY_FEED = import.meta.env.VITE_FOLLOW_ONLY_FEED === 'true';

export const Feed = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const { user } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadPosts = async () => {
    let query = supabase.from('posts').select('*, profiles(*)').order('created_at', { ascending: false });
    if (FOLLOW_ONLY_FEED && user) {
    const { data: following } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id);

    const followingIds = following?.map(f => f.following_id) || [];
    const allowedIds = [...followingIds, user.id];

    query = query.in('user_id', allowedIds);
  }
    const { data } = await query;
    setPosts(data || []);
  };

  useEffect(() => {
    loadPosts();

    const channel = supabase.channel('public:posts').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, async (payload) => {
      if (FOLLOW_ONLY_FEED && user) {
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
    if (!content.trim() && !file) return;

    setIsUploading(true);
    setUploadProgress(0);

    let media_url = null;
    let media_type = null;

    if (file) {
      const result = await uploadMedia(file, 'posts', (percent) => {
        setUploadProgress(percent);
      });
      if (!result) {
        setIsUploading(false);
        return;
      }
      media_url = result.url;
      media_type = result.type;
    }

    await supabase
      .from('posts')
      .insert({ 
        user_id: user!.id, 
        content, 
        media_url,
        media_type 
      });

    setContent('');
    setFile(null);
    setIsExpanded(false);
    setIsUploading(false);
    setUploadProgress(0);
  };

  const goToProfile = async (profileId: string) => {
    const { data } = await supabase.from('profiles').select('username').eq('id', profileId).single();
    if (data) {
      window.history.replaceState({}, '', `/?${data.username}`);
      window.dispatchEvent(new CustomEvent('navigateToProfile', { detail: profileId }));
    }
  };

  const getPreview = () => {
    if (!file) return null;
    const url = URL.createObjectURL(file);
    if (file.type.startsWith('image/')) {
      return <img src={url} className="max-h-48 rounded-lg object-cover" alt="Preview" />;
    }
    if (file.type.startsWith('video/')) {
      return <video src={url} className="max-h-48 rounded-lg" controls />;
    }
    return (
      <div className="flex items-center gap-2 p-3 bg-gray-100 rounded-lg">
        <FileText size={20} />
        <span className="text-sm">{file.name}</span>
      </div>
    );
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
            
            {file && (
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  {getPreview()}
                </div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="ml-2 p-1 hover:bg-gray-200 rounded-full transition"
                >
                  <X size={18} />
                </button>
              </div>
            )}

            {isUploading && (
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-orange-500 h-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*,.pdf,.doc,.docx,.txt"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="hidden"
            />

            <div className="flex gap-2 items-center">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-gray-100 rounded-full text-sm hover:bg-gray-200 transition flex items-center gap-2"
              >
                <Paperclip size={16} /> {file ? 'Change File' : 'Attach'}
              </button>
              {file && (
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="text-red-500 hover:text-red-700 text-sm"
                >
                  Remove
                </button>
              )}
              <button
                type="submit"
                disabled={isUploading || (!content.trim() && !file)}
                className="ml-auto bg-orange-500 disabled:bg-gray-300 text-white px-6 py-2 rounded-full hover:bg-orange-600 flex items-center gap-2 font-semibold transition"
              >
                <Send size={16} />
                {isUploading ? 'Uploading...' : 'Post'}
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
                {post.media_url && (
                  <div className="mt-3">
                    {post.media_type === 'image' && (
                      <img src={post.media_url} className="rounded-2xl max-h-96 object-cover w-full" alt="Post" />
                    )}
                    {post.media_type === 'video' && (
                      <video controls className="rounded-2xl max-h-96 w-full">
                        <source src={post.media_url} />
                        Your browser does not support the video tag.
                      </video>
                    )}
                    {post.media_type === 'document' && (
                      <a
                        href={post.media_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-3 bg-gray-100 rounded-lg hover:bg-gray-200 transition inline-block"
                      >
                        <FileText size={20} /> Download File
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
