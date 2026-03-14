CREATE TABLE `food_library` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(500) NOT NULL,
	`calories` decimal(10,1) NOT NULL,
	`protein` decimal(10,1) NOT NULL,
	`defaultQuantity` decimal(10,2),
	`defaultServingType` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `food_library_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `meal_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`mealName` varchar(500) NOT NULL,
	`mealType` enum('breakfast','lunch','dinner','snack') NOT NULL,
	`calories` decimal(10,1) NOT NULL,
	`protein` decimal(10,1) NOT NULL,
	`quantity` decimal(10,2),
	`servingType` varchar(100),
	`photoUrl` text,
	`loggedAt` bigint NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `meal_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`dailyCalorieTarget` int NOT NULL DEFAULT 2000,
	`dailyProteinTarget` int NOT NULL DEFAULT 150,
	`googleSheetUrl` text,
	`googleSheetId` varchar(255),
	`googleSheetName` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_settings_userId_unique` UNIQUE(`userId`)
);
