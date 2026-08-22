CREATE TABLE `passwordResetTokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`tokenHash` varchar(128) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`usedAt` timestamp,
	`requestedAt` timestamp NOT NULL DEFAULT (now()),
	`requestIp` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `passwordResetTokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `passwordResetTokens_tokenHash_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
ALTER TABLE `securityEvents` MODIFY COLUMN `eventType` enum('login_success','login_failed','logout','password_changed','password_reset_requested','password_reset_completed','mfa_enabled','mfa_disabled','session_revoked','portal_access') NOT NULL;--> statement-breakpoint
ALTER TABLE `passwordResetTokens` ADD CONSTRAINT `passwordResetTokens_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `password_reset_user_idx` ON `passwordResetTokens` (`userId`,`expiresAt`);--> statement-breakpoint
CREATE INDEX `password_reset_expiry_idx` ON `passwordResetTokens` (`expiresAt`);