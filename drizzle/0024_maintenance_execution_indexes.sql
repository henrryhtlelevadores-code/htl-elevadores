CREATE INDEX `idx_cem_contract_elevator` ON `contract_elevator_modules` (`contract_elevator_id`);
--> statement-breakpoint
CREATE INDEX `idx_cem_module` ON `contract_elevator_modules` (`module_id`);
--> statement-breakpoint
CREATE INDEX `idx_mt_module` ON `maintenance_tasks` (`module_id`);
--> statement-breakpoint
CREATE INDEX `idx_mt_zone` ON `maintenance_tasks` (`module_id`, `zone`);
--> statement-breakpoint
CREATE INDEX `idx_ec_elevator` ON `elevator_components` (`elevator_unity_id`);
--> statement-breakpoint
CREATE INDEX `idx_ec_parent` ON `elevator_components` (`parent_id`);
--> statement-breakpoint
CREATE INDEX `idx_cr_component` ON `component_replacements` (`elevator_component_id`);
--> statement-breakpoint
CREATE INDEX `idx_cr_spare_part` ON `component_replacements` (`spare_part_id`);
--> statement-breakpoint
CREATE INDEX `idx_cr_work_order` ON `component_replacements` (`work_order_id`);
--> statement-breakpoint
CREATE INDEX `idx_sp_brand` ON `spare_parts` (`brand_id`);
--> statement-breakpoint
CREATE INDEX `idx_sp_model` ON `spare_parts` (`model_id`);
--> statement-breakpoint
CREATE INDEX `idx_po_supplier` ON `purchase_orders` (`supplier_id`);
--> statement-breakpoint
CREATE INDEX `idx_mtpl_module` ON `maintenance_templates` (`module_id`);
--> statement-breakpoint
ALTER TABLE `pricing_config` ADD `maintenance_grace_days` integer DEFAULT 15;
--> statement-breakpoint
ALTER TABLE `work_order_tasks` ADD `maintenance_task_id` text REFERENCES maintenance_tasks(id) ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE `work_order_tasks` ADD `requires_photo` integer DEFAULT 0;
--> statement-breakpoint
CREATE INDEX `idx_wot_maintenance_task` ON `work_order_tasks` (`maintenance_task_id`);
--> statement-breakpoint
CREATE TABLE `contract_elevator_module_executions` (
	`id` text PRIMARY KEY NOT NULL,
	`contract_elevator_id` text NOT NULL,
	`module_id` text NOT NULL,
	`work_order_id` text NOT NULL,
	`executed_at` integer NOT NULL,
	`technician_id` text,
	`notes` text,
	`created_at` integer DEFAULT (CAST(unixepoch() AS INT)),
	FOREIGN KEY (`contract_elevator_id`) REFERENCES `contract_elevators`(`id`) ON DELETE CASCADE,
	FOREIGN KEY (`module_id`) REFERENCES `maintenance_modules`(`id`) ON DELETE RESTRICT,
	FOREIGN KEY (`work_order_id`) REFERENCES `work_orders`(`id`) ON DELETE RESTRICT,
	FOREIGN KEY (`technician_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
	CONSTRAINT `contract_elevator_module_executions_unique` UNIQUE(`work_order_id`, `module_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_ceme_contract_elevator` ON `contract_elevator_module_executions` (`contract_elevator_id`);
--> statement-breakpoint
CREATE INDEX `idx_ceme_module` ON `contract_elevator_module_executions` (`module_id`);
--> statement-breakpoint
CREATE INDEX `idx_ceme_executed_at` ON `contract_elevator_module_executions` (`executed_at`);
--> statement-breakpoint
CREATE INDEX `idx_ceme_work_order` ON `contract_elevator_module_executions` (`work_order_id`);
