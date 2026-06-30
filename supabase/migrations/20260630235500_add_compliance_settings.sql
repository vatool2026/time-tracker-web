ALTER TABLE public.category_settings ADD COLUMN compliance_max_hours_enabled BOOLEAN DEFAULT true;
ALTER TABLE public.category_settings ADD COLUMN compliance_max_hours DECIMAL DEFAULT 10.0;
ALTER TABLE public.category_settings ADD COLUMN compliance_rest_period_enabled BOOLEAN DEFAULT true;
ALTER TABLE public.category_settings ADD COLUMN compliance_rest_period_hours DECIMAL DEFAULT 11.0;
ALTER TABLE public.category_settings ADD COLUMN compliance_break_enabled BOOLEAN DEFAULT true;
ALTER TABLE public.category_settings ADD COLUMN compliance_sunday_holiday_enabled BOOLEAN DEFAULT true;
