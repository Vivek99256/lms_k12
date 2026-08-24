-- =============================================================================
-- Gamification / Visibility Governance (Row 7) — MySQL Migration
-- Database: MySQL-compatible (HeidiSQL)
-- Tables:
--   1. Gamification_visibility_rules
--   2. Gamification_visibility_audit
--   3. Gamification_parent_child_links
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- =============================================================================
-- 1. Gamification_visibility_rules
--    Stores visibility policy configuration per domain and role.
--    Acts as the source of truth for the visibility matrix.
-- =============================================================================

DROP TABLE IF EXISTS `Gamification_visibility_rules`;

CREATE TABLE `Gamification_visibility_rules` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `domain` VARCHAR(50) NOT NULL COMMENT 'mastery | badges | streak | personal_best | career_quest | team_challenge | challenge_mode | notifications',
    `actor_role` VARCHAR(20) NOT NULL COMMENT 'student | teacher | parent | admin',
    `access_level` VARCHAR(30) NOT NULL COMMENT 'full | aggregate | milestone | summary | current | none | count_only | per_student | own_plus_optin_top5 | opt_in_only | same_aggregate',
    `can_view_personal` TINYINT(1) NOT NULL DEFAULT 0,
    `can_view_aggregate` TINYINT(1) NOT NULL DEFAULT 0,
    `can_view_milestone` TINYINT(1) NOT NULL DEFAULT 0,
    `can_view_full` TINYINT(1) NOT NULL DEFAULT 0,
    `description` TEXT NULL COMMENT 'Human-readable rule description',
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uniq_vis_domain_role` (`domain`, `actor_role`),
    KEY `idx_vis_domain` (`domain`),
    KEY `idx_vis_role` (`actor_role`),
    KEY `idx_vis_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 2. Gamification_visibility_audit
--    Audit log for visibility access decisions.
--    Records every access grant/deny for compliance and debugging.
-- =============================================================================

DROP TABLE IF EXISTS `Gamification_visibility_audit`;

CREATE TABLE `Gamification_visibility_audit` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `actor_user_id` VARCHAR(255) NOT NULL,
    `actor_role` VARCHAR(20) NOT NULL,
    `actor_sub_institute_id` VARCHAR(255) NOT NULL,
    `actor_syear` VARCHAR(50) NOT NULL,
    `target_user_id` VARCHAR(255) NOT NULL,
    `target_sub_institute_id` VARCHAR(255) NOT NULL,
    `target_syear` VARCHAR(50) NOT NULL,
    `domain` VARCHAR(50) NOT NULL,
    `access_level` VARCHAR(30) NOT NULL,
    `granted` TINYINT(1) NOT NULL DEFAULT 0,
    `reason` TEXT NULL COMMENT 'Why access was granted or denied',
    `ip_address` VARCHAR(45) NULL,
    `user_agent` TEXT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_vis_audit_actor` (`actor_user_id`, `actor_sub_institute_id`, `actor_syear`),
    KEY `idx_vis_audit_target` (`target_user_id`, `target_sub_institute_id`, `target_syear`),
    KEY `idx_vis_audit_domain` (`domain`),
    KEY `idx_vis_audit_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 3. Gamification_parent_child_links
--    Links parent users to student users for visibility governance.
--    Required because the LMS does not have a dedicated parent-child table.
-- =============================================================================

DROP TABLE IF EXISTS `Gamification_parent_child_links`;

CREATE TABLE `Gamification_parent_child_links` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `parent_user_id` VARCHAR(255) NOT NULL,
    `student_user_id` VARCHAR(255) NOT NULL,
    `sub_institute_id` VARCHAR(255) NOT NULL,
    `syear` VARCHAR(50) NOT NULL,
    `relationship_type` VARCHAR(50) NOT NULL DEFAULT 'parent'
        COMMENT 'parent | guardian',
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uniq_parent_child_link` (`parent_user_id`, `student_user_id`, `sub_institute_id`, `syear`),
    KEY `idx_parent_child_parent` (`parent_user_id`, `sub_institute_id`, `syear`),
    KEY `idx_parent_child_student` (`student_user_id`, `sub_institute_id`, `syear`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- Seed visibility rules from the visibility matrix
-- =============================================================================

INSERT INTO `Gamification_visibility_rules`
    (`domain`, `actor_role`, `access_level`, `can_view_personal`, `can_view_aggregate`, `can_view_milestone`, `can_view_full`, `description`, `is_active`)
VALUES
-- Mastery
('mastery', 'student', 'full', 1, 0, 0, 1, 'Student sees own mastery level in full detail.', 1),
('mastery', 'teacher', 'full', 1, 1, 0, 1, 'Teacher sees full mastery data for students they are authorized to view.', 1),
('mastery', 'parent', 'summary', 0, 0, 0, 0, 'Parent sees summary-level mastery for their child.', 1),
('mastery', 'admin', 'aggregate', 0, 1, 0, 0, 'Admin sees aggregate mastery data only.', 1),

-- Badges
('badges', 'student', 'full', 1, 0, 0, 1, 'Student sees own badges in full detail.', 1),
('badges', 'teacher', 'full', 1, 0, 0, 1, 'Teacher sees full badge data for students they are authorized to view.', 1),
('badges', 'parent', 'milestone', 0, 0, 1, 0, 'Parent sees milestone badges for their child.', 1),
('badges', 'admin', 'count_only', 0, 0, 0, 0, 'Admin sees badge count only.', 1),

-- Streak
('streak', 'student', 'full', 1, 0, 0, 1, 'Student sees own streak in full detail.', 1),
('streak', 'teacher', 'full', 1, 0, 0, 1, 'Teacher sees full streak data for students they are authorized to view.', 1),
('streak', 'parent', 'current', 0, 0, 0, 0, 'Parent sees current streak value for their child only.', 1),
('streak', 'admin', 'none', 0, 0, 0, 0, 'Admin has no access to streak data.', 1),

-- Personal Best
('personal_best', 'student', 'full', 1, 0, 0, 1, 'Student sees own personal bests in full detail.', 1),
('personal_best', 'teacher', 'full', 1, 0, 0, 1, 'Teacher sees full personal best data for students they are authorized to view.', 1),
('personal_best', 'parent', 'none', 0, 0, 0, 0, 'Parent has no access to personal best data.', 1),
('personal_best', 'admin', 'none', 0, 0, 0, 0, 'Admin has no access to personal best data.', 1),

-- Career Quest
('career_quest', 'student', 'full', 1, 0, 0, 1, 'Student sees own career quest in full detail.', 1),
('career_quest', 'teacher', 'full', 1, 0, 0, 1, 'Teacher sees full career quest data for students they are authorized to view.', 1),
('career_quest', 'parent', 'full', 1, 0, 0, 1, 'Parent sees full career quest data for their child.', 1),
('career_quest', 'admin', 'none', 0, 0, 0, 0, 'Admin has no access to career quest data.', 1),

-- Team Challenge progress
('team_challenge', 'student', 'aggregate', 0, 1, 0, 0, 'Student sees class aggregate team challenge progress.', 1),
('team_challenge', 'teacher', 'per_student', 1, 1, 0, 0, 'Teacher sees per-student team challenge progress.', 1),
('team_challenge', 'parent', 'none', 0, 0, 0, 0, 'Parent has no access to team challenge data.', 1),
('team_challenge', 'admin', 'none', 0, 0, 0, 0, 'Admin has no access to team challenge data.', 1),

-- Challenge Mode scores
('challenge_mode', 'student', 'own_plus_optin_top5', 1, 0, 0, 1, 'Student sees own challenge mode scores plus top 5 if opted in.', 1),
('challenge_mode', 'teacher', 'full', 1, 1, 0, 1, 'Teacher sees full challenge mode data for students they are authorized to view.', 1),
('challenge_mode', 'parent', 'none', 0, 0, 0, 0, 'Parent has no access to challenge mode data.', 1),
('challenge_mode', 'admin', 'none', 0, 0, 0, 0, 'Admin has no access to challenge mode data.', 1),

-- Notifications
('notifications', 'student', 'full', 1, 0, 0, 1, 'Student sees own notifications.', 1),
('notifications', 'teacher', 'full', 1, 0, 0, 1, 'Teacher sees notifications for students they are authorized to view.', 1),
('notifications', 'parent', 'milestone', 0, 0, 1, 0, 'Parent sees milestone notifications for their child.', 1),
('notifications', 'admin', 'none', 0, 0, 0, 0, 'Admin has no access to notification data.', 1);

SET FOREIGN_KEY_CHECKS = 1;
