-- Servicios generales en órdenes de trabajo (limpieza, jardinería, etc.).
-- work_order_services es el hermano de work_order_elevators; sus tareas van en
-- work_order_service_tasks. Una OT es de ascensores o de servicios generales
-- según service_types.service_scope de su tipo de servicio.
CREATE TABLE `work_order_services` (
	`id` text PRIMARY KEY NOT NULL,
	`work_order_id` text NOT NULL,
	`service_type_id` text,
	`location_description` text,
	`description` text,
	`status` text DEFAULT 'PENDING',
	`started_at` integer,
	`completed_at` integer,
	`final_status` text,
	`observations` text,
	`order_index` integer DEFAULT 0,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`work_order_id`) REFERENCES `work_orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`service_type_id`) REFERENCES `service_types`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_wos_work_order` ON `work_order_services` (`work_order_id`);--> statement-breakpoint
CREATE TABLE `work_order_service_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`work_order_service_id` text NOT NULL,
	`task_description` text NOT NULL,
	`is_critical` integer DEFAULT false,
	`is_completed` integer DEFAULT false,
	`status` text DEFAULT 'PENDING',
	`requires_photo` integer DEFAULT false,
	`observations` text,
	`evidence_photo_url` text,
	`completed_at` integer,
	`order_index` integer DEFAULT 0,
	FOREIGN KEY (`work_order_service_id`) REFERENCES `work_order_services`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_wost_service` ON `work_order_service_tasks` (`work_order_service_id`);
