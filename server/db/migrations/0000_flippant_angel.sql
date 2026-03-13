CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`from` text DEFAULT '{}' NOT NULL,
	`to` text DEFAULT '[]' NOT NULL,
	`cc` text,
	`subject` text DEFAULT '' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`timestamp` integer DEFAULT 0 NOT NULL,
	`synced_at` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`thread_id`) REFERENCES `threads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `messages_thread_id_idx` ON `messages` (`thread_id`);--> statement-breakpoint
CREATE TABLE `smart_inbox_items` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`classification_prompt` text NOT NULL,
	`summarization_prompt` text,
	`scan_scope` integer DEFAULT 50 NOT NULL,
	`classifying` integer DEFAULT 0 NOT NULL,
	`last_classified_at` integer,
	`created_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `smart_inbox_results` (
	`item_id` text NOT NULL,
	`thread_id` text NOT NULL,
	`summary` text NOT NULL,
	`classified_at` integer NOT NULL,
	PRIMARY KEY(`item_id`, `thread_id`),
	FOREIGN KEY (`item_id`) REFERENCES `smart_inbox_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`thread_id`) REFERENCES `threads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `smart_inbox_results_item_id_idx` ON `smart_inbox_results` (`item_id`);--> statement-breakpoint
CREATE TABLE `sync_state` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `threads` (
	`id` text PRIMARY KEY NOT NULL,
	`subject` text DEFAULT '' NOT NULL,
	`snippet` text DEFAULT '' NOT NULL,
	`participants` text DEFAULT '[]' NOT NULL,
	`unread` integer DEFAULT 0 NOT NULL,
	`message_count` integer DEFAULT 0 NOT NULL,
	`last_message_at` integer DEFAULT 0 NOT NULL,
	`labels` text DEFAULT '[]' NOT NULL,
	`history_id` text,
	`synced_at` integer DEFAULT 0 NOT NULL
);
