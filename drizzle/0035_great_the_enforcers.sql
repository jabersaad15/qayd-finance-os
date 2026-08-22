CREATE TABLE `administrativeDocuments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`documentId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`accessScope` enum('general','department','confidential','executive') NOT NULL DEFAULT 'general',
	`department` varchar(128),
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `administrativeDocuments_id` PRIMARY KEY(`id`),
	CONSTRAINT `admin_documents_document_unique` UNIQUE(`documentId`)
);
--> statement-breakpoint
ALTER TABLE `administrativeDocuments` ADD CONSTRAINT `administrativeDocuments_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `administrativeDocuments` ADD CONSTRAINT `administrativeDocuments_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `administrativeDocuments` ADD CONSTRAINT `administrativeDocuments_documentId_documents_id_fk` FOREIGN KEY (`documentId`) REFERENCES `documents`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `administrativeDocuments` ADD CONSTRAINT `administrativeDocuments_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `admin_documents_scope_idx` ON `administrativeDocuments` (`tenantId`,`companyId`,`accessScope`,`department`,`createdAt`);