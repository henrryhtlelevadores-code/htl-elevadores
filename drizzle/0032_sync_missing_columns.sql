-- ============================================================================
-- 0032 · Sincroniza columnas faltantes en bases aplicadas a mano
-- ----------------------------------------------------------------------------
-- En este entorno la base se provisionó aplicando los .sql a mano, así que
-- `__drizzle_migrations` quedó vacía y algunas columnas de migraciones
-- anteriores nunca llegaron a crearse. `schema.ts` sí las conoce, por lo que
-- cualquier INSERT que las escriba reventaba con
--   SQLite error: table invoices has no column named payer_tax_id
-- y el formulario solo mostraba "Ocurrió un error inesperado".
--
-- Las tres columnas son nullable y se agregan vacías: no se pierde data y las
-- facturas/OT ya registradas siguen intactas.
--
-- NOTA: en una base creada corriendo todo el historial desde 0000_init estas
-- columnas ya existen (0012 y 0004) y estas líneas darían error. En ese caso
-- hay que comentarlas.
-- ============================================================================

-- 1) Datos del pagador de la factura: documento y teléfono.
ALTER TABLE `invoices` ADD COLUMN `payer_tax_id` text;
--> statement-breakpoint
ALTER TABLE `invoices` ADD COLUMN `payer_phone` text;

-- 2) Evidencia fotográfica de la tarea de la OT.
ALTER TABLE `work_order_tasks` ADD COLUMN `requires_photo` integer DEFAULT false;
