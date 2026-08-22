CREATE TABLE `documentNumberingRules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`branchId` int,
	`documentType` enum('invoice','quotation','credit_note','debit_note','journal','payment') NOT NULL,
	`prefix` varchar(24) NOT NULL,
	`nextNumber` int NOT NULL DEFAULT 1,
	`padding` int NOT NULL DEFAULT 6,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `documentNumberingRules_id` PRIMARY KEY(`id`),
	CONSTRAINT `numbering_rule_scope_unique` UNIQUE(`tenantId`,`companyId`,`branchId`,`documentType`)
);
--> statement-breakpoint
ALTER TABLE `documentNumberingRules` ADD CONSTRAINT `documentNumberingRules_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `documentNumberingRules` ADD CONSTRAINT `documentNumberingRules_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `documentNumberingRules` ADD CONSTRAINT `documentNumberingRules_branchId_branches_id_fk` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE no action ON UPDATE no action;