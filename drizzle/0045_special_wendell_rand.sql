ALTER TABLE `approvalCases` ADD `dueAt` timestamp;--> statement-breakpoint
ALTER TABLE `centralApprovalPolicies` ADD `slaHours` int;--> statement-breakpoint
ALTER TABLE `centralApprovalPolicies` ADD `escalationAfterHours` int;