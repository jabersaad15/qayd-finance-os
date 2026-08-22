CREATE TABLE `bankReconciliationMatches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`statementLineId` int NOT NULL,
	`paymentId` int,
	`matchedAmount` decimal(18,6) NOT NULL,
	`matchedByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bankReconciliationMatches_id` PRIMARY KEY(`id`),
	CONSTRAINT `reconciliation_statement_unique` UNIQUE(`tenantId`,`statementLineId`)
);
--> statement-breakpoint
CREATE TABLE `bankStatementLines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`bankAccountId` int NOT NULL,
	`transactionDate` date NOT NULL,
	`reference` varchar(128),
	`description` varchar(500),
	`amount` decimal(18,6) NOT NULL,
	`direction` enum('inflow','outflow') NOT NULL,
	`reconciliationStatus` enum('unmatched','matched','excluded') NOT NULL DEFAULT 'unmatched',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bankStatementLines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `bankReconciliationMatches` ADD CONSTRAINT `bankReconciliationMatches_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bankReconciliationMatches` ADD CONSTRAINT `bankReconciliationMatches_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bankReconciliationMatches` ADD CONSTRAINT `brm_line_fk` FOREIGN KEY (`statementLineId`) REFERENCES `bankStatementLines`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bankReconciliationMatches` ADD CONSTRAINT `bankReconciliationMatches_paymentId_payments_id_fk` FOREIGN KEY (`paymentId`) REFERENCES `payments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bankReconciliationMatches` ADD CONSTRAINT `bankReconciliationMatches_matchedByUserId_users_id_fk` FOREIGN KEY (`matchedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bankStatementLines` ADD CONSTRAINT `bankStatementLines_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bankStatementLines` ADD CONSTRAINT `bankStatementLines_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bankStatementLines` ADD CONSTRAINT `bankStatementLines_bankAccountId_bankAccounts_id_fk` FOREIGN KEY (`bankAccountId`) REFERENCES `bankAccounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `bank_statement_reconciliation_idx` ON `bankStatementLines` (`tenantId`,`bankAccountId`,`reconciliationStatus`);
