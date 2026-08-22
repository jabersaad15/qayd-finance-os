CREATE TABLE `salesOpportunityStageHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`opportunityId` int NOT NULL,
	`ownerUserId` int NOT NULL,
	`fromStage` enum('new_lead','qualified','discovery','proposal','negotiation','won','lost','on_hold'),
	`toStage` enum('new_lead','qualified','discovery','proposal','negotiation','won','lost','on_hold') NOT NULL,
	`changedByUserId` int NOT NULL,
	`changedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `salesOpportunityStageHistory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `salesOpportunityStageHistory` ADD CONSTRAINT `salesOpportunityStageHistory_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `salesOpportunityStageHistory` ADD CONSTRAINT `salesOpportunityStageHistory_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `sales_opportunity_history_idx` ON `salesOpportunityStageHistory` (`tenantId`,`companyId`,`changedAt`,`toStage`);--> statement-breakpoint
CREATE INDEX `sales_opportunity_history_owner_idx` ON `salesOpportunityStageHistory` (`tenantId`,`companyId`,`ownerUserId`,`changedAt`);