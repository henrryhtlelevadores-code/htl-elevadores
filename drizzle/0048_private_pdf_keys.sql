-- Clave del PDF en el bucket privado de R2. Las columnas de URL pública
-- (pdf_url, final_pdf_url) se conservan para los PDFs aún no migrados.
ALTER TABLE `quotations` ADD COLUMN `pdf_key` text;
--> statement-breakpoint
ALTER TABLE `contracts` ADD COLUMN `final_pdf_key` text;
