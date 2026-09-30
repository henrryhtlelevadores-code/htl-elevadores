-- Elimina `contract_elevator_modules`.
--
-- El plan de mantenimiento de un ascensor se deriva por tipo de equipo:
--   maintenance_modules.elevator_type_id -> elevator_unities.elevator_type_id
-- La rotación vive en maintenance_modules.rotation_group y la frecuencia en
-- maintenance_modules.frequency_per_year, por lo que la tabla sólo aportaba
-- estado desnormalizado y asignaciones manuales por equipo.
--
-- Antes de dropearla se preserva la última ejecución registrada, escribiéndola
-- en contract_elevator_module_executions (histórico ya existente). Cada fila
-- antigua se vincula a la OT completada más reciente de ese ascensor; si el
-- ascensor no tiene ninguna OT completada, no existe una OT a la que vincular
-- la ejecución y la fila se descarta.

INSERT OR IGNORE INTO `contract_elevator_module_executions`
  (`id`, `contract_elevator_id`, `module_id`, `work_order_id`, `executed_at`, `created_at`)
SELECT
  lower(hex(randomblob(16))),
  `cem`.`contract_elevator_id`,
  `cem`.`module_id`,
  (
    SELECT `woe`.`work_order_id`
    FROM `work_order_elevators` `woe`
    INNER JOIN `work_orders` `wo` ON `wo`.`id` = `woe`.`work_order_id`
    WHERE `woe`.`contract_elevator_id` = `cem`.`contract_elevator_id`
      AND `wo`.`status` = 'COMPLETED'
    ORDER BY `wo`.`completed_at` DESC
    LIMIT 1
  ),
  `cem`.`last_executed_at`,
  `cem`.`last_executed_at`
FROM `contract_elevator_modules` `cem`
WHERE `cem`.`last_executed_at` IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM `work_order_elevators` `woe`
    INNER JOIN `work_orders` `wo` ON `wo`.`id` = `woe`.`work_order_id`
    WHERE `woe`.`contract_elevator_id` = `cem`.`contract_elevator_id`
      AND `wo`.`status` = 'COMPLETED'
  );
--> statement-breakpoint
DROP INDEX IF EXISTS `idx_cem_contract_elevator`;
--> statement-breakpoint
DROP INDEX IF EXISTS `idx_cem_module`;
--> statement-breakpoint
DROP TABLE IF EXISTS `contract_elevator_modules`;
