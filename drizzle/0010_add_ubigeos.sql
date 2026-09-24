CREATE TABLE `ubigeos` (
	`id` text PRIMARY KEY NOT NULL,
	`departamento` text NOT NULL,
	`provincia` text NOT NULL,
	`distrito` text NOT NULL,
	`latitud` real,
	`longitud` real,
	`created_at` integer DEFAULT (cast(strftime('%s','now') as int))
);
--> statement-breakpoint
CREATE INDEX `idx_ubigeos_departamento` ON `ubigeos` (`departamento`);--> statement-breakpoint
CREATE INDEX `idx_ubigeos_provincia` ON `ubigeos` (`provincia`);--> statement-breakpoint
CREATE INDEX `idx_ubigeos_distrito` ON `ubigeos` (`distrito`);--> statement-breakpoint
ALTER TABLE `cost_center` ADD `ubigeo_id` text REFERENCES ubigeos(id);--> statement-breakpoint
ALTER TABLE `cost_center` DROP COLUMN `district`;