DROP TABLE IF EXISTS `work_order_safety_records`;

CREATE TABLE `work_order_elevator_safety` (
  `id` text PRIMARY KEY NOT NULL,
  `work_order_elevator_id` text NOT NULL,
  `template_id` text NOT NULL,
  `template_version` text,
  `template_snapshot` text,
  `status` text DEFAULT 'PENDING',
  `technician_signature_url` text,
  `client_signature_url` text,
  `geolocation` text,
  `notes` text,
  `completed_at` integer,
  `created_at` integer DEFAULT (unixepoch()),
  FOREIGN KEY (`work_order_elevator_id`) REFERENCES `work_order_elevators`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`template_id`) REFERENCES `safety_templates`(`id`)
);

CREATE TABLE `work_order_elevator_safety_items` (
  `id` text PRIMARY KEY NOT NULL,
  `safety_record_id` text NOT NULL,
  `question` text NOT NULL,
  `response` text,
  `observations` text,
  `photo_url` text,
  `order_index` integer DEFAULT 0,
  `answered_at` integer,
  FOREIGN KEY (`safety_record_id`) REFERENCES `work_order_elevator_safety`(`id`) ON DELETE CASCADE
);
