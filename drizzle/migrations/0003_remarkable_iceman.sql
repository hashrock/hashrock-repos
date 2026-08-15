ALTER TABLE `repositories` ADD `notes` text;--> statement-breakpoint
ALTER TABLE `repositories` ADD `star` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `repositories` ADD `hide` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `repositories` ADD `cover_image_key` text;