CREATE TABLE `vatReturnPreparations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`taxPeriodId` int NOT NULL,
	`status` enum('draft','under_review','reviewed') NOT NULL DEFAULT 'draft',
	`taxableSales` decimal(18,6) NOT NULL DEFAULT '0',
	`outputVat` decimal(18,6) NOT NULL DEFAULT '0',
	`inputVat` decimal(18,6) NOT NULL DEFAULT '0',
	`netVatDue` decimal(18,6) NOT NULL DEFAULT '0',
	`reviewNotes` text,
	`preparedByUserId` int NOT NULL,
	`reviewedByUserId` int,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vatReturnPreparations_id` PRIMARY KEY(`id`),
	CONSTRAINT `vat_return_period_unique` UNIQUE(`tenantId`,`companyId`,`taxPeriodId`)
);
--> statement-breakpoint
ALTER TABLE `vatReturnPreparations` ADD CONSTRAINT `vatReturnPreparations_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `vatReturnPreparations` ADD CONSTRAINT `vatReturnPreparations_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `vatReturnPreparations` ADD CONSTRAINT `vatReturnPreparations_taxPeriodId_taxPeriods_id_fk` FOREIGN KEY (`taxPeriodId`) REFERENCES `taxPeriods`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `vatReturnPreparations` ADD CONSTRAINT `vatReturnPreparations_preparedByUserId_users_id_fk` FOREIGN KEY (`preparedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `vatReturnPreparations` ADD CONSTRAINT `vatReturnPreparations_reviewedByUserId_users_id_fk` FOREIGN KEY (`reviewedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `vat_return_status_idx` ON `vatReturnPreparations` (`tenantId`,`companyId`,`status`);