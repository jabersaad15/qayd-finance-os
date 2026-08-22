CREATE TABLE `administrativeActivityTimeline` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`entityType` varchar(64) NOT NULL,
	`entityId` int NOT NULL,
	`action` varchar(128) NOT NULL,
	`description` text NOT NULL,
	`actorUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `administrativeActivityTimeline_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `administrativeCorrespondence` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`counterparty` varchar(255),
	`contactName` varchar(255),
	`correspondenceType` enum('letter','email','internal','external','circular') NOT NULL DEFAULT 'internal',
	`status` enum('draft','review','approved','sent','closed') NOT NULL DEFAULT 'draft',
	`assignedToUserId` int NOT NULL,
	`followUpDate` date,
	`notes` text,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `administrativeCorrespondence_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `administrativeMeetings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`meetingDate` date NOT NULL,
	`startTime` varchar(8),
	`endTime` varchar(8),
	`location` varchar(512),
	`agenda` text,
	`minutes` text,
	`status` enum('planned','held','cancelled') NOT NULL DEFAULT 'planned',
	`organizerUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `administrativeMeetings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `administrativeReminders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`dueAt` timestamp NOT NULL,
	`priority` enum('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
	`assignedToUserId` int NOT NULL,
	`relatedEntityType` varchar(64),
	`relatedEntityId` int,
	`status` enum('open','completed','cancelled') NOT NULL DEFAULT 'open',
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `administrativeReminders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `administrativeRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`requestType` enum('letter','appointment','meeting','document','visit','contact','file','follow_up') NOT NULL,
	`description` text NOT NULL,
	`priority` enum('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
	`deadline` date,
	`requestedByUserId` int NOT NULL,
	`assignedToUserId` int,
	`status` enum('new','in_progress','waiting','completed','cancelled') NOT NULL DEFAULT 'new',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `administrativeRequests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `administrativeTasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`status` enum('new','in_progress','waiting','completed','cancelled') NOT NULL DEFAULT 'new',
	`priority` enum('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
	`dueDate` date,
	`assignedToUserId` int NOT NULL,
	`createdByUserId` int NOT NULL,
	`relatedEntityType` varchar(64),
	`relatedEntityId` int,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `administrativeTasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `administrativeActivityTimeline` ADD CONSTRAINT `administrativeActivityTimeline_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `administrativeActivityTimeline` ADD CONSTRAINT `administrativeActivityTimeline_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `administrativeActivityTimeline` ADD CONSTRAINT `administrativeActivityTimeline_actorUserId_users_id_fk` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `administrativeCorrespondence` ADD CONSTRAINT `administrativeCorrespondence_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `administrativeCorrespondence` ADD CONSTRAINT `administrativeCorrespondence_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `administrativeCorrespondence` ADD CONSTRAINT `administrativeCorrespondence_assignedToUserId_users_id_fk` FOREIGN KEY (`assignedToUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `administrativeCorrespondence` ADD CONSTRAINT `administrativeCorrespondence_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `administrativeMeetings` ADD CONSTRAINT `administrativeMeetings_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `administrativeMeetings` ADD CONSTRAINT `administrativeMeetings_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `administrativeMeetings` ADD CONSTRAINT `administrativeMeetings_organizerUserId_users_id_fk` FOREIGN KEY (`organizerUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `administrativeReminders` ADD CONSTRAINT `administrativeReminders_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `administrativeReminders` ADD CONSTRAINT `administrativeReminders_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `administrativeReminders` ADD CONSTRAINT `administrativeReminders_assignedToUserId_users_id_fk` FOREIGN KEY (`assignedToUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `administrativeReminders` ADD CONSTRAINT `administrativeReminders_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `administrativeRequests` ADD CONSTRAINT `administrativeRequests_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `administrativeRequests` ADD CONSTRAINT `administrativeRequests_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `administrativeRequests` ADD CONSTRAINT `administrativeRequests_requestedByUserId_users_id_fk` FOREIGN KEY (`requestedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `administrativeRequests` ADD CONSTRAINT `administrativeRequests_assignedToUserId_users_id_fk` FOREIGN KEY (`assignedToUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `administrativeTasks` ADD CONSTRAINT `administrativeTasks_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `administrativeTasks` ADD CONSTRAINT `administrativeTasks_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `administrativeTasks` ADD CONSTRAINT `administrativeTasks_assignedToUserId_users_id_fk` FOREIGN KEY (`assignedToUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `administrativeTasks` ADD CONSTRAINT `administrativeTasks_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `admin_timeline_entity_idx` ON `administrativeActivityTimeline` (`tenantId`,`companyId`,`entityType`,`entityId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `admin_correspondence_scope_idx` ON `administrativeCorrespondence` (`tenantId`,`companyId`,`status`,`followUpDate`,`assignedToUserId`);--> statement-breakpoint
CREATE INDEX `admin_meetings_scope_idx` ON `administrativeMeetings` (`tenantId`,`companyId`,`meetingDate`,`status`);--> statement-breakpoint
CREATE INDEX `admin_reminders_scope_idx` ON `administrativeReminders` (`tenantId`,`companyId`,`assignedToUserId`,`status`,`dueAt`);--> statement-breakpoint
CREATE INDEX `admin_requests_scope_idx` ON `administrativeRequests` (`tenantId`,`companyId`,`status`,`deadline`,`assignedToUserId`);--> statement-breakpoint
CREATE INDEX `admin_tasks_scope_idx` ON `administrativeTasks` (`tenantId`,`companyId`,`assignedToUserId`,`status`,`dueDate`);