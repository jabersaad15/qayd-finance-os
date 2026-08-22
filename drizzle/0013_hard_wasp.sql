CREATE TABLE `companyMemberInvitations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`displayName` varchar(255),
	`roleId` int NOT NULL,
	`status` enum('pending','accepted','revoked','expired') NOT NULL DEFAULT 'pending',
	`invitedByUserId` int NOT NULL,
	`acceptedByUserId` int,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `companyMemberInvitations_id` PRIMARY KEY(`id`),
	CONSTRAINT `company_member_invitation_unique` UNIQUE(`tenantId`,`companyId`,`email`)
);
--> statement-breakpoint
ALTER TABLE `companyMemberInvitations` ADD CONSTRAINT `companyMemberInvitations_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `companyMemberInvitations` ADD CONSTRAINT `companyMemberInvitations_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `companyMemberInvitations` ADD CONSTRAINT `companyMemberInvitations_roleId_appRoles_id_fk` FOREIGN KEY (`roleId`) REFERENCES `appRoles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `companyMemberInvitations` ADD CONSTRAINT `companyMemberInvitations_invitedByUserId_users_id_fk` FOREIGN KEY (`invitedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `companyMemberInvitations` ADD CONSTRAINT `companyMemberInvitations_acceptedByUserId_users_id_fk` FOREIGN KEY (`acceptedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `company_member_invitation_status_idx` ON `companyMemberInvitations` (`companyId`,`status`);