CREATE TABLE `salesCommissionEntries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`ruleId` int,
	`salesRepUserId` int NOT NULL,
	`customerId` int NOT NULL,
	`opportunityId` int,
	`contractId` int,
	`invoiceId` int,
	`basis` enum('contract_value','invoice_paid') NOT NULL,
	`basisAmount` decimal(18,6) NOT NULL,
	`rateBps` int NOT NULL,
	`commissionAmount` decimal(18,6) NOT NULL,
	`status` enum('pending','approved','paid','cancelled') NOT NULL DEFAULT 'pending',
	`approvedByUserId` int,
	`approvedAt` timestamp,
	`paidAt` timestamp,
	`notes` text,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `salesCommissionEntries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `salesCommissionRules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`nameAr` varchar(255) NOT NULL,
	`basis` enum('contract_value','invoice_paid') NOT NULL DEFAULT 'contract_value',
	`rateBps` int NOT NULL,
	`effectiveFrom` date NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `salesCommissionRules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `salesCustomerAttributions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`customerId` int NOT NULL,
	`contactId` int,
	`salesRepUserId` int NOT NULL,
	`source` enum('field_visit','referral','inbound','partner','existing_relationship','other') NOT NULL DEFAULT 'field_visit',
	`status` enum('active','released','disputed') NOT NULL DEFAULT 'active',
	`firstContactAt` timestamp NOT NULL,
	`lastContactAt` timestamp,
	`notes` text,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `salesCustomerAttributions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `salesVisits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`customerId` int NOT NULL,
	`contactId` int,
	`opportunityId` int,
	`salesRepUserId` int NOT NULL,
	`visitType` enum('in_person','phone','email','whatsapp','meeting') NOT NULL,
	`status` enum('planned','completed','cancelled') NOT NULL DEFAULT 'completed',
	`visitedAt` timestamp NOT NULL,
	`location` varchar(255),
	`outcome` varchar(500),
	`nextFollowUpDate` date,
	`notes` text,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `salesVisits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `sales_commission_entries_rep_idx` ON `salesCommissionEntries` (`tenantId`,`companyId`,`salesRepUserId`,`status`);--> statement-breakpoint
CREATE INDEX `sales_commission_entries_contract_idx` ON `salesCommissionEntries` (`tenantId`,`companyId`,`contractId`);--> statement-breakpoint
CREATE INDEX `sales_commission_entries_invoice_idx` ON `salesCommissionEntries` (`tenantId`,`companyId`,`invoiceId`);--> statement-breakpoint
CREATE INDEX `sales_commission_rules_lookup_idx` ON `salesCommissionRules` (`tenantId`,`companyId`,`basis`,`isActive`);--> statement-breakpoint
CREATE INDEX `sales_customer_attribution_lookup_idx` ON `salesCustomerAttributions` (`tenantId`,`companyId`,`customerId`,`status`);--> statement-breakpoint
CREATE INDEX `sales_customer_attribution_rep_idx` ON `salesCustomerAttributions` (`tenantId`,`companyId`,`salesRepUserId`,`status`);--> statement-breakpoint
CREATE INDEX `sales_visits_customer_idx` ON `salesVisits` (`tenantId`,`companyId`,`customerId`,`visitedAt`);--> statement-breakpoint
CREATE INDEX `sales_visits_rep_idx` ON `salesVisits` (`tenantId`,`companyId`,`salesRepUserId`,`visitedAt`);