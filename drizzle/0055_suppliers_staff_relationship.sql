-- Proveedores y relación del personal de campo con HTL.
-- relationship_type: INTERNAL_EMPLOYEE | COLLABORATOR | SUBCONTRACTED_COMPANY |
-- EXTERNAL_PROFESSIONAL. Una empresa proveedora usa UNA sola cuenta (supplier_id).
-- provider_type / provider_company se conservan, derivados de estos campos.
ALTER TABLE `suppliers` ADD `tax_id` text;--> statement-breakpoint
ALTER TABLE `staff_profiles` ADD `relationship_type` text DEFAULT 'INTERNAL_EMPLOYEE';--> statement-breakpoint
ALTER TABLE `staff_profiles` ADD `supplier_id` text REFERENCES `suppliers`(`id`);--> statement-breakpoint
-- Las cuentas externas existentes pasan a ser la cuenta de su empresa: se crea el
-- proveedor a partir del nombre que tenían en texto libre y se vinculan.
INSERT INTO `suppliers` (`id`, `name`, `is_active`)
SELECT upper(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(6))), company, 1
FROM (SELECT DISTINCT trim(`provider_company`) AS company FROM `staff_profiles`
      WHERE `provider_type` = 'EXTERNAL' AND trim(coalesce(`provider_company`, '')) <> '')
WHERE company NOT IN (SELECT `name` FROM `suppliers`);--> statement-breakpoint
UPDATE `staff_profiles`
SET `relationship_type` = 'SUBCONTRACTED_COMPANY',
    `supplier_id` = (SELECT `id` FROM `suppliers` WHERE `name` = trim(`staff_profiles`.`provider_company`))
WHERE `provider_type` = 'EXTERNAL' AND `supplier_id` IS NULL;
