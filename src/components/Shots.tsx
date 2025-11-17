// src/components/Shots.tsx
import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase, Post } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Heart, MessageCircle, Share2, Music2, User, X, BadgeCheck, Send } from 'lucide-react';

const FOLLOW_ONLY_FEED = import.meta.env.VITE_FOLLOW_ONLY_FEED === 'true';

const SVG_PATH = "M403.68 234.366c-3.681 5.618-30.224 30.851-40.724 38.713-25.347 18.983-38.394 24.776-77.79 34.544-23.062 5.718-26.126 6.76-29.666 10.087-7.857 7.384-13.863 11.247-21.384 13.752-9.789 3.259-12.116 5.672-12.116 12.558 0 3.825-.438 5.035-2.25 6.216-2.635 1.716-20.674 9.566-29.076 12.652l-5.825 2.141-2.971-2.116c-9.884-7.038-20.846.73-18.023 12.769 1.281 5.464 4.697 13.648 7.648 18.323 2.003 3.172 3.01 3.922 4.768 3.546 1.226-.263 4.254-.713 6.729-1.001 42.493-4.949 40.864-5.209 23.4 3.732-19.939 10.207-18.133 8.396-15.298 15.335 3.253 7.964 12.604 17.385 20.007 20.156l5.391 2.019.571-3.146c2.04-11.232 8.429-15.14 35.313-21.598l16.883-4.056 13.117 2.49c12.523 2.378 44.627 6.84 45.186 6.281.557-.557-2.339-3.496-10.071-10.22-12.342-10.734-11.967-10.234-8.194-10.934 3.07-.569 13.356.364 24.48 2.221 5.695.951 6.849 1.949 10.602 9.17 8.474 16.302 4.32 33.766-10.663 44.834-12.739 9.412-30.225 15.712-58.895 21.221-41.565 7.986-66.646 14.612-87.823 23.201-38.111 15.456-64.943 39.315-81.349 72.337-25.537 51.399-13.852 115.129 29.49 160.845 11.285 11.904 24.516 22.439 35.558 28.313 9.965 5.301 26.891 11.195 32.681 11.381l4.114.131-3.5.619-3.5.618 4.157 1.262c19.446 5.905 48.822 7.93 69.843 4.814 35.165-5.213 59.534-15.919 91.968-40.404 14.472-10.926 38.359-33.149 60.337-56.135 45.747-47.846 70.153-71.503 80.342-77.878C518.855 595.832 531.512 592 544 592c18.29 0 32.472 6.933 42.959 21 6.102 8.186 10.208 17.124 12.861 28 2.382 9.768 3.878 23.317 2.327 21.069-.752-1.088-1.147-.49-1.65 2.5-1.775 10.54-7.924 25.284-13.676 32.793-8.697 11.352-23.899 22.822-37.247 28.103-13.613 5.385-37.399 10.294-61.035 12.597-27.42 2.671-56.809 7.787-72.039 12.54-28.765 8.977-52.539 27.345-63.932 49.398-14.355 27.783-13.427 60.661 2.466 87.415 5.626 9.47 8.339 12.945 16.466 21.088 6.022 6.035 7.163 6.986 17.716 14.777 18.026 13.307 43.527 22.826 73.017 27.255 13.391 2.011 52.549 2.016 54.558.007.202-.202-2.256-.881-5.462-1.508-14.198-2.779-32.245-10.073-41.829-16.905-15.141-10.793-30.463-25.813-37.688-36.946-2.029-3.126-5.016-7.483-6.638-9.683C416.705 874.014 413 864.636 413 854.684c0-5.65 2.569-16.422 4.312-18.082 9.77-9.301 25.027-16.03 48.822-21.533 64.081-14.82 109.776-51.401 128.122-102.569 3.224-8.992 6.818-27.367 7.726-39.5l.71-9.5.154 9.583c.144 8.953-.301 12.954-2.993 26.917-1.404 7.286-7.125 23.019-11.09 30.5-1.749 3.3-3.649 7.009-4.222 8.242-.572 1.233-1.378 2.246-1.791 2.25s-.75.646-.75 1.425-.357 1.566-.793 1.75-1.887 2.133-3.226 4.333c-2.159 3.55-12.538 16.048-17.218 20.734-3.451 3.456-18.579 15.488-22.376 17.797-2.138 1.3-4.112 2.667-4.387 3.039-.275.371-5.9 3.4-12.5 6.731-16.549 8.351-30.523 13.68-47.732 18.205-2.602.684-4.477 1.656-4.166 2.16.312.503 1.316.689 2.232.412s8.641-1.213 17.166-2.081c40.585-4.13 69.071-9.765 92.5-18.298 15.33-5.583 37.661-18.554 50.945-29.591 10.296-8.554 25.124-24.582 33.34-36.037 3.374-4.704 13.526-23.941 16.397-31.071 2.83-7.028 5.649-16.706 8.011-27.5 1.966-8.988 2.293-13.308 2.27-30-.029-21.817-1.459-32.183-6.545-47.461-4.267-12.818-13.982-32.084-21.064-41.771-7.41-10.137-23.927-26.589-33.354-33.222-15.179-10.682-37.054-20.061-56.5-24.226-13.245-2.836-42.849-2.586-57.5.487-27.999 5.872-54.161 18.066-78.5 36.589-8.789 6.689-30.596 26.259-34.981 31.392-5.122 5.997-38.941 40.833-55.176 56.835-15.863 15.637-22.787 22.017-31.337 28.877-2.742 2.2-5.89 4.829-6.996 5.843-1.105 1.013-6.06 4.488-11.01 7.722s-9.45 6.242-10 6.686c-2.014 1.624-12.507 6.373-19.656 8.896-8.791 3.103-26.867 4.32-35.998 2.425-14.396-2.989-26.608-12.051-32.574-24.172-3.938-8-5.216-13.468-5.248-22.44-.05-14.406 4.83-25.419 16.415-37.046 8.018-8.047 15.344-13.02 27.453-18.636 13.664-6.337 24.699-9.76 68.608-21.281 23.61-6.195 53.403-16.746 65-23.02 37.251-20.151 62.371-49.521 70.969-82.977 3.164-12.312 4.368-32.296 2.62-43.5-2.675-17.153-11.273-37.276-22.004-51.5-10.94-14.501-29.977-30.241-43.244-35.755l-4.987-2.072 5.325-2.166c15.935-6.483 33.215-19.607 42.642-32.385 5.925-8.032 12.007-19.627 10.884-20.751-.359-.358-2.374.874-4.48 2.739-19.929 17.652-32.524 25.61-53.225 33.626-8.739 3.383-30.986 9.264-35.049 9.264-.617 0 2.629-2.521 7.214-5.602 21.853-14.688 39.424-33.648 49.197-53.085 2.254-4.483 7.638-17.828 7.638-18.932 0-1.228-1.997-.034-3.32 1.985m-9.601 249.217c.048 1.165.285 1.402.604.605.289-.722.253-1.585-.079-1.917s-.568.258-.525 1.312m-6.62 20.484c-.363.586-.445 1.281-.183 1.543s.743-.218 1.069-1.067c.676-1.762.1-2.072-.886-.476m207.291 56.656c1.788.222 4.712.222 6.5 0 1.788-.221.325-.403-3.25-.403s-5.038.182-3.25.403m13.333-.362c.23.199 3.117.626 6.417.949 3.811.374 5.27.268 4-.29-1.892-.832-11.303-1.427-10.417-.659M627 564.137c3.575 1.072 7.4 2.351 8.5 2.842 1.1.49 4.025 1.764 6.5 2.83 6.457 2.78 15.574 9.246 22.445 15.918 5.858 5.687 5.899 4.716.055-1.277-3.395-3.481-13.251-11.028-18.5-14.164-4.511-2.696-20.509-8.314-23.33-8.192-1.193.051.755.97 4.33 2.043M283.572 749.028c-2.161 1.635-3.511 2.96-3 2.945.945-.027 8.341-5.92 7.428-5.918-.275 0-2.268 1.338-4.428 2.973M264.5 760.049c-14.725 7.213-25.192 9.921-42 10.865-12.896.724-13.276.798-4.822.936 16.858.275 31.491-2.958 46.822-10.347 6.099-2.939 11.984-6.524 10.5-6.396-.275.023-5 2.247-10.5 4.942M435 897.859c0 1.77 20.812 21.955 28.752 27.887 10.355 7.736 27.863 16.301 40.248 19.691 11.885 3.254 27.788 4.339 38.679 2.641 15.915-2.483 42.821-11.687 56.321-19.268 4.671-2.624 21.633-13.314 22.917-14.443.229-.202.185-.599-.098-.882s-2.496.561-4.917 1.876c-8.642 4.692-29.216 11.343-44.402 14.354-7.013 1.391-13.746 1.775-30.5 1.738-19.299-.042-22.831-.32-34.5-2.724-25.415-5.234-48.507-14.972-66.207-27.92-5.432-3.973-6.293-4.377-6.293-2.95";
const SVG_VIEWBOX = "0 0 784 1168";

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles: {
    username: string;
    display_name: string;
    avatar_url: string;
    verified: boolean;
  };
}

interface Liker {
  user_id: string;
  profiles: {
    username: string;
    display_name: string;
    avatar_url: string;
    verified: boolean;
  };
}

export const Shots = () => {
  const [videos, setVideos] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);

  // Copied from Feed.tsx
  const getPostCounts = useCallback(async (postIds: string[]) => {
    if (!postIds.length) return { likeCounts: {}, commentCounts: {} };

    const likeCounts: Record<string, number> = {};
    const commentCounts: Record<string, number> = {};

    for (const postId of postIds) {
      const [{ count: likeCount }, { count: commentCount }] = await Promise.all([
        supabase
          .from('likes')
          .select('*', { count: 'exact', head: true })
          .eq('entity_type', 'post')
          .eq('entity_id', postId),
        supabase
          .from('comments')
          .select('*', { count: 'exact', head: true })
          .eq('post_id', postId)
      ]);
      likeCounts[postId] = likeCount || 0;
      commentCounts[postId] = commentCount || 0;
    }

    return { likeCounts, commentCounts };
  }, []);
  
  // Interaction States
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());
  const [activeCommentsId, setActiveCommentsId] = useState<string | null>(null);
  const [commentsList, setCommentsList] = useState<Comment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [activeLikesId, setActiveLikesId] = useState<string | null>(null);
  const [likersList, setLikersList] = useState<Liker[]>([]);

  const fetchUserLikes = useCallback(async (posts: Post[]) => {
    if (!user || posts.length === 0) return;
    const postIds = posts.map(p => p.id);
    const { data } = await supabase
      .from('likes')
      .select('entity_id')
      .eq('user_id', user.id)
      .eq('entity_type', 'post')
      .in('entity_id', postIds);
    
    if (data) {
      setLikedPostIds(prev => new Set([...prev, ...data.map(d => d.entity_id)]));
    }
  }, [user]);

  const loadVideos = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('posts')
      .select('*, profiles(*)')
      .eq('media_type', 'video')
      .order('created_at', { ascending: false })
      .limit(20);

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
    const loadedVideos = data || [];

    // --- ADDED LIKES/COMMENTS COUNT FETCHING ---
    const postIds = loadedVideos.map(p => p.id);
    const { likeCounts, commentCounts } = await getPostCounts(postIds);
    const videosWithCounts = loadedVideos.map(video => ({
      ...video,
      like_count: likeCounts[video.id] || 0,
      comment_count: commentCounts[video.id] || 0,
    }));
    // --- END ---

    setVideos(videosWithCounts);
    fetchUserLikes(videosWithCounts);
    setLoading(false);
  }, [user, fetchUserLikes, getPostCounts]);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  // Intersection Observer for Auto-Play
  useEffect(() => {
    const options = {
      root: containerRef.current,
      threshold: 0.6
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const videoElement = entry.target.querySelector('video');
        if (!videoElement) return;

        if (entry.isIntersecting) {
          videoElement.play().catch(() => {});
        } else {
          videoElement.pause();
          videoElement.currentTime = 0;
        }
      });
    }, options);

    const items = document.querySelectorAll('.shot-item');
    items.forEach(item => observer.observe(item));

    return () => observer.disconnect();
  }, [videos]);

  // Interaction Logic (Duplicated from Feed but tailored for UI)
  const handleLikeInteraction = async (post: Post) => {
    if (!user) return;
    
    // 1. If not liked, like it.
    if (!likedPostIds.has(post.id)) {
      const newSet = new Set(likedPostIds);
      newSet.add(post.id);
      setLikedPostIds(newSet);

      // Optimistic Count Update
      setVideos(current => current.map(v => v.id === post.id ? { ...v, like_count: v.like_count + 1 } : v));
      
      await supabase.from('likes').insert({ user_id: user.id, entity_id: post.id, entity_type: 'post' });
    }

    // 2. Open Modal (Requested Behavior)
    openLikesList(post.id);
  };

  const handleUnlikeFromModal = async (postId: string) => {
    if (!user) return;
    
    // Remove from set
    const newSet = new Set(likedPostIds);
    newSet.delete(postId);
    setLikedPostIds(newSet);

    // Optimistic Count Update
    setVideos(current => current.map(v => v.id === postId ? { ...v, like_count: Math.max(0, v.like_count - 1) } : v));

    // Remove from DB
    await supabase.from('likes').delete().match({ user_id: user.id, entity_id: postId, entity_type: 'post' });
    
    // Remove self from the displayed list
    setLikersList(prev => prev.filter(liker => liker.user_id !== user.id));
  };

  const openLikesList = async (postId: string) => {
    setActiveLikesId(postId);
    const { data } = await supabase
      .from('likes')
      .select('user_id, profiles(*)')
      .eq('entity_id', postId)
      .eq('entity_type', 'post');
    if (data) setLikersList(data as unknown as Liker[]);
  };

  const openComments = async (postId: string) => {
    setActiveCommentsId(postId);
    const { data } = await supabase
      .from('comments')
      .select('*, profiles(*)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });
    if (data) setCommentsList(data as Comment[]);
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeCommentsId || !newCommentText.trim()) return;

    const postId = activeCommentsId;
    const { data, error } = await supabase
      .from('comments')
      .insert({ post_id: postId, user_id: user.id, content: newCommentText.trim() })
      .select('*, profiles(*)')
      .single();

    if (!error && data) {
      setCommentsList(prev => [...prev, data as Comment]);
      setNewCommentText('');
      setVideos(current => current.map(v => v.id === postId ? { ...v, comment_count: (v.comment_count || 0) + 1 } : v));
    }
  };

  const goToProfile = (profileId: string) => {
    window.dispatchEvent(new CustomEvent('navigateToProfile', { detail: profileId }));
  };

if (loading) {
    return (
        <div className="flex flex-col items-center justify-center py-10 w-full">
            <div className="logo-loading-container w-[100px] h-auto relative mb-4">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox={SVG_VIEWBOX}
                    className="logo-svg"
                >
                    <defs>
                        {/* Clip-Path to control the vertical fill */}
                        <clipPath id="logo-clip">
                            <rect
                                id="clip-rect"
                                x="0"
                                y="0"
                                width="100%"
                                height="100%"
                            />
                        </clipPath>
                    </defs>

                    {/* Background/Outline (unfilled portion) */}
                    <path
                        d={SVG_PATH}
                        fill="none"
                        stroke="rgb(var(--color-primary))"
                        strokeWidth="10"
                        strokeOpacity="0.1" 
                    />

                    {/* The Filled Logo - Apply the clip-path and scanline CSS class */}
                    <path
                        d={SVG_PATH}
                        fill="rgb(var(--color-primary))" 
                        clipPath="url(#logo-clip)"
                        className="logo-fill-animated"
                    />
                </svg>
            </div>
            <p className="text-[rgb(var(--color-text-secondary))]">Loading shots...</p>
        </div>
    );
}

  if (videos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-[rgb(var(--color-text-secondary))] p-8 text-center">
        <Music2 size={48} className="mb-4 opacity-50" />
        <h3 className="text-xl font-bold mb-2">No Shots Yet</h3>
        <p>No video content available in your feed. Follow people who post video content, or post a video yourself to see them here!</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[calc(100vh-180px)] bg-black rounded-xl overflow-hidden">
      <div 
        ref={containerRef}
        className="w-full h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
        style={{ scrollBehavior: 'smooth' }}
      >
        {videos.map((video) => (
          <div key={video.id} className="shot-item relative w-full h-full snap-start bg-black">
            {/* Video Layer */}
            <video
              src={video.media_url!}
              className="w-full h-full object-cover"
              playsInline
              loop
              muted={false} // In a real app, you'd manage mute state globally
            />
            
            {/* Overlay Gradient */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60 pointer-events-none" />

            {/* Right Sidebar (Actions) */}
            <div className="absolute right-4 bottom-20 flex flex-col gap-6 items-center z-10">
              <div className="flex flex-col items-center gap-1">
                 <button onClick={() => goToProfile(video.user_id)} className="relative">
                    <img 
                      src={video.profiles?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${video.profiles?.username}`}
                      className="w-12 h-12 rounded-full border-2 border-white"
                    />
                 </button>
              </div>

              <div className="flex flex-col items-center gap-1">
                <button 
                  onClick={() => handleLikeInteraction(video)}
                  className="p-3 bg-white/10 backdrop-blur-sm rounded-full transition active:scale-90"
                >
                  <Heart 
                    size={28} 
                    className={likedPostIds.has(video.id) ? "fill-red-500 text-red-500" : "text-white"} 
                  />
                </button>
                <span className="text-white text-xs font-bold shadow-black drop-shadow-md">{video.like_count}</span>
              </div>

              <div className="flex flex-col items-center gap-1">
                <button 
                  onClick={() => openComments(video.id)}
                  className="p-3 bg-white/10 backdrop-blur-sm rounded-full transition active:scale-90"
                >
                  <MessageCircle size={28} className="text-white" />
                </button>
                <span className="text-white text-xs font-bold shadow-black drop-shadow-md">{video.comment_count}</span>
              </div>

              <button className="p-3 bg-white/10 backdrop-blur-sm rounded-full transition active:scale-90">
                <Share2 size={28} className="text-white" />
              </button>
            </div>

            {/* Bottom Info */}
            <div className="absolute bottom-4 left-4 right-16 z-10 text-white">
              <button onClick={() => goToProfile(video.user_id)} className="font-bold text-lg hover:underline flex items-center gap-1 mb-2 shadow-black drop-shadow-md">
                @{video.profiles?.username}
                {video.profiles?.verified && <BadgeCheck size={16} className="text-blue-400" />}
              </button>
              <p className="text-sm line-clamp-2 opacity-90 mb-3 shadow-black drop-shadow-md">
                {video.content}
              </p>
              <div className="flex items-center gap-2 text-xs opacity-70">
                 <Music2 size={14} className="animate-spin-slow" />
                 <span>Original Sound - {video.profiles?.display_name}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Shared Interaction Modals (Reused styles for consistency) */}
      {activeLikesId && (
        <div className="absolute inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center p-4 animate-in fade-in">
           <div className="bg-[rgb(var(--color-surface))] w-full max-w-sm h-[60vh] rounded-t-2xl sm:rounded-2xl flex flex-col" onClick={e => e.stopPropagation()}>
             <div className="p-4 border-b border-[rgb(var(--color-border))] flex justify-between items-center">
                <h3 className="font-bold text-[rgb(var(--color-text))]">Likes</h3>
                <button onClick={() => setActiveLikesId(null)}><X size={20} className="text-[rgb(var(--color-text))]" /></button>
             </div>
             <div className="overflow-y-auto p-4 space-y-4 flex-1">
               {likersList.map(liker => (
                 <div key={liker.user_id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <img src={liker.profiles.avatar_url} className="w-10 h-10 rounded-full" />
                        <div>
                            <p className="font-bold text-sm text-[rgb(var(--color-text))]">{liker.profiles.display_name}</p>
                            <p className="text-xs text-[rgb(var(--color-text-secondary))]">@{liker.profiles.username}</p>
                        </div>
                    </div>
                    {/* Special "Unlike" button if this is the current user */}
                    {liker.user_id === user?.id && (
                        <button 
                            onClick={() => handleUnlikeFromModal(activeLikesId)}
                            className="p-2 rounded-full bg-red-50 text-red-500 hover:bg-red-100"
                            title="Remove like"
                        >
                            <Heart size={16} className="fill-current" />
                        </button>
                    )}
                 </div>
               ))}
             </div>
           </div>
        </div>
      )}

      {activeCommentsId && (
        <div className="absolute inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[rgb(var(--color-surface))] w-full max-w-sm h-[70vh] rounded-t-2xl sm:rounded-2xl flex flex-col">
            <div className="p-4 border-b border-[rgb(var(--color-border))] flex justify-between items-center">
                <h3 className="font-bold text-[rgb(var(--color-text))]">Comments</h3>
                <button onClick={() => setActiveCommentsId(null)}><X size={20} className="text-[rgb(var(--color-text))]" /></button>
             </div>
             <div className="overflow-y-auto p-4 space-y-4 flex-1">
                {commentsList.map(comment => (
                    <div key={comment.id} className="flex gap-3">
                        <img src={comment.profiles.avatar_url} className="w-8 h-8 rounded-full flex-shrink-0" />
                        <div className="flex-1">
                            <div className="flex gap-2 items-baseline">
                                <span className="font-bold text-xs text-[rgb(var(--color-text))]">{comment.profiles.display_name}</span>
                                <span className="text-[10px] text-[rgb(var(--color-text-secondary))]">{new Date(comment.created_at).toLocaleDateString()}</span>
                            </div>
                            <p className="text-sm text-[rgb(var(--color-text))]">{comment.content}</p>
                        </div>
                    </div>
                ))}
             </div>
             <form onSubmit={handlePostComment} className="p-3 border-t border-[rgb(var(--color-border))] flex gap-2">
                <input 
                    value={newCommentText}
                    onChange={e => setNewCommentText(e.target.value)}
                    placeholder="Say something..." 
                    className="flex-1 bg-[rgb(var(--color-surface-hover))] rounded-full px-4 py-2 text-sm outline-none text-[rgb(var(--color-text))]"
                />
                <button type="submit" className="text-[rgb(var(--color-accent))]"><Send size={20} /></button>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};
