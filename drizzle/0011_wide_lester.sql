CREATE TABLE `documentRetentionPolicies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`classification` enum('zatca','vat','zakat','bank','audit','supplier','customer','contract','financial_statement','miscellaneous') NOT NULL,
	`retentionYears` int NOT NULL,
	`preventDeletion` boolean NOT NULL DEFAULT true,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `documentRetentionPolicies_id` PRIMARY KEY(`id`),
	CONSTRAINT `document_retention_policy_unique` UNIQUE(`tenantId`,`companyId`,`classification`)
);
--> statement-breakpoint
ALTER TABLE `documents` ADD `retentionPolicyId` int;--> statement-breakpoint
ALTER TABLE `documents` ADD `retentionStatus` enum('active','archived','hold','expired') DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `documents` ADD `retentionUntil` date;--> statement-breakpoint
ALTER TABLE `documents` ADD `archivedAt` timestamp;--> statement-breakpoint
ALTER TABLE `documents` ADD `isLegalHold` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `documentRetentionPolicies` ADD CONSTRAINT `documentRetentionPolicies_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `documentRetentionPolicies` ADD CONSTRAINT `documentRetentionPolicies_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `documentRetentionPolicies` ADD CONSTRAINT `documentRetentionPolicies_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;