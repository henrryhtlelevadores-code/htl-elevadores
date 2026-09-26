CREATE TABLE `preventive_route_config` (
	`technician_id` text PRIMARY KEY NOT NULL,
	`total_days` integer DEFAULT 10,
	`max_days` integer DEFAULT 15,
	`include_saturdays` integer DEFAULT true,
	`saturday_max_hours` integer DEFAULT 4,
	`default_stop_duration_mins` integer DEFAULT 120,
	`updated_at` integer DEFAULT (cast(strftime('%s','now') as int)),
	FOREIGN KEY (`technician_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `preventive_route_stops` ADD `estimated_duration_mins` integer DEFAULT 120;--> statement-breakpoint
ALTER TABLE `preventive_route_stops` ADD `generated_work_order_id` text REFERENCES work_orders(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE `preventive_route_stops` ADD `generated_month` text;--> statement-breakpoint
ALTER TABLE `preventive_route_stops` ADD `generated_at` integer;--> statement-breakpoint
CREATE INDEX `idx_prs_generated_month` ON `preventive_route_stops` (`generated_month`);--> statement-breakpoint
ALTER TABLE `work_order_elevators` ADD `started_at` integer;--> statement-breakpoint
INSERT OR IGNORE INTO `preventive_route_config` (`technician_id`) SELECT DISTINCT `u`.`id` FROM `users` `u` INNER JOIN `roles` `r` ON `r`.`id` = `u`.`role_id` WHERE `r`.`name` LIKE '%TECNICO%' AND `u`.`deleted_at` IS NULL;