PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `preventive_route_stops__rebuild` (
	`id` text PRIMARY KEY NOT NULL,
	`route_id` text NOT NULL,
	`contract_elevator_id` text NOT NULL,
	`planned_time` text NOT NULL,
	`order_index` integer DEFAULT 0,
	`created_at` integer DEFAULT (cast(strftime('%s','now') as int)),
	`estimated_duration_mins` integer DEFAULT 120,
	`generated_work_order_id` text,
	`generated_month` text,
	`generated_at` integer,
	FOREIGN KEY (`route_id`) REFERENCES `preventive_routes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contract_elevator_id`) REFERENCES `contract_elevators`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`generated_work_order_id`) REFERENCES `work_orders`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `preventive_route_stops__rebuild` (`id`, `route_id`, `contract_elevator_id`, `planned_time`, `order_index`, `created_at`, `estimated_duration_mins`, `generated_work_order_id`, `generated_month`, `generated_at`)
SELECT `id`, `route_id`, `contract_elevator_id`, `planned_time`, `order_index`, `created_at`, `estimated_duration_mins`, `generated_work_order_id`, `generated_month`, `generated_at` FROM `preventive_route_stops`;
--> statement-breakpoint
DROP TABLE `preventive_route_stops`;
--> statement-breakpoint
ALTER TABLE `preventive_route_stops__rebuild` RENAME TO `preventive_route_stops`;
--> statement-breakpoint
CREATE INDEX `idx_prs_generated_month` ON `preventive_route_stops` (`generated_month`);
--> statement-breakpoint
INSERT OR IGNORE INTO `preventive_route_config` (`technician_id`)
SELECT DISTINCT `u`.`id` FROM `users` `u`
INNER JOIN `roles` `r` ON `r`.`id` = `u`.`role_id`
WHERE `r`.`name` LIKE '%TECNICO%' AND `u`.`deleted_at` IS NULL;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
