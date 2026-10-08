-- Notas de voz de hallazgos, subidas desde la app de técnicos.
CREATE TABLE IF NOT EXISTS `work_order_elevator_audios` (
	`id` text PRIMARY KEY NOT NULL,
	`work_order_elevator_id` text NOT NULL,
	`key` text NOT NULL,
	`duration_ms` integer DEFAULT 0 NOT NULL,
	`transcript` text,
	`transcript_status` text DEFAULT 'NONE' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`work_order_elevator_id`) REFERENCES `work_order_elevators`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_woea_elevator` ON `work_order_elevator_audios` (`work_order_elevator_id`);
