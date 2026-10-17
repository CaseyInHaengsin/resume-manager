CREATE TABLE `oauth_access_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`token_hash` text NOT NULL,
	`client_id` text NOT NULL,
	`user_id` integer NOT NULL,
	`scope` text NOT NULL,
	`resource` text NOT NULL,
	`expires_at` text NOT NULL,
	`revoked_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_access_tokens_token_hash_unique` ON `oauth_access_tokens` (`token_hash`);--> statement-breakpoint
CREATE TABLE `oauth_auth_codes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code_hash` text NOT NULL,
	`client_id` text NOT NULL,
	`user_id` integer NOT NULL,
	`redirect_uri` text NOT NULL,
	`code_challenge` text NOT NULL,
	`scope` text NOT NULL,
	`resource` text NOT NULL,
	`expires_at` text NOT NULL,
	`consumed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_auth_codes_code_hash_unique` ON `oauth_auth_codes` (`code_hash`);--> statement-breakpoint
CREATE TABLE `oauth_clients` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` text NOT NULL,
	`client_secret_hash` text,
	`client_name` text NOT NULL,
	`redirect_uris` text NOT NULL,
	`token_endpoint_auth_method` text DEFAULT 'none' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_clients_client_id_unique` ON `oauth_clients` (`client_id`);--> statement-breakpoint
CREATE TABLE `oauth_refresh_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`token_hash` text NOT NULL,
	`client_id` text NOT NULL,
	`user_id` integer NOT NULL,
	`scope` text NOT NULL,
	`resource` text NOT NULL,
	`expires_at` text NOT NULL,
	`rotated_to` text,
	`revoked_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_refresh_tokens_token_hash_unique` ON `oauth_refresh_tokens` (`token_hash`);