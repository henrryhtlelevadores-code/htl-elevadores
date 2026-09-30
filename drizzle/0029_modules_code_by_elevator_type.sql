PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `maintenance_modules_new` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`frequency_per_year` integer NOT NULL,
	`months_of_year` text,
	`elevator_type_id` text REFERENCES elevator_types(id),
	`is_active` integer DEFAULT 1,
	CONSTRAINT `maintenance_modules_type_code_unique` UNIQUE(`elevator_type_id`, `code`)
);
--> statement-breakpoint
INSERT INTO `maintenance_modules_new` (`id`, `code`, `name`, `description`, `frequency_per_year`, `months_of_year`, `elevator_type_id`, `is_active`)
SELECT `id`, `code`, `name`, `description`, `frequency_per_year`, `months_of_year`, `elevator_type_id`, `is_active`
FROM `maintenance_modules`;
--> statement-breakpoint
DROP TABLE `maintenance_modules`;
--> statement-breakpoint
ALTER TABLE `maintenance_modules_new` RENAME TO `maintenance_modules`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
