CREATE TABLE `signup_snapshots` (
	`date` text NOT NULL,
	`service` text NOT NULL,
	`total` integer,
	`new_7d` integer,
	`new_30d` integer,
	`taken_at` text NOT NULL,
	PRIMARY KEY(`date`, `service`)
);
