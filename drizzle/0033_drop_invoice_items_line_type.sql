-- ============================================================================
-- 0033 · Elimina la columna fantasma `invoice_items.line_type`
-- ----------------------------------------------------------------------------
-- `0009_drop_invoice_items_line_type.sql` nunca se aplicó en este entorno
-- (la base se provisionó a mano y `__drizzle_migrations` está vacía), así que
-- la columna sobrevivió. Como quedó `NOT NULL` sin default, todo INSERT de
-- conceptos fallaba con
--   NOT NULL constraint failed: invoice_items.line_type
-- y el formulario reportaba "Faltan campos obligatorios", que no era cierto:
-- ningún campo del formulario tenía nada que ver.
--
-- `schema.ts` ya no declara `line_type` y ningún código la escribe, así que
-- aquí solo se elimina. Es seguro: la tabla tenía 0 filas.
--
-- En una base creada corriendo todo el historial desde 0000_init esta columna
-- ya no existe y la línea daría error. En ese caso hay que comentarla.
-- ============================================================================

ALTER TABLE `invoice_items` DROP COLUMN `line_type`;
