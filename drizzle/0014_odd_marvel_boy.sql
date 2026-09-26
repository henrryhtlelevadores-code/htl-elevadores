ALTER TABLE `quotation_lines` ADD `manual_price` real;--> statement-breakpoint
ALTER TABLE `quotation_lines` ADD `manual_price_includes_igv` integer DEFAULT true;--> statement-breakpoint
ALTER TABLE `quotation_lines` ADD `supplier_cost` real;--> statement-breakpoint
-- FIXED_PRICE y PASSTHROUGH se fusionan en MANUAL_PRICE.
-- El precio al cliente se conserva: el manual_price siempre es el precio final con IGV.
UPDATE `quotation_lines`
SET `manual_price` = `line_override_price`,
    `manual_price_includes_igv` = 1,
    `line_override_price` = NULL,
    `line_mode` = 'MANUAL_PRICE'
WHERE `line_mode` = 'FIXED_PRICE'
  AND `line_override_price` IS NOT NULL;--> statement-breakpoint
UPDATE `quotation_lines`
SET `manual_price` = `client_price`,
    `manual_price_includes_igv` = 1,
    `supplier_cost` = `client_value`,
    `line_mode` = 'MANUAL_PRICE'
WHERE `line_mode` = 'PASSTHROUGH';
