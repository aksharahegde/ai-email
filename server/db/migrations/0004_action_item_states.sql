CREATE TABLE `action_item_states` (
	`thread_id` text NOT NULL,
	`item_text` text NOT NULL,
	`dismissed` integer DEFAULT 0 NOT NULL,
	`task_id` text,
	`created_at` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`thread_id`, `item_text`),
	FOREIGN KEY (`thread_id`) REFERENCES `threads`(`id`) ON DELETE cascade ON UPDATE no action
);
