CREATE TABLE `invoicingPreferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`defaultPaymentTermsDays` int NOT NULL DEFAULT 30,
	`defaultInvoiceType` enum('standard','simplified') NOT NULL DEFAULT 'standard',
	`footerNoteAr` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `invoicingPreferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `invoicing_preferences_company_unique` UNIQUE(`tenantId`,`companyId`)
);
--> statement-breakpoint
CREATE TABLE `taxPeriods` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`taxProfileId` int NOT NULL,
	`name` varchar(64) NOT NULL,
	`startDate` date NOT NULL,
	`endDate` date NOT NULL,
	`status` enum('open','prepared','filed','locked') NOT NULL DEFAULT 'open',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `taxPeriods_id` PRIMARY KEY(`id`),
	CONSTRAINT `tax_period_scope_unique` UNIQUE(`tenantId`,`companyId`,`taxProfileId`,`name`)
);
--> statement-breakpoint
CREATE TABLE `taxProfiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`taxType` enum('vat','zakat') NOT NULL,
	`registrationNumber` varchar(64),
	`defaultRateBps` int NOT NULL DEFAULT 1500,
	`filingFrequency` enum('monthly','quarterly','annual') NOT NULL DEFAULT 'quarterly',
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `taxProfiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `tax_profile_scope_unique` UNIQUE(`tenantId`,`companyId`,`taxType`)
);
--> statement-breakpoint
ALTER TABLE `invoicingPreferences` ADD CONSTRAINT `invoicingPreferences_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoicingPreferences` ADD CONSTRAINT `invoicingPreferences_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `taxPeriods` ADD CONSTRAINT `taxPeriods_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `taxPeriods` ADD CONSTRAINT `taxPeriods_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `taxPeriods` ADD CONSTRAINT `taxPeriods_taxProfileId_taxProfiles_id_fk` FOREIGN KEY (`taxProfileId`) REFERENCES `taxProfiles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `taxProfiles` ADD CONSTRAINT `taxProfiles_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `taxProfiles` ADD CONSTRAINT `taxProfiles_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;