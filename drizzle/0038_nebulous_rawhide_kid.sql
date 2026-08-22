CREATE TABLE `executiveApprovalActions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`approvalRequestId` int NOT NULL,
	`action` enum('approve','reject','request_information') NOT NULL,
	`note` text,
	`actorUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `executiveApprovalActions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `executiveApprovalPolicies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`documentType` varchar(64) NOT NULL,
	`roleCode` varchar(64) NOT NULL,
	`minAmount` decimal(18,6) NOT NULL DEFAULT '0.000000',
	`maxAmount` decimal(18,6),
	`requiresCeo` boolean NOT NULL DEFAULT false,
	`active` boolean NOT NULL DEFAULT true,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `executiveApprovalPolicies_id` PRIMARY KEY(`id`),
	CONSTRAINT `executive_approval_policy_unique` UNIQUE(`tenantId`,`companyId`,`documentType`,`roleCode`,`minAmount`)
);
--> statement-breakpoint
CREATE TABLE `executiveOpportunities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`opportunityType` enum('sales_growth','cost_reduction','collections','operations','data_insight') NOT NULL,
	`estimatedValue` decimal(18,6) NOT NULL DEFAULT '0.000000',
	`confidencePercent` int NOT NULL DEFAULT 0,
	`ownerUserId` int,
	`evidence` text,
	`recommendedAction` text,
	`status` enum('open','mitigating','accepted','closed') NOT NULL DEFAULT 'open',
	`sourceEntityType` varchar(64),
	`sourceEntityId` int,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `executiveOpportunities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `executiveRisks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`sourceModule` varchar(64) NOT NULL,
	`severity` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`impact` text,
	`ownerUserId` int,
	`recommendedAction` text,
	`status` enum('open','mitigating','accepted','closed') NOT NULL DEFAULT 'open',
	`dueDate` date,
	`sourceEntityType` varchar(64),
	`sourceEntityId` int,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `executiveRisks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `executiveApprovalActions` ADD CONSTRAINT `executiveApprovalActions_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `executiveApprovalActions` ADD CONSTRAINT `executiveApprovalActions_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `executiveApprovalActions` ADD CONSTRAINT `executiveApprovalActions_approvalRequestId_approvalRequests_id_fk` FOREIGN KEY (`approvalRequestId`) REFERENCES `approvalRequests`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `executiveApprovalActions` ADD CONSTRAINT `executiveApprovalActions_actorUserId_users_id_fk` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `executiveApprovalPolicies` ADD CONSTRAINT `executiveApprovalPolicies_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `executiveApprovalPolicies` ADD CONSTRAINT `executiveApprovalPolicies_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `executiveApprovalPolicies` ADD CONSTRAINT `executiveApprovalPolicies_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `executiveOpportunities` ADD CONSTRAINT `executiveOpportunities_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `executiveOpportunities` ADD CONSTRAINT `executiveOpportunities_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `executiveOpportunities` ADD CONSTRAINT `executiveOpportunities_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `executiveOpportunities` ADD CONSTRAINT `executiveOpportunities_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `executiveRisks` ADD CONSTRAINT `executiveRisks_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `executiveRisks` ADD CONSTRAINT `executiveRisks_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `executiveRisks` ADD CONSTRAINT `executiveRisks_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `executiveRisks` ADD CONSTRAINT `executiveRisks_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `executive_approval_action_scope_idx` ON `executiveApprovalActions` (`tenantId`,`companyId`,`approvalRequestId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `executive_approval_policy_scope_idx` ON `executiveApprovalPolicies` (`tenantId`,`companyId`,`documentType`,`active`);--> statement-breakpoint
CREATE INDEX `executive_opportunity_scope_idx` ON `executiveOpportunities` (`tenantId`,`companyId`,`status`,`opportunityType`);--> statement-breakpoint
CREATE INDEX `executive_risk_scope_idx` ON `executiveRisks` (`tenantId`,`companyId`,`status`,`severity`,`dueDate`);