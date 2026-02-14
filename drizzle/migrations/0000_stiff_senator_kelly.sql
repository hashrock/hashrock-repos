CREATE TABLE `repositories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`full_name` text NOT NULL,
	`url` text NOT NULL,
	`description` text,
	`updated_at` text NOT NULL,
	`language` text,
	`star_count` integer DEFAULT 0,
	`created_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `repositories_full_name_unique` ON `repositories` (`full_name`);--> statement-breakpoint
CREATE TABLE `repository_tags` (
	`repository_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	PRIMARY KEY(`repository_id`, `tag_id`),
	FOREIGN KEY (`repository_id`) REFERENCES `repositories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_unique` ON `tags` (`name`);