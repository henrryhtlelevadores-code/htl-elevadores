ALTER TABLE `work_orders` ADD COLUMN `approval_status` text DEFAULT 'PENDING';
-- 'PENDING' | 'APPROVED' | 'REJECTED'

ALTER TABLE `work_orders` ADD COLUMN `approved_by` text;

ALTER TABLE `work_orders` ADD COLUMN `approved_at` integer;