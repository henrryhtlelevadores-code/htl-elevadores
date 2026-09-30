ALTER TABLE `work_order_elevators` ADD COLUMN `contract_elevator_id` text REFERENCES `contract_elevators`(`id`);
ALTER TABLE `work_order_tasks` ADD COLUMN `module_id` text REFERENCES `maintenance_modules`(`id`);
