ALTER TABLE `maintenance_modules` ADD COLUMN `rotation_group` integer;
--> statement-breakpoint
-- Backfill: los módulos que ya existían sin meses absolutos (M1, M2, ...)
-- son rotativos bajo el nuevo modelo. Sin esto quedarían como fijos sin
-- calendario y el generador de OT no los aplicaría nunca.
UPDATE `maintenance_modules` SET `rotation_group` = 1 WHERE `months_of_year` IS NULL;
--> statement-breakpoint
ALTER TABLE `contracts` ADD COLUMN `maintenance_frequency_months` integer DEFAULT 1;
