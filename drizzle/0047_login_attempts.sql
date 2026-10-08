-- Fallos de inicio de sesión para el rate limit (personal y portal).
CREATE TABLE IF NOT EXISTS `login_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`scope` text NOT NULL,
	`ip` text NOT NULL,
	`identifier` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_login_attempts_key` ON `login_attempts` (`scope`,`ip`,`identifier`,`created_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_login_attempts_created` ON `login_attempts` (`created_at`);
