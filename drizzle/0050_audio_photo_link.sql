-- Origen de cada nota de voz: NULL = grabada en Hallazgos; con valor = grabada
-- desde el detalle de esa foto (work_order_elevator_photos.id). Sin clave
-- foránea a propósito: la app puede subir el audio justo antes que la foto, y
-- si la foto se borra, la nota se conserva y pasa a mostrarse como de Hallazgos.
ALTER TABLE `work_order_elevator_audios` ADD `photo_id` text;
