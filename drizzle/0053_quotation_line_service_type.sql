-- Tipo de servicio por línea de cotización (opcional): permite filtrar el listado.
-- `show_in_quotations` marca qué tipos de servicio se ofrecen en Cotizaciones; el
-- precio (`price`) pasa a ser opcional y solo se propone cuando existe.
ALTER TABLE `quotation_lines` ADD `service_type_id` text REFERENCES `service_types`(`id`) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE `service_types` ADD `show_in_quotations` integer DEFAULT 0;--> statement-breakpoint
-- Los servicios que ya tenían precio eran los que se ofrecían: se conservan visibles.
UPDATE `service_types` SET `show_in_quotations` = 1 WHERE `price` IS NOT NULL;
