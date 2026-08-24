-- =============================================================================
-- Gamification / Challenge Mode (Row 1) — MySQL Migration
-- Database: MySQL-compatible (HeidiSQL)
-- Tables:
--   1. Gamification_challenges
--   2. Gamification_challenge_opt_ins
--   3. Gamification_challenge_attempts
--   4. Gamification_challenge_responses
--   5. Gamification_challenge_leaderboards
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- =============================================================================
-- 1. Gamification_challenges
--    Challenge Mode task definitions (hard/advanced challenge tasks).
--    Teachers/admin create these. Students discover and opt-in.
-- =============================================================================

DROP TABLE IF EXISTS `Gamification_challenges`;

CREATE TABLE `Gamification_challenges` (
    `id`                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `title`               VARCHAR(255) NOT NULL,
    `description`         TEXT NULL,
    `subject_id`          VARCHAR(255) NULL COMMENT 'Linked subject (mirrors PAL subject_id)',
    `concept_id`          VARCHAR(255) NULL COMMENT 'Linked concept (mirrors PAL concept_id)',
    `difficulty`          VARCHAR(20)  NOT NULL DEFAULT 'hard'
        COMMENT 'Challenge difficulty: hard | advanced (Challenge Mode difficulty, not adaptive)',
    `target_time_seconds` INT NOT NULL DEFAULT 60 COMMENT 'Target seconds per item/question',
    `item_count`          INT NOT NULL DEFAULT 10 COMMENT 'Number of items/questions in this challenge',
    `is_active`           TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1 = available for opt-in',
    `start_date`          DATETIME NULL COMMENT 'Earliest date challenge is available',
    `end_date`            DATETIME NULL COMMENT 'After this date challenge closes',
    `created_by`          INT NOT NULL COMMENT 'Teacher/admin user_id who created this challenge',
    `sub_institute_id`    VARCHAR(255) NOT NULL,
    `syear`               VARCHAR(50) NOT NULL,
    `created_at`          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    UNIQUE KEY `uniq_challenge_title_inst_year` (`title`, `sub_institute_id`, `syear`),
    KEY `idx_challenge_inst_year` (`sub_institute_id`, `syear`),
    KEY `idx_challenge_active` (`is_active`),
    KEY `idx_challenge_subject` (`subject_id`),
    KEY `idx_challenge_created_by` (`created_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 2. Gamification_challenge_opt_ins
--    Student opt-in / opt-out for Challenge Mode.
--    Unique per (student, institute, year). A student can opt out at any time.
-- =============================================================================

DROP TABLE IF EXISTS `Gamification_challenge_opt_ins`;

CREATE TABLE `Gamification_challenge_opt_ins` (
    `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id`          VARCHAR(255) NOT NULL COMMENT 'Student user_id',
    `sub_institute_id` VARCHAR(255) NOT NULL,
    `syear`            VARCHAR(50) NOT NULL,
    `is_opted_in`      TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1 = opted in, 0 = opted out',
    `opted_in_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `opted_out_at`     DATETIME NULL COMMENT 'Set when student opts out',
    `created_at`       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    UNIQUE KEY `uniq_optin_user_year` (`user_id`, `sub_institute_id`, `syear`),
    KEY `idx_optin_user` (`user_id`, `sub_institute_id`, `syear`),
    KEY `idx_optin_status` (`is_opted_in`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 3. Gamification_challenge_attempts
--    One row per student challenge attempt.
--    Stores computed score, accuracy, speed, difficulty, qualification status.
--    Challenge Mode scoring is isolated from normal PAL mastery/BKT.
-- =============================================================================

DROP TABLE IF EXISTS `Gamification_challenge_attempts`;

CREATE TABLE `Gamification_challenge_attempts` (
    `id`                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `challenge_id`            BIGINT UNSIGNED NOT NULL,
    `user_id`                 VARCHAR(255) NOT NULL COMMENT 'Student user_id',
    `sub_institute_id`        VARCHAR(255) NOT NULL,
    `syear`                   VARCHAR(50) NOT NULL,
    `opt_in_id`               BIGINT UNSIGNED NULL COMMENT 'Reference to opt-in record at attempt time',
    `started_at`              DATETIME NOT NULL,
    `completed_at`            DATETIME NULL,
    `total_items`             INT NOT NULL DEFAULT 0 COMMENT 'Total items in this challenge',
    `valid_responses`         INT NOT NULL DEFAULT 0 COMMENT 'Items with a valid response',
    `correct_responses`       INT NOT NULL DEFAULT 0,
    `accuracy`                DECIMAL(6,4) NOT NULL DEFAULT 0.0000 COMMENT 'correct / valid_responses',
    `avg_time_per_item`       DECIMAL(8,3) NOT NULL DEFAULT 0.000 COMMENT 'Seconds per item (total time / valid_responses)',
    `speed_ratio`             DECIMAL(6,4) NOT NULL DEFAULT 0.0000 COMMENT 'min(target_time / avg_time, 2.0)',
    `difficulty_coefficient`  DECIMAL(6,4) NOT NULL DEFAULT 0.0000 COMMENT 'avg difficulty / 5',
    `raw_score`               INT NOT NULL DEFAULT 0 COMMENT 'round(accuracy * speed_ratio * difficulty_coefficient * 1000)',
    `is_qualified`            TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 if valid_responses >= 5',
    `attempt_status`          VARCHAR(20) NOT NULL DEFAULT 'in_progress'
        COMMENT 'in_progress | completed | abandoned',
    `created_at`              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    KEY `idx_attempt_challenge` (`challenge_id`),
    KEY `idx_attempt_user` (`user_id`, `sub_institute_id`, `syear`),
    KEY `idx_attempt_user_challenge` (`user_id`, `challenge_id`, `attempt_status`),
    KEY `idx_attempt_completed` (`completed_at`),
    KEY `idx_attempt_qualified` (`is_qualified`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 4. Gamification_challenge_responses
--    Per-item result for a challenge attempt.
--    Stores correctness, response time, difficulty, target time for scoring audit.
-- =============================================================================

DROP TABLE IF EXISTS `Gamification_challenge_responses`;

CREATE TABLE `Gamification_challenge_responses` (
    `id`                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `attempt_id`          BIGINT UNSIGNED NOT NULL,
    `challenge_id`        BIGINT UNSIGNED NOT NULL,
    `user_id`             VARCHAR(255) NOT NULL,
    `sub_institute_id`    VARCHAR(255) NOT NULL,
    `syear`               VARCHAR(50) NOT NULL,
    `question_id`         VARCHAR(255) NULL COMMENT 'Question/item identifier if available',
    `is_correct`          TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 if response was correct',
    `response_time`       DECIMAL(8,3) NOT NULL DEFAULT 0.000 COMMENT 'Seconds taken to respond',
    `difficulty`          DECIMAL(5,2) NOT NULL DEFAULT 3.00 COMMENT 'Question difficulty (1-5 scale)',
    `target_time`         DECIMAL(8,3) NOT NULL DEFAULT 60.000 COMMENT 'Target seconds for this item',
    `response_metadata`   JSON NULL COMMENT 'Optional metadata (selected answer, options, etc.)',
    `created_at`          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    KEY `idx_response_attempt` (`attempt_id`),
    KEY `idx_response_challenge` (`challenge_id`),
    KEY `idx_response_user` (`user_id`, `sub_institute_id`, `syear`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 5. Gamification_challenge_leaderboards
--    Weekly leaderboard snapshots per challenge.
--    Only opted-in, qualified students appear. Top 5 per challenge per week.
--    Uses first names only for student-facing display. Resets weekly.
-- =============================================================================

DROP TABLE IF EXISTS `Gamification_challenge_leaderboards`;

CREATE TABLE `Gamification_challenge_leaderboards` (
    `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `challenge_id`    BIGINT UNSIGNED NOT NULL,
    `user_id`         VARCHAR(255) NOT NULL COMMENT 'Student user_id',
    `sub_institute_id` VARCHAR(255) NOT NULL,
    `syear`           VARCHAR(50) NOT NULL,
    `week_start`      DATE NOT NULL COMMENT 'ISO week start (Monday) for this leaderboard period',
    `week_number`     INT NOT NULL COMMENT 'ISO week number',
    `year_number`     INT NOT NULL COMMENT 'ISO year',
    `score`           INT NOT NULL DEFAULT 0 COMMENT 'Final challenge score (raw_score from attempt)',
    `rank`            INT NULL COMMENT 'Rank within this challenge/week (1-based)',
    `is_qualified`    TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1 = scored with >=5 valid responses',
    `display_name`    VARCHAR(100) NOT NULL COMMENT 'First name only for student-facing display',
    `created_at`      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    UNIQUE KEY `uniq_leaderboard_entry` (`challenge_id`, `week_start`, `user_id`),
    KEY `idx_leaderboard_challenge_week` (`challenge_id`, `week_start`, `rank`),
    KEY `idx_leaderboard_user` (`user_id`, `sub_institute_id`, `syear`),
    KEY `idx_leaderboard_week` (`week_start`, `year_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
