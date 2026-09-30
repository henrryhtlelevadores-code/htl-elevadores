ALTER TABLE `contract_elevator_modules` DROP COLUMN `months_of_year`;
--> statement-breakpoint
ALTER TABLE `maintenance_modules` ADD `months_of_year` text;
