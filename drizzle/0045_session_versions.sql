-- Versión de sesión: va dentro del token y se compara en cada petición.
-- Incrementarla revoca todas las sesiones emitidas para ese usuario/sede.
ALTER TABLE `users` ADD COLUMN `session_version` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `cost_center` ADD COLUMN `portal_session_version` integer NOT NULL DEFAULT 0;
