UPDATE `maintenance_modules` SET `months_of_year` = '1,2,3,4,5,6,7,8,9,10,11,12' WHERE `months_of_year` IS NULL;
--> statement-breakpoint
ALTER TABLE `maintenance_modules` DROP COLUMN `rotation_group`;
--> statement-breakpoint
ALTER TABLE `maintenance_modules` DROP COLUMN `relative_offsets`;
--> statement-breakpoint
ALTER TABLE `maintenance_modules` DROP COLUMN `frequency_per_year`;
--> statement-breakpoint
ALTER TABLE `contracts` DROP COLUMN `maintenance_frequency_months`;
