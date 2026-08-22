CREATE TABLE `kpiDefinitions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`nameAr` varchar(160) NOT NULL,
	`metricCode` enum('activities_completed','opportunities_won','completed_visits','weighted_pipeline','invoices_issued','overdue_collection') NOT NULL,
	`targetValue` decimal(18,6) NOT NULL,
	`period` enum('daily','weekly','monthly','quarterly') NOT NULL DEFAULT 'monthly',
	`roleCode` varchar(64),
	`assignedUserId` int,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `kpiDefinitions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `kpiDefinitions` ADD CONSTRAINT `kpiDefinitions_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `kpiDefinitions` ADD CONSTRAINT `kpiDefinitions_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `kpiDefinitions` ADD CONSTRAINT `kpiDefinitions_assignedUserId_users_id_fk` FOREIGN KEY (`assignedUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `kpiDefinitions` ADD CONSTRAINT `kpiDefinitions_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `kpi_definitions_scope_idx` ON `kpiDefinitions` (`tenantId`,`companyId`,`roleCode`,`assignedUserId`,`isActive`);