CREATE TABLE `customerContracts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`customerId` int NOT NULL,
	`documentId` int,
	`contractNumber` varchar(128) NOT NULL,
	`title` varchar(255) NOT NULL,
	`status` enum('draft','active','expired','terminated') NOT NULL DEFAULT 'draft',
	`startDate` date,
	`endDate` date,
	`contractValue` decimal(18,6) NOT NULL DEFAULT '0.000000',
	`notes` text,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customerContracts_id` PRIMARY KEY(`id`),
	CONSTRAINT `customer_contract_number_unique` UNIQUE(`tenantId`,`companyId`,`contractNumber`)
);
--> statement-breakpoint
CREATE TABLE `customerPaymentReminderEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`customerId` int NOT NULL,
	`invoiceId` int NOT NULL,
	`reminderDate` date NOT NULL,
	`reminderKind` enum('upcoming','overdue') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `customerPaymentReminderEvents_id` PRIMARY KEY(`id`),
	CONSTRAINT `customer_payment_reminder_unique` UNIQUE(`tenantId`,`companyId`,`invoiceId`,`reminderDate`,`reminderKind`)
);
--> statement-breakpoint
ALTER TABLE `financialReminderSchedules` MODIFY COLUMN `reminderType` enum('vat_due','financial_digest','approval_pending','customer_payment_due') NOT NULL;--> statement-breakpoint
ALTER TABLE `customerContracts` ADD CONSTRAINT `customerContracts_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customerContracts` ADD CONSTRAINT `customerContracts_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customerContracts` ADD CONSTRAINT `customerContracts_customerId_customers_id_fk` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customerContracts` ADD CONSTRAINT `customerContracts_documentId_documents_id_fk` FOREIGN KEY (`documentId`) REFERENCES `documents`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customerContracts` ADD CONSTRAINT `customerContracts_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customerPaymentReminderEvents` ADD CONSTRAINT `customerPaymentReminderEvents_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customerPaymentReminderEvents` ADD CONSTRAINT `customerPaymentReminderEvents_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customerPaymentReminderEvents` ADD CONSTRAINT `customerPaymentReminderEvents_customerId_customers_id_fk` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customerPaymentReminderEvents` ADD CONSTRAINT `customerPaymentReminderEvents_invoiceId_invoices_id_fk` FOREIGN KEY (`invoiceId`) REFERENCES `invoices`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `customer_contracts_lookup_idx` ON `customerContracts` (`tenantId`,`companyId`,`customerId`,`status`);--> statement-breakpoint
CREATE INDEX `customer_payment_reminder_lookup_idx` ON `customerPaymentReminderEvents` (`tenantId`,`companyId`,`customerId`,`reminderDate`);