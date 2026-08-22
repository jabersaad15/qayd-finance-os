CREATE TABLE `operationalCorrectiveActions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`issueId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`assignedToUserId` int,
	`dueAt` timestamp,
	`status` enum('open','in_progress','completed','verified') NOT NULL DEFAULT 'open',
	`verifiedByUserId` int,
	`verifiedAt` timestamp,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operationalCorrectiveActions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `operationalIssues` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`status` enum('new','assigned','investigation','action_required','resolved','closed') NOT NULL DEFAULT 'new',
	`severity` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`department` varchar(128),
	`branchId` int,
	`assignedToUserId` int,
	`discoveredAt` timestamp NOT NULL DEFAULT (now()),
	`resolutionDueAt` timestamp,
	`rootCause` text,
	`immediateAction` text,
	`correctiveAction` text,
	`preventiveAction` text,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operationalIssues_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `operationalKpis` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`code` varchar(64) NOT NULL,
	`nameAr` varchar(255) NOT NULL,
	`targetValue` decimal(18,6),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operationalKpis_id` PRIMARY KEY(`id`),
	CONSTRAINT `operational_kpi_scope_code_unique` UNIQUE(`tenantId`,`companyId`,`code`)
);
--> statement-breakpoint
CREATE TABLE `operationalRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`requestType` varchar(64) NOT NULL,
	`description` text NOT NULL,
	`priority` enum('low','normal','high','critical') NOT NULL DEFAULT 'normal',
	`status` enum('request','review','assigned','in_progress','completed','cancelled') NOT NULL DEFAULT 'request',
	`department` varchar(128),
	`branchId` int,
	`requestedByUserId` int NOT NULL,
	`assignedToUserId` int,
	`requiresApproval` boolean NOT NULL DEFAULT false,
	`approvedByUserId` int,
	`dueAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operationalRequests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `operationalSlaPolicies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`priority` enum('low','normal','high','critical') NOT NULL,
	`responseMinutes` int NOT NULL,
	`resolutionMinutes` int NOT NULL,
	`department` varchar(128),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operationalSlaPolicies_id` PRIMARY KEY(`id`),
	CONSTRAINT `operational_sla_scope_unique` UNIQUE(`tenantId`,`companyId`,`priority`,`department`)
);
--> statement-breakpoint
CREATE TABLE `operationalTasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`status` enum('new','assigned','in_progress','waiting','blocked','escalated','completed','cancelled') NOT NULL DEFAULT 'new',
	`priority` enum('low','normal','high','critical') NOT NULL DEFAULT 'normal',
	`department` varchar(128),
	`branchId` int,
	`assignedToUserId` int,
	`createdByUserId` int NOT NULL,
	`dueAt` timestamp,
	`lastUpdatedAt` timestamp NOT NULL DEFAULT (now()),
	`escalationReason` text,
	`instructions` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operationalTasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `operationalCorrectiveActions` ADD CONSTRAINT `operationalCorrectiveActions_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `operationalCorrectiveActions` ADD CONSTRAINT `operationalCorrectiveActions_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `operationalCorrectiveActions` ADD CONSTRAINT `operationalCorrectiveActions_issueId_operationalIssues_id_fk` FOREIGN KEY (`issueId`) REFERENCES `operationalIssues`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `operationalCorrectiveActions` ADD CONSTRAINT `operationalCorrectiveActions_assignedToUserId_users_id_fk` FOREIGN KEY (`assignedToUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `operationalCorrectiveActions` ADD CONSTRAINT `operationalCorrectiveActions_verifiedByUserId_users_id_fk` FOREIGN KEY (`verifiedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `operationalCorrectiveActions` ADD CONSTRAINT `operationalCorrectiveActions_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `operationalIssues` ADD CONSTRAINT `operationalIssues_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `operationalIssues` ADD CONSTRAINT `operationalIssues_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `operationalIssues` ADD CONSTRAINT `operationalIssues_branchId_branches_id_fk` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `operationalIssues` ADD CONSTRAINT `operationalIssues_assignedToUserId_users_id_fk` FOREIGN KEY (`assignedToUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `operationalIssues` ADD CONSTRAINT `operationalIssues_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `operationalKpis` ADD CONSTRAINT `operationalKpis_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `operationalKpis` ADD CONSTRAINT `operationalKpis_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `operationalRequests` ADD CONSTRAINT `operationalRequests_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `operationalRequests` ADD CONSTRAINT `operationalRequests_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `operationalRequests` ADD CONSTRAINT `operationalRequests_branchId_branches_id_fk` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `operationalRequests` ADD CONSTRAINT `operationalRequests_requestedByUserId_users_id_fk` FOREIGN KEY (`requestedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `operationalRequests` ADD CONSTRAINT `operationalRequests_assignedToUserId_users_id_fk` FOREIGN KEY (`assignedToUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `operationalRequests` ADD CONSTRAINT `operationalRequests_approvedByUserId_users_id_fk` FOREIGN KEY (`approvedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `operationalSlaPolicies` ADD CONSTRAINT `operationalSlaPolicies_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `operationalSlaPolicies` ADD CONSTRAINT `operationalSlaPolicies_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `operationalTasks` ADD CONSTRAINT `operationalTasks_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `operationalTasks` ADD CONSTRAINT `operationalTasks_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `operationalTasks` ADD CONSTRAINT `operationalTasks_branchId_branches_id_fk` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `operationalTasks` ADD CONSTRAINT `operationalTasks_assignedToUserId_users_id_fk` FOREIGN KEY (`assignedToUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `operationalTasks` ADD CONSTRAINT `operationalTasks_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `operational_corrective_actions_scope_idx` ON `operationalCorrectiveActions` (`tenantId`,`companyId`,`issueId`,`status`,`dueAt`);--> statement-breakpoint
CREATE INDEX `operational_issues_scope_idx` ON `operationalIssues` (`tenantId`,`companyId`,`status`,`severity`,`department`,`branchId`,`resolutionDueAt`);--> statement-breakpoint
CREATE INDEX `operational_requests_scope_idx` ON `operationalRequests` (`tenantId`,`companyId`,`status`,`priority`,`department`,`branchId`,`dueAt`);--> statement-breakpoint
CREATE INDEX `operational_tasks_scope_idx` ON `operationalTasks` (`tenantId`,`companyId`,`status`,`priority`,`department`,`branchId`,`dueAt`);