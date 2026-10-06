CREATE TABLE public.moves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  origin_country text NOT NULL,
  destination_country text NOT NULL,
  move_type text NOT NULL CHECK (move_type IN ('work','study')),
  visa_type text,
  target_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.moves TO authenticated;
GRANT ALL ON public.moves TO service_role;
ALTER TABLE public.moves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own moves select" ON public.moves FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own moves insert" ON public.moves FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own moves update" ON public.moves FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own moves delete" ON public.moves FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.corridor_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_country text NOT NULL,
  destination_country text NOT NULL,
  move_type text NOT NULL CHECK (move_type IN ('work','study')),
  default_visa_type text,
  content_blob text,
  last_verified date,
  source_links text[],
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.corridor_knowledge TO authenticated;
GRANT ALL ON public.corridor_knowledge TO service_role;
ALTER TABLE public.corridor_knowledge ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read corridors" ON public.corridor_knowledge FOR SELECT TO authenticated USING (true);

CREATE TABLE public.modifier_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destination_country text NOT NULL,
  modifier_type text NOT NULL,
  quick_select_label text,
  content_blob text,
  last_verified date,
  source_links text[],
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.modifier_knowledge TO authenticated;
GRANT ALL ON public.modifier_knowledge TO service_role;
ALTER TABLE public.modifier_knowledge ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read modifiers" ON public.modifier_knowledge FOR SELECT TO authenticated USING (true);

CREATE TABLE public.checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  move_id uuid NOT NULL REFERENCES public.moves(id) ON DELETE CASCADE,
  category text,
  title text NOT NULL,
  description text,
  timing_window text CHECK (timing_window IN ('before_arrival','first_week','first_month','first_90_days')),
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','done')),
  version integer NOT NULL DEFAULT 1,
  change_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_items TO authenticated;
GRANT ALL ON public.checklist_items TO service_role;
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own checklist" ON public.checklist_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.moves m WHERE m.id = move_id AND m.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.moves m WHERE m.id = move_id AND m.user_id = auth.uid()));

CREATE TABLE public.move_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  move_id uuid NOT NULL REFERENCES public.moves(id) ON DELETE CASCADE,
  event_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.move_events TO authenticated;
GRANT ALL ON public.move_events TO service_role;
ALTER TABLE public.move_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own events" ON public.move_events FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.moves m WHERE m.id = move_id AND m.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.moves m WHERE m.id = move_id AND m.user_id = auth.uid()));