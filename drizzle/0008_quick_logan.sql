CREATE TABLE `auditClosingNotes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`engagementId` int NOT NULL,
	`fiscalPeriodId` int NOT NULL,
	`authorUserId` int NOT NULL,
	`note` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditClosingNotes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `auditEngagements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`fiscalPeriodId` int NOT NULL,
	`auditorUserId` int NOT NULL,
	`engagementName` varchar(255) NOT NULL,
	`auditFirm` varchar(255),
	`accessStart` date NOT NULL,
	`accessExpiry` date NOT NULL,
	`status` enum('active','closed','suspended') NOT NULL DEFAULT 'active',
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `auditEngagements_id` PRIMARY KEY(`id`),
	CONSTRAINT `audit_engagement_scope_unique` UNIQUE(`tenantId`,`companyId`,`fiscalPeriodId`,`auditorUserId`)
);
--> statement-breakpoint
CREATE TABLE `auditFinalReports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`engagementId` int NOT NULL,
	`summaryOfFindings` text,
	`materialMisstatements` text,
	`adjustmentsProposed` text,
	`adjustmentsAcceptedRejected` text,
	`complianceStatus` text,
	`vatReviewSummary` text,
	`zakatReviewSummary` text,
	`financialStatementOpinionDraft` text,
	`managementResponses` text,
	`opinionStatus` enum('draft','final','qualified','disclaimer','adverse') NOT NULL DEFAULT 'draft',
	`isLocked` boolean NOT NULL DEFAULT false,
	`lockedAt` timestamp,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `auditFinalReports_id` PRIMARY KEY(`id`),
	CONSTRAINT `audit_final_report_engagement_unique` UNIQUE(`engagementId`)
);
--> statement-breakpoint
CREATE TABLE `auditIndependenceDeclarations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`engagementId` int NOT NULL,
	`auditorUserId` int NOT NULL,
	`auditFirm` varchar(255),
	`independenceConfirmed` boolean NOT NULL,
	`hasPotentialConflict` boolean NOT NULL DEFAULT false,
	`potentialRelationships` text,
	`declarationStatus` enum('declared','updated','conflict_disclosed') NOT NULL DEFAULT 'declared',
	`declaredAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `auditIndependenceDeclarations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `auditReopenRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`engagementId` int NOT NULL,
	`fiscalPeriodId` int NOT NULL,
	`requestedByUserId` int NOT NULL,
	`reason` text NOT NULL,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`reviewedByUserId` int,
	`reviewedAt` timestamp,
	`decisionNote` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `auditReopenRequests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `auditSignOffs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`reportId` int NOT NULL,
	`auditorUserId` int NOT NULL,
	`auditorName` varchar(255) NOT NULL,
	`professionalLicenseNumber` varchar(128) NOT NULL,
	`auditFirm` varchar(255) NOT NULL,
	`auditScope` text NOT NULL,
	`opinionStatus` enum('draft','final','qualified','disclaimer','adverse') NOT NULL DEFAULT 'draft',
	`signedAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditSignOffs_id` PRIMARY KEY(`id`),
	CONSTRAINT `audit_signoff_report_unique` UNIQUE(`reportId`)
);
--> statement-breakpoint
ALTER TABLE `auditClosingNotes` ADD CONSTRAINT `auditClosingNotes_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auditClosingNotes` ADD CONSTRAINT `auditClosingNotes_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auditClosingNotes` ADD CONSTRAINT `auditClosingNotes_engagementId_auditEngagements_id_fk` FOREIGN KEY (`engagementId`) REFERENCES `auditEngagements`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auditClosingNotes` ADD CONSTRAINT `auditClosingNotes_fiscalPeriodId_fiscalPeriods_id_fk` FOREIGN KEY (`fiscalPeriodId`) REFERENCES `fiscalPeriods`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auditClosingNotes` ADD CONSTRAINT `auditClosingNotes_authorUserId_users_id_fk` FOREIGN KEY (`authorUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auditEngagements` ADD CONSTRAINT `auditEngagements_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auditEngagements` ADD CONSTRAINT `auditEngagements_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auditEngagements` ADD CONSTRAINT `auditEngagements_fiscalPeriodId_fiscalPeriods_id_fk` FOREIGN KEY (`fiscalPeriodId`) REFERENCES `fiscalPeriods`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auditEngagements` ADD CONSTRAINT `auditEngagements_auditorUserId_users_id_fk` FOREIGN KEY (`auditorUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auditEngagements` ADD CONSTRAINT `auditEngagements_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auditFinalReports` ADD CONSTRAINT `auditFinalReports_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auditFinalReports` ADD CONSTRAINT `auditFinalReports_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auditFinalReports` ADD CONSTRAINT `auditFinalReports_engagementId_auditEngagements_id_fk` FOREIGN KEY (`engagementId`) REFERENCES `auditEngagements`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auditFinalReports` ADD CONSTRAINT `auditFinalReports_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auditIndependenceDeclarations` ADD CONSTRAINT `aind_tenant_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auditIndependenceDeclarations` ADD CONSTRAINT `aind_engagement_fk` FOREIGN KEY (`engagementId`) REFERENCES `auditEngagements`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auditIndependenceDeclarations` ADD CONSTRAINT `aind_auditor_fk` FOREIGN KEY (`auditorUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auditReopenRequests` ADD CONSTRAINT `areopen_tenant_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auditReopenRequests` ADD CONSTRAINT `areopen_company_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auditReopenRequests` ADD CONSTRAINT `areopen_engagement_fk` FOREIGN KEY (`engagementId`) REFERENCES `auditEngagements`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auditReopenRequests` ADD CONSTRAINT `areopen_period_fk` FOREIGN KEY (`fiscalPeriodId`) REFERENCES `fiscalPeriods`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auditReopenRequests` ADD CONSTRAINT `areopen_requester_fk` FOREIGN KEY (`requestedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auditReopenRequests` ADD CONSTRAINT `areopen_reviewer_fk` FOREIGN KEY (`reviewedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auditSignOffs` ADD CONSTRAINT `asign_tenant_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auditSignOffs` ADD CONSTRAINT `asign_report_fk` FOREIGN KEY (`reportId`) REFERENCES `auditFinalReports`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auditSignOffs` ADD CONSTRAINT `asign_auditor_fk` FOREIGN KEY (`auditorUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `audit_closing_note_period_idx` ON `auditClosingNotes` (`tenantId`,`fiscalPeriodId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `audit_engagement_auditor_idx` ON `auditEngagements` (`tenantId`,`auditorUserId`,`status`);--> statement-breakpoint
CREATE INDEX `audit_independence_engagement_idx` ON `auditIndependenceDeclarations` (`engagementId`,`declaredAt`);--> statement-breakpoint
CREATE INDEX `audit_reopen_period_idx` ON `auditReopenRequests` (`tenantId`,`companyId`,`fiscalPeriodId`,`status`);
