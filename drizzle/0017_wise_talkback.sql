ALTER TABLE `preventive_route_stops` ADD `visit_group_id` text;--> statement-breakpoint
CREATE INDEX `idx_prs_visit_group` ON `preventive_route_stops` (`visit_group_id`);