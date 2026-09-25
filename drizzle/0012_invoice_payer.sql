ALTER TABLE `invoices` ADD `payer_type` text DEFAULT 'COST_CENTER';--> statement-breakpoint
ALTER TABLE `invoices` ADD `payer_tax_id_type` text;--> statement-breakpoint
ALTER TABLE `invoices` ADD `payer_tax_id` text;--> statement-breakpoint
ALTER TABLE `invoices` ADD `payer_name` text;--> statement-breakpoint
ALTER TABLE `invoices` ADD `payer_commercial_name` text;--> statement-breakpoint
ALTER TABLE `invoices` ADD `payer_phone` text;--> statement-breakpoint
ALTER TABLE `invoices` ADD `payer_email` text;--> statement-breakpoint
ALTER TABLE `invoices` ADD `payer_relationship` text;--> statement-breakpoint
ALTER TABLE `invoices` ADD `payer_notes` text;--> statement-breakpoint
CREATE INDEX `idx_invoices_payer_type` ON `invoices` (`payer_type`);--> statement-breakpoint
CREATE INDEX `idx_invoices_payer_tax_id` ON `invoices` (`payer_tax_id`) WHERE "invoices"."payer_tax_id" IS NOT NULL;