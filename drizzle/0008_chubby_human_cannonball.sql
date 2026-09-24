ALTER TABLE `service_types` ADD `is_system` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `service_types` ADD `billing_trigger` text DEFAULT 'MANUAL';--> statement-breakpoint
ALTER TABLE `service_types` ADD `billing_delay_days` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `service_types` ADD `allowed_document_types` text DEFAULT 'FACTURA,BOLETA,NOTA_VENTA_INTERNA';--> statement-breakpoint
ALTER TABLE `work_orders` ADD `service_type_id` text REFERENCES service_types(id);--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`document_type` text NOT NULL,
	`series` text,
	`number` text,
	`client_id` text NOT NULL,
	`cost_center_id` text,
	`contract_id` text,
	`work_order_id` text,
	`issue_date` integer,
	`due_date` integer,
	`tax_period` text,
	`currency` text DEFAULT 'PEN',
	`total` real NOT NULL,
	`taxable_base` real,
	`igv` real,
	`renta_rate` real DEFAULT 0,
	`renta_amount` real DEFAULT 0,
	`detraction_rate` real DEFAULT 0,
	`detraction_amount` real DEFAULT 0,
	`net_payable` real,
	`sunat_status` text DEFAULT 'DRAFT',
	`payment_status` text DEFAULT 'PENDING',
	`client_tax_id_snapshot` text,
	`client_tax_id_type_snapshot` text,
	`client_name_snapshot` text,
	`client_address_snapshot` text,
	`created_at` integer DEFAULT (cast(strftime('%s','now') as int)),
	`updated_at` integer DEFAULT (cast(strftime('%s','now') as int)),
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`cost_center_id`) REFERENCES `cost_center`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`contract_id`) REFERENCES `contracts`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`work_order_id`) REFERENCES `work_orders`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_doc_series_number_unique` ON `invoices` (`document_type`,`series`,`number`) WHERE "invoices"."number" IS NOT NULL;--> statement-breakpoint
CREATE TABLE `invoice_items` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`line_type` text NOT NULL,
	`service_type_id` text,
	`description` text NOT NULL,
	`source_type` text,
	`source_id` text,
	`quantity` real DEFAULT 1,
	`unit_price` real NOT NULL,
	`subtotal` real NOT NULL,
	`igv` real NOT NULL,
	`total` real NOT NULL,
	`created_at` integer DEFAULT (cast(strftime('%s','now') as int)),
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`service_type_id`) REFERENCES `service_types`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
UPDATE `service_types` SET `is_system` = true;--> statement-breakpoint
UPDATE `service_types` SET `billing_trigger` = 'ON_OT_COMPLETION', `billing_delay_days` = 7 WHERE `code` = 'PREV';--> statement-breakpoint
UPDATE `service_types` SET `billing_trigger` = 'ON_OT_CREATION' WHERE `code` IN ('CORR-1','CORR-2');