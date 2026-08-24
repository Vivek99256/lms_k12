-- =============================================================================
-- Gamification / Milestone Badge System — MySQL Migration
-- Database: MySQL-compatible (HeidiSQL)
-- Tables:
--   1. Gamification_badges
--   2. Gamification_student_badges
--   3. Gamification_badge_events
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- =============================================================================
-- 1. Gamification_badges
--    Badge master/definition table.
--    Each row defines one permanent badge type with its trigger rule.
-- =============================================================================

DROP TABLE IF EXISTS `Gamification_badges`;

CREATE TABLE `Gamification_badges` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `badge_code` VARCHAR(100) NOT NULL,
    `badge_name` VARCHAR(255) NOT NULL,
    `category` VARCHAR(50) NOT NULL,
    `description` TEXT NOT NULL,
    `trigger_type` VARCHAR(100) NOT NULL,
    `trigger_rule` JSON NOT NULL,
    `icon` VARCHAR(100) NULL,
    `color` VARCHAR(50) NULL,
    `status` TINYINT(1) NOT NULL DEFAULT 1,
    `sort_order` INT NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uniq_badge_code` (`badge_code`),
    KEY `idx_badge_category` (`category`),
    KEY `idx_badge_status` (`status`),
    KEY `idx_badge_sort` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 2. Gamification_student_badges
--    Awarded badge records per student.
--    Uniqueness protection: the same permanent badge cannot be awarded twice
--    to the same student in the same academic year.
-- =============================================================================

DROP TABLE IF EXISTS `Gamification_student_badges`;

CREATE TABLE `Gamification_student_badges` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` VARCHAR(255) NOT NULL,
    `sub_institute_id` VARCHAR(255) NOT NULL,
    `syear` VARCHAR(50) NOT NULL,
    `badge_id` BIGINT UNSIGNED NOT NULL,
    `badge_code` VARCHAR(100) NOT NULL,
    `earned_at` DATETIME NOT NULL,
    `evidence` JSON NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uniq_student_badge_year` (`user_id`, `sub_institute_id`, `syear`, `badge_code`),
    KEY `idx_student_badge_user` (`user_id`, `sub_institute_id`, `syear`),
    KEY `idx_student_badge_code` (`badge_code`),
    KEY `idx_student_badge_earned` (`earned_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 3. Gamification_badge_events
--    Lightweight event/evidence/audit table.
--    Records discrete learning events that feed badge trigger evaluation.
--    Used for counting events like content visits, misconception views,
--    pedagogy views, career page visits, etc.
-- =============================================================================

DROP TABLE IF EXISTS `Gamification_badge_events`;

CREATE TABLE `Gamification_badge_events` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` VARCHAR(255) NOT NULL,
    `sub_institute_id` VARCHAR(255) NOT NULL,
    `syear` VARCHAR(50) NOT NULL,
    `event_type` VARCHAR(100) NOT NULL,
    `source_id` VARCHAR(255) NULL,
    `context` JSON NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_badge_event_user_type` (`user_id`, `sub_institute_id`, `syear`, `event_type`),
    KEY `idx_badge_event_source` (`source_id`),
    KEY `idx_badge_event_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed badge definitions (17 badges across 6 categories)

INSERT INTO `Gamification_badges`
    (`badge_code`, `badge_name`, `category`, `description`, `trigger_type`, `trigger_rule`, `icon`, `color`, `sort_order`)
VALUES
-- Mastery (3)
('BADGE_FIRST_MASTERY', 'First Steps to Mastery', 'Mastery', 'Achieve mastery (>= 70%) in any concept for the first time.', 'mastery_first', JSON_OBJECT('min_mastery', 70), 'Target', 'emerald', 1),
('BADGE_PERFECT_MASTERY', 'Perfect Score', 'Mastery', 'Achieve 100% mastery in any concept.', 'mastery_perfect', JSON_OBJECT('min_mastery', 100), 'Star', 'yellow', 2),
('BADGE_QUICK_MASTERY', 'Quick Learner', 'Mastery', 'Reach mastery >= 70% in a concept in 3 or fewer sessions.', 'mastery_quick', JSON_OBJECT('min_mastery', 70, 'max_sessions', 3), 'Zap', 'violet', 3),

-- Fluency (3)
('BADGE_FIRST_FLUENCY', 'First Fluency', 'Fluency', 'Achieve fluency > 0% in any concept for the first time.', 'fluency_first', JSON_OBJECT('min_fluency', 0.01), 'Target', 'sky', 4),
('BADGE_PERFECT_FLUENCY', 'Perfect Fluency', 'Fluency', 'Achieve 100% fluency in any concept.', 'fluency_perfect', JSON_OBJECT('min_fluency', 1.0), 'CheckCircle2', 'green', 5),
('BADGE_FLUENCY_MASTER', 'Fluency Master', 'Fluency', 'Achieve 90%+ fluency in any concept.', 'fluency_high', JSON_OBJECT('min_fluency', 0.9), 'TrendingUp', 'teal', 6),

-- Persistence (3)
('BADGE_FIRST_STEPS', 'First Steps', 'Persistence', 'Complete your first PAL quiz.', 'first_quiz', JSON_OBJECT(), 'Footprints', 'orange', 7),
('BADGE_WEEK_STREAK', 'Week Warrior', 'Persistence', 'Achieve a 7-day learning streak.', 'streak', JSON_OBJECT('min_days', 7), 'Flame', 'red', 8),
('BADGE_MONTH_STREAK', 'Monthly Master', 'Persistence', 'Achieve a 30-day learning streak.', 'streak', JSON_OBJECT('min_days', 30), 'Flame', 'rose', 9),

-- Curiosity (3)
('BADGE_CONTENT_EXPLORER', 'Content Explorer', 'Curiosity', 'Visit 5 unique PAL content items.', 'content_visit', JSON_OBJECT('min_count', 5), 'BookOpen', 'blue', 10),
('BADGE_PRACTICE_PARTICIPANT', 'Practice Enthusiast', 'Curiosity', 'Complete 5 PAL quizzes.', 'quiz_count', JSON_OBJECT('min_count', 5), 'ClipboardList', 'indigo', 11),
('BADGE_MISCONCEPTION_INVESTIGATOR', 'Misconception Sleuth', 'Curiosity', 'Review misconception content 3 times.', 'misconception_view', JSON_OBJECT('min_count', 3), 'CircleHelp', 'purple', 12),

-- Social (2)
('BADGE_PEER_HELPER', 'Peer Helper', 'Social', 'Access misconception remediation or peer help content.', 'remediation_view', JSON_OBJECT('min_count', 1), 'Users', 'cyan', 13),
('BADGE_REFLECTIVE_LEARNER', 'Reflective Learner', 'Social', 'View pedagogy suggestions 5 times.', 'pedagogy_view', JSON_OBJECT('min_count', 5), 'Lightbulb', 'amber', 14),

-- Career (3)
('BADGE_CAREER_EXPLORER', 'Career Explorer', 'Career', 'Visit the career counselling page.', 'career_visit', JSON_OBJECT('min_count', 1), 'Compass', 'teal', 15),
('BADGE_RIASEC_COMPLETE', 'Interest Profiler', 'Career', 'Complete the RIASEC interest profile assessment.', 'riasec_complete', JSON_OBJECT(), 'ClipboardCheck', 'emerald', 16),
('BADGE_PATHWAY_STARTER', 'Pathway Starter', 'Career', 'Master 3 different concepts, building a clear skill pathway.', 'mastery_count', JSON_OBJECT('min_mastered_concepts', 3), 'Route', 'slate', 17);

SET FOREIGN_KEY_CHECKS = 1;
