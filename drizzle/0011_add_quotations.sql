CREATE TABLE `labor_config` (
	`id` text PRIMARY KEY NOT NULL,
	`hourly_cost` real NOT NULL,
	`updated_at` integer DEFAULT (cast(strftime('%s','now') as int))
);
--> statement-breakpoint
CREATE TABLE `quotation_line_products` (
	`id` text PRIMARY KEY NOT NULL,
	`quotation_line_id` text NOT NULL,
	`description` text NOT NULL,
	`quantity` real DEFAULT 1,
	`unit` text,
	`unit_cost` real NOT NULL,
	`total_cost` real,
	`order_index` integer DEFAULT 0,
	FOREIGN KEY (`quotation_line_id`) REFERENCES `quotation_lines`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `quotation_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`quotation_id` text NOT NULL,
	`elevator_unity_id` text,
	`equipment_serial` text,
	`description` text,
	`order_index` integer DEFAULT 0,
	`total_hours` real DEFAULT 0,
	`hourly_cost` real DEFAULT 0,
	`labor_cost` real DEFAULT 0,
	`product_cost` real DEFAULT 0,
	`subtotal` real DEFAULT 0,
	`overhead_rate` real DEFAULT 0.2,
	`overhead_amount` real DEFAULT 0,
	`total_cost` real DEFAULT 0,
	`commission_rate` real DEFAULT 0.04,
	`commission_amount` real DEFAULT 0,
	`profit_rate` real DEFAULT 0.6,
	`profit_amount` real DEFAULT 0,
	`client_value` real DEFAULT 0,
	`igv` real DEFAULT 0,
	`client_price` real DEFAULT 0,
	`created_at` integer DEFAULT (cast(strftime('%s','now') as int)),
	FOREIGN KEY (`quotation_id`) REFERENCES `quotations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`elevator_unity_id`) REFERENCES `elevator_unity`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `quotations` (
	`id` text PRIMARY KEY NOT NULL,
	`quotation_number` text NOT NULL,
	`client_id` text NOT NULL,
	`cost_center_id` text,
	`advisor_id` text,
	`issue_date` integer NOT NULL,
	`valid_until` integer NOT NULL,
	`status` text DEFAULT 'DRAFT',
	`discount_rate` real DEFAULT 0,
	`subtotal` real DEFAULT 0,
	`discount_amount` real DEFAULT 0,
	`taxable_base` real DEFAULT 0,
	`igv` real DEFAULT 0,
	`total` real DEFAULT 0,
	`notes` text,
	`terms` text,
	`created_at` integer DEFAULT (cast(strftime('%s','now') as int)),
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cost_center_id`) REFERENCES `cost_center`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`advisor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quotations_quotation_number_unique` ON `quotations` (`quotation_number`);