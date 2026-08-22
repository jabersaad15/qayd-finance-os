CREATE TABLE `zatcaCredentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`egsId` int NOT NULL,
	`environment` enum('simulation','production') NOT NULL,
	`credentialType` enum('compliance_csid','production_csid') NOT NULL,
	`requestId` varchar(128),
	`encryptedBinarySecurityToken` text,
	`encryptedSecret` text,
	`issuedAt` timestamp,
	`expiresAt` timestamp,
	`status` enum('active','expired','revoked') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `zatcaCredentials_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `zatcaEgsUnits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`branchId` int,
	`environment` enum('simulation','production') NOT NULL DEFAULT 'simulation',
	`deviceName` varchar(255) NOT NULL,
	`serialNumber` varchar(128) NOT NULL,
	`invoiceType` enum('standard','simplified','both') NOT NULL DEFAULT 'both',
	`status` enum('draft','onboarding','active','suspended','retired') NOT NULL DEFAULT 'draft',
	`csrStatus` enum('not_started','pending','issued','failed','expired') NOT NULL DEFAULT 'not_started',
	`complianceCsidStatus` enum('not_started','pending','issued','failed','expired') NOT NULL DEFAULT 'not_started',
	`complianceCheckStatus` enum('not_started','pending','issued','failed','expired') NOT NULL DEFAULT 'not_started',
	`productionCsidStatus` enum('not_started','pending','issued','failed','expired') NOT NULL DEFAULT 'not_started',
	`connectionStatus` enum('not_configured','connected','degraded','failed') NOT NULL DEFAULT 'not_configured',
	`csrPemEncrypted` text,
	`privateKeyEncrypted` text,
	`certificateExpiresAt` timestamp,
	`lastSuccessfulConnection` timestamp,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `zatcaEgsUnits_id` PRIMARY KEY(`id`),
	CONSTRAINT `zatca_egs_company_env_serial_unique` UNIQUE(`tenantId`,`companyId`,`environment`,`serialNumber`)
);
--> statement-breakpoint
ALTER TABLE `zatcaCredentials` ADD CONSTRAINT `zatcaCredentials_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `zatcaCredentials` ADD CONSTRAINT `zatcaCredentials_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `zatcaCredentials` ADD CONSTRAINT `zatcaCredentials_egsId_zatcaEgsUnits_id_fk` FOREIGN KEY (`egsId`) REFERENCES `zatcaEgsUnits`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `zatcaEgsUnits` ADD CONSTRAINT `zatcaEgsUnits_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `zatcaEgsUnits` ADD CONSTRAINT `zatcaEgsUnits_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `zatcaEgsUnits` ADD CONSTRAINT `zatcaEgsUnits_branchId_branches_id_fk` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `zatcaEgsUnits` ADD CONSTRAINT `zatcaEgsUnits_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `zatca_credentials_scope_idx` ON `zatcaCredentials` (`tenantId`,`companyId`,`egsId`,`environment`,`status`);--> statement-breakpoint
CREATE INDEX `zatca_egs_scope_idx` ON `zatcaEgsUnits` (`tenantId`,`companyId`,`environment`,`status`);