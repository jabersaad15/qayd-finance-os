CREATE TABLE `supplierInvoiceLines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`supplierInvoiceId` int NOT NULL,
	`expenseAccountId` int,
	`costCenterId` int,
	`projectId` int,
	`description` varchar(500) NOT NULL,
	`quantity` decimal(18,6) NOT NULL DEFAULT '1.000000',
	`unitPrice` decimal(18,6) NOT NULL DEFAULT '0.000000',
	`taxRate` decimal(8,4) NOT NULL DEFAULT '0.0000',
	`taxAmount` decimal(18,6) NOT NULL DEFAULT '0.000000',
	`lineTotal` decimal(18,6) NOT NULL DEFAULT '0.000000',
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `supplierInvoiceLines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `supplierInvoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`supplierId` int NOT NULL,
	`sourceDocumentId` int,
	`supplierInvoiceNumber` varchar(128) NOT NULL,
	`invoiceDate` date NOT NULL,
	`dueDate` date,
	`subtotal` decimal(18,6) NOT NULL DEFAULT '0.000000',
	`taxTotal` decimal(18,6) NOT NULL DEFAULT '0.000000',
	`grandTotal` decimal(18,6) NOT NULL DEFAULT '0.000000',
	`status` enum('draft','pending_review','approved','posted','voided') NOT NULL DEFAULT 'draft',
	`createdByUserId` int NOT NULL,
	`approvedByUserId` int,
	`approvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `supplierInvoices_id` PRIMARY KEY(`id`),
	CONSTRAINT `supplier_invoice_unique` UNIQUE(`tenantId`,`companyId`,`supplierId`,`supplierInvoiceNumber`)
);
--> statement-breakpoint
ALTER TABLE `supplierInvoiceLines` ADD CONSTRAINT `supplierInvoiceLines_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supplierInvoiceLines` ADD CONSTRAINT `supplierInvoiceLines_supplierInvoiceId_supplierInvoices_id_fk` FOREIGN KEY (`supplierInvoiceId`) REFERENCES `supplierInvoices`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supplierInvoiceLines` ADD CONSTRAINT `supplierInvoiceLines_expenseAccountId_accounts_id_fk` FOREIGN KEY (`expenseAccountId`) REFERENCES `accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supplierInvoiceLines` ADD CONSTRAINT `supplierInvoiceLines_costCenterId_costCenters_id_fk` FOREIGN KEY (`costCenterId`) REFERENCES `costCenters`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supplierInvoiceLines` ADD CONSTRAINT `supplierInvoiceLines_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supplierInvoices` ADD CONSTRAINT `supplierInvoices_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supplierInvoices` ADD CONSTRAINT `supplierInvoices_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supplierInvoices` ADD CONSTRAINT `supplierInvoices_supplierId_suppliers_id_fk` FOREIGN KEY (`supplierId`) REFERENCES `suppliers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supplierInvoices` ADD CONSTRAINT `supplierInvoices_sourceDocumentId_documents_id_fk` FOREIGN KEY (`sourceDocumentId`) REFERENCES `documents`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supplierInvoices` ADD CONSTRAINT `supplierInvoices_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supplierInvoices` ADD CONSTRAINT `supplierInvoices_approvedByUserId_users_id_fk` FOREIGN KEY (`approvedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `supplier_invoice_status_idx` ON `supplierInvoices` (`tenantId`,`companyId`,`status`);