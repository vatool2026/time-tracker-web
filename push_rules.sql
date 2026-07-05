-- Table: public.push_notification_rules

CREATE TABLE IF NOT EXISTS public.push_notification_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    trigger_minutes integer NOT NULL,
    condition_break_minutes integer NOT NULL,
    message text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT push_notification_rules_pkey PRIMARY KEY (id),
    CONSTRAINT push_notification_rules_company_id_fkey FOREIGN KEY (company_id)
        REFERENCES public.companies (id) MATCH SIMPLE
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

-- RLS
ALTER TABLE public.push_notification_rules ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view rules for their company" ON public.push_notification_rules
    FOR SELECT
    USING (company_id IN (
        SELECT company_id FROM public.users WHERE id = auth.uid()
    ));

CREATE POLICY "Admins can insert rules for their company" ON public.push_notification_rules
    FOR INSERT
    WITH CHECK (company_id IN (
        SELECT company_id FROM public.users WHERE id = auth.uid() AND (role = 'COMPANY_ADMIN' OR role = 'ROOT')
    ));

CREATE POLICY "Admins can update rules for their company" ON public.push_notification_rules
    FOR UPDATE
    USING (company_id IN (
        SELECT company_id FROM public.users WHERE id = auth.uid() AND (role = 'COMPANY_ADMIN' OR role = 'ROOT')
    ));

CREATE POLICY "Admins can delete rules for their company" ON public.push_notification_rules
    FOR DELETE
    USING (company_id IN (
        SELECT company_id FROM public.users WHERE id = auth.uid() AND (role = 'COMPANY_ADMIN' OR role = 'ROOT')
    ));

-- Add trigger for updated_at
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.push_notification_rules
  FOR EACH ROW EXECUTE PROCEDURE moddatetime (updated_at);
