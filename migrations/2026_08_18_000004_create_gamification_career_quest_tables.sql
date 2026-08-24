-- =============================================================================
-- Gamification / Career Quest (Row 4) — MySQL Migration
-- Database: MySQL-compatible (HeidiSQL)
-- Tables:
--   1. Gamification_career_pathways
--   2. Gamification_career_skills
--   3. Gamification_career_quests
--   4. Gamification_student_career_progress
--   5. Gamification_career_activities
--   6. Gamification_career_interests
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- =============================================================================
-- 1. Gamification_career_pathways
--    Master career pathway definitions.
-- =============================================================================

DROP TABLE IF EXISTS `Gamification_career_pathways`;

CREATE TABLE `Gamification_career_pathways` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `pathway_code` VARCHAR(100) NOT NULL,
    `pathway_name` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `category` VARCHAR(100) NULL COMMENT 'Career cluster / category',
    `riasec_codes` VARCHAR(50) NULL COMMENT 'Comma-separated RIASEC codes e.g. R,I,A,S,E,C',
    `status` TINYINT(1) NOT NULL DEFAULT 1,
    `sort_order` INT NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uniq_career_pathway_code` (`pathway_code`),
    KEY `idx_career_pathway_category` (`category`),
    KEY `idx_career_pathway_status` (`status`),
    KEY `idx_career_pathway_sort` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 2. Gamification_career_skills
--    Skills that contribute toward a career pathway.
-- =============================================================================

DROP TABLE IF EXISTS `Gamification_career_skills`;

CREATE TABLE `Gamification_career_skills` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `pathway_id` INT UNSIGNED NOT NULL,
    `skill_code` VARCHAR(100) NOT NULL,
    `skill_label` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `weight` DECIMAL(5,2) NOT NULL DEFAULT 1.00 COMMENT 'Skill weight for pathway scoring',
    `nsqf_relevance` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 if relevant to NSQF/vocational track',
    `sort_order` INT NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uniq_career_skill_pathway_code` (`pathway_id`, `skill_code`),
    KEY `idx_career_skill_pathway` (`pathway_id`),
    KEY `idx_career_skill_nsqf` (`nsqf_relevance`),
    KEY `idx_career_skill_sort` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 3. Gamification_career_quests
--    Career Quest stage/state per student per academic year.
-- =============================================================================

DROP TABLE IF EXISTS `Gamification_career_quests`;

CREATE TABLE `Gamification_career_quests` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` VARCHAR(255) NOT NULL,
    `sub_institute_id` VARCHAR(255) NOT NULL,
    `syear` VARCHAR(50) NOT NULL,
    `grade` INT NULL COMMENT 'Student grade used to determine stage (1-12)',
    `current_stage` VARCHAR(50) NOT NULL DEFAULT 'explorer'
        COMMENT 'explorer | skill_builder | pathway_seeker | career_builder',
    `primary_pathway_id` INT UNSIGNED NULL,
    `secondary_pathway_id` INT UNSIGNED NULL,
    `interest_declaration` JSON NULL COMMENT 'Non-binding interest selections',
    `quest_level` INT NOT NULL DEFAULT 1,
    `progress_info` JSON NULL COMMENT 'Stage-specific progress details',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uniq_cq_user_year` (`user_id`, `sub_institute_id`, `syear`),
    KEY `idx_cq_user` (`user_id`, `sub_institute_id`, `syear`),
    KEY `idx_cq_stage` (`current_stage`),
    KEY `idx_cq_grade` (`grade`),
    KEY `idx_cq_primary_pathway` (`primary_pathway_id`),
    KEY `idx_cq_secondary_pathway` (`secondary_pathway_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 4. Gamification_student_career_progress
--    Tracks student skill mastery/progress per career pathway.
-- =============================================================================

DROP TABLE IF EXISTS `Gamification_student_career_progress`;

CREATE TABLE `Gamification_student_career_progress` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` VARCHAR(255) NOT NULL,
    `sub_institute_id` VARCHAR(255) NOT NULL,
    `syear` VARCHAR(50) NOT NULL,
    `pathway_id` INT UNSIGNED NOT NULL,
    `skill_id` INT UNSIGNED NOT NULL,
    `mastery_state` VARCHAR(50) NOT NULL DEFAULT 'not_started'
        COMMENT 'not_started | in_progress | mastered',
    `completion_state` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 when skill fully completed',
    `achieved_at` DATETIME NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uniq_scp_user_pathway_skill_year` (`user_id`, `sub_institute_id`, `syear`, `pathway_id`, `skill_id`),
    KEY `idx_scp_user_year` (`user_id`, `sub_institute_id`, `syear`),
    KEY `idx_scp_pathway` (`pathway_id`),
    KEY `idx_scp_skill` (`skill_id`),
    KEY `idx_scp_mastery` (`mastery_state`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 5. Gamification_career_activities
--    Tracks completed career exploration/quest activities.
-- =============================================================================

DROP TABLE IF EXISTS `Gamification_career_activities`;

CREATE TABLE `Gamification_career_activities` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` VARCHAR(255) NOT NULL,
    `sub_institute_id` VARCHAR(255) NOT NULL,
    `syear` VARCHAR(50) NOT NULL,
    `activity_type` VARCHAR(100) NOT NULL
        COMMENT 'exploration | skill_builder | pathway_discovery | riasec_assessment | nsqf_module',
    `activity_name` VARCHAR(255) NOT NULL,
    `pathway_id` INT UNSIGNED NULL,
    `skill_id` INT UNSIGNED NULL,
    `source_id` VARCHAR(255) NULL COMMENT 'External source identifier',
    `status` VARCHAR(50) NOT NULL DEFAULT 'completed'
        COMMENT 'started | completed | skipped',
    `metadata` JSON NULL COMMENT 'Activity-specific data',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_ca_user_type` (`user_id`, `sub_institute_id`, `syear`, `activity_type`),
    KEY `idx_ca_user_created` (`user_id`, `sub_institute_id`, `syear`, `created_at`),
    KEY `idx_ca_pathway` (`pathway_id`),
    KEY `idx_ca_source` (`source_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 6. Gamification_career_interests
--    Stores student non-binding career interest selections.
-- =============================================================================

DROP TABLE IF EXISTS `Gamification_career_interests`;

CREATE TABLE `Gamification_career_interests` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` VARCHAR(255) NOT NULL,
    `sub_institute_id` VARCHAR(255) NOT NULL,
    `syear` VARCHAR(50) NOT NULL,
    `interest_type` VARCHAR(50) NOT NULL
        COMMENT 'riasec | pathway | skill | cluster',
    `interest_value` VARCHAR(255) NOT NULL,
    `metadata` JSON NULL COMMENT 'Additional interest context',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uniq_ci_user_type_value_year` (`user_id`, `sub_institute_id`, `syear`, `interest_type`, `interest_value`),
    KEY `idx_ci_user_type` (`user_id`, `sub_institute_id`, `syear`, `interest_type`),
    KEY `idx_ci_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
