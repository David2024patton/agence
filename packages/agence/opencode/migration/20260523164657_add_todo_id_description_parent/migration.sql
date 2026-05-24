PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_todo` (
	`id` text NOT NULL,
	`session_id` text NOT NULL,
	`content` text NOT NULL,
	`description` text,
	`status` text NOT NULL,
	`priority` text NOT NULL,
	`parent_id` text,
	`position` integer NOT NULL,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL,
	CONSTRAINT `todo_pk` PRIMARY KEY(`id`, `session_id`),
	CONSTRAINT `fk_todo_session_id_session_id_fk` FOREIGN KEY (`session_id`) REFERENCES `session`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__new_todo`(`id`, `session_id`, `content`, `status`, `priority`, `position`, `time_created`, `time_updated`) SELECT hex(randomblob(4)), `session_id`, `content`, `status`, `priority`, `position`, `time_created`, `time_updated` FROM `todo`;--> statement-breakpoint
DROP TABLE `todo`;--> statement-breakpoint
ALTER TABLE `__new_todo` RENAME TO `todo`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `todo_session_idx` ON `todo` (`session_id`);--> statement-breakpoint
CREATE INDEX `todo_parent_idx` ON `todo` (`parent_id`);