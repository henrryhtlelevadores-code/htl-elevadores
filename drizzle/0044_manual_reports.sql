ALTER TABLE work_orders ADD COLUMN filled_by_admin integer DEFAULT 0;
ALTER TABLE work_orders ADD COLUMN manual_report_number text;
ALTER TABLE work_orders ADD COLUMN manual_report_photo_url text;
