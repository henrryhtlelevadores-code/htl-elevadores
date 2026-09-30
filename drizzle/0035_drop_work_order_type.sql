-- El tipo de OT se obtiene desde work_orders.service_type_id.
ALTER TABLE `work_orders` DROP COLUMN `type`;
