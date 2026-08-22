CREATE TABLE `approvalCaseActions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseId` int NOT NULL,
	`stepId` int,
	`actorUserId` int NOT NULL,
	`action` enum('approve','reject','return','request_information','delegate') NOT NULL,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `approvalCaseActions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `approvalCaseSteps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseId` int NOT NULL,
	`sequence` int NOT NULL,
	`stageKey` varchar(64) NOT NULL,
	`roleCode` varchar(64),
	`assignedUserId` int,
	`status` enum('pending','approved','rejected','returned','information_required','skipped') NOT NULL DEFAULT 'pending',
	`requiredApprovals` int NOT NULL DEFAULT 1,
	`approvedCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `approvalCaseSteps_id` PRIMARY KEY(`id`),
	CONSTRAINT `approval_case_step_unique` UNIQUE(`caseId`,`sequence`)
);
--> statement-breakpoint
CREATE TABLE `approvalCases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`requestType` varchar(96) NOT NULL,
	`module` varchar(64) NOT NULL,
	`entityType` varchar(96) NOT NULL,
	`entityId` int,
	`requestNumber` varchar(64) NOT NULL,
	`requestedByUserId` int NOT NULL,
	`department` varchar(128),
	`branchId` int,
	`amount` decimal(18,6) NOT NULL DEFAULT '0.000000',
	`currency` varchar(3) NOT NULL DEFAULT 'SAR',
	`reason` text NOT NULL,
	`priority` enum('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
	`deadline` date,
	`riskLevel` varchar(32),
	`workflowMode` enum('sequential','parallel') NOT NULL DEFAULT 'sequential',
	`quorum` enum('any_one','all') NOT NULL DEFAULT 'all',
	`currentStep` int NOT NULL DEFAULT 1,
	`status` enum('pending','approved','rejected','returned','information_required','completed','cancelled') NOT NULL DEFAULT 'pending',
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `approvalCases_id` PRIMARY KEY(`id`),
	CONSTRAINT `approval_case_number_unique` UNIQUE(`tenantId`,`companyId`,`requestNumber`)
);
--> statement-breakpoint
CREATE TABLE `approvalDelegations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`delegatorUserId` int NOT NULL,
	`delegateeUserId` int NOT NULL,
	`requestTypes` json NOT NULL,
	`maxAmount` decimal(18,6),
	`startsAt` timestamp NOT NULL,
	`endsAt` timestamp NOT NULL,
	`reason` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `approvalDelegations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `centralApprovalPolicies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`requestType` varchar(96) NOT NULL,
	`module` varchar(64) NOT NULL,
	`minAmount` decimal(18,6) NOT NULL DEFAULT '0.000000',
	`maxAmount` decimal(18,6),
	`department` varchar(128),
	`branchId` int,
	`roleCode` varchar(64),
	`riskLevel` varchar(32),
	`workflowMode` enum('sequential','parallel') NOT NULL DEFAULT 'sequential',
	`quorum` enum('any_one','all') NOT NULL DEFAULT 'all',
	`steps` json NOT NULL,
	`requiresStepUp` boolean NOT NULL DEFAULT false,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `centralApprovalPolicies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `approvalCaseActions` ADD CONSTRAINT `approvalCaseActions_caseId_approvalCases_id_fk` FOREIGN KEY (`caseId`) REFERENCES `approvalCases`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approvalCaseActions` ADD CONSTRAINT `approvalCaseActions_stepId_approvalCaseSteps_id_fk` FOREIGN KEY (`stepId`) REFERENCES `approvalCaseSteps`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approvalCaseActions` ADD CONSTRAINT `approvalCaseActions_actorUserId_users_id_fk` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approvalCaseSteps` ADD CONSTRAINT `approvalCaseSteps_caseId_approvalCases_id_fk` FOREIGN KEY (`caseId`) REFERENCES `approvalCases`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approvalCaseSteps` ADD CONSTRAINT `approvalCaseSteps_assignedUserId_users_id_fk` FOREIGN KEY (`assignedUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approvalCases` ADD CONSTRAINT `approvalCases_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approvalCases` ADD CONSTRAINT `approvalCases_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approvalCases` ADD CONSTRAINT `approvalCases_requestedByUserId_users_id_fk` FOREIGN KEY (`requestedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approvalCases` ADD CONSTRAINT `approvalCases_branchId_branches_id_fk` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approvalDelegations` ADD CONSTRAINT `approvalDelegations_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approvalDelegations` ADD CONSTRAINT `approvalDelegations_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approvalDelegations` ADD CONSTRAINT `approvalDelegations_delegatorUserId_users_id_fk` FOREIGN KEY (`delegatorUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approvalDelegations` ADD CONSTRAINT `approvalDelegations_delegateeUserId_users_id_fk` FOREIGN KEY (`delegateeUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `centralApprovalPolicies` ADD CONSTRAINT `centralApprovalPolicies_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `centralApprovalPolicies` ADD CONSTRAINT `centralApprovalPolicies_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `centralApprovalPolicies` ADD CONSTRAINT `centralApprovalPolicies_branchId_branches_id_fk` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `approval_case_action_scope_idx` ON `approvalCaseActions` (`caseId`,`createdAt`,`actorUserId`);--> statement-breakpoint
CREATE INDEX `approval_case_step_actor_idx` ON `approvalCaseSteps` (`assignedUserId`,`status`);--> statement-breakpoint
CREATE INDEX `approval_case_scope_idx` ON `approvalCases` (`tenantId`,`companyId`,`status`,`requestedByUserId`,`module`);--> statement-breakpoint
CREATE INDEX `approval_delegation_scope_idx` ON `approvalDelegations` (`tenantId`,`companyId`,`delegatorUserId`,`delegateeUserId`,`startsAt`,`endsAt`);--> statement-breakpoint
CREATE INDEX `central_approval_policy_scope_idx` ON `centralApprovalPolicies` (`tenantId`,`companyId`,`requestType`,`module`,`isActive`);