CREATE TABLE `email_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`text` text NOT NULL,
	`due` text,
	`done` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`thread_id`) REFERENCES `threads`(`id`) ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX `email_tasks_thread_id_idx` ON `email_tasks` (`thread_id`);
