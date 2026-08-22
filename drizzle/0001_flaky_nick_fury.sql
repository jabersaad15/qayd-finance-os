CREATE TABLE `accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`parentId` int,
	`code` varchar(32) NOT NULL,
	`nameAr` varchar(255) NOT NULL,
	`nameEn` varchar(255),
	`accountType` enum('asset','liability','equity','revenue','cost_of_revenue','expense','other_income','other_expense') NOT NULL,
	`normalBalance` enum('debit','credit') NOT NULL,
	`isPosting` boolean NOT NULL DEFAULT true,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `account_code_unique` UNIQUE(`tenantId`,`companyId`,`code`)
);
--> statement-breakpoint
CREATE TABLE `appRoles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int,
	`code` varchar(64) NOT NULL,
	`nameAr` varchar(128) NOT NULL,
	`isSystem` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `appRoles_id` PRIMARY KEY(`id`),
	CONSTRAINT `role_tenant_code_unique` UNIQUE(`tenantId`,`code`)
);
--> statement-breakpoint
CREATE TABLE `approvalPolicies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`documentType` varchar(64) NOT NULL,
	`minAmount` decimal(18,6) NOT NULL DEFAULT '0.000000',
	`requiredPermission` varchar(120) NOT NULL,
	`preventSelfApproval` boolean NOT NULL DEFAULT true,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `approvalPolicies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `auditLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int,
	`actorUserId` int,
	`action` varchar(128) NOT NULL,
	`entityType` varchar(64) NOT NULL,
	`entityId` int NOT NULL,
	`previousValue` json,
	`newValue` json,
	`reason` varchar(500),
	`ipAddress` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bankAccounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`accountId` int NOT NULL,
	`bankName` varchar(255) NOT NULL,
	`iban` varchar(64),
	`currencyCode` varchar(3) NOT NULL DEFAULT 'SAR',
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bankAccounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `branches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`code` varchar(32) NOT NULL,
	`nameAr` varchar(255) NOT NULL,
	`nameEn` varchar(255),
	`vatNumber` varchar(32),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `branches_id` PRIMARY KEY(`id`),
	CONSTRAINT `branch_code_unique` UNIQUE(`tenantId`,`companyId`,`code`)
);
--> statement-breakpoint
CREATE TABLE `companies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`legalNameAr` varchar(255) NOT NULL,
	`legalNameEn` varchar(255),
	`commercialRegistration` varchar(64),
	`unifiedNumber` varchar(64),
	`vatNumber` varchar(32),
	`email` varchar(320),
	`phone` varchar(32),
	`countryCode` varchar(2) NOT NULL DEFAULT 'SA',
	`city` varchar(128),
	`nationalAddress` text,
	`baseCurrency` varchar(3) NOT NULL DEFAULT 'SAR',
	`fiscalYearStartMonth` int NOT NULL DEFAULT 1,
	`status` enum('draft','active','suspended') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `companies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `complianceChecks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`invoiceId` int,
	`rulesetId` int NOT NULL,
	`score` int NOT NULL,
	`hasCriticalErrors` boolean NOT NULL DEFAULT false,
	`resultJson` json NOT NULL,
	`checkedAt` timestamp NOT NULL DEFAULT (now()),
	`createdByUserId` int,
	CONSTRAINT `complianceChecks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `complianceRulesets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int,
	`code` varchar(64) NOT NULL,
	`version` varchar(64) NOT NULL,
	`effectiveFrom` date NOT NULL,
	`effectiveTo` date,
	`status` enum('draft','active','retired') NOT NULL DEFAULT 'draft',
	`sourceUrl` varchar(1024) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `complianceRulesets_id` PRIMARY KEY(`id`),
	CONSTRAINT `ruleset_version_unique` UNIQUE(`tenantId`,`code`,`version`)
);
--> statement-breakpoint
CREATE TABLE `costCenters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`parentId` int,
	`code` varchar(32) NOT NULL,
	`nameAr` varchar(255) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `costCenters_id` PRIMARY KEY(`id`),
	CONSTRAINT `cost_center_code_unique` UNIQUE(`tenantId`,`companyId`,`code`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`customerType` enum('individual','company','government') NOT NULL DEFAULT 'company',
	`businessModel` enum('b2b','b2c','b2g') NOT NULL DEFAULT 'b2b',
	`commercialRegistration` varchar(64),
	`vatNumber` varchar(32),
	`email` varchar(320),
	`phone` varchar(32),
	`creditLimit` decimal(18,6) NOT NULL DEFAULT '0.000000',
	`paymentTermsDays` int NOT NULL DEFAULT 30,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `documentLinks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`documentId` int NOT NULL,
	`entityType` varchar(64) NOT NULL,
	`entityId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `documentLinks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`classification` enum('zatca','vat','zakat','bank','audit','supplier','customer','contract','financial_statement','miscellaneous') NOT NULL,
	`fileKey` varchar(512) NOT NULL,
	`filename` varchar(512) NOT NULL,
	`mimeType` varchar(128) NOT NULL,
	`sizeBytes` int NOT NULL,
	`uploadedByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fiscalPeriods` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`name` varchar(64) NOT NULL,
	`startDate` date NOT NULL,
	`endDate` date NOT NULL,
	`status` enum('open','soft_locked','hard_locked') NOT NULL DEFAULT 'open',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fiscalPeriods_id` PRIMARY KEY(`id`),
	CONSTRAINT `period_tenant_company_name_unique` UNIQUE(`tenantId`,`companyId`,`name`)
);
--> statement-breakpoint
CREATE TABLE `invoiceLines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`invoiceId` int NOT NULL,
	`productServiceId` int,
	`revenueAccountId` int,
	`costCenterId` int,
	`projectId` int,
	`description` varchar(500) NOT NULL,
	`quantity` decimal(18,6) NOT NULL DEFAULT '1.000000',
	`unitPrice` decimal(18,6) NOT NULL,
	`discountAmount` decimal(18,6) NOT NULL DEFAULT '0.000000',
	`taxableAmount` decimal(18,6) NOT NULL,
	`taxRate` decimal(7,4) NOT NULL DEFAULT '0.0000',
	`taxAmount` decimal(18,6) NOT NULL DEFAULT '0.000000',
	`lineTotal` decimal(18,6) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `invoiceLines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`branchId` int,
	`customerId` int NOT NULL,
	`quotationId` int,
	`invoiceNumber` varchar(64) NOT NULL,
	`invoiceType` enum('standard','simplified','credit_note','debit_note') NOT NULL,
	`status` enum('draft','pending_approval','approved','zatca_processing','cleared','reported','sent','partially_paid','paid','overdue','credit_note_issued','rejected') NOT NULL DEFAULT 'draft',
	`issueDate` date NOT NULL,
	`dueDate` date,
	`currencyCode` varchar(3) NOT NULL DEFAULT 'SAR',
	`subtotal` decimal(18,6) NOT NULL DEFAULT '0.000000',
	`discountTotal` decimal(18,6) NOT NULL DEFAULT '0.000000',
	`taxTotal` decimal(18,6) NOT NULL DEFAULT '0.000000',
	`grandTotal` decimal(18,6) NOT NULL DEFAULT '0.000000',
	`paidTotal` decimal(18,6) NOT NULL DEFAULT '0.000000',
	`uuid` varchar(64),
	`originalInvoiceId` int,
	`complianceCheckId` int,
	`createdByUserId` int NOT NULL,
	`issuedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `invoices_id` PRIMARY KEY(`id`),
	CONSTRAINT `invoice_number_unique` UNIQUE(`tenantId`,`companyId`,`invoiceNumber`)
);
--> statement-breakpoint
CREATE TABLE `journalEntries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`branchId` int,
	`fiscalPeriodId` int NOT NULL,
	`entryNumber` varchar(64) NOT NULL,
	`entryDate` date NOT NULL,
	`status` enum('draft','submitted','approved','posted','reversed') NOT NULL DEFAULT 'draft',
	`sourceType` varchar(64) NOT NULL,
	`sourceId` int,
	`originalEntryId` int,
	`description` text,
	`debitTotal` decimal(18,6) NOT NULL DEFAULT '0.000000',
	`creditTotal` decimal(18,6) NOT NULL DEFAULT '0.000000',
	`createdByUserId` int NOT NULL,
	`postedByUserId` int,
	`postedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `journalEntries_id` PRIMARY KEY(`id`),
	CONSTRAINT `journal_entry_number_unique` UNIQUE(`tenantId`,`companyId`,`entryNumber`)
);
--> statement-breakpoint
CREATE TABLE `journalLines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`journalEntryId` int NOT NULL,
	`accountId` int NOT NULL,
	`customerId` int,
	`supplierId` int,
	`costCenterId` int,
	`projectId` int,
	`debit` decimal(18,6) NOT NULL DEFAULT '0.000000',
	`credit` decimal(18,6) NOT NULL DEFAULT '0.000000',
	`description` varchar(500),
	`lineOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `journalLines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `outboxEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`eventType` varchar(128) NOT NULL,
	`aggregateType` varchar(64) NOT NULL,
	`aggregateId` int NOT NULL,
	`payload` json NOT NULL,
	`status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`idempotencyKey` varchar(128) NOT NULL,
	`attempts` int NOT NULL DEFAULT 0,
	`processedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `outboxEvents_id` PRIMARY KEY(`id`),
	CONSTRAINT `outbox_idempotency_unique` UNIQUE(`tenantId`,`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`invoiceId` int,
	`customerId` int,
	`bankAccountId` int,
	`paymentNumber` varchar(64) NOT NULL,
	`direction` enum('receipt','payment') NOT NULL,
	`method` enum('cash','bank_transfer','card','cheque','other') NOT NULL,
	`amount` decimal(18,6) NOT NULL,
	`paymentDate` date NOT NULL,
	`reference` varchar(128),
	`status` enum('draft','posted','reversed') NOT NULL DEFAULT 'draft',
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `payment_number_unique` UNIQUE(`tenantId`,`companyId`,`paymentNumber`)
);
--> statement-breakpoint
CREATE TABLE `permissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(120) NOT NULL,
	`module` varchar(64) NOT NULL,
	`descriptionAr` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `permissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `permissions_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `productsServices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`kind` enum('product','service') NOT NULL DEFAULT 'service',
	`sku` varchar(64),
	`nameAr` varchar(255) NOT NULL,
	`nameEn` varchar(255),
	`description` text,
	`unit` varchar(32) NOT NULL DEFAULT 'وحدة',
	`unitPrice` decimal(18,6) NOT NULL DEFAULT '0.000000',
	`revenueAccountId` int,
	`defaultCostCenterId` int,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `productsServices_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_sku_unique` UNIQUE(`tenantId`,`companyId`,`sku`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`code` varchar(48) NOT NULL,
	`nameAr` varchar(255) NOT NULL,
	`status` enum('active','on_hold','closed') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`),
	CONSTRAINT `project_code_unique` UNIQUE(`tenantId`,`companyId`,`code`)
);
--> statement-breakpoint
CREATE TABLE `quotationLines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`quotationId` int NOT NULL,
	`productServiceId` int,
	`description` varchar(500) NOT NULL,
	`quantity` decimal(18,6) NOT NULL DEFAULT '1.000000',
	`unitPrice` decimal(18,6) NOT NULL,
	`discountAmount` decimal(18,6) NOT NULL DEFAULT '0.000000',
	`taxRate` decimal(7,4) NOT NULL DEFAULT '0.0000',
	`lineTotal` decimal(18,6) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quotationLines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quotations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`branchId` int,
	`customerId` int NOT NULL,
	`quoteNumber` varchar(64) NOT NULL,
	`status` enum('draft','sent','accepted','rejected','expired','converted') NOT NULL DEFAULT 'draft',
	`issueDate` date NOT NULL,
	`expiryDate` date,
	`subtotal` decimal(18,6) NOT NULL DEFAULT '0.000000',
	`taxTotal` decimal(18,6) NOT NULL DEFAULT '0.000000',
	`grandTotal` decimal(18,6) NOT NULL DEFAULT '0.000000',
	`version` int NOT NULL DEFAULT 1,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `quotations_id` PRIMARY KEY(`id`),
	CONSTRAINT `quote_number_unique` UNIQUE(`tenantId`,`companyId`,`quoteNumber`)
);
--> statement-breakpoint
CREATE TABLE `rolePermissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`roleId` int NOT NULL,
	`permissionId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rolePermissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `role_permission_unique` UNIQUE(`tenantId`,`roleId`,`permissionId`)
);
--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`vatNumber` varchar(32),
	`commercialRegistration` varchar(64),
	`email` varchar(320),
	`phone` varchar(32),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `suppliers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tenantUsers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`userId` int NOT NULL,
	`companyId` int,
	`roleId` int,
	`status` enum('invited','active','disabled') NOT NULL DEFAULT 'invited',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tenantUsers_id` PRIMARY KEY(`id`),
	CONSTRAINT `tenant_user_unique` UNIQUE(`tenantId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(80) NOT NULL,
	`legalName` varchar(255) NOT NULL,
	`status` enum('active','suspended','trial','archived') NOT NULL DEFAULT 'trial',
	`planCode` varchar(64) NOT NULL DEFAULT 'internal',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tenants_id` PRIMARY KEY(`id`),
	CONSTRAINT `tenants_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `zatcaSubmissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`invoiceId` int NOT NULL,
	`rulesetId` int,
	`operation` enum('onboarding','clearance','reporting') NOT NULL,
	`status` enum('queued','processing','succeeded','failed','retrying') NOT NULL DEFAULT 'queued',
	`idempotencyKey` varchar(128) NOT NULL,
	`correlationId` varchar(128),
	`responseCode` varchar(64),
	`responseSummary` text,
	`attemptCount` int NOT NULL DEFAULT 0,
	`lastAttemptAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `zatcaSubmissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `zatca_idempotency_unique` UNIQUE(`tenantId`,`idempotencyKey`)
);
--> statement-breakpoint
ALTER TABLE `accounts` ADD CONSTRAINT `accounts_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `accounts` ADD CONSTRAINT `accounts_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `appRoles` ADD CONSTRAINT `appRoles_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approvalPolicies` ADD CONSTRAINT `approvalPolicies_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approvalPolicies` ADD CONSTRAINT `approvalPolicies_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auditLogs` ADD CONSTRAINT `auditLogs_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auditLogs` ADD CONSTRAINT `auditLogs_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auditLogs` ADD CONSTRAINT `auditLogs_actorUserId_users_id_fk` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bankAccounts` ADD CONSTRAINT `bankAccounts_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bankAccounts` ADD CONSTRAINT `bankAccounts_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bankAccounts` ADD CONSTRAINT `bankAccounts_accountId_accounts_id_fk` FOREIGN KEY (`accountId`) REFERENCES `accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `branches` ADD CONSTRAINT `branches_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `branches` ADD CONSTRAINT `branches_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `companies` ADD CONSTRAINT `companies_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `complianceChecks` ADD CONSTRAINT `complianceChecks_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `complianceChecks` ADD CONSTRAINT `complianceChecks_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `complianceChecks` ADD CONSTRAINT `complianceChecks_invoiceId_invoices_id_fk` FOREIGN KEY (`invoiceId`) REFERENCES `invoices`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `complianceChecks` ADD CONSTRAINT `complianceChecks_rulesetId_complianceRulesets_id_fk` FOREIGN KEY (`rulesetId`) REFERENCES `complianceRulesets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `complianceChecks` ADD CONSTRAINT `complianceChecks_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `complianceRulesets` ADD CONSTRAINT `complianceRulesets_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `costCenters` ADD CONSTRAINT `costCenters_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `costCenters` ADD CONSTRAINT `costCenters_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customers` ADD CONSTRAINT `customers_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customers` ADD CONSTRAINT `customers_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `documentLinks` ADD CONSTRAINT `documentLinks_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `documentLinks` ADD CONSTRAINT `documentLinks_documentId_documents_id_fk` FOREIGN KEY (`documentId`) REFERENCES `documents`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `documents` ADD CONSTRAINT `documents_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `documents` ADD CONSTRAINT `documents_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `documents` ADD CONSTRAINT `documents_uploadedByUserId_users_id_fk` FOREIGN KEY (`uploadedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fiscalPeriods` ADD CONSTRAINT `fiscalPeriods_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fiscalPeriods` ADD CONSTRAINT `fiscalPeriods_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoiceLines` ADD CONSTRAINT `invoiceLines_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoiceLines` ADD CONSTRAINT `invoiceLines_invoiceId_invoices_id_fk` FOREIGN KEY (`invoiceId`) REFERENCES `invoices`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoiceLines` ADD CONSTRAINT `invoiceLines_productServiceId_productsServices_id_fk` FOREIGN KEY (`productServiceId`) REFERENCES `productsServices`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoiceLines` ADD CONSTRAINT `invoiceLines_revenueAccountId_accounts_id_fk` FOREIGN KEY (`revenueAccountId`) REFERENCES `accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoiceLines` ADD CONSTRAINT `invoiceLines_costCenterId_costCenters_id_fk` FOREIGN KEY (`costCenterId`) REFERENCES `costCenters`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoiceLines` ADD CONSTRAINT `invoiceLines_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_branchId_branches_id_fk` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_customerId_customers_id_fk` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_quotationId_quotations_id_fk` FOREIGN KEY (`quotationId`) REFERENCES `quotations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `journalEntries` ADD CONSTRAINT `journalEntries_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `journalEntries` ADD CONSTRAINT `journalEntries_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `journalEntries` ADD CONSTRAINT `journalEntries_branchId_branches_id_fk` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `journalEntries` ADD CONSTRAINT `journalEntries_fiscalPeriodId_fiscalPeriods_id_fk` FOREIGN KEY (`fiscalPeriodId`) REFERENCES `fiscalPeriods`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `journalEntries` ADD CONSTRAINT `journalEntries_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `journalEntries` ADD CONSTRAINT `journalEntries_postedByUserId_users_id_fk` FOREIGN KEY (`postedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `journalLines` ADD CONSTRAINT `journalLines_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `journalLines` ADD CONSTRAINT `journalLines_journalEntryId_journalEntries_id_fk` FOREIGN KEY (`journalEntryId`) REFERENCES `journalEntries`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `journalLines` ADD CONSTRAINT `journalLines_accountId_accounts_id_fk` FOREIGN KEY (`accountId`) REFERENCES `accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `journalLines` ADD CONSTRAINT `journalLines_customerId_customers_id_fk` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `journalLines` ADD CONSTRAINT `journalLines_supplierId_suppliers_id_fk` FOREIGN KEY (`supplierId`) REFERENCES `suppliers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `journalLines` ADD CONSTRAINT `journalLines_costCenterId_costCenters_id_fk` FOREIGN KEY (`costCenterId`) REFERENCES `costCenters`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `journalLines` ADD CONSTRAINT `journalLines_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `outboxEvents` ADD CONSTRAINT `outboxEvents_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_invoiceId_invoices_id_fk` FOREIGN KEY (`invoiceId`) REFERENCES `invoices`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_customerId_customers_id_fk` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_bankAccountId_bankAccounts_id_fk` FOREIGN KEY (`bankAccountId`) REFERENCES `bankAccounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `productsServices` ADD CONSTRAINT `productsServices_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `productsServices` ADD CONSTRAINT `productsServices_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `productsServices` ADD CONSTRAINT `productsServices_revenueAccountId_accounts_id_fk` FOREIGN KEY (`revenueAccountId`) REFERENCES `accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `productsServices` ADD CONSTRAINT `productsServices_defaultCostCenterId_costCenters_id_fk` FOREIGN KEY (`defaultCostCenterId`) REFERENCES `costCenters`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projects` ADD CONSTRAINT `projects_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projects` ADD CONSTRAINT `projects_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quotationLines` ADD CONSTRAINT `quotationLines_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quotationLines` ADD CONSTRAINT `quotationLines_quotationId_quotations_id_fk` FOREIGN KEY (`quotationId`) REFERENCES `quotations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quotationLines` ADD CONSTRAINT `quotationLines_productServiceId_productsServices_id_fk` FOREIGN KEY (`productServiceId`) REFERENCES `productsServices`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quotations` ADD CONSTRAINT `quotations_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quotations` ADD CONSTRAINT `quotations_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quotations` ADD CONSTRAINT `quotations_branchId_branches_id_fk` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quotations` ADD CONSTRAINT `quotations_customerId_customers_id_fk` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quotations` ADD CONSTRAINT `quotations_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rolePermissions` ADD CONSTRAINT `rolePermissions_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rolePermissions` ADD CONSTRAINT `rolePermissions_roleId_appRoles_id_fk` FOREIGN KEY (`roleId`) REFERENCES `appRoles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rolePermissions` ADD CONSTRAINT `rolePermissions_permissionId_permissions_id_fk` FOREIGN KEY (`permissionId`) REFERENCES `permissions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `suppliers` ADD CONSTRAINT `suppliers_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `suppliers` ADD CONSTRAINT `suppliers_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tenantUsers` ADD CONSTRAINT `tenantUsers_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tenantUsers` ADD CONSTRAINT `tenantUsers_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tenantUsers` ADD CONSTRAINT `tenantUsers_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tenantUsers` ADD CONSTRAINT `tenantUsers_roleId_appRoles_id_fk` FOREIGN KEY (`roleId`) REFERENCES `appRoles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `zatcaSubmissions` ADD CONSTRAINT `zatcaSubmissions_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `zatcaSubmissions` ADD CONSTRAINT `zatcaSubmissions_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `zatcaSubmissions` ADD CONSTRAINT `zatcaSubmissions_invoiceId_invoices_id_fk` FOREIGN KEY (`invoiceId`) REFERENCES `invoices`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `zatcaSubmissions` ADD CONSTRAINT `zatcaSubmissions_rulesetId_complianceRulesets_id_fk` FOREIGN KEY (`rulesetId`) REFERENCES `complianceRulesets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `approval_policy_scope_idx` ON `approvalPolicies` (`tenantId`,`companyId`,`documentType`);--> statement-breakpoint
CREATE INDEX `audit_entity_idx` ON `auditLogs` (`tenantId`,`entityType`,`entityId`);--> statement-breakpoint
CREATE INDEX `audit_actor_idx` ON `auditLogs` (`tenantId`,`actorUserId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `companies_tenant_idx` ON `companies` (`tenantId`);--> statement-breakpoint
CREATE INDEX `compliance_invoice_idx` ON `complianceChecks` (`tenantId`,`invoiceId`);--> statement-breakpoint
CREATE INDEX `customers_lookup_idx` ON `customers` (`tenantId`,`companyId`,`name`);--> statement-breakpoint
CREATE INDEX `document_link_entity_idx` ON `documentLinks` (`tenantId`,`entityType`,`entityId`);--> statement-breakpoint
CREATE INDEX `invoice_list_idx` ON `invoices` (`tenantId`,`companyId`,`status`,`issueDate`);--> statement-breakpoint
CREATE INDEX `journal_period_idx` ON `journalEntries` (`tenantId`,`companyId`,`fiscalPeriodId`,`status`);--> statement-breakpoint
CREATE INDEX `journal_lines_account_idx` ON `journalLines` (`tenantId`,`accountId`);--> statement-breakpoint
CREATE INDEX `outbox_status_idx` ON `outboxEvents` (`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `suppliers_lookup_idx` ON `suppliers` (`tenantId`,`companyId`,`name`);--> statement-breakpoint
CREATE INDEX `tenant_users_user_idx` ON `tenantUsers` (`userId`);--> statement-breakpoint
CREATE INDEX `zatca_submission_idx` ON `zatcaSubmissions` (`tenantId`,`status`);