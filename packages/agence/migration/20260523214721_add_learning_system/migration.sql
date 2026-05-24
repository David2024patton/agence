CREATE TABLE `embedding_cache` (
	`hash` text PRIMARY KEY,
	`model` text NOT NULL,
	`embedding` text NOT NULL,
	`dimensions` integer NOT NULL,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `learning` (
	`id` text PRIMARY KEY,
	`project_id` text NOT NULL,
	`source` text NOT NULL,
	`concept` text NOT NULL,
	`description` text NOT NULL,
	`embedding` text,
	`confidence` text DEFAULT 'medium',
	`related_to` text,
	`skill_path` text,
	`metadata` text,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL,
	CONSTRAINT `fk_learning_project_id_project_id_fk` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE
);
