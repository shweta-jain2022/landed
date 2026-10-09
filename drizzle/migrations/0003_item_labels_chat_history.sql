ALTER TABLE public.checklist_items
  ADD COLUMN grounded boolean NOT NULL DEFAULT false,
  ADD COLUMN source_label text NOT NULL DEFAULT 'General knowledge, not verified',
  ADD COLUMN added_because text,
  ADD COLUMN added_by_message_id uuid;

UPDATE public.checklist_items ci SET grounded = true, source_label = 'Verified source'
FROM public.moves m
WHERE m.id = ci.move_id AND ci.change_reason IS NULL
  AND EXISTS (SELECT 1 FROM public.corridor_knowledge c
    WHERE lower(c.origin_country) = lower(m.origin_country)
      AND lower(c.destination_country) = lower(m.destination_country)
      AND c.move_type = m.move_type);
UPDATE public.checklist_items SET added_because = change_reason WHERE change_reason IS NOT NULL;

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  move_id uuid NOT NULL REFERENCES public.moves(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  match_level text,
  grounded boolean NOT NULL DEFAULT false,
  source_label text,
  match_reason text,
  closest_topic text,
  items_added jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_last_verified date,
  source_links text[],
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own chat" ON public.chat_messages FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.moves m WHERE m.id = move_id AND m.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.moves m WHERE m.id = move_id AND m.user_id = auth.uid()));
CREATE INDEX chat_messages_move_idx ON public.chat_messages (move_id, created_at);