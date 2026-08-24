import { createVisibilityStore, type ParentChildLinkRow } from './visibility-store';

export type ActorRole = 'student' | 'teacher' | 'parent' | 'admin';

export type VisibilityDomain =
    | 'mastery'
    | 'badges'
    | 'streak'
    | 'personal_best'
    | 'career_quest'
    | 'team_challenge'
    | 'challenge_mode'
    | 'notifications';

export type AccessLevel = 'full' | 'aggregate' | 'milestone' | 'summary' | 'current' | 'none' | 'count_only' | 'per_student' | 'own_plus_optin_top5' | 'opt_in_only' | 'same_aggregate';

export interface VisibilityContext {
    actorUserId: string;
    actorRole: ActorRole;
    actorSubInstituteId: string;
    actorSyear: string;
    targetUserId: string;
    targetSubInstituteId: string;
    targetSyear: string;
    domain: VisibilityDomain;
}

export interface VisibilityDecision {
    granted: boolean;
    accessLevel: AccessLevel;
    canViewPersonal: boolean;
    canViewAggregate: boolean;
    canViewMilestone: boolean;
    canViewFull: boolean;
    reason: string;
}

export interface VisibilityService {
    checkAccess(ctx: VisibilityContext, ipAddress?: string, userAgent?: string): Promise<VisibilityDecision>;
    isAuthorizedForStudent(actorUserId: string, actorRole: ActorRole, actorSubInstituteId: string, actorSyear: string, targetUserId: string, targetSubInstituteId: string, targetSyear: string): Promise<boolean>;
    getParentChildLinks(parentUserId: string, subInstituteId: string, syear: string): Promise<ParentChildLinkRow[]>;
    getParentChildLink(parentUserId: string, studentUserId: string, subInstituteId: string, syear: string): Promise<ParentChildLinkRow | null>;
    createParentChildLink(parentUserId: string, studentUserId: string, subInstituteId: string, syear: string, relationshipType?: string): Promise<ParentChildLinkRow>;
    close(): Promise<void>;
}

const SELF_DOMAIN_ACCESS: Record<string, Record<ActorRole, AccessLevel>> = {
    mastery: { student: 'full', teacher: 'full', parent: 'summary', admin: 'aggregate' },
    badges: { student: 'full', teacher: 'full', parent: 'milestone', admin: 'count_only' },
    streak: { student: 'full', teacher: 'full', parent: 'current', admin: 'none' },
    personal_best: { student: 'full', teacher: 'full', parent: 'none', admin: 'none' },
    career_quest: { student: 'full', teacher: 'full', parent: 'full', admin: 'none' },
    team_challenge: { student: 'aggregate', teacher: 'per_student', parent: 'none', admin: 'none' },
    challenge_mode: { student: 'own_plus_optin_top5', teacher: 'full', parent: 'none', admin: 'none' },
    notifications: { student: 'full', teacher: 'full', parent: 'milestone', admin: 'none' },
};

export function createMockVisibilityService(): VisibilityService {
    return {
        async checkAccess(ctx) {
            const isSelf = ctx.actorUserId === ctx.targetUserId && ctx.actorSubInstituteId === ctx.targetSubInstituteId && ctx.actorSyear === ctx.targetSyear;
            if (isSelf) {
                if (ctx.actorRole === 'student') {
                    return {
                        granted: true,
                        accessLevel: SELF_DOMAIN_ACCESS[ctx.domain]?.student ?? 'none',
                        canViewPersonal: true,
                        canViewAggregate: false,
                        canViewMilestone: false,
                        canViewFull: true,
                        reason: 'Student accessing own data.',
                    };
                }
                if (ctx.actorRole === 'teacher') {
                    return {
                        granted: true,
                        accessLevel: SELF_DOMAIN_ACCESS[ctx.domain]?.teacher ?? 'none',
                        canViewPersonal: true,
                        canViewAggregate: true,
                        canViewMilestone: false,
                        canViewFull: true,
                        reason: 'Teacher accessing own data.',
                    };
                }
                if (ctx.actorRole === 'parent') {
                    return {
                        granted: true,
                        accessLevel: SELF_DOMAIN_ACCESS[ctx.domain]?.parent ?? 'none',
                        canViewPersonal: true,
                        canViewAggregate: false,
                        canViewMilestone: true,
                        canViewFull: false,
                        reason: 'Parent accessing own profile data.',
                    };
                }
                return {
                    granted: true,
                    accessLevel: SELF_DOMAIN_ACCESS[ctx.domain]?.admin ?? 'none',
                    canViewPersonal: false,
                    canViewAggregate: true,
                    canViewMilestone: false,
                    canViewFull: false,
                    reason: 'Admin accessing own data.',
                };
            }

            if (ctx.actorRole === 'student') {
                return {
                    granted: false,
                    accessLevel: 'none',
                    canViewPersonal: false,
                    canViewAggregate: false,
                    canViewMilestone: false,
                    canViewFull: false,
                    reason: 'Students cannot access other students personal gamification data.',
                };
            }

            if (ctx.actorRole === 'teacher') {
                const sameScope = ctx.actorSubInstituteId === ctx.targetSubInstituteId && ctx.actorSyear === ctx.targetSyear;
                if (!sameScope) {
                    return {
                        granted: false,
                        accessLevel: 'none',
                        canViewPersonal: false,
                        canViewAggregate: false,
                        canViewMilestone: false,
                        canViewFull: false,
                        reason: 'Teacher and target student are not in the same institution/year scope.',
                    };
                }
                const access = SELF_DOMAIN_ACCESS[ctx.domain]?.teacher ?? 'none';
                return {
                    granted: access !== 'none',
                    accessLevel: access,
                    canViewPersonal: true,
                    canViewAggregate: true,
                    canViewMilestone: false,
                    canViewFull: true,
                    reason: `Teacher authorized to view ${ctx.domain} data for student in same scope.`,
                };
            }

            if (ctx.actorRole === 'parent') {
                const sameScope = ctx.actorSubInstituteId === ctx.targetSubInstituteId && ctx.actorSyear === ctx.targetSyear;
                if (!sameScope) {
                    return {
                        granted: false,
                        accessLevel: 'none',
                        canViewPersonal: false,
                        canViewAggregate: false,
                        canViewMilestone: false,
                        canViewFull: false,
                        reason: 'Parent and target student are not in the same institution/year scope.',
                    };
                }
                const access = SELF_DOMAIN_ACCESS[ctx.domain]?.parent ?? 'none';
                return {
                    granted: access !== 'none',
                    accessLevel: access,
                    canViewPersonal: access === 'full',
                    canViewAggregate: false,
                    canViewMilestone: access === 'milestone',
                    canViewFull: access === 'full',
                    reason: `Parent authorized to view ${ctx.domain} data for their child.`,
                };
            }

            if (ctx.actorRole === 'admin') {
                const sameScope = ctx.actorSubInstituteId === ctx.targetSubInstituteId && ctx.actorSyear === ctx.targetSyear;
                if (!sameScope) {
                    return {
                        granted: false,
                        accessLevel: 'none',
                        canViewPersonal: false,
                        canViewAggregate: false,
                        canViewMilestone: false,
                        canViewFull: false,
                        reason: 'Admin and target student are not in the same institution/year scope.',
                    };
                }
                const access = SELF_DOMAIN_ACCESS[ctx.domain]?.admin ?? 'none';
                return {
                    granted: access !== 'none',
                    accessLevel: access,
                    canViewPersonal: false,
                    canViewAggregate: access === 'aggregate',
                    canViewMilestone: false,
                    canViewFull: false,
                    reason: `Admin has ${access} access to ${ctx.domain} data.`,
                };
            }

            return {
                granted: false,
                accessLevel: 'none',
                canViewPersonal: false,
                canViewAggregate: false,
                canViewMilestone: false,
                canViewFull: false,
                reason: 'Unknown actor role.',
            };
        },

        async isAuthorizedForStudent(actorUserId, actorRole, actorSubInstituteId, actorSyear, targetUserId, targetSubInstituteId, targetSyear) {
            const decision = await this.checkAccess({
                actorUserId,
                actorRole,
                actorSubInstituteId,
                actorSyear,
                targetUserId,
                targetSubInstituteId,
                targetSyear,
                domain: 'mastery',
            });
            return decision.granted;
        },

        async getParentChildLinks(_parentUserId: string, _subInstituteId: string, _syear: string) {
            void _parentUserId; void _subInstituteId; void _syear;
            return [];
        },

        async getParentChildLink(_parentUserId: string, _studentUserId: string, _subInstituteId: string, _syear: string) {
            void _parentUserId; void _studentUserId; void _subInstituteId; void _syear;
            return null;
        },

        async createParentChildLink(_parentUserId: string, _studentUserId: string, _subInstituteId: string, _syear: string, _relationshipType = 'parent') {
            void _parentUserId; void _studentUserId; void _subInstituteId; void _syear; void _relationshipType;
            return {
                id: 0,
                parent_user_id: _parentUserId,
                student_user_id: _studentUserId,
                sub_institute_id: _subInstituteId,
                syear: _syear,
                relationship_type: _relationshipType,
                is_active: true,
            };
        },

        async close() {},
    };
}

export function createVisibilityService(store?: ReturnType<typeof createVisibilityStore>): VisibilityService {
    const visibilityStore = store ?? createVisibilityStore();

    return {
        async checkAccess(ctx, ipAddress, userAgent) {
            const isSelf = ctx.actorUserId === ctx.targetUserId && ctx.actorSubInstituteId === ctx.targetSubInstituteId && ctx.actorSyear === ctx.targetSyear;

            let decision: VisibilityDecision;

            if (isSelf) {
                if (ctx.actorRole === 'student') {
                    const access = SELF_DOMAIN_ACCESS[ctx.domain]?.student ?? 'none';
                    decision = {
                        granted: true,
                        accessLevel: access,
                        canViewPersonal: true,
                        canViewAggregate: false,
                        canViewMilestone: false,
                        canViewFull: true,
                        reason: 'Student accessing own data.',
                    };
                } else if (ctx.actorRole === 'teacher') {
                    const access = SELF_DOMAIN_ACCESS[ctx.domain]?.teacher ?? 'none';
                    decision = {
                        granted: true,
                        accessLevel: access,
                        canViewPersonal: true,
                        canViewAggregate: true,
                        canViewMilestone: false,
                        canViewFull: true,
                        reason: 'Teacher accessing own data.',
                    };
                } else if (ctx.actorRole === 'parent') {
                    const access = SELF_DOMAIN_ACCESS[ctx.domain]?.parent ?? 'none';
                    decision = {
                        granted: true,
                        accessLevel: access,
                        canViewPersonal: access === 'full',
                        canViewAggregate: false,
                        canViewMilestone: access === 'milestone',
                        canViewFull: access === 'full',
                        reason: 'Parent accessing own profile data.',
                    };
                } else {
                    const access = SELF_DOMAIN_ACCESS[ctx.domain]?.admin ?? 'none';
                    decision = {
                        granted: true,
                        accessLevel: access,
                        canViewPersonal: false,
                        canViewAggregate: access === 'aggregate',
                        canViewMilestone: false,
                        canViewFull: false,
                        reason: 'Admin accessing own data.',
                    };
                }
            } else if (ctx.actorRole === 'student') {
                decision = {
                    granted: false,
                    accessLevel: 'none',
                    canViewPersonal: false,
                    canViewAggregate: false,
                    canViewMilestone: false,
                    canViewFull: false,
                    reason: 'Students cannot access other students personal gamification data.',
                };
            } else if (ctx.actorRole === 'teacher') {
                const sameScope = ctx.actorSubInstituteId === ctx.targetSubInstituteId && ctx.actorSyear === ctx.targetSyear;
                if (!sameScope) {
                    decision = {
                        granted: false,
                        accessLevel: 'none',
                        canViewPersonal: false,
                        canViewAggregate: false,
                        canViewMilestone: false,
                        canViewFull: false,
                        reason: 'Teacher and target student are not in the same institution/year scope.',
                    };
                } else {
                    const access = SELF_DOMAIN_ACCESS[ctx.domain]?.teacher ?? 'none';
                    decision = {
                        granted: access !== 'none',
                        accessLevel: access,
                        canViewPersonal: true,
                        canViewAggregate: true,
                        canViewMilestone: false,
                        canViewFull: true,
                        reason: `Teacher authorized to view ${ctx.domain} data for student in same scope.`,
                    };
                }
            } else if (ctx.actorRole === 'parent') {
                const sameScope = ctx.actorSubInstituteId === ctx.targetSubInstituteId && ctx.actorSyear === ctx.targetSyear;
                if (!sameScope) {
                    decision = {
                        granted: false,
                        accessLevel: 'none',
                        canViewPersonal: false,
                        canViewAggregate: false,
                        canViewMilestone: false,
                        canViewFull: false,
                        reason: 'Parent and target student are not in the same institution/year scope.',
                    };
                } else {
                    const link = await visibilityStore.getParentChildLink(ctx.actorUserId, ctx.targetUserId, ctx.actorSubInstituteId, ctx.actorSyear);
                    if (!link) {
                        decision = {
                            granted: false,
                            accessLevel: 'none',
                            canViewPersonal: false,
                            canViewAggregate: false,
                            canViewMilestone: false,
                            canViewFull: false,
                            reason: 'Parent is not linked to this student.',
                        };
                    } else {
                        const access = SELF_DOMAIN_ACCESS[ctx.domain]?.parent ?? 'none';
                        decision = {
                            granted: access !== 'none',
                            accessLevel: access,
                            canViewPersonal: access === 'full',
                            canViewAggregate: false,
                            canViewMilestone: access === 'milestone',
                            canViewFull: access === 'full',
                            reason: `Parent authorized to view ${ctx.domain} data for their child.`,
                        };
                    }
                }
            } else if (ctx.actorRole === 'admin') {
                const sameScope = ctx.actorSubInstituteId === ctx.targetSubInstituteId && ctx.actorSyear === ctx.targetSyear;
                if (!sameScope) {
                    decision = {
                        granted: false,
                        accessLevel: 'none',
                        canViewPersonal: false,
                        canViewAggregate: false,
                        canViewMilestone: false,
                        canViewFull: false,
                        reason: 'Admin and target student are not in the same institution/year scope.',
                    };
                } else {
                    const access = SELF_DOMAIN_ACCESS[ctx.domain]?.admin ?? 'none';
                    decision = {
                        granted: access !== 'none',
                        accessLevel: access,
                        canViewPersonal: false,
                        canViewAggregate: access === 'aggregate',
                        canViewMilestone: false,
                        canViewFull: false,
                        reason: `Admin has ${access} access to ${ctx.domain} data.`,
                    };
                }
            } else {
                decision = {
                    granted: false,
                    accessLevel: 'none',
                    canViewPersonal: false,
                    canViewAggregate: false,
                    canViewMilestone: false,
                    canViewFull: false,
                    reason: 'Unknown actor role.',
                };
            }

            try {
                await visibilityStore.insertAudit({
                    actorUserId: ctx.actorUserId,
                    actorRole: ctx.actorRole,
                    actorSubInstituteId: ctx.actorSubInstituteId,
                    actorSyear: ctx.actorSyear,
                    targetUserId: ctx.targetUserId,
                    targetSubInstituteId: ctx.targetSubInstituteId,
                    targetSyear: ctx.targetSyear,
                    domain: ctx.domain,
                    accessLevel: decision.accessLevel,
                    granted: decision.granted,
                    reason: decision.reason,
                    ipAddress: ipAddress ?? null,
                    userAgent: userAgent ?? null,
                });
            } catch {
                // ignore audit failures
            }

            return decision;
        },

        async isAuthorizedForStudent(actorUserId, actorRole, actorSubInstituteId, actorSyear, targetUserId, targetSubInstituteId, targetSyear) {
            const decision = await this.checkAccess({
                actorUserId,
                actorRole,
                actorSubInstituteId,
                actorSyear,
                targetUserId,
                targetSubInstituteId,
                targetSyear,
                domain: 'mastery',
            });
            return decision.granted;
        },

        async getParentChildLinks(parentUserId, subInstituteId, syear) {
            return visibilityStore.getParentChildLinks(parentUserId, subInstituteId, syear);
        },

        async getParentChildLink(parentUserId, studentUserId, subInstituteId, syear) {
            return visibilityStore.getParentChildLink(parentUserId, studentUserId, subInstituteId, syear);
        },

        async createParentChildLink(parentUserId, studentUserId, subInstituteId, syear, relationshipType = 'parent') {
            return visibilityStore.createParentChildLink({
                parentUserId,
                studentUserId,
                subInstituteId,
                syear,
                relationshipType,
            });
        },

        async close() {
            await visibilityStore.close();
        },
    };
}

export function createVisibilityServiceFromEnv(): VisibilityService {
    return createVisibilityService();
}
