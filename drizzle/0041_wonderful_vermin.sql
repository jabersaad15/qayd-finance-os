CREATE TABLE `onboardingImportBatches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`userId` int NOT NULL,
	`entityType` varchar(64) NOT NULL,
	`sourceType` varchar(32) NOT NULL,
	`filename` varchar(255),
	`status` enum('uploaded','previewed','validated','imported','failed','cancelled') NOT NULL DEFAULT 'uploaded',
	`totalRows` int NOT NULL DEFAULT 0,
	`validRows` int NOT NULL DEFAULT 0,
	`errorCount` int NOT NULL DEFAULT 0,
	`errorSummary` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `onboardingImportBatches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `onboardingSessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`userId` int NOT NULL,
	`currentStep` varchar(64) NOT NULL DEFAULT 'welcome',
	`status` enum('active','paused','completed','abandoned') NOT NULL DEFAULT 'active',
	`percent` int NOT NULL DEFAULT 0,
	`answers` json,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `onboardingSessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `onboarding_session_scope_uq` UNIQUE(`tenantId`,`companyId`)
);
--> statement-breakpoint
ALTER TABLE `onboardingImportBatches` ADD CONSTRAINT `onboardingImportBatches_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `onboardingImportBatches` ADD CONSTRAINT `onboardingImportBatches_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `onboardingImportBatches` ADD CONSTRAINT `onboardingImportBatches_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `onboardingSessions` ADD CONSTRAINT `onboardingSessions_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `onboardingSessions` ADD CONSTRAINT `onboardingSessions_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `onboardingSessions` ADD CONSTRAINT `onboardingSessions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `onboarding_import_scope_idx` ON `onboardingImportBatches` (`tenantId`,`companyId`,`status`);--> statement-breakpoint
CREATE INDEX `onboarding_import_user_idx` ON `onboardingImportBatches` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `onboarding_session_user_idx` ON `onboardingSessions` (`userId`,`status`);