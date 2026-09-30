-- Técnicos de apoyo, duración y hora estimada de cierre.
ALTER TABLE `work_orders` ADD COLUMN `supporting_technicians` text;
ALTER TABLE `work_orders` ADD COLUMN `estimated_duration_mins` integer;
ALTER TABLE `work_orders` ADD COLUMN `estimated_end_at` integer;

-- Derivación de órdenes de trabajo.
ALTER TABLE `work_orders` ADD COLUMN `parent_work_order_id` text;
ALTER TABLE `work_orders` ADD COLUMN `derivation_reason` text;
ALTER TABLE `work_orders`
  ADD CONSTRAINT `fk_wo_parent`
  FOREIGN KEY (`parent_work_order_id`) REFERENCES `work_orders`(`id`);

-- Origen de la hora de cierre: AUTO o MANUAL.
ALTER TABLE `work_orders`
  ADD COLUMN `close_time_source` text DEFAULT 'MANUAL';
