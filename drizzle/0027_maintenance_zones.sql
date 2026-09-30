CREATE TABLE `maintenance_zones` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL UNIQUE,
	`name` text NOT NULL,
	`order_index` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT 1
);

ALTER TABLE `maintenance_tasks` ADD `zone_id` text REFERENCES maintenance_zones(id) ON DELETE RESTRICT;
--> statement-breakpoint
UPDATE `maintenance_tasks` SET `zone_id` = (
  SELECT `id` FROM `maintenance_zones` WHERE `maintenance_zones`.`name` = `maintenance_tasks`.`zone`
);
--> statement-breakpoint
CREATE INDEX `idx_mz_order` ON `maintenance_zones` (`order_index`);
--> statement-breakpoint
CREATE INDEX `idx_mt_zone_id` ON `maintenance_tasks` (`zone_id`);
