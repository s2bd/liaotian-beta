import React, { useState, useEffect } from 'react';
import { supabase, uploadMedia } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { MessagesSquare, Plus, X, MessageCircle, ArrowLeft, Calendar, User } from 'lucide-react';

interface Forum {
  id: string;
  name: string;
  description: string;
  tag: string;
  created_at: string;
}

interface ForumPost {
  id: string;
  title: string;
  content: string;
  media_url: string;
  created_at: string;
  user_id: string;
  profiles: { username: string; display_name: string; avatar_url: string; verified: boolean; };
  comment_count: number;
}

const TAGS = ['Gaming', 'Hobbies', 'Study', 'Trade', 'Reviews', 'Other'];

export const Forums: React.FC = () => {
  const { user } = useAuth();
  const [forums, setForums] = useState<Forum[]>([]);
  const [viewState, setViewState] = useState<'list' | 'threads' | 'thread_detail'>('list');
  const [selectedForum, setSelectedForum] = useState<Forum | null>(null);
  const [selectedPost, setSelectedPost] = useState<ForumPost | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchForums = async () => {
    const { data } = await supabase.from('forums').select('*').order('created_at', { ascending: false });
    setForums(data || []);
  };

  useEffect(() => { fetchForums(); }, []);

  const openForum = (f: Forum) => { setSelectedForum(f); setViewState('threads'); };
  const openThread = (p: ForumPost) => { setSelectedPost(p); setViewState('thread_detail'); };
  const goBack = () => {
    if (viewState === 'thread_detail') setViewState('threads');
    else setViewState('list');
  };

  if (viewState === 'list') {
    return (
        <div className="max-w-4xl mx-auto p-4 pb-20">
           <div className="flex justify-between items-center mb-6">
             <h1 className="text-2xl font-bold text-[rgb(var(--color-text))] flex items-center gap-2">
               <MessagesSquare className="text-[rgb(var(--color-primary))]" /> Forums
             </h1>
             <button onClick={() => setShowCreateModal(true)} className="bg-[rgb(var(--color-primary))] text-white px-4 py-2 rounded-full font-bold flex items-center gap-2">
               <Plus size={18} /> New Forum
             </button>
           </div>
           <div className="space-y-4">
              {forums.map(f => (
                  <div key={f.id} onClick={() => openForum(f)} className="bg-[rgb(var(--color-surface))] p-6 rounded-xl border border-[rgb(var(--color-border))] hover:border-[rgb(var(--color-primary))] cursor-pointer transition">
                      <div className="flex justify-between">
                          <h3 className="font-bold text-xl text-[rgb(var(--color-text))]">{f.name}</h3>
                          <span className="text-xs bg-[rgba(var(--color-primary),0.1)] text-[rgb(var(--color-primary))] px-2 py-1 rounded-full h-fit">{f.tag}</span>
                      </div>
                      <p className="text-[rgb(var(--color-text-secondary))] mt-2">{f.description}</p>
                  </div>
              ))}
           </div>
           {showCreateModal && <CreateForumModal onClose={() => setShowCreateModal(false)} onCreated={fetchForums} />}
        </div>
    );
  }

  if (viewState === 'threads' && selectedForum) {
     return <ForumThreads forum={selectedForum} onBack={goBack} onOpenThread={openThread} />;
  }

  if (viewState === 'thread_detail' && selectedPost) {
     return <ThreadDetail post={selectedPost} onBack={goBack} />;
  }

  return null;
};

const ForumThreads: React.FC<{ forum: Forum; onBack: () => void; onOpenThread: (p: ForumPost) => void }> = ({ forum, onBack, onOpenThread }) => {
    const { user } = useAuth();
    const [posts, setPosts] = useState<ForumPost[]>([]);
    const [showPostModal, setShowPostModal] = useState(false);

    const fetchPosts = async () => {
        const { data } = await supabase
            .from('forum_posts')
            .select('*, profiles(*)')
            .eq('forum_id', forum.id)
            .order('created_at', { ascending: false });
        setPosts(data as ForumPost[] || []);
    };

    useEffect(() => { fetchPosts(); }, [forum.id]);

    return (
        <div className="max-w-4xl mx-auto p-4 pb-20">
            <button onClick={onBack} className="flex items-center gap-2 text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text))] mb-4">
                <ArrowLeft size={18} /> Back to Forums
            </button>
            <div className="bg-[rgb(var(--color-surface))] p-6 rounded-xl border-b border-[rgb(var(--color-border))] mb-6">
                <h1 className="text-2xl font-bold text-[rgb(var(--color-text))]">{forum.name}</h1>
                <p className="text-[rgb(var(--color-text-secondary))]">{forum.description}</p>
            </div>

            <div className="flex justify-between items-center mb-4">
                <h2 className="font-bold text-lg text-[rgb(var(--color-text))]">Threads</h2>
                <button onClick={() => setShowPostModal(true)} className="bg-[rgb(var(--color-primary))] text-white px-4 py-2 rounded-full font-bold text-sm">New Thread</button>
            </div>

            <div className="space-y-2">
                {posts.length === 0 && <div className="text-center py-8 text-[rgb(var(--color-text-secondary))]">No threads yet.</div>}
                {posts.map(p => (
                    <div key={p.id} onClick={() => onOpenThread(p)} className="bg-[rgb(var(--color-surface))] p-4 rounded-lg border border-[rgb(var(--color-border))] hover:bg-[rgb(var(--color-surface-hover))] cursor-pointer transition">
                        <h3 className="font-bold text-[rgb(var(--color-text))]">{p.title}</h3>
                        <div className="flex gap-4 mt-2 text-xs text-[rgb(var(--color-text-secondary))]">
                            <span className="flex items-center gap-1"><User size={12}/> {p.profiles.display_name}</span>
                            <span className="flex items-center gap-1"><Calendar size={12}/> {new Date(p.created_at).toLocaleDateString()}</span>
                            <span className="flex items-center gap-1"><MessageCircle size={12}/> {p.comment_count || 0} comments</span>
                        </div>
                    </div>
                ))}
            </div>
            {showPostModal && <CreateThreadModal forumId={forum.id} onClose={() => setShowPostModal(false)} onCreated={fetchPosts} />}
        </div>
    );
};

const ThreadDetail: React.FC<{ post: ForumPost; onBack: () => void }> = ({ post, onBack }) => {
    const { user } = useAuth();
    const [comments, setComments] = useState<any[]>([]);
    const [newComment, setNewComment] = useState('');

    const fetchComments = async () => {
        const { data } = await supabase.from('forum_comments').select('*, profiles(*)').eq('post_id', post.id).order('created_at');
        setComments(data || []);
    };

    useEffect(() => { fetchComments(); }, [post.id]);

    const handleComment = async () => {
        if (!user || !newComment.trim()) return;
        await supabase.from('forum_comments').insert({ post_id: post.id, user_id: user.id, content: newComment });
        // Update comment count in post table for display logic
        await supabase.rpc('increment_forum_comment_count', { post_id: post.id });
        setNewComment('');
        fetchComments();
    };

    return (
        <div className="max-w-4xl mx-auto p-4 pb-20">
             <button onClick={onBack} className="flex items-center gap-2 text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text))] mb-4">
                <ArrowLeft size={18} /> Back to Threads
            </button>
            
            {/* Main Post */}
            <div className="bg-[rgb(var(--color-surface))] p-6 rounded-xl border border-[rgb(var(--color-border))] mb-6">
                <h1 className="text-2xl font-bold text-[rgb(var(--color-text))] mb-4">{post.title}</h1>
                <div className="flex items-center gap-2 mb-4">
                    <img src={post.profiles.avatar_url || `https://ui-avatars.com/api/?name=${post.profiles.username}`} className="w-8 h-8 rounded-full" />
                    <div>
                        <div className="text-sm font-bold text-[rgb(var(--color-text))]">{post.profiles.display_name}</div>
                        <div className="text-xs text-[rgb(var(--color-text-secondary))]">{new Date(post.created_at).toLocaleString()}</div>
                    </div>
                </div>
                <p className="text-[rgb(var(--color-text))] whitespace-pre-wrap">{post.content}</p>
                {post.media_url && <img src={post.media_url} className="mt-4 rounded-lg max-h-96" />}
            </div>

            {/* Comments */}
            <div className="space-y-4 mb-20">
                {comments.map(c => (
                    <div key={c.id} className="bg-[rgb(var(--color-surface))] p-4 rounded-lg border border-[rgb(var(--color-border))] flex gap-3">
                         <img src={c.profiles.avatar_url} className="w-8 h-8 rounded-full" />
                         <div>
                             <div className="flex items-baseline gap-2">
                                 <span className="font-bold text-sm text-[rgb(var(--color-text))]">{c.profiles.display_name}</span>
                                 <span className="text-xs text-[rgb(var(--color-text-secondary))]">{new Date(c.created_at).toLocaleString()}</span>
                             </div>
                             <p className="text-[rgb(var(--color-text))] mt-1 text-sm">{c.content}</p>
                         </div>
                    </div>
                ))}
            </div>

            {/* Comment Box */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-[rgb(var(--color-surface))] border-t border-[rgb(var(--color-border))]">
                <div className="max-w-4xl mx-auto flex gap-2">
                    <input 
                        value={newComment}
                        onChange={e => setNewComment(e.target.value)}
                        placeholder="Write a comment..." 
                        className="flex-1 p-3 bg-[rgb(var(--color-background))] rounded-lg border border-[rgb(var(--color-border))] text-[rgb(var(--color-text))]"
                    />
                    <button onClick={handleComment} className="bg-[rgb(var(--color-primary))] text-white px-6 rounded-lg font-bold">Post</button>
                </div>
            </div>
        </div>
    );
};

// Modals (Simplified for brevity)
const CreateForumModal: React.FC<{ onClose: () => void; onCreated: () => void }> = ({ onClose, onCreated }) => {
    const { user } = useAuth();
    const [name, setName] = useState('');
    const [desc, setDesc] = useState('');
    const [tag, setTag] = useState(TAGS[0]);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!user) return;
        await supabase.from('forums').insert({ name, description: desc, tag, owner_id: user.id });
        onCreated(); onClose();
    };
    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[100]">
            <form onSubmit={submit} className="bg-[rgb(var(--color-surface))] p-6 rounded-xl w-full max-w-md space-y-4">
                <h2 className="font-bold text-[rgb(var(--color-text))]">Create Forum</h2>
                <input required value={name} onChange={e=>setName(e.target.value)} placeholder="Name" className="w-full p-2 bg-[rgb(var(--color-background))] rounded border border-[rgb(var(--color-border))]" />
                <textarea required value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Description" className="w-full p-2 bg-[rgb(var(--color-background))] rounded border border-[rgb(var(--color-border))]" />
                <select value={tag} onChange={e=>setTag(e.target.value)} className="w-full p-2 bg-[rgb(var(--color-background))] rounded border border-[rgb(var(--color-border))]">
                    {TAGS.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
                <div className="flex gap-2">
                    <button type="button" onClick={onClose} className="flex-1 py-2 border border-[rgb(var(--color-border))] rounded text-[rgb(var(--color-text))]">Cancel</button>
                    <button type="submit" className="flex-1 py-2 bg-[rgb(var(--color-primary))] text-white rounded font-bold">Create</button>
                </div>
            </form>
        </div>
    );
};

const CreateThreadModal: React.FC<{ forumId: string; onClose: () => void; onCreated: () => void }> = ({ forumId, onClose, onCreated }) => {
    const { user } = useAuth();
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!user) return;
        await supabase.from('forum_posts').insert({ forum_id: forumId, user_id: user.id, title, content });
        onCreated(); onClose();
    };
    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[100]">
            <form onSubmit={submit} className="bg-[rgb(var(--color-surface))] p-6 rounded-xl w-full max-w-md space-y-4">
                <h2 className="font-bold text-[rgb(var(--color-text))]">New Thread</h2>
                <input required value={title} onChange={e=>setTitle(e.target.value)} placeholder="Title" className="w-full p-2 bg-[rgb(var(--color-background))] rounded border border-[rgb(var(--color-border))]" />
                <textarea required value={content} onChange={e=>setContent(e.target.value)} placeholder="Content" className="w-full p-2 bg-[rgb(var(--color-background))] rounded border border-[rgb(var(--color-border))] h-32" />
                <div className="flex gap-2">
                    <button type="button" onClick={onClose} className="flex-1 py-2 border border-[rgb(var(--color-border))] rounded text-[rgb(var(--color-text))]">Cancel</button>
                    <button type="submit" className="flex-1 py-2 bg-[rgb(var(--color-primary))] text-white rounded font-bold">Post</button>
                </div>
            </form>
        </div>
    );
};
