CREATE TABLE `scheduledExecutionLocks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskUid` varchar(65) NOT NULL,
	`executionBucket` varchar(32) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `scheduledExecutionLocks_id` PRIMARY KEY(`id`),
	CONSTRAINT `scheduled_execution_unique` UNIQUE(`taskUid`,`executionBucket`)
);
