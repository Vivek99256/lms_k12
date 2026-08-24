export interface VisibilityRuleRow {
    id: number;
    domain: string;
    actor_role: string;
    access_level: string;
    can_view_personal: boolean;
    can_view_aggregate: boolean;
    can_view_milestone: boolean;
    can_view_full: boolean;
    description: string | null;
    is_active: boolean;
}

export interface VisibilityAuditRow {
    id: number;
    actor_user_id: string;
    actor_role: string;
    actor_sub_institute_id: string;
    actor_syear: string;
    target_user_id: string;
    target_sub_institute_id: string;
    target_syear: string;
    domain: string;
    access_level: string;
    granted: boolean;
    reason: string | null;
    ip_address: string | null;
    user_agent: string | null;
    created_at: string;
}

export interface ParentChildLinkRow {
    id: number;
    parent_user_id: string;
    student_user_id: string;
    sub_institute_id: string;
    syear: string;
    relationship_type: string;
    is_active: boolean;
}

export interface VisibilityStore {
    getRule(domain: string, actorRole: string): Promise<VisibilityRuleRow | null>;
    getAllActiveRules(): Promise<VisibilityRuleRow[]>;
    insertAudit(audit: {
        actorUserId: string;
        actorRole: string;
        actorSubInstituteId: string;
        actorSyear: string;
        targetUserId: string;
        targetSubInstituteId: string;
        targetSyear: string;
        domain: string;
        accessLevel: string;
        granted: boolean;
        reason: string | null;
        ipAddress: string | null;
        userAgent: string | null;
    }): Promise<void>;
    getParentChildLinks(parentUserId: string, subInstituteId: string, syear: string): Promise<ParentChildLinkRow[]>;
    getParentChildLink(parentUserId: string, studentUserId: string, subInstituteId: string, syear: string): Promise<ParentChildLinkRow | null>;
    createParentChildLink(link: {
        parentUserId: string;
        studentUserId: string;
        subInstituteId: string;
        syear: string;
        relationshipType: string;
    }): Promise<ParentChildLinkRow>;
    close(): Promise<void>;
}

const FALLBACK_RULES: VisibilityRuleRow[] = [
    { id: 1, domain: 'mastery', actor_role: 'student', access_level: 'full', can_view_personal: true, can_view_aggregate: false, can_view_milestone: false, can_view_full: true, description: 'Student sees own mastery level in full detail.', is_active: true },
    { id: 2, domain: 'mastery', actor_role: 'teacher', access_level: 'full', can_view_personal: true, can_view_aggregate: true, can_view_milestone: false, can_view_full: true, description: 'Teacher sees full mastery data for students they are authorized to view.', is_active: true },
    { id: 3, domain: 'mastery', actor_role: 'parent', access_level: 'summary', can_view_personal: false, can_view_aggregate: false, can_view_milestone: false, can_view_full: false, description: 'Parent sees summary-level mastery for their child.', is_active: true },
    { id: 4, domain: 'mastery', actor_role: 'admin', access_level: 'aggregate', can_view_personal: false, can_view_aggregate: true, can_view_milestone: false, can_view_full: false, description: 'Admin sees aggregate mastery data only.', is_active: true },
    { id: 5, domain: 'badges', actor_role: 'student', access_level: 'full', can_view_personal: true, can_view_aggregate: false, can_view_milestone: false, can_view_full: true, description: 'Student sees own badges in full detail.', is_active: true },
    { id: 6, domain: 'badges', actor_role: 'teacher', access_level: 'full', can_view_personal: true, can_view_aggregate: false, can_view_milestone: false, can_view_full: true, description: 'Teacher sees full badge data for students they are authorized to view.', is_active: true },
    { id: 7, domain: 'badges', actor_role: 'parent', access_level: 'milestone', can_view_personal: false, can_view_aggregate: false, can_view_milestone: true, can_view_full: false, description: 'Parent sees milestone badges for their child.', is_active: true },
    { id: 8, domain: 'badges', actor_role: 'admin', access_level: 'count_only', can_view_personal: false, can_view_aggregate: false, can_view_milestone: false, can_view_full: false, description: 'Admin sees badge count only.', is_active: true },
    { id: 9, domain: 'streak', actor_role: 'student', access_level: 'full', can_view_personal: true, can_view_aggregate: false, can_view_milestone: false, can_view_full: true, description: 'Student sees own streak in full detail.', is_active: true },
    { id: 10, domain: 'streak', actor_role: 'teacher', access_level: 'full', can_view_personal: true, can_view_aggregate: false, can_view_milestone: false, can_view_full: true, description: 'Teacher sees full streak data for students they are authorized to view.', is_active: true },
    { id: 11, domain: 'streak', actor_role: 'parent', access_level: 'current', can_view_personal: false, can_view_aggregate: false, can_view_milestone: false, can_view_full: false, description: 'Parent sees current streak value for their child only.', is_active: true },
    { id: 12, domain: 'streak', actor_role: 'admin', access_level: 'none', can_view_personal: false, can_view_aggregate: false, can_view_milestone: false, can_view_full: false, description: 'Admin has no access to streak data.', is_active: true },
    { id: 13, domain: 'personal_best', actor_role: 'student', access_level: 'full', can_view_personal: true, can_view_aggregate: false, can_view_milestone: false, can_view_full: true, description: 'Student sees own personal bests in full detail.', is_active: true },
    { id: 14, domain: 'personal_best', actor_role: 'teacher', access_level: 'full', can_view_personal: true, can_view_aggregate: false, can_view_milestone: false, can_view_full: true, description: 'Teacher sees full personal best data for students they are authorized to view.', is_active: true },
    { id: 15, domain: 'personal_best', actor_role: 'parent', access_level: 'none', can_view_personal: false, can_view_aggregate: false, can_view_milestone: false, can_view_full: false, description: 'Parent has no access to personal best data.', is_active: true },
    { id: 16, domain: 'personal_best', actor_role: 'admin', access_level: 'none', can_view_personal: false, can_view_aggregate: false, can_view_milestone: false, can_view_full: false, description: 'Admin has no access to personal best data.', is_active: true },
    { id: 17, domain: 'career_quest', actor_role: 'student', access_level: 'full', can_view_personal: true, can_view_aggregate: false, can_view_milestone: false, can_view_full: true, description: 'Student sees own career quest in full detail.', is_active: true },
    { id: 18, domain: 'career_quest', actor_role: 'teacher', access_level: 'full', can_view_personal: true, can_view_aggregate: false, can_view_milestone: false, can_view_full: true, description: 'Teacher sees full career quest data for students they are authorized to view.', is_active: true },
    { id: 19, domain: 'career_quest', actor_role: 'parent', access_level: 'full', can_view_personal: true, can_view_aggregate: false, can_view_milestone: false, can_view_full: true, description: 'Parent sees full career quest data for their child.', is_active: true },
    { id: 20, domain: 'career_quest', actor_role: 'admin', access_level: 'none', can_view_personal: false, can_view_aggregate: false, can_view_milestone: false, can_view_full: false, description: 'Admin has no access to career quest data.', is_active: true },
    { id: 21, domain: 'team_challenge', actor_role: 'student', access_level: 'aggregate', can_view_personal: false, can_view_aggregate: true, can_view_milestone: false, can_view_full: false, description: 'Student sees class aggregate team challenge progress.', is_active: true },
    { id: 22, domain: 'team_challenge', actor_role: 'teacher', access_level: 'per_student', can_view_personal: true, can_view_aggregate: true, can_view_milestone: false, can_view_full: false, description: 'Teacher sees per-student team challenge progress.', is_active: true },
    { id: 23, domain: 'team_challenge', actor_role: 'parent', access_level: 'none', can_view_personal: false, can_view_aggregate: false, can_view_milestone: false, can_view_full: false, description: 'Parent has no access to team challenge data.', is_active: true },
    { id: 24, domain: 'team_challenge', actor_role: 'admin', access_level: 'none', can_view_personal: false, can_view_aggregate: false, can_view_milestone: false, can_view_full: false, description: 'Admin has no access to team challenge data.', is_active: true },
    { id: 25, domain: 'challenge_mode', actor_role: 'student', access_level: 'own_plus_optin_top5', can_view_personal: true, can_view_aggregate: false, can_view_milestone: false, can_view_full: true, description: 'Student sees own challenge mode scores plus top 5 if opted in.', is_active: true },
    { id: 26, domain: 'challenge_mode', actor_role: 'teacher', access_level: 'full', can_view_personal: true, can_view_aggregate: true, can_view_milestone: false, can_view_full: true, description: 'Teacher sees full challenge mode data for students they are authorized to view.', is_active: true },
    { id: 27, domain: 'challenge_mode', actor_role: 'parent', access_level: 'none', can_view_personal: false, can_view_aggregate: false, can_view_milestone: false, can_view_full: false, description: 'Parent has no access to challenge mode data.', is_active: true },
    { id: 28, domain: 'challenge_mode', actor_role: 'admin', access_level: 'none', can_view_personal: false, can_view_aggregate: false, can_view_milestone: false, can_view_full: false, description: 'Admin has no access to challenge mode data.', is_active: true },
    { id: 29, domain: 'notifications', actor_role: 'student', access_level: 'full', can_view_personal: true, can_view_aggregate: false, can_view_milestone: false, can_view_full: true, description: 'Student sees own notifications.', is_active: true },
    { id: 30, domain: 'notifications', actor_role: 'teacher', access_level: 'full', can_view_personal: true, can_view_aggregate: false, can_view_milestone: false, can_view_full: true, description: 'Teacher sees notifications for students they are authorized to view.', is_active: true },
    { id: 31, domain: 'notifications', actor_role: 'parent', access_level: 'milestone', can_view_personal: false, can_view_aggregate: false, can_view_milestone: true, can_view_full: false, description: 'Parent sees milestone notifications for their child.', is_active: true },
    { id: 32, domain: 'notifications', actor_role: 'admin', access_level: 'none', can_view_personal: false, can_view_aggregate: false, can_view_milestone: false, can_view_full: false, description: 'Admin has no access to notification data.', is_active: true },
];

export function createMockVisibilityStore(): VisibilityStore {
    return {
        async getRule(domain, actorRole) {
            return FALLBACK_RULES.find((r) => r.domain === domain && r.actor_role === actorRole && r.is_active) || null;
        },
        async getAllActiveRules() {
            return FALLBACK_RULES.filter((r) => r.is_active);
        },
        async insertAudit() {},
        async getParentChildLinks() {
            return [];
        },
        async getParentChildLink() {
            return null;
        },
        async createParentChildLink() {
            return {
                id: 0,
                parent_user_id: '',
                student_user_id: '',
                sub_institute_id: '',
                syear: '',
                relationship_type: 'parent',
                is_active: true,
            };
        },
        async close() {},
    };
}

let mysqlPromise: Promise<typeof import('mysql2/promise')> | null = null;

async function getMysql() {
    if (!mysqlPromise) {
        mysqlPromise = import('mysql2/promise');
    }
    return mysqlPromise;
}

export function createVisibilityStore(config?: { host: string; port: number; user: string; password: string; database: string }): VisibilityStore {
    const resolvedConfig = config ?? {
        host: process.env.MYSQL_HOST || process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.MYSQL_PORT || process.env.DB_PORT || 3306),
        user: process.env.MYSQL_USER || process.env.DB_USER || 'root',
        password: process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || '',
        database: process.env.MYSQL_DATABASE || process.env.DB_NAME || 'lms_k12',
    };
    let pool: import('mysql2/promise').Pool | null = null;

    function getPool() {
        if (!pool) {
            return getMysql().then((mysql) => {
                pool = mysql.createPool({
                    host: resolvedConfig!.host,
                    port: resolvedConfig!.port,
                    user: resolvedConfig!.user,
                    password: resolvedConfig!.password,
                    database: resolvedConfig!.database,
                    waitForConnections: true,
                    connectionLimit: 5,
                    queueLimit: 0,
                    multipleStatements: false,
                });
                return pool;
            });
        }
        return Promise.resolve(pool);
    }

    async function withConnection<T>(callback: (conn: import('mysql2/promise').Connection) => Promise<T>): Promise<T> {
        const p = await getPool();
        const conn = await p.getConnection();
        try {
            return await callback(conn);
        } finally {
            conn.release();
        }
    }

    return {
        async getRule(domain, actorRole) {
            try {
                return withConnection(async (conn) => {
                    const [rows] = await conn.execute(
                        `SELECT id, domain, actor_role, access_level, can_view_personal, can_view_aggregate, can_view_milestone, can_view_full, description, is_active
                         FROM Gamification_visibility_rules
                         WHERE domain = ? AND actor_role = ? AND is_active = 1
                         LIMIT 1`,
                        [domain, actorRole]
                    );
                    const result = rows as Array<Record<string, unknown>>;
                    if (result.length === 0) return null;
                    const row = result[0];
                        return {
                            id: Number(row.id),
                            domain: String(row.domain),
                            actor_role: String(row.actor_role),
                            access_level: String(row.access_level),
                            can_view_personal: Boolean(row.can_view_personal),
                            can_view_aggregate: Boolean(row.can_view_aggregate),
                            can_view_milestone: Boolean(row.can_view_milestone),
                            can_view_full: Boolean(row.can_view_full),
                            description: row.description != null ? String(row.description) : null,
                            is_active: Boolean(row.is_active),
                        };
                });
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                if (message.includes('does not exist') || message.includes("doesn't exist")) {
                    return FALLBACK_RULES.find((r) => r.domain === domain && r.actor_role === actorRole && r.is_active) || null;
                }
                throw err;
            }
        },

        async getAllActiveRules() {
            try {
                return withConnection(async (conn) => {
                    const [rows] = await conn.execute(
                        `SELECT id, domain, actor_role, access_level, can_view_personal, can_view_aggregate, can_view_milestone, can_view_full, description, is_active
                         FROM Gamification_visibility_rules
                         WHERE is_active = 1
                         ORDER BY domain, actor_role`
                    );
                    return (rows as Array<Record<string, unknown>>).map((row) => ({
                        id: Number(row.id),
                        domain: String(row.domain),
                        actor_role: String(row.actor_role),
                        access_level: String(row.access_level),
                        can_view_personal: Boolean(row.can_view_personal),
                        can_view_aggregate: Boolean(row.can_view_aggregate),
                        can_view_milestone: Boolean(row.can_view_milestone),
                        can_view_full: Boolean(row.can_view_full),
                        description: row.description != null ? String(row.description) : null,
                        is_active: Boolean(row.is_active),
                    }));
                });
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                if (message.includes('does not exist') || message.includes("doesn't exist")) {
                    return FALLBACK_RULES.filter((r) => r.is_active);
                }
                throw err;
            }
        },

        async insertAudit(audit) {
            try {
                await withConnection(async (conn) => {
                    await conn.execute(
                        `INSERT INTO Gamification_visibility_audit
                         (actor_user_id, actor_role, actor_sub_institute_id, actor_syear, target_user_id, target_sub_institute_id, target_syear, domain, access_level, granted, reason, ip_address, user_agent)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            audit.actorUserId,
                            audit.actorRole,
                            audit.actorSubInstituteId,
                            audit.actorSyear,
                            audit.targetUserId,
                            audit.targetSubInstituteId,
                            audit.targetSyear,
                            audit.domain,
                            audit.accessLevel,
                            audit.granted ? 1 : 0,
                            audit.reason,
                            audit.ipAddress,
                            audit.userAgent,
                        ]
                    );
                });
            } catch {
                // ignore audit errors
            }
        },

        async getParentChildLinks(parentUserId, subInstituteId, syear) {
            try {
                return withConnection(async (conn) => {
                    const [rows] = await conn.execute(
                        `SELECT id, parent_user_id, student_user_id, sub_institute_id, syear, relationship_type, is_active
                         FROM Gamification_parent_child_links
                         WHERE parent_user_id = ? AND sub_institute_id = ? AND syear = ? AND is_active = 1`,
                        [parentUserId, subInstituteId, syear]
                    );
                    return (rows as Array<Record<string, unknown>>).map((row) => ({
                        id: Number(row.id),
                        parent_user_id: String(row.parent_user_id),
                        student_user_id: String(row.student_user_id),
                        sub_institute_id: String(row.sub_institute_id),
                        syear: String(row.syear),
                        relationship_type: String(row.relationship_type),
                        is_active: Boolean(row.is_active),
                    }));
                });
            } catch {
                return [];
            }
        },

        async getParentChildLink(parentUserId, studentUserId, subInstituteId, syear) {
            try {
                return withConnection(async (conn) => {
                    const [rows] = await conn.execute(
                        `SELECT id, parent_user_id, student_user_id, sub_institute_id, syear, relationship_type, is_active
                         FROM Gamification_parent_child_links
                         WHERE parent_user_id = ? AND student_user_id = ? AND sub_institute_id = ? AND syear = ? AND is_active = 1
                         LIMIT 1`,
                        [parentUserId, studentUserId, subInstituteId, syear]
                    );
                    const result = rows as Array<Record<string, unknown>>;
                    if (result.length === 0) return null;
                    const row = result[0];
                    return {
                        id: Number(row.id),
                        parent_user_id: String(row.parent_user_id),
                        student_user_id: String(row.student_user_id),
                        sub_institute_id: String(row.sub_institute_id),
                        syear: String(row.syear),
                        relationship_type: String(row.relationship_type),
                        is_active: Boolean(row.is_active),
                    };
                });
            } catch {
                return null;
            }
        },

        async createParentChildLink(link) {
            try {
                return withConnection(async (conn) => {
                    const [result] = await conn.execute(
                        `INSERT INTO Gamification_parent_child_links
                         (parent_user_id, student_user_id, sub_institute_id, syear, relationship_type, is_active)
                         VALUES (?, ?, ?, ?, ?, 1)
                         ON DUPLICATE KEY UPDATE is_active = 1, updated_at = CURRENT_TIMESTAMP`,
                        [link.parentUserId, link.studentUserId, link.subInstituteId, link.syear, link.relationshipType]
                    );
                    const insertId = Number((result as { insertId: number }).insertId);
                    const [rows] = await conn.execute(
                        `SELECT id, parent_user_id, student_user_id, sub_institute_id, syear, relationship_type, is_active
                         FROM Gamification_parent_child_links WHERE id = ?`,
                        [insertId]
                    );
                    const row = (rows as Array<Record<string, unknown>>)[0];
                    return {
                        id: Number(row.id),
                        parent_user_id: String(row.parent_user_id),
                        student_user_id: String(row.student_user_id),
                        sub_institute_id: String(row.sub_institute_id),
                        syear: String(row.syear),
                        relationship_type: String(row.relationship_type),
                        is_active: Boolean(row.is_active),
                    };
                });
            } catch {
                return {
                    id: 0,
                    parent_user_id: link.parentUserId,
                    student_user_id: link.studentUserId,
                    sub_institute_id: link.subInstituteId,
                    syear: link.syear,
                    relationship_type: link.relationshipType,
                    is_active: true,
                };
            }
        },

        async close(): Promise<void> {
            if (pool) {
                await pool.end();
                pool = null;
            }
        },
    };
}

export function createVisibilityStoreFromEnv(): VisibilityStore {
    return createVisibilityStore();
}
