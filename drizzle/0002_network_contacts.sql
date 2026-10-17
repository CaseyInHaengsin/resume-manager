CREATE TABLE `network_contacts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`company_id` integer,
	`name` text NOT NULL,
	`headline` text,
	`notes` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `network_contacts_user_company_idx` ON `network_contacts` (`user_id`,`company_id`);