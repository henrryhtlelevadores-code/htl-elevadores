ALTER TABLE `roles` ADD `is_field_role` integer DEFAULT 0;
UPDATE `roles` SET `is_field_role` = 1 WHERE `name` IN ('TECNICO DE CAMPO', 'SUPERVISOR');
