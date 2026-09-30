CREATE TABLE `work_order_elevator_photos` (
  `id` text PRIMARY KEY NOT NULL,
  `work_order_elevator_id` text NOT NULL,
  `work_order_task_id` text,
  `url` text NOT NULL,
  `tag` text NOT NULL,
  `description` text,
  `created_at` integer DEFAULT (unixepoch()),
  FOREIGN KEY (`work_order_elevator_id`) REFERENCES `work_order_elevators`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`work_order_task_id`) REFERENCES `work_order_tasks`(`id`) ON DELETE SET NULL
);

CREATE INDEX `idx_woep_elevator` ON `work_order_elevator_photos` (`work_order_elevator_id`);