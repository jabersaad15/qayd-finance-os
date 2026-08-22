CREATE TABLE `customerContacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyId` int NOT NULL,
	`customerId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`jobTitle` varchar(255),
	`email` varchar(320),
	`phone` varchar(32),
	`isPrimary` boolean NOT NULL DEFAULT false,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customerContacts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `customers` ADD `primaryContactName` varchar(255);--> statement-breakpoint
ALTER TABLE `customers` ADD `primaryContactTitle` varchar(255);--> statement-breakpoint
ALTER TABLE `customers` ADD `primaryContactEmail` varchar(320);--> statement-breakpoint
ALTER TABLE `customers` ADD `primaryContactPhone` varchar(32);--> statement-breakpoint
ALTER TABLE `customers` ADD `salesOwnerUserId` int;--> statement-breakpoint
ALTER TABLE `quotations` ADD `customerContactId` int;--> statement-breakpoint
ALTER TABLE `quotations` ADD `salesOwnerUserId` int;--> statement-breakpoint
ALTER TABLE `customerContacts` ADD CONSTRAINT `customerContacts_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customerContacts` ADD CONSTRAINT `customerContacts_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customerContacts` ADD CONSTRAINT `customerContacts_customerId_customers_id_fk` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `customer_contacts_lookup_idx` ON `customerContacts` (`tenantId`,`companyId`,`customerId`);--> statement-breakpoint
ALTER TABLE `customers` ADD CONSTRAINT `customers_salesOwnerUserId_users_id_fk` FOREIGN KEY (`salesOwnerUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quotations` ADD CONSTRAINT `quotations_customerContactId_customerContacts_id_fk` FOREIGN KEY (`customerContactId`) REFERENCES `customerContacts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quotations` ADD CONSTRAINT `quotations_salesOwnerUserId_users_id_fk` FOREIGN KEY (`salesOwnerUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;