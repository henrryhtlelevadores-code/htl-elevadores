PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `work_orders_new` (
	`id` text PRIMARY KEY NOT NULL,
	`ot_number` text NOT NULL,
	`cost_center_id` text NOT NULL,
	`technician_id` text,
	`type` text DEFAULT 'CORRECTIVE',
	`status` text DEFAULT 'PENDING',
	`priority` text DEFAULT 'NORMAL',
	`scheduled_date` text,
	`scheduled_time` text,
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
INSERT INTO `work_orders_new` (`id`, `ot_number`, `cost_center_id`, `technician_id`, `type`, `status`, `priority`, `scheduled_date`, `scheduled_time`, `started_at`, `completed_at`, `checkin_latitude`, `checkin_longitude`, `closing_notes`, `client_signature_url`, `client_signer_name`, `created_at`, `deleted_at`)
SELECT `id`, `ot_number`, `cost_center_id`, `technician_id`, `type`, `status`, `priority`,
	CASE
		WHEN `scheduled_date` IS NOT NULL AND typeof(`scheduled_date`) = 'integer'
		THEN strftime('%Y-%m-%d', `scheduled_date`, 'unixepoch')
		ELSE `scheduled_date`
	END AS `scheduled_date`,
	`scheduled_time`,
	`started_at`, `completed_at`, `checkin_latitude`, `checkin_longitude`, `closing_notes`, `client_signature_url`, `client_signer_name`, `created_at`, `deleted_at`
FROM `work_orders`;
--> statement-breakpoint
DROP TABLE `work_orders`;
--> statement-breakpoint
ALTER TABLE `work_orders_new` RENAME TO `work_orders`;
--> statement-breakpoint
CREATE UNIQUE INDEX `work_orders_ot_number_unique` ON `work_orders` (`ot_number`);
--> statement-breakpoint
PRAGMA foreign_keys=ON;