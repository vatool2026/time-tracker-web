-- Idempotent clock events coming from the native Android app (and future offline-capable clients).
-- Every event carries a client-generated UUID so a retried upload never creates duplicate time entries.

CREATE TABLE IF NOT EXISTS public.clock_events (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('IN', 'OUT', 'BREAK')),
  occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
  source TEXT NOT NULL DEFAULT 'android',
  time_entry_id UUID REFERENCES public.time_entries(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clock_events_user_occurred_idx ON public.clock_events (user_id, occurred_at);

ALTER TABLE public.clock_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own clock events" ON public.clock_events;
CREATE POLICY "Users can view own clock events" ON public.clock_events
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own clock events" ON public.clock_events;
CREATE POLICY "Users can insert own clock events" ON public.clock_events
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own clock events" ON public.clock_events;
CREATE POLICY "Users can update own clock events" ON public.clock_events
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own clock events" ON public.clock_events;
CREATE POLICY "Users can delete own clock events" ON public.clock_events
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Marks entries that were recorded while the device was offline (device clock), so admins can see it.
ALTER TABLE public.time_entries ADD COLUMN IF NOT EXISTS recorded_offline BOOLEAN NOT NULL DEFAULT false;
