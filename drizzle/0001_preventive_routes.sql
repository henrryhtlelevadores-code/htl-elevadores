CREATE TABLE `preventive_route_stops` (
	`id` text PRIMARY KEY NOT NULL,
	`route_id` text NOT NULL,
	`contract_elevator_id` text NOT NULL,
	`planned_time` text NOT NULL,
	`order_index` integer DEFAULT 0,
	`created_at` integer DEFAULT (cast(strftime('%s','now') as int)),
	FOREIGN KEY (`route_id`) REFERENCES `preventive_routes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contract_elevator_id`) REFERENCES `contract_elevators`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `preventive_routes` (
	`id` text PRIMARY KEY NOT NULL,
	`technician_id` text NOT NULL,
	`business_day_number` integer NOT NULL,
	`name` text,
	`is_active` integer DEFAULT true,
	`created_at` integer DEFAULT (cast(strftime('%s','now') as int)),
	FOREIGN KEY (`technician_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `preventive_routes_technician_id_business_day_number_unique` ON `preventive_routes` (`technician_id`,`business_day_number`);