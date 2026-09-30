CREATE TABLE `maintenance_modules` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL UNIQUE,
	`name` text NOT NULL,
	`description` text,
	`frequency_per_year` integer NOT NULL,
	`is_active` integer DEFAULT 1
);
--> statement-breakpoint
CREATE TABLE `maintenance_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`module_id` text NOT NULL,
	`zone` text NOT NULL,
	`description` text NOT NULL,
	`is_critical` integer DEFAULT 0,
	`order_index` integer DEFAULT 0,
	`requires_photo` integer DEFAULT 0,
	`is_active` integer DEFAULT 1,
	FOREIGN KEY (`module_id`) REFERENCES `maintenance_modules`(`id`)
);
--> statement-breakpoint
CREATE TABLE `contract_elevator_modules` (
	`id` text PRIMARY KEY NOT NULL,
	`contract_elevator_id` text NOT NULL,
	`module_id` text NOT NULL,
	`frequency_months` integer NOT NULL,
	`last_executed_at` integer,
	`next_due_at` integer,
	`is_active` integer DEFAULT 1,
	FOREIGN KEY (`contract_elevator_id`) REFERENCES `contract_elevators`(`id`),
	FOREIGN KEY (`module_id`) REFERENCES `maintenance_modules`(`id`),
	CONSTRAINT `contract_elevator_modules_unique` UNIQUE(`contract_elevator_id`,`module_id`)
);
--> statement-breakpoint
CREATE TABLE `maintenance_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`module_id` text,
	`name` text NOT NULL,
	`version` text DEFAULT 'v1.0',
	`content` text NOT NULL,
	`is_active` integer DEFAULT 1,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`module_id`) REFERENCES `maintenance_modules`(`id`)
);
--> statement-breakpoint
CREATE TABLE `elevator_components` (
	`id` text PRIMARY KEY NOT NULL,
	`elevator_unity_id` text NOT NULL,
	`parent_id` text,
	`name` text NOT NULL,
	`component_type` text,
	`serial_number` text,
	`install_date` integer,
	`status` text DEFAULT 'OPERATIVE',
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`elevator_unity_id`) REFERENCES `elevator_unity`(`id`),
	FOREIGN KEY (`parent_id`) REFERENCES `elevator_components`(`id`)
);
--> statement-breakpoint
CREATE TABLE `spare_parts` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text UNIQUE,
	`name` text NOT NULL,
	`brand_id` text,
	`model_id` text,
	`unit` text,
	`stock` integer DEFAULT 0,
	`min_stock` integer DEFAULT 0,
	`is_active` integer DEFAULT 1,
	FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`),
	FOREIGN KEY (`model_id`) REFERENCES `models`(`id`)
);
--> statement-breakpoint
CREATE TABLE `component_replacements` (
	`id` text PRIMARY KEY NOT NULL,
	`elevator_component_id` text NOT NULL,
	`spare_part_id` text,
	`work_order_id` text,
	`replacement_date` integer NOT NULL,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`elevator_component_id`) REFERENCES `elevator_components`(`id`),
	FOREIGN KEY (`spare_part_id`) REFERENCES `spare_parts`(`id`),
	FOREIGN KEY (`work_order_id`) REFERENCES `work_orders`(`id`)
);
--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`contact_name` text,
	`phone` text,
	`email` text,
	`is_active` integer DEFAULT 1
);
--> statement-breakpoint
CREATE TABLE `purchase_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`supplier_id` text,
	`order_date` integer,
	`status` text DEFAULT 'DRAFT',
	`total` real,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`)
);
