-- ============================================================================
-- 0031 · Un único calendario: grupo de rotación para todos los módulos
-- ----------------------------------------------------------------------------
-- Modelo final: todo módulo tiene `rotation_group` y nada más.
--   1        -> va siempre en cada visita preventiva
--   2, 3, 4… -> se turnan entre visitas
-- Los campos `months_of_year` y `relative_offsets` quedan obsoletos: se vacían
-- y el código deja de usarlos.
--
-- NOTA: la columna `relative_offsets` ya existía en este entorno (se agregó
-- manualmente). En una base nueva hay que descomentar la línea de abajo.
--
-- ALTER TABLE `maintenance_modules` ADD COLUMN `relative_offsets` text;
-- ============================================================================

-- 1) Módulos de plataformas: R1, es decir, van en todas las visitas.
--    Se identifican por código porque los códigos son únicos por tipo de
--    equipo y P1..P8 solo existen en el catálogo de plataformas.
UPDATE `maintenance_modules`
SET `rotation_group` = 1
WHERE `code` IN ('P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8');
--> statement-breakpoint

-- 2) Calendarios obsoletos: se vacían en todos los módulos, para que nunca
--    coexistan con `rotation_group` (inválido por definición).
UPDATE `maintenance_modules` SET `months_of_year` = NULL;
--> statement-breakpoint
UPDATE `maintenance_modules` SET `relative_offsets` = NULL;
--> statement-breakpoint

-- 3) Todo módulo debe tener un grupo válido: los que estaban sin grupo
--    quedan como R1, que es el comportamiento de siempre.
UPDATE `maintenance_modules`
SET `rotation_group` = 1
WHERE `rotation_group` IS NULL OR `rotation_group` < 1;
