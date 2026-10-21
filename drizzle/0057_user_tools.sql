CREATE TABLE IF NOT EXISTS `user_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`content` text,
	`color` text DEFAULT '#ffffff',
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_user_notes_user_updated` ON `user_notes` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `calculator_history` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expression` text NOT NULL,
	`result` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_calculator_history_user_created` ON `calculator_history` (`user_id`,`created_at`);
