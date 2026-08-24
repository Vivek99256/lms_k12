SET FOREIGN_KEY_CHECKS = 0;

-- =============================================================================
-- Gamification / Team Challenge System — MySQL Migration
-- Database: MySQL-compatible (HeidiSQL)
-- Tables:
--   1. Gamification_team_challenges
--   2. Gamification_team_challenge_participants
--   3. Gamification_team_challenge_contributions
--   4. Gamification_team_challenge_progress
-- =============================================================================

-- =============================================================================
-- 1. Gamification_team_challenges
--    Challenge master table configured by teachers.
--    Scoped to class/group via grade_id, standard_id, division_id.
-- =============================================================================

CREATE TABLE IF NOT EXISTS `Gamification_team_challenges` (
    `id`                INT AUTO_INCREMENT PRIMARY KEY,
    `title`             VARCHAR(255) NOT NULL,
    `description`       TEXT,
    `challenge_type`    VARCHAR(50)  NOT NULL DEFAULT 'mastery_sprint'
        COMMENT 'mastery_sprint | collective_fluency | peer_teaching | exploration',
    `target_type`       VARCHAR(100) NOT NULL
        COMMENT 'concepts_mastered | total_fluency | peer_help_count | content_explored',
    `target_value`      DECIMAL(12,4) NOT NULL DEFAULT 0,
    `reward_type`       VARCHAR(50)  DEFAULT NULL
        COMMENT 'points | badge | certificate',
    `reward_value`      VARCHAR(255) DEFAULT NULL,
    `status`            VARCHAR(20)  NOT NULL DEFAULT 'draft'
        COMMENT 'draft | active | ended | completed',
    `created_by`        INT NOT NULL
        COMMENT 'teacher user_id',
    `sub_institute_id`  INT NOT NULL,
    `syear`             INT NOT NULL,
    `grade_id`          INT,
    `standard_id`       INT,
    `division_id`       INT,
    `start_date`        DATETIME,
    `deadline`          DATETIME,
    `ended_at`          DATETIME,
    `created_at`        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX `idx_tc_class`      (`sub_institute_id`, `syear`, `grade_id`, `standard_id`, `division_id`),
    INDEX `idx_tc_status`     (`status`),
    INDEX `idx_tc_created_by` (`created_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 2. Gamification_team_challenge_participants
--    Student enrollments in team challenges.
--    Uniqueness: a student can join a challenge only once.
-- =============================================================================

CREATE TABLE IF NOT EXISTS `Gamification_team_challenge_participants` (
    `id`                INT AUTO_INCREMENT PRIMARY KEY,
    `team_challenge_id` INT NOT NULL,
    `user_id`           INT NOT NULL
        COMMENT 'student user_id',
    `sub_institute_id`  INT NOT NULL,
    `syear`             INT NOT NULL,
    `joined_at`         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `status`            VARCHAR(20) NOT NULL DEFAULT 'active'
        COMMENT 'active | removed',

    UNIQUE KEY `uq_tc_participant` (`team_challenge_id`, `user_id`),
    INDEX `idx_tcp_class` (`sub_institute_id`, `syear`, `user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 3. Gamification_team_challenge_contributions
--    Idempotent contribution events for team challenges.
--    Uniqueness: idempotency_key prevents duplicate counting.
-- =============================================================================

CREATE TABLE IF NOT EXISTS `Gamification_team_challenge_contributions` (
    `id`                INT AUTO_INCREMENT PRIMARY KEY,
    `team_challenge_id` INT NOT NULL,
    `user_id`           INT NOT NULL
        COMMENT 'student who contributed',
    `sub_institute_id`  INT NOT NULL,
    `syear`             INT NOT NULL,
    `event_type`        VARCHAR(100) NOT NULL
        COMMENT 'mastery | fluency | peer_help | exploration',
    `source_id`         VARCHAR(255)
        COMMENT 'source learning event identifier (questionPaperId, conceptId, contentId, etc.)',
    `value`             DECIMAL(12,4) NOT NULL DEFAULT 1,
    `idempotency_key`   VARCHAR(255) NOT NULL,
    `status`            VARCHAR(20) NOT NULL DEFAULT 'counted'
        COMMENT 'counted | skipped',
    `created_at`        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY `uq_tc_contribution_idempotent` (`idempotency_key`),
    INDEX `idx_tc_contrib_event` (`team_challenge_id`, `user_id`, `event_type`),
    INDEX `idx_tc_contrib_class`  (`sub_institute_id`, `syear`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 4. Gamification_team_challenge_progress
--    Aggregated progress snapshot per team challenge.
--    Updated on each contribution via recompute.
-- =============================================================================

CREATE TABLE IF NOT EXISTS `Gamification_team_challenge_progress` (
    `id`                INT AUTO_INCREMENT PRIMARY KEY,
    `team_challenge_id` INT NOT NULL,
    `total_participants`     INT NOT NULL DEFAULT 0,
    `active_contributors`    INT NOT NULL DEFAULT 0,
    `aggregate_value`        DECIMAL(12,4) NOT NULL DEFAULT 0,
    `target_value`           DECIMAL(12,4) NOT NULL DEFAULT 0,
    `progress_percentage`    DECIMAL(6,2) NOT NULL DEFAULT 0,
    `status`                 VARCHAR(20) NOT NULL DEFAULT 'in_progress'
        COMMENT 'in_progress | completed | ended',
    `last_updated`           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `updated_at`             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY `uq_tc_progress` (`team_challenge_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
