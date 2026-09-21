CREATE TABLE `brands` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`country` text,
	`is_active` integer DEFAULT true
);
--> statement-breakpoint
CREATE UNIQUE INDEX `brands_name_unique` ON `brands` (`name`);--> statement-breakpoint
CREATE TABLE `clients` (
	`id` text PRIMARY KEY NOT NULL,
	`legal_name` text NOT NULL,
	`tax_id` text NOT NULL,
	`tax_id_type` text DEFAULT 'RUC',
	`billing_address` text,
	`billing_email` text,
	`logo_url` text,
	`status` text DEFAULT 'ACTIVE',
	`created_at` integer DEFAULT (cast(strftime('%s','now') as int)),
	`deleted_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clients_tax_id_unique` ON `clients` (`tax_id`);--> statement-breakpoint
CREATE TABLE `contract_elevators` (
	`id` text PRIMARY KEY NOT NULL,
	`contract_id` text NOT NULL,
	`elevator_unity_id` text NOT NULL,
	`frequency_months` integer DEFAULT 1,
	`price` real NOT NULL,
	`added_at` integer DEFAULT (cast(strftime('%s','now') as int)),
	FOREIGN KEY (`contract_id`) REFERENCES `contracts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`elevator_unity_id`) REFERENCES `elevator_unity`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `contracts` (
	`id` text PRIMARY KEY NOT NULL,
	`contract_number` text NOT NULL,
	`cost_center_id` text NOT NULL,
	`status` text DEFAULT 'ACTIVE',
	`service_type_id` text NOT NULL,
	`start_date` integer NOT NULL,
	`end_date` integer,
	`auto_renewal` integer DEFAULT true,
	`notice_period_days` integer DEFAULT 30,
	`currency` text DEFAULT 'PEN',
	`base_amount` real NOT NULL,
	`includes_igv` integer DEFAULT true,
	`payment_terms_days` integer DEFAULT 5,
	`inflation_adjustment` integer DEFAULT true,
	`sla_entrapment_mins` integer DEFAULT 45,
	`sla_mechanical_failure_mins` integer DEFAULT 180,
	`created_at` integer DEFAULT (cast(strftime('%s','now') as int)),
	`deleted_at` integer,
	FOREIGN KEY (`cost_center_id`) REFERENCES `cost_center`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`service_type_id`) REFERENCES `service_types`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contracts_contract_number_unique` ON `contracts` (`contract_number`);--> statement-breakpoint
CREATE TABLE `cost_center_contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`cost_center_id` text NOT NULL,
	`user_id` text,
	`full_name` text NOT NULL,
	`role` text DEFAULT 'Administrador',
	`phone` text,
	`email` text,
	`signature_url` text,
	`is_active` integer DEFAULT true,
	FOREIGN KEY (`cost_center_id`) REFERENCES `cost_center`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `cost_center` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`name` text NOT NULL,
	`address` text NOT NULL,
	`district` text,
	`latitude` real,
	`longitude` real,
	`main_photo_url` text,
	`created_at` integer DEFAULT (cast(strftime('%s','now') as int)),
	`deleted_at` integer,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `elevator_types` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`is_active` integer DEFAULT true
);
--> statement-breakpoint
CREATE UNIQUE INDEX `elevator_types_name_unique` ON `elevator_types` (`name`);--> statement-breakpoint
CREATE TABLE `elevator_unity` (
	`id` text PRIMARY KEY NOT NULL,
	`cost_center_id` text NOT NULL,
	`brand_id` text,
	`model_id` text,
	`elevator_type_id` text NOT NULL,
	`internal_code` text NOT NULL,
	`manufacturer_serial` text,
	`name` text NOT NULL,
	`capacity_persons` integer,
	`capacity_kg` integer,
	`speed_ms` real,
	`stops` integer,
	`floors` integer,
	`traction_type` text,
	`year_of_fabrication` integer,
	`status` text DEFAULT 'OPERATIVE',
	`installation_date` integer,
	`reference_photos` text,
	`created_at` integer DEFAULT (cast(strftime('%s','now') as int)),
	`deleted_at` integer,
	FOREIGN KEY (`cost_center_id`) REFERENCES `cost_center`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`model_id`) REFERENCES `models`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`elevator_type_id`) REFERENCES `elevator_types`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `models` (
	`id` text PRIMARY KEY NOT NULL,
	`brand_id` text NOT NULL,
	`name` text NOT NULL,
	`tech_specs` text,
	`is_active` integer DEFAULT true,
	FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`work_order_id` text NOT NULL,
	`equipment_id` text,
	`report_category` text NOT NULL,
	`report_type` text NOT NULL,
	`issue_description` text NOT NULL,
	`observations` text,
	`status` text DEFAULT 'Borrador',
	`final_pdf_url` text,
	`created_at` integer DEFAULT (cast(strftime('%s','now') as int)),
	`updated_at` integer DEFAULT (cast(strftime('%s','now') as int)),
	FOREIGN KEY (`work_order_id`) REFERENCES `work_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`equipment_id`) REFERENCES `elevator_unity`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`permissions` text,
	`is_active` integer DEFAULT true,
	`created_at` integer DEFAULT (cast(strftime('%s','now') as int))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `roles_name_unique` ON `roles` (`name`);--> statement-breakpoint
CREATE TABLE `safety_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`equipment_type_id` text,
	`name` text NOT NULL,
	`version` text DEFAULT 'v1.0',
	`content` text NOT NULL,
	`is_active` integer DEFAULT true,
	`created_at` integer DEFAULT (cast(strftime('%s','now') as int)),
	FOREIGN KEY (`equipment_type_id`) REFERENCES `elevator_types`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `service_types` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`requires_contract` integer DEFAULT false,
	`default_sla_mins` integer,
	`is_billable_by_default` integer DEFAULT true,
	`is_active` integer DEFAULT true,
	`created_at` integer DEFAULT (cast(strftime('%s','now') as int))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `service_types_code_unique` ON `service_types` (`code`);--> statement-breakpoint
CREATE TABLE `staff_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`document_type` text NOT NULL,
	`document_number` text NOT NULL,
	`specialization` text,
	`license_number` text,
	`signature_url` text,
	`has_sctr` integer DEFAULT false,
	`sctr_expiry_date` integer,
	`base_salary` real,
	`current_latitude` real,
	`current_longitude` real,
	`last_location_update` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`full_name` text NOT NULL,
	`phone` text,
	`role_id` text NOT NULL,
	`status` text DEFAULT 'ACTIVE',
	`last_login_at` integer,
	`created_at` integer DEFAULT (cast(strftime('%s','now') as int)),
	`deleted_at` integer,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `work_order_elevators` (
	`id` text PRIMARY KEY NOT NULL,
	`work_order_id` text NOT NULL,
	`elevator_unity_id` text NOT NULL,
	`status` text DEFAULT 'PENDING',
	`finding` text,
	`completed_at` integer,
	FOREIGN KEY (`work_order_id`) REFERENCES `work_orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`elevator_unity_id`) REFERENCES `elevator_unity`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `work_order_safety_records` (
	`id` text PRIMARY KEY NOT NULL,
	`work_order_id` text NOT NULL,
	`template_id` text NOT NULL,
	`technician_id` text NOT NULL,
	`status` text DEFAULT 'DRAFT',
	`responses` text NOT NULL,
	`signature_url` text,
	`geolocation` text,
	`signed_at` integer,
	`created_at` integer DEFAULT (cast(strftime('%s','now') as int)),
	FOREIGN KEY (`template_id`) REFERENCES `safety_templates`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`technician_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `work_order_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`work_order_elevator_id` text NOT NULL,
	`task_description` text NOT NULL,
	`is_critical` integer DEFAULT false,
	`is_completed` integer DEFAULT false,
	`observations` text,
	`evidence_photo_url` text,
	`completed_at` integer,
	FOREIGN KEY (`work_order_elevator_id`) REFERENCES `work_order_elevators`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `work_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`ot_number` text NOT NULL,
	`cost_center_id` text NOT NULL,
	`technician_id` text,
	`type` text DEFAULT 'CORRECTIVE',
	`status` text DEFAULT 'PENDING',
	`priority` text DEFAULT 'NORMAL',
	`scheduled_date` integer,
	`started_at` integer,
	`completed_at` integer,
	`checkin_latitude` real,
	`checkin_longitude` real,
	`closing_notes` text,
	`client_signature_url` text,
	`client_signer_name` text,
	`created_at` integer DEFAULT (cast(strftime('%s','now') as int)),
	`deleted_at` integer,
	FOREIGN KEY (`cost_center_id`) REFERENCES `cost_center`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`technician_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `work_orders_ot_number_unique` ON `work_orders` (`ot_number`);