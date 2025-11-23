-- 1. Add the missing Foreign Key constraint so Supabase knows how to join them
ALTER TABLE public.message_reactions
ADD CONSTRAINT message_reactions_message_id_fkey
FOREIGN KEY (message_id)
REFERENCES public.messages(id)
ON DELETE CASCADE; -- If a message is deleted, delete its reactions

-- 2. (Optional but recommended) Add an index for faster loading
CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id 
ON public.message_reactions(message_id);
