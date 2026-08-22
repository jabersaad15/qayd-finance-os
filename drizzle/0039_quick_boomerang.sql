CREATE TABLE `adminDataExportRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`requestedByUserId` int NOT NULL,
	`scopeCode` varchar(120) NOT NULL,
	`reason` text NOT NULL,
	`status` enum('requested','confirmed','processing','completed','rejected','cancelled') NOT NULL DEFAULT 'requested',
	`confirmedAt` timestamp,
	`completedAt` timestamp,
	`resultReference` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `adminDataExportRequests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `adminSupportAccessGrants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`grantedByUserId` int NOT NULL,
	`supportUserId` int,
	`scopeCode` varchar(120) NOT NULL,
	`reason` text NOT NULL,
	`startsAt` timestamp NOT NULL,
	`endsAt` timestamp NOT NULL,
	`status` enum('requested','active','expired','revoked') NOT NULL DEFAULT 'requested',
	`revokedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `adminSupportAccessGrants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `adminDataExportRequests` ADD CONSTRAINT `adminDataExportRequests_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `adminDataExportRequests` ADD CONSTRAINT `adminDataExportRequests_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `adminDataExportRequests` ADD CONSTRAINT `adminDataExportRequests_requestedByUserId_users_id_fk` FOREIGN KEY (`requestedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `adminSupportAccessGrants` ADD CONSTRAINT `adminSupportAccessGrants_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `adminSupportAccessGrants` ADD CONSTRAINT `adminSupportAccessGrants_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `adminSupportAccessGrants` ADD CONSTRAINT `adminSupportAccessGrants_grantedByUserId_users_id_fk` FOREIGN KEY (`grantedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `adminSupportAccessGrants` ADD CONSTRAINT `adminSupportAccessGrants_supportUserId_users_id_fk` FOREIGN KEY (`supportUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `admin_export_scope_idx` ON `adminDataExportRequests` (`tenantId`,`companyId`,`status`);--> statement-breakpoint
CREATE INDEX `admin_support_scope_idx` ON `adminSupportAccessGrants` (`tenantId`,`companyId`,`status`);--> statement-breakpoint
CREATE INDEX `admin_support_expiry_idx` ON `adminSupportAccessGrants` (`endsAt`);