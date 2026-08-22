ALTER TABLE `users` ADD `mfaSecretEncrypted` varchar(512);--> statement-breakpoint
ALTER TABLE `users` ADD `mfaEnabled` boolean DEFAULT false NOT NULL;