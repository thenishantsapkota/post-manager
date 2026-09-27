CREATE TABLE `activity_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`level` text NOT NULL,
	`message` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `automations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`cron` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`config` text NOT NULL,
	`next_run_at` integer,
	`last_run_at` integer,
	`last_status` text,
	`last_message` text,
	`last_set_key` text,
	`pending_slot_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `library_items` (
	`id` text PRIMARY KEY NOT NULL,
	`collection` text NOT NULL,
	`caption` text DEFAULT '' NOT NULL,
	`media_id` text,
	`card` text,
	`active` integer DEFAULT true NOT NULL,
	`times_posted` integer DEFAULT 0 NOT NULL,
	`last_posted_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `library_collection` ON `library_items` (`collection`);--> statement-breakpoint
CREATE TABLE `media` (
	`id` text PRIMARY KEY NOT NULL,
	`filename` text NOT NULL,
	`mime` text NOT NULL,
	`width` integer,
	`height` integer,
	`bytes` integer NOT NULL,
	`kind` text NOT NULL,
	`label` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text,
	`caption` text DEFAULT '' NOT NULL,
	`media_ids` text NOT NULL,
	`status` text NOT NULL,
	`scheduled_at` integer,
	`published_at` integer,
	`fb_post_id` text,
	`permalink` text,
	`error` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`source` text NOT NULL,
	`automation_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `posts_status_scheduled` ON `posts` (`status`,`scheduled_at`);--> statement-breakpoint
CREATE TABLE `rashifal_sets` (
	`id` text PRIMARY KEY NOT NULL,
	`period` text NOT NULL,
	`end_date` text NOT NULL,
	`title` text NOT NULL,
	`author` text DEFAULT '' NOT NULL,
	`entries` text NOT NULL,
	`edited` integer DEFAULT false NOT NULL,
	`fetched_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rashifal_period_end` ON `rashifal_sets` (`period`,`end_date`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`background_media_id` text,
	`background_color` text DEFAULT '#1f2937' NOT NULL,
	`sign_backgrounds` text NOT NULL,
	`layers` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
