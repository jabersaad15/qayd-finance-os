CREATE TABLE `subscriptionPlanEntitlements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`planId` int NOT NULL,
	`featureCode` varchar(120) NOT NULL,
	`limitValue` int,
	`enabled` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscriptionPlanEntitlements_id` PRIMARY KEY(`id`),
	CONSTRAINT `subscription_plan_feature_unique` UNIQUE(`planId`,`featureCode`)
);
--> statement-breakpoint
CREATE TABLE `subscriptionPlans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(64) NOT NULL,
	`nameAr` varchar(128) NOT NULL,
	`nameEn` varchar(128),
	`descriptionAr` text,
	`monthlyPrice` decimal(18,2) NOT NULL DEFAULT '0',
	`annualPrice` decimal(18,2) NOT NULL DEFAULT '0',
	`maxUsers` int,
	`maxInvoicesPerMonth` int,
	`maxStorageMb` int,
	`trialDays` int NOT NULL DEFAULT 14,
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscriptionPlans_id` PRIMARY KEY(`id`),
	CONSTRAINT `subscriptionPlans_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `tenantFeatureEntitlements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`featureCode` varchar(120) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`limitValue` int,
	`source` varchar(32) NOT NULL DEFAULT 'plan',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tenantFeatureEntitlements_id` PRIMARY KEY(`id`),
	CONSTRAINT `tenant_feature_unique` UNIQUE(`tenantId`,`featureCode`)
);
--> statement-breakpoint
CREATE TABLE `tenantSubscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`planId` int NOT NULL,
	`billingCycle` enum('monthly','annual') NOT NULL DEFAULT 'monthly',
	`status` enum('trialing','active','past_due','cancelled','expired','suspended') NOT NULL DEFAULT 'trialing',
	`trialEndsAt` timestamp,
	`currentPeriodStartsAt` timestamp,
	`currentPeriodEndsAt` timestamp,
	`cancelledAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tenantSubscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tenantUsageCounters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`featureCode` varchar(120) NOT NULL,
	`periodKey` varchar(16) NOT NULL,
	`usageValue` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tenantUsageCounters_id` PRIMARY KEY(`id`),
	CONSTRAINT `tenant_usage_period_unique` UNIQUE(`tenantId`,`featureCode`,`periodKey`)
);
--> statement-breakpoint
ALTER TABLE `subscriptionPlanEntitlements` ADD CONSTRAINT `subscriptionPlanEntitlements_planId_subscriptionPlans_id_fk` FOREIGN KEY (`planId`) REFERENCES `subscriptionPlans`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tenantFeatureEntitlements` ADD CONSTRAINT `tenantFeatureEntitlements_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tenantSubscriptions` ADD CONSTRAINT `tenantSubscriptions_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tenantSubscriptions` ADD CONSTRAINT `tenantSubscriptions_planId_subscriptionPlans_id_fk` FOREIGN KEY (`planId`) REFERENCES `subscriptionPlans`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tenantUsageCounters` ADD CONSTRAINT `tenantUsageCounters_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `tenant_subscription_lookup_idx` ON `tenantSubscriptions` (`tenantId`,`status`);--> statement-breakpoint
CREATE INDEX `tenant_subscription_period_idx` ON `tenantSubscriptions` (`tenantId`,`currentPeriodEndsAt`);