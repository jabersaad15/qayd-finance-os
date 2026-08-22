CREATE TABLE `companyBranding` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`displayNameAr` varchar(255),
	`displayNameEn` varchar(255),
	`logoUrl` text,
	`faviconUrl` text,
	`primaryColor` varchar(7) NOT NULL DEFAULT '#0B3D3A',
	`accentColor` varchar(7) NOT NULL DEFAULT '#4A82C4',
	`surfaceColor` varchar(7) NOT NULL DEFAULT '#F6F7F4',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `companyBranding_id` PRIMARY KEY(`id`),
	CONSTRAINT `company_branding_scope_uq` UNIQUE(`tenantId`,`companyId`)
);
--> statement-breakpoint
ALTER TABLE `companyBranding` ADD CONSTRAINT `companyBranding_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `companyBranding` ADD CONSTRAINT `companyBranding_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;