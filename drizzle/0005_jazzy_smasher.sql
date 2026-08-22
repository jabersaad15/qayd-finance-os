CREATE TABLE `financialReminderSchedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`createdByUserId` int NOT NULL,
	`reminderType` enum('vat_due','financial_digest','approval_pending') NOT NULL,
	`cronExpression` varchar(64) NOT NULL,
	`scheduleCronTaskUid` varchar(65),
	`isEnabled` boolean NOT NULL DEFAULT true,
	`lastTriggeredAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `financialReminderSchedules_id` PRIMARY KEY(`id`),
	CONSTRAINT `financial_reminder_unique` UNIQUE(`tenantId`,`companyId`,`reminderType`)
);
--> statement-breakpoint
ALTER TABLE `financialReminderSchedules` ADD CONSTRAINT `financialReminderSchedules_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `financialReminderSchedules` ADD CONSTRAINT `financialReminderSchedules_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `financialReminderSchedules` ADD CONSTRAINT `financialReminderSchedules_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `financial_reminder_task_idx` ON `financialReminderSchedules` (`scheduleCronTaskUid`);