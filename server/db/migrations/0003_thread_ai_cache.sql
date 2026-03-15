CREATE TABLE `thread_ai_cache` (
	`thread_id` text NOT NULL,
	`type` text NOT NULL,
	`last_message_at` integer NOT NULL,
	`data` text NOT NULL,
	`created_at` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`thread_id`, `type`),
	FOREIGN KEY (`thread_id`) REFERENCES `threads`(`id`) ON DELETE cascade ON UPDATE no action
);
