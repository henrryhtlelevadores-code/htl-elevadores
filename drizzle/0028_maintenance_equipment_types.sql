ALTER TABLE `maintenance_zones` ADD `elevator_type_id` text REFERENCES elevator_types(id);
--> statement-breakpoint
ALTER TABLE `maintenance_modules` ADD `elevator_type_id` text REFERENCES elevator_types(id);
--> statement-breakpoint
UPDATE `maintenance_zones`
SET `elevator_type_id` = COALESCE(
  (SELECT id FROM elevator_types WHERE lower(name) LIKE '%pasaj%' LIMIT 1),
  (SELECT id FROM elevator_types ORDER BY name LIMIT 1)
)
WHERE `elevator_type_id` IS NULL;
--> statement-breakpoint
UPDATE `maintenance_modules`
SET `elevator_type_id` = COALESCE(
  (SELECT id FROM elevator_types WHERE lower(name) LIKE '%pasaj%' LIMIT 1),
  (SELECT id FROM elevator_types ORDER BY name LIMIT 1)
)
WHERE `elevator_type_id` IS NULL;
--> statement-breakpoint
CREATE INDEX `idx_mz_elevator_type` ON `maintenance_zones` (`elevator_type_id`);
--> statement-breakpoint
CREATE INDEX `idx_mm_elevator_type` ON `maintenance_modules` (`elevator_type_id`);
