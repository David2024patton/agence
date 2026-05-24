CREATE TABLE `conversation_archive` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL REFERENCES project(id) ON DELETE cascade,
  `session_id` text NOT NULL REFERENCES session(id) ON DELETE cascade,
  `title` text NOT NULL,
  `summary` text NOT NULL,
  `subject` text NOT NULL,
  `tags` text,
  `embedding` text,
  `token_count` integer NOT NULL,
  `message_count` integer NOT NULL,
  `compacted_summary` text,
  `time_created` integer NOT NULL DEFAULT (unixepoch()),
  `time_updated` integer NOT NULL DEFAULT (unixepoch())
);
