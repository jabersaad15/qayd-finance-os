CREATE TABLE `salesActivities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`customerId` int NOT NULL,
	`opportunityId` int,
	`ownerUserId` int NOT NULL,
	`activityType` enum('call','meeting','email','task','note') NOT NULL,
	`status` enum('open','completed','cancelled') NOT NULL DEFAULT 'open',
	`subject` varchar(255) NOT NULL,
	`notes` text,
	`dueDate` date,
	`completedAt` timestamp,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `salesActivities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `salesOpportunities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`customerId` int NOT NULL,
	`contactId` int,
	`ownerUserId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`stage` enum('new_lead','qualified','discovery','proposal','negotiation','won','lost','on_hold') NOT NULL DEFAULT 'new_lead',
	`probability` int NOT NULL DEFAULT 10,
	`expectedValue` decimal(18,6) NOT NULL DEFAULT '0.000000',
	`expectedCloseDate` date,
	`source` varchar(128),
	`serviceInterest` varchar(255),
	`nextAction` varchar(500),
	`nextActionDate` date,
	`lostReason` varchar(500),
	`notes` text,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `salesOpportunities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `salesActivities` ADD CONSTRAINT `salesActivities_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `salesActivities` ADD CONSTRAINT `salesActivities_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `salesActivities` ADD CONSTRAINT `salesActivities_customerId_customers_id_fk` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `salesActivities` ADD CONSTRAINT `salesActivities_opportunityId_salesOpportunities_id_fk` FOREIGN KEY (`opportunityId`) REFERENCES `salesOpportunities`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `salesActivities` ADD CONSTRAINT `salesActivities_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `salesActivities` ADD CONSTRAINT `salesActivities_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `salesOpportunities` ADD CONSTRAINT `salesOpportunities_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `salesOpportunities` ADD CONSTRAINT `salesOpportunities_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `salesOpportunities` ADD CONSTRAINT `salesOpportunities_customerId_customers_id_fk` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `salesOpportunities` ADD CONSTRAINT `salesOpportunities_contactId_customerContacts_id_fk` FOREIGN KEY (`contactId`) REFERENCES `customerContacts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `salesOpportunities` ADD CONSTRAINT `salesOpportunities_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `salesOpportunities` ADD CONSTRAINT `salesOpportunities_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `sales_activities_worklist_idx` ON `salesActivities` (`tenantId`,`companyId`,`status`,`dueDate`,`ownerUserId`);--> statement-breakpoint
CREATE INDEX `sales_activities_customer_idx` ON `salesActivities` (`tenantId`,`companyId`,`customerId`);--> statement-breakpoint
CREATE INDEX `sales_opportunities_pipeline_idx` ON `salesOpportunities` (`tenantId`,`companyId`,`stage`,`ownerUserId`);--> statement-breakpoint
CREATE INDEX `sales_opportunities_customer_idx` ON `salesOpportunities` (`tenantId`,`companyId`,`customerId`);