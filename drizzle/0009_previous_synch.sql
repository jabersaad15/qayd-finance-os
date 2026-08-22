ALTER TABLE `auditEngagements` MODIFY COLUMN `status` enum('pending_independence','active','closed','suspended') NOT NULL DEFAULT 'pending_independence';--> statement-breakpoint
ALTER TABLE `auditEngagements` ADD `isIndependenceDeclared` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `auditFinalReports` ADD `fiscalPeriodId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `auditSignOffs` ADD `fiscalPeriodId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `fiscalPeriods` ADD `lockedByUserId` int;--> statement-breakpoint
ALTER TABLE `fiscalPeriods` ADD `lockedAt` timestamp;--> statement-breakpoint
ALTER TABLE `auditFinalReports` ADD CONSTRAINT `auditFinalReports_fiscalPeriodId_fiscalPeriods_id_fk` FOREIGN KEY (`fiscalPeriodId`) REFERENCES `fiscalPeriods`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auditSignOffs` ADD CONSTRAINT `auditSignOffs_fiscalPeriodId_fiscalPeriods_id_fk` FOREIGN KEY (`fiscalPeriodId`) REFERENCES `fiscalPeriods`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fiscalPeriods` ADD CONSTRAINT `fiscalPeriods_lockedByUserId_users_id_fk` FOREIGN KEY (`lockedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;