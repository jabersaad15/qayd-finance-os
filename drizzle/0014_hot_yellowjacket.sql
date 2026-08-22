CREATE TABLE `internalNotifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`recipientUserId` int,
	`eventType` varchar(120) NOT NULL,
	`titleAr` varchar(255) NOT NULL,
	`bodyAr` text NOT NULL,
	`entityType` varchar(64) NOT NULL,
	`entityId` int NOT NULL,
	`status` enum('unread','read') NOT NULL DEFAULT 'unread',
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `internalNotifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `internalNotifications` ADD CONSTRAINT `internalNotifications_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `internalNotifications` ADD CONSTRAINT `internalNotifications_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `internalNotifications` ADD CONSTRAINT `internalNotifications_recipientUserId_users_id_fk` FOREIGN KEY (`recipientUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `internal_notification_company_status_idx` ON `internalNotifications` (`companyId`,`status`);--> statement-breakpoint
CREATE INDEX `internal_notification_recipient_status_idx` ON `internalNotifications` (`recipientUserId`,`status`);