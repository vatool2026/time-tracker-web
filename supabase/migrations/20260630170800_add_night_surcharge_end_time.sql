ALTER TABLE category_settings ADD COLUMN night_surcharge_end_time TIME DEFAULT '06:00:00';
ALTER TABLE category_settings DROP COLUMN IF EXISTS sunday_surcharge_start_time;
ALTER TABLE category_settings DROP COLUMN IF EXISTS holiday_surcharge_start_time;
