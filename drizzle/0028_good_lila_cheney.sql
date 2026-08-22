CREATE TABLE `executiveAssignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`assignedToUserId` int NOT NULL,
	`createdByUserId` int NOT NULL,
	`dueDate` date NOT NULL,
	`priority` enum('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
	`status` enum('planned','in_progress','blocked','completed','cancelled') NOT NULL DEFAULT 'planned',
	`latestUpdate` text,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `executiveAssignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `executiveWeeklyReports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`weekStart` date NOT NULL,
	`weekEnd` date NOT NULL,
	`submittedByUserId` int NOT NULL,
	`status` enum('draft','submitted','reviewed') NOT NULL DEFAULT 'draft',
	`summary` text NOT NULL,
	`achievements` text,
	`blockers` text,
	`decisionsNeeded` text,
	`nextWeekPlan` text,
	`reviewedByUserId` int,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `executiveWeeklyReports_id` PRIMARY KEY(`id`),
	CONSTRAINT `executive_weekly_report_unique` UNIQUE(`tenantId`,`companyId`,`weekStart`,`submittedByUserId`)
);
--> statement-breakpoint
ALTER TABLE `executiveAssignments` ADD CONSTRAINT `executiveAssignments_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `executiveAssignments` ADD CONSTRAINT `executiveAssignments_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `executiveAssignments` ADD CONSTRAINT `executiveAssignments_assignedToUserId_users_id_fk` FOREIGN KEY (`assignedToUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `executiveAssignments` ADD CONSTRAINT `executiveAssignments_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `executiveWeeklyReports` ADD CONSTRAINT `executiveWeeklyReports_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `executiveWeeklyReports` ADD CONSTRAINT `executiveWeeklyReports_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `executiveWeeklyReports` ADD CONSTRAINT `executiveWeeklyReports_submittedByUserId_users_id_fk` FOREIGN KEY (`submittedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `executiveWeeklyReports` ADD CONSTRAINT `executiveWeeklyReports_reviewedByUserId_users_id_fk` FOREIGN KEY (`reviewedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `executive_assignment_scope_idx` ON `executiveAssignments` (`tenantId`,`companyId`,`status`,`dueDate`);--> statement-breakpoint
CREATE INDEX `executive_assignment_owner_idx` ON `executiveAssignments` (`tenantId`,`assignedToUserId`,`status`);--> statement-breakpoint
CREATE INDEX `executive_weekly_report_scope_idx` ON `executiveWeeklyReports` (`tenantId`,`companyId`,`status`,`weekStart`);