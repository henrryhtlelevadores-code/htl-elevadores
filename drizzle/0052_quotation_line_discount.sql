-- Descuento por línea de cotización. `line_discount_mode`: NULL = sin descuento,
-- 'PERCENT' o 'AMOUNT'. `line_discount_value` es lo que digitó el usuario (% o
-- S/ con IGV) y `line_discount_amount` el descuento efectivo en S/ con IGV.
-- client_value / igv / client_price de la línea quedan NETOS del descuento.
ALTER TABLE `quotation_lines` ADD `line_discount_mode` text;--> statement-breakpoint
ALTER TABLE `quotation_lines` ADD `line_discount_value` real;--> statement-breakpoint
ALTER TABLE `quotation_lines` ADD `line_discount_amount` real DEFAULT 0;
