CREATE TABLE `approvalCaseAttachments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseId` int NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`uploadedByUserId` int NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`mimeType` varchar(128) NOT NULL,
	`fileKey` varchar(512) NOT NULL,
	`fileUrl` varchar(1024) NOT NULL,
	`fileSize` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `approvalCaseAttachments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `approvalCaseAttachments` ADD CONSTRAINT `approvalCaseAttachments_caseId_approvalCases_id_fk` FOREIGN KEY (`caseId`) REFERENCES `approvalCases`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approvalCaseAttachments` ADD CONSTRAINT `approvalCaseAttachments_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approvalCaseAttachments` ADD CONSTRAINT `approvalCaseAttachments_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approvalCaseAttachments` ADD CONSTRAINT `approvalCaseAttachments_uploadedByUserId_users_id_fk` FOREIGN KEY (`uploadedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `approval_attachment_scope_idx` ON `approvalCaseAttachments` (`caseId`,`tenantId`,`companyId`);--> statement-breakpoint
CREATE INDEX `approval_attachment_uploader_idx` ON `approvalCaseAttachments` (`uploadedByUserId`,`createdAt`);