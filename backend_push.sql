-- Tabelle für Push-Abonnements erstellen
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, endpoint)
);

-- RLS (Row Level Security) aktivieren
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Richtlinien erstellen (Benutzer können nur ihre eigenen Abonnements sehen/verwalten)
CREATE POLICY "Users can view their own subscriptions"
ON public.push_subscriptions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscriptions"
ON public.push_subscriptions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own subscriptions"
ON public.push_subscriptions FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Optional: Service Role Policy für das Backend (damit das Backend alle abfragen kann)
CREATE POLICY "Service role can manage all subscriptions"
ON public.push_subscriptions FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
