CREATE TABLE `executiveDecisions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`decisionDate` date NOT NULL,
	`responsibleDepartment` varchar(128),
	`responsibleUserId` int,
	`requirement` text NOT NULL,
	`dueDate` date,
	`status` enum('issued','assigned','in_progress','waiting','completed','closed') NOT NULL DEFAULT 'issued',
	`completionPercent` int NOT NULL DEFAULT 0,
	`latestUpdate` text,
	`notes` text,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `executiveDecisions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `executiveDelegations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`assistantUserId` int NOT NULL,
	`permission` enum('can_schedule_on_behalf_of_ceo','can_request_reports_on_behalf_of_ceo','can_follow_up_on_behalf_of_ceo','can_send_internal_reminder_on_behalf_of_ceo') NOT NULL,
	`startsAt` timestamp NOT NULL,
	`endsAt` timestamp NOT NULL,
	`grantedByUserId` int NOT NULL,
	`revokedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `executiveDelegations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `executiveDocuments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`documentId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`accessScope` enum('general','executive','confidential','ceo_only') NOT NULL DEFAULT 'executive',
	`sharedWithUserId` int,
	`sharedByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `executiveDocuments_id` PRIMARY KEY(`id`),
	CONSTRAINT `executive_document_share_unique` UNIQUE(`tenantId`,`companyId`,`documentId`,`sharedWithUserId`)
);
--> statement-breakpoint
CREATE TABLE `executiveInboxItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`itemType` enum('approval_request','report','decision_request','escalation','critical_issue','contract_review','important_document') NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`priority` enum('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
	`status` enum('open','snoozed','completed','dismissed') NOT NULL DEFAULT 'open',
	`dueAt` timestamp,
	`note` text,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `executiveInboxItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `executiveMeetings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`startAt` timestamp NOT NULL,
	`endAt` timestamp,
	`meetingLink` varchar(500),
	`participants` text,
	`agenda` text,
	`brief` text,
	`minutes` text,
	`actionItems` text,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `executiveMeetings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `executiveRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`requestType` enum('schedule_meeting','follow_up_task','request_report','prepare_document','reminder','contact_manager','prepare_minutes','request_update') NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`priority` enum('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
	`status` enum('new','in_review','assigned','in_progress','completed','cancelled') NOT NULL DEFAULT 'new',
	`requestedByUserId` int NOT NULL,
	`assignedToUserId` int,
	`dueDate` date,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `executiveRequests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `executiveDecisions` ADD CONSTRAINT `executiveDecisions_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `executiveDecisions` ADD CONSTRAINT `executiveDecisions_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `executiveDecisions` ADD CONSTRAINT `executiveDecisions_responsibleUserId_users_id_fk` FOREIGN KEY (`responsibleUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `executiveDecisions` ADD CONSTRAINT `executiveDecisions_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `executiveDelegations` ADD CONSTRAINT `executiveDelegations_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `executiveDelegations` ADD CONSTRAINT `executiveDelegations_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `executiveDelegations` ADD CONSTRAINT `executiveDelegations_assistantUserId_users_id_fk` FOREIGN KEY (`assistantUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `executiveDelegations` ADD CONSTRAINT `executiveDelegations_grantedByUserId_users_id_fk` FOREIGN KEY (`grantedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `executiveDocuments` ADD CONSTRAINT `executiveDocuments_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `executiveDocuments` ADD CONSTRAINT `executiveDocuments_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `executiveDocuments` ADD CONSTRAINT `executiveDocuments_documentId_documents_id_fk` FOREIGN KEY (`documentId`) REFERENCES `documents`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `executiveDocuments` ADD CONSTRAINT `executiveDocuments_sharedWithUserId_users_id_fk` FOREIGN KEY (`sharedWithUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `executiveDocuments` ADD CONSTRAINT `executiveDocuments_sharedByUserId_users_id_fk` FOREIGN KEY (`sharedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `executiveInboxItems` ADD CONSTRAINT `executiveInboxItems_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `executiveInboxItems` ADD CONSTRAINT `executiveInboxItems_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `executiveInboxItems` ADD CONSTRAINT `executiveInboxItems_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `executiveMeetings` ADD CONSTRAINT `executiveMeetings_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `executiveMeetings` ADD CONSTRAINT `executiveMeetings_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `executiveMeetings` ADD CONSTRAINT `executiveMeetings_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `executiveRequests` ADD CONSTRAINT `executiveRequests_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `executiveRequests` ADD CONSTRAINT `executiveRequests_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `executiveRequests` ADD CONSTRAINT `executiveRequests_requestedByUserId_users_id_fk` FOREIGN KEY (`requestedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `executiveRequests` ADD CONSTRAINT `executiveRequests_assignedToUserId_users_id_fk` FOREIGN KEY (`assignedToUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `executive_decision_scope_idx` ON `executiveDecisions` (`tenantId`,`companyId`,`status`,`dueDate`,`responsibleDepartment`);--> statement-breakpoint
CREATE INDEX `executive_delegation_scope_idx` ON `executiveDelegations` (`tenantId`,`companyId`,`assistantUserId`,`permission`,`startsAt`,`endsAt`);--> statement-breakpoint
CREATE INDEX `executive_document_scope_idx` ON `executiveDocuments` (`tenantId`,`companyId`,`accessScope`,`sharedWithUserId`);--> statement-breakpoint
CREATE INDEX `executive_inbox_scope_idx` ON `executiveInboxItems` (`tenantId`,`companyId`,`status`,`priority`,`dueAt`);--> statement-breakpoint
CREATE INDEX `executive_meeting_scope_idx` ON `executiveMeetings` (`tenantId`,`companyId`,`startAt`);--> statement-breakpoint
CREATE INDEX `executive_request_scope_idx` ON `executiveRequests` (`tenantId`,`companyId`,`status`,`priority`,`dueDate`);