-- =============================================================================
-- Gamification / Session Summary Screen — MySQL Migration
-- Database: MySQL-compatible (HeidiSQL)
-- Tables:
--   1. Gamification_session_summaries
--   2. Gamification_session_summary_concepts
--   3. Gamification_session_summary_praise
--   4. Gamification_session_summary_upcoming
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- =============================================================================
-- 1. Gamification_session_summaries
--    Stores the session summary header for a completed student learning session.
--    Uniqueness: one summary per completed session per student per academic year.
-- =============================================================================

DROP TABLE IF EXISTS `Gamification_session_summaries`;

CREATE TABLE `Gamification_session_summaries` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `session_id` VARCHAR(255) NOT NULL COMMENT 'Unique session identifier (e.g. questionPaperId)',
    `user_id` VARCHAR(255) NOT NULL,
    `sub_institute_id` VARCHAR(255) NOT NULL,
    `syear` VARCHAR(50) NOT NULL,
    `session_start` DATETIME NULL,
    `session_end` DATETIME NULL,
    `completion_state` VARCHAR(50) NOT NULL DEFAULT 'completed'
        COMMENT 'completed | partial | abandoned',
    `total_concepts` INT NOT NULL DEFAULT 0,
    `total_questions` INT NOT NULL DEFAULT 0,
    `obtain_marks` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `total_marks` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `accuracy` DECIMAL(6,2) NOT NULL DEFAULT 0.00,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uniq_session_user_session` (`user_id`, `sub_institute_id`, `syear`, `session_id`),
    KEY `idx_session_user` (`user_id`, `sub_institute_id`, `syear`),
    KEY `idx_session_id` (`session_id`),
    KEY `idx_session_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 2. Gamification_session_summary_concepts
--    Stores each concept worked on during the session with progress snapshot.
-- =============================================================================

DROP TABLE IF EXISTS `Gamification_session_summary_concepts`;

CREATE TABLE `Gamification_session_summary_concepts` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `summary_id` BIGINT UNSIGNED NOT NULL,
    `concept_id` VARCHAR(255) NULL,
    `concept_name` VARCHAR(500) NOT NULL,
    `mastery_before` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `mastery_after` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `mastery_change` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `accuracy` DECIMAL(6,2) NOT NULL DEFAULT 0.00,
    `attempted` INT NOT NULL DEFAULT 0,
    `correct` INT NOT NULL DEFAULT 0,
    `sort_order` INT NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_summary_concept` (`summary_id`, `sort_order`),
    KEY `idx_concept_name` (`concept_name`(255))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 3. Gamification_session_summary_praise
--    Stores evidence-based specific praise for the session.
-- =============================================================================

DROP TABLE IF EXISTS `Gamification_session_summary_praise`;

CREATE TABLE `Gamification_session_summary_praise` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `summary_id` BIGINT UNSIGNED NOT NULL,
    `praise_text` TEXT NOT NULL,
    `reason` TEXT NOT NULL COMMENT 'Evidence or reason for the praise',
    `source_type` VARCHAR(50) NULL COMMENT 'mastery_improvement | accuracy | concept_specific',
    `concept_name` VARCHAR(500) NULL,
    `sort_order` INT NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_praise_summary` (`summary_id`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 4. Gamification_session_summary_upcoming
--    Stores upcoming/recommended concepts for the next session.
-- =============================================================================

DROP TABLE IF EXISTS `Gamification_session_summary_upcoming`;

CREATE TABLE `Gamification_session_summary_upcoming` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `summary_id` BIGINT UNSIGNED NOT NULL,
    `concept_id` VARCHAR(255) NULL,
    `concept_name` VARCHAR(500) NOT NULL,
    `reason` TEXT NULL COMMENT 'Why this concept is recommended next',
    `expected_timing` VARCHAR(100) NULL COMMENT 'Expected timing recommendation',
    `sort_order` INT NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_upcoming_summary` (`summary_id`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
