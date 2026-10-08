-- Separa los permisos de órdenes de trabajo en panel (oficina) y field (app
-- del técnico), para que el técnico de campo no herede las acciones del panel.
-- Solo toca los roles por defecto si conservan los permisos originales.
UPDATE `roles` SET `permissions` = '["work_orders:field","safety"]'
WHERE `name` = 'TECNICO DE CAMPO' AND `permissions` = '["work_orders","safety"]';
--> statement-breakpoint
UPDATE `roles` SET `permissions` = '["work_orders:panel:read"]'
WHERE `name` = 'SOPORTE' AND `permissions` = '["work_orders:read"]';
