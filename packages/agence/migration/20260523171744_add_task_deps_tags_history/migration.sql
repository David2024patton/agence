CREATE TABLE `task_history` (
	`id` text PRIMARY KEY,
	`task_id` text NOT NULL,
	`session_id` text NOT NULL,
	`field` text NOT NULL,
	`old_value` text,
	`new_value` text,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL,
	CONSTRAINT `fk_task_history_session_id_session_id_fk` FOREIGN KEY (`session_id`) REFERENCES `session`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
ALTER TABLE `todo` ADD `depends_on` text;--> statement-breakpoint
ALTER TABLE `todo` ADD `tags` text;--> statement-breakpoint
CREATE INDEX `task_history_task_idx` ON `task_history` (`task_id`);--> statement-breakpoint
CREATE INDEX `task_history_session_idx` ON `task_history` (`session_id`);--> statement-breakpoint
CREATE INDEX `todo_status_idx` ON `todo` (`status`);