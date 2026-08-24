-- =============================================================================
-- Gamification / Personal Best System — MySQL Migration
-- Database: MySQL-compatible (HeidiSQL)
-- Tables:
--   1. Gamification_fluency_records
--   2. Gamification_streak_records
--   3. Gamification_mastery_records
--   4. Gamification_session_records
--   5. Gamification_pb_notifications
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- =============================================================================
-- 1. Gamification_fluency_records
--    Stores each student's Personal Best fluency per concept.
--    A new record is inserted only when the student's new fluency exceeds
--    their previous best for that concept.
-- =============================================================================

DROP TABLE IF EXISTS `Gamification_fluency_records`;

CREATE TABLE `Gamification_fluency_records` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` VARCHAR(255) NOT NULL,
    `sub_institute_id` VARCHAR(255) NOT NULL,
    `syear` VARCHAR(50) NOT NULL,
    `concept_id` VARCHAR(255) NOT NULL,
    `concept_name` VARCHAR(500) NULL,
    `best_fluency` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `previous_best` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `absolute_improvement` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `improvement_percentage` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `achieved_at` DATETIME NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uniq_fluency_user_concept_year` (`user_id`, `sub_institute_id`, `syear`, `concept_id`),
    KEY `idx_fluency_user_year` (`user_id`, `sub_institute_id`, `syear`),
    KEY `idx_fluency_concept` (`concept_id`),
    KEY `idx_fluency_achieved` (`achieved_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 2. Gamification_streak_records
--    Stores current and longest learning streaks per student per academic year.
--    Only actual learning activities count (not simple page visits).
-- =============================================================================

DROP TABLE IF EXISTS `Gamification_streak_records`;

CREATE TABLE `Gamification_streak_records` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` VARCHAR(255) NOT NULL,
    `sub_institute_id` VARCHAR(255) NOT NULL,
    `syear` VARCHAR(50) NOT NULL,
    `current_streak` INT NOT NULL DEFAULT 0,
    `longest_streak` INT NOT NULL DEFAULT 0,
    `longest_streak_date` DATE NULL,
    `last_activity_date` DATE NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uniq_streak_user_year` (`user_id`, `sub_institute_id`, `syear`),
    KEY `idx_streak_user` (`user_id`, `sub_institute_id`, `syear`),
    KEY `idx_streak_last_activity` (`last_activity_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 3. Gamification_mastery_records
--    Stores Personal Best mastery achievements per student per concept.
--    Uses existing PAL mastery/BKT data; does not invent mastery values.
-- =============================================================================

DROP TABLE IF EXISTS `Gamification_mastery_records`;

CREATE TABLE `Gamification_mastery_records` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` VARCHAR(255) NOT NULL,
    `sub_institute_id` VARCHAR(255) NOT NULL,
    `syear` VARCHAR(50) NOT NULL,
    `concept` VARCHAR(500) NOT NULL,
    `concept_id` VARCHAR(255) NULL,
    `mastery_result` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `mastery_duration` INT NULL COMMENT 'Duration in seconds where available',
    `mastery_session_count` INT NULL,
    `fastest_mastery` INT NULL COMMENT 'Fastest mastery in seconds where available',
    `mountain_sky_concept` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 if concept is at Mountain/Sky level per PAL data',
    `achieved_at` DATETIME NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uniq_mastery_user_concept_year` (`user_id`, `sub_institute_id`, `syear`, `concept`),
    KEY `idx_mastery_user_year` (`user_id`, `sub_institute_id`, `syear`),
    KEY `idx_mastery_concept` (`concept_id`),
    KEY `idx_mastery_achieved` (`achieved_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 4. Gamification_session_records
--    Stores Personal Best session metrics as events.
--    Each row represents a PB event for a specific metric type.
-- =============================================================================

DROP TABLE IF EXISTS `Gamification_session_records`;

CREATE TABLE `Gamification_session_records` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` VARCHAR(255) NOT NULL,
    `sub_institute_id` VARCHAR(255) NOT NULL,
    `syear` VARCHAR(50) NOT NULL,
    `record_type` VARCHAR(50) NOT NULL COMMENT 'longest_productive_session | most_concepts_in_one_day | best_single_session_mastery_gain',
    `previous_value` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `new_value` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `session_start` DATETIME NULL,
    `session_end` DATETIME NULL,
    `concepts_covered` TEXT NULL COMMENT 'Comma-separated concept names or JSON array',
    `achieved_at` DATETIME NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_session_user_type` (`user_id`, `sub_institute_id`, `syear`, `record_type`),
    KEY `idx_session_user_year` (`user_id`, `sub_institute_id`, `syear`),
    KEY `idx_session_achieved` (`achieved_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 5. Gamification_pb_notifications
--    Stores Personal Best notifications for students.
--    Notification types: fluency_pb, streak_pb, mastery_pb, session_pb
-- =============================================================================

DROP TABLE IF EXISTS `Gamification_pb_notifications`;

CREATE TABLE `Gamification_pb_notifications` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` VARCHAR(255) NOT NULL,
    `sub_institute_id` VARCHAR(255) NOT NULL,
    `syear` VARCHAR(50) NOT NULL,
    `notification_type` VARCHAR(50) NOT NULL COMMENT 'fluency_pb | streak_pb | mastery_pb | session_pb',
    `title` VARCHAR(255) NOT NULL,
    `message` TEXT NOT NULL,
    `related_concept` VARCHAR(500) NULL,
    `previous_value` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `new_value` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `improvement` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `is_read` TINYINT(1) NOT NULL DEFAULT 0,
    `read_at` DATETIME NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_notification_user_type` (`user_id`, `sub_institute_id`, `syear`, `notification_type`),
    KEY `idx_notification_read` (`is_read`, `created_at`),
    KEY `idx_notification_user` (`user_id`, `sub_institute_id`, `syear`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
