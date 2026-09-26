ALTER TABLE `quotations` ADD `welcome_message` text;--> statement-breakpoint
ALTER TABLE `quotations` ADD `payment_terms` text;--> statement-breakpoint
ALTER TABLE `quotations` ADD `execution_time` text;--> statement-breakpoint
ALTER TABLE `quotations` ADD `working_hours` text;--> statement-breakpoint
ALTER TABLE `quotations` ADD `validity_days` integer DEFAULT 15;--> statement-breakpoint
CREATE TABLE `quotation_images` (
  `id` text PRIMARY KEY NOT NULL,
  `quotation_id` text NOT NULL,
  `url` text NOT NULL,
  `caption` text,
  `order_index` integer DEFAULT 0,
  `is_reference_only` integer DEFAULT 0,
  `created_at` integer DEFAULT (CAST(unixepoch() AS INT)),
  FOREIGN KEY (`quotation_id`) REFERENCES `quotations` (`id`) ON DELETE CASCADE
);--> statement-breakpoint
CREATE INDEX `idx_quotation_images_quotation_id` ON `quotation_images` (`quotation_id`);
--> statement-breakpoint
ALTER TABLE `quotations` DROP COLUMN `notes`;--> statement-breakpoint
ALTER TABLE `quotations` DROP COLUMN `terms`;
