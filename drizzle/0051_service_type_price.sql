-- Precio estandarizado por tipo de servicio (S/). NULL = sin precio fijo; solo
-- los servicios con precio se ofrecen en Cotizaciones (modo de cobro manual).
-- En producción la columna ya existe (se agregó a mano): aplicar solo en bases
-- que aún no la tengan, p. ej. local.db.
ALTER TABLE `service_types` ADD `price` text;
