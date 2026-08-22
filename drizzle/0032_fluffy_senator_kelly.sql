ALTER TABLE `users` ADD `termsAcceptedVersion` varchar(32);--> statement-breakpoint
ALTER TABLE `users` ADD `privacyAcceptedVersion` varchar(32);--> statement-breakpoint
ALTER TABLE `users` ADD `legalConsentAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `legalConsentIp` varchar(64);