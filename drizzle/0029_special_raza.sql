CREATE TABLE `salesWeeklyRepNotes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`salesRepUserId` int NOT NULL,
	`authorUserId` int NOT NULL,
	`weekStart` date NOT NULL,
	`weekEnd` date NOT NULL,
	`note` text NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `salesWeeklyRepNotes_id` PRIMARY KEY(`id`),
	CONSTRAINT `sales_weekly_rep_note_unique` UNIQUE(`tenantId`,`companyId`,`salesRepUserId`,`weekStart`)
);
--> statement-breakpoint
ALTER TABLE `salesWeeklyRepNotes` ADD CONSTRAINT `salesWeeklyRepNotes_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `salesWeeklyRepNotes` ADD CONSTRAINT `salesWeeklyRepNotes_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `salesWeeklyRepNotes` ADD CONSTRAINT `salesWeeklyRepNotes_salesRepUserId_users_id_fk` FOREIGN KEY (`salesRepUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `salesWeeklyRepNotes` ADD CONSTRAINT `salesWeeklyRepNotes_authorUserId_users_id_fk` FOREIGN KEY (`authorUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `sales_weekly_rep_note_scope_idx` ON `salesWeeklyRepNotes` (`tenantId`,`companyId`,`weekStart`);