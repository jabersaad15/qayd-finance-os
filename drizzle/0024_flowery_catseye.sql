CREATE TABLE `approvalRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`documentType` varchar(64) NOT NULL,
	`documentId` int NOT NULL,
	`requestedByUserId` int NOT NULL,
	`decidedByUserId` int,
	`status` enum('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
	`amount` decimal(18,6) NOT NULL DEFAULT '0.000000',
	`reason` text,
	`decisionNote` text,
	`requestedAt` timestamp NOT NULL DEFAULT (now()),
	`decidedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `approvalRequests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customerPortalEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`customerId` int NOT NULL,
	`tokenId` int NOT NULL,
	`eventType` varchar(64) NOT NULL,
	`entityType` varchar(64),
	`entityId` int,
	`ipAddress` varchar(64),
	`userAgent` varchar(512),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `customerPortalEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customerPortalTokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`customerId` int NOT NULL,
	`tokenHash` varchar(128) NOT NULL,
	`status` enum('active','revoked','expired') NOT NULL DEFAULT 'active',
	`expiresAt` timestamp NOT NULL,
	`lastUsedAt` timestamp,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customerPortalTokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `customerPortalTokens_tokenHash_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
CREATE TABLE `securityEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int,
	`companyId` int,
	`userId` int,
	`eventType` enum('login_success','login_failed','logout','password_changed','mfa_enabled','mfa_disabled','session_revoked','portal_access') NOT NULL,
	`ipAddress` varchar(64),
	`userAgent` varchar(512),
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `securityEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `approvalRequests` ADD CONSTRAINT `approvalRequests_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approvalRequests` ADD CONSTRAINT `approvalRequests_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approvalRequests` ADD CONSTRAINT `approvalRequests_requestedByUserId_users_id_fk` FOREIGN KEY (`requestedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approvalRequests` ADD CONSTRAINT `approvalRequests_decidedByUserId_users_id_fk` FOREIGN KEY (`decidedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customerPortalEvents` ADD CONSTRAINT `customerPortalEvents_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customerPortalEvents` ADD CONSTRAINT `customerPortalEvents_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customerPortalEvents` ADD CONSTRAINT `customerPortalEvents_customerId_customers_id_fk` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customerPortalEvents` ADD CONSTRAINT `customerPortalEvents_tokenId_customerPortalTokens_id_fk` FOREIGN KEY (`tokenId`) REFERENCES `customerPortalTokens`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customerPortalTokens` ADD CONSTRAINT `customerPortalTokens_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customerPortalTokens` ADD CONSTRAINT `customerPortalTokens_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customerPortalTokens` ADD CONSTRAINT `customerPortalTokens_customerId_customers_id_fk` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customerPortalTokens` ADD CONSTRAINT `customerPortalTokens_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `securityEvents` ADD CONSTRAINT `securityEvents_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `securityEvents` ADD CONSTRAINT `securityEvents_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `securityEvents` ADD CONSTRAINT `securityEvents_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `approval_request_scope_idx` ON `approvalRequests` (`tenantId`,`companyId`,`documentType`,`documentId`,`status`);--> statement-breakpoint
CREATE INDEX `customer_portal_events_scope_idx` ON `customerPortalEvents` (`tenantId`,`companyId`,`customerId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `customer_portal_scope_idx` ON `customerPortalTokens` (`tenantId`,`companyId`,`customerId`,`status`);--> statement-breakpoint
CREATE INDEX `security_events_user_idx` ON `securityEvents` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `security_events_scope_idx` ON `securityEvents` (`tenantId`,`companyId`,`createdAt`);