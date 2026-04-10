ALTER TABLE `repositories` ADD `github_id` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `repositories_github_id_unique` ON `repositories` (`github_id`);