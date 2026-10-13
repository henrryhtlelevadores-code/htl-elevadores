-- Línea de negocio del tipo de servicio: ELEVATOR (ascensores) o GENERAL
-- (servicios generales: limpieza, jardinería, etc.). Los existentes son de ascensores.
ALTER TABLE `service_types` ADD `service_scope` text DEFAULT 'ELEVATOR';
