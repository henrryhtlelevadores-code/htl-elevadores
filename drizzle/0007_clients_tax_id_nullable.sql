PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `clients_new` (
	`id` text PRIMARY KEY NOT NULL,
	`legal_name` text NOT NULL,
	`tax_id` text,
	`tax_id_type` text DEFAULT 'RUC',
	`billing_address` text,
	`billing_email` text,
	`logo_url` text,
	`status` text DEFAULT 'ACTIVE',
	`created_at` integer DEFAULT (cast(strftime('%s','now') as int)),
	`deleted_at` integer
);
--> statement-breakpoint
INSERT INTO `clients_new` (`id`, `legal_name`, `tax_id`, `tax_id_type`, `billing_address`, `billing_email`, `logo_url`, `status`, `created_at`, `deleted_at`)
SELECT `id`, `legal_name`, `tax_id`, `tax_id_type`, `billing_address`, `billing_email`, `logo_url`, `status`, `created_at`, `deleted_at`
FROM `clients`;
--> statement-breakpoint
DROP TABLE `clients`;
--> statement-breakpoint
ALTER TABLE `clients_new` RENAME TO `clients`;
--> statement-breakpoint
CREATE UNIQUE INDEX `clients_tax_id_unique` ON `clients` (`tax_id`);
--> statement-breakpoint
PRAGMA foreign_keys=ON;