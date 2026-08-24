import { NextRequest, NextResponse } from 'next/server';
import { getDbConfig } from '@/app/pal/data/pal-pb-store-config';
import { createPalPbStore } from '@/app/pal/data/pal-pb-store';
import { createPalSsStore } from '@/app/pal/data/ss-store';
import { createPalCqStore } from '@/app/pal/data/cq-store';
import {
  computeFluency,
  computeMasteryPBs,
  computeSessionPBs,
  computeStreak,
  type PbEventInput,
  type PbFluencyEvent,
  type PbProcessResult,
} from '@/app/pal/data/pal-pb';

export const runtime = 'nodejs';

async function requireSession(request: NextRequest): Promise<{ userId: string; subInstituteId: string; syear: string; body: PbEventInput }> {
    const cookie = request.headers.get('cookie');
    const authorization = request.headers.get('authorization');

    if (!cookie && !authorization) {
        throw new Error('Unauthorized');
    }

    let body: PbEventInput;
    try {
        body = (await request.json()) as PbEventInput;
    } catch {
        throw new Error('Invalid JSON body');
    }

    const userId = String(body.userId || '').trim();
    const subInstituteId = String(body.subInstituteId || '').trim();
    const syear = String(body.syear || '').trim();

    if (!userId || !subInstituteId || !syear) {
        throw new Error('Missing user context');
    }

    return { userId, subInstituteId, syear, body };
}

function badRequest(message: string) {
  return NextResponse.json({ status: '0', message }, { status: 400 });
}

function ok(payload: PbProcessResult) {
  return NextResponse.json({ status: '1', data: payload });
}

export async function POST(request: NextRequest) {
    try {
        const session = await requireSession(request);
        const userId = session.userId;
        const subInstituteId = session.subInstituteId;
        const syear = session.syear;
        const body = session.body;

        if (!body.result || !body.mastery) {
            return badRequest('Missing result or mastery data.');
        }

    const store = createPalPbStore(getDbConfig());

    const alreadyProcessed = await store.getProcessedEvent(
      userId,
      subInstituteId,
      syear,
      body.questionPaperId
    );
    if (alreadyProcessed) {
      return ok({ processed: false, fluencyEvents: [], streakEvent: null, masteryEvents: [], sessionEvents: [], notifications: [] });
    }

    const result: PbProcessResult = {
      processed: true,
      fluencyEvents: [],
      streakEvent: null,
      masteryEvents: [],
      sessionEvents: [],
      notifications: [],
    };

    const fluencyMap = computeFluency(body.result.questions);
    const existingFluency = new Map<string, { previousBest: number }>();
    for (const [conceptName] of fluencyMap) {
      const rec = await store.getFluencyRecord(userId, subInstituteId, syear, conceptName);
      if (rec) existingFluency.set(conceptName, { previousBest: rec.previousBest });
    }

    for (const [conceptName, input] of fluencyMap) {
      const prev = existingFluency.get(conceptName)?.previousBest ?? 0;
      if (input.fluency > prev) {
        const absoluteImprovement = Math.round((input.fluency - prev) * 100) / 100;
        const improvementPercentage = prev > 0 ? Math.round(((input.fluency - prev) / prev) * 10000) / 100 : 100;
        const event: PbFluencyEvent & { idempotencyKey: string } = {
          type: 'fluency_pb',
          userId,
          subInstituteId,
          syear,
          conceptId: input.conceptId,
          conceptName: input.conceptName,
          previousBest: prev,
          newBest: input.fluency,
          absoluteImprovement,
          improvementPercentage,
          achievedAt: input.achievedAt,
          idempotencyKey: `${userId}:${subInstituteId}:${syear}:${input.conceptId}:${body.questionPaperId}`,
        };
        await store.upsertFluencyRecord(event);
        result.fluencyEvents.push(event);
      }
    }

    const streakRec = await store.getStreakRecord(userId, subInstituteId, syear);
    const streakEvent = computeStreak(
      new Date().toISOString(),
      streakRec?.currentStreak ?? 0,
      streakRec?.longestStreak ?? 0,
      streakRec?.lastActivityDate
    );
    if (streakEvent) {
      streakEvent.userId = userId;
      streakEvent.subInstituteId = subInstituteId;
      streakEvent.syear = syear;
      await store.upsertStreakRecord(streakEvent);
      result.streakEvent = streakEvent;
    }

    const existingMastery = new Map<string, { masteryResult: number; fastestMastery?: number; masterySessionCount?: number }>();
    for (const concept of body.mastery) {
      const rec = await store.getMasteryRecord(userId, subInstituteId, syear, concept.conceptName);
      if (rec) existingMastery.set(concept.conceptName, rec);
    }

    const masteryEvents = computeMasteryPBs(body.mastery, existingMastery);
    for (const me of masteryEvents) {
      me.userId = userId;
      me.subInstituteId = subInstituteId;
      me.syear = syear;
      await store.upsertMasteryRecord(me);
    }
    result.masteryEvents = masteryEvents;

    const sessionStart = body.sessionStart || new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const sessionEnd = body.sessionEnd || new Date().toISOString();
    const conceptsCovered = Array.from(new Set([body.questionPaperId, ...body.result.questions.map((q) => q.conceptName).filter(Boolean)]));

    const sessionTypes = ['longest_productive_session', 'most_concepts_in_one_day', 'best_single_session_mastery_gain'] as const;
    const existingSessions = new Map<string, { previousValue: number }>();
    for (const rt of sessionTypes) {
      const rec = await store.getSessionRecord(userId, subInstituteId, syear, rt);
      if (rec) existingSessions.set(rt, { previousValue: rec.previousValue });
    }

    const sessionEvents = computeSessionPBs(sessionStart, sessionEnd, conceptsCovered, existingSessions);
    for (const se of sessionEvents) {
      se.userId = userId;
      se.subInstituteId = subInstituteId;
      se.syear = syear;
      await store.insertSessionRecord(se);
    }
    result.sessionEvents = sessionEvents;

    const notifications = [];
    for (const fe of result.fluencyEvents) {
      const improvement = Math.round((fe.newBest - fe.previousBest) * 100) / 100;
      notifications.push({
        notificationType: 'fluency_pb' as const,
        userId: fe.userId,
        subInstituteId: fe.subInstituteId,
        syear: fe.syear,
        title: 'New Fluency Personal Best!',
        message: `You achieved ${(fe.newBest * 100).toFixed(0)}% fluency in ${fe.conceptName}, up from ${(fe.previousBest * 100).toFixed(0)}%.`,
        relatedConcept: fe.conceptName,
        previousValue: fe.previousBest,
        newValue: fe.newBest,
        improvement,
      });
    }
    if (result.streakEvent) {
      const se = result.streakEvent;
      notifications.push({
        notificationType: 'streak_pb' as const,
        userId: se.userId,
        subInstituteId: se.subInstituteId,
        syear: se.syear,
        title: 'New Streak Personal Best!',
        message: `You reached a ${se.newLongest}-day learning streak!`,
        previousValue: se.previousLongest,
        newValue: se.newLongest,
        improvement: se.newLongest - se.previousLongest,
      });
    }
    for (const me of result.masteryEvents) {
      const improvement = Math.round((me.newResult - me.previousResult) * 100) / 100;
      notifications.push({
        notificationType: 'mastery_pb' as const,
        userId: me.userId,
        subInstituteId: me.subInstituteId,
        syear: me.syear,
        title: 'New Mastery Personal Best!',
        message: `You improved mastery in ${me.concept} to ${me.newResult}%.`,
        relatedConcept: me.concept,
        previousValue: me.previousResult,
        newValue: me.newResult,
        improvement,
      });
    }
    for (const se of result.sessionEvents) {
      const improvement = Math.round((se.newValue - se.previousValue) * 100) / 100;
      const label = se.recordType.replace(/_/g, ' ');
      notifications.push({
        notificationType: 'session_pb' as const,
        userId: se.userId,
        subInstituteId: se.subInstituteId,
        syear: se.syear,
        title: 'New Session Personal Best!',
        message: `You set a new best for ${label}: ${se.newValue}.`,
        previousValue: se.previousValue,
        newValue: se.newValue,
        improvement,
      });
    }

    for (const n of notifications) {
      await store.insertNotification(n);
    }
    result.notifications = notifications;

    await store.markEventProcessed(userId, subInstituteId, syear, body.questionPaperId);

    try {
      const ssStore = createPalSsStore();
      const cqStore = createPalCqStore();
      const summaryRow = await ssStore.insertSummary({
        sessionId: body.questionPaperId,
        userId,
        subInstituteId,
        syear,
        sessionStart: sessionStart ? sessionStart.slice(0, 19).replace('T', ' ') : null,
        sessionEnd: sessionEnd ? sessionEnd.slice(0, 19).replace('T', ' ') : null,
        completionState: 'completed',
        totalConcepts: body.mastery.length,
        totalQuestions: body.result.questions.length,
        obtainMarks: body.result.obtainMarks,
        totalMarks: body.result.totalMarks,
        accuracy: body.result.totalMarks > 0 ? Math.round((body.result.obtainMarks / body.result.totalMarks) * 100) : 0,
      });

      const conceptAccuracy = new Map<string, { attempted: number; correct: number }>();
      for (const q of body.result.questions) {
        const name = q.conceptName || 'General Concept';
        const prev = conceptAccuracy.get(name) ?? { attempted: 0, correct: 0 };
        if (q.rightWrong === 'right') prev.correct += 1;
        if (q.rightWrong === 'right' || q.rightWrong === 'wrong') prev.attempted += 1;
        conceptAccuracy.set(name, prev);
      }

      const praiseRows: { praiseText: string; reason: string; sourceType: string; conceptName: string | null; sortOrder: number }[] = [];
      const upcomingRows: { conceptId: string | null; conceptName: string; reason: string | null; expectedTiming: string | null; sortOrder: number }[] = [];

      for (let i = 0; i < body.mastery.length; i++) {
        const concept = body.mastery[i];
        const acc = conceptAccuracy.get(concept.conceptName) ?? { attempted: 0, correct: 0 };
        const accuracy = acc.attempted > 0 ? Math.round((acc.correct / acc.attempted) * 100) : 0;
        const masteryBefore = existingMastery.get(concept.conceptName)?.masteryResult ?? 0;
        const masteryAfter = concept.masteryLevel;
        const masteryChange = Math.round((masteryAfter - masteryBefore) * 100) / 100;

        await ssStore.insertConcept(summaryRow.id, {
          conceptId: concept.conceptName,
          conceptName: concept.conceptName,
          masteryBefore,
          masteryAfter,
          masteryChange,
          accuracy,
          attempted: acc.attempted,
          correct: acc.correct,
          sortOrder: i,
        });

        if (masteryChange > 0) {
          praiseRows.push({
            praiseText: `You improved your mastery of ${concept.conceptName} from ${Math.round(masteryBefore)}% to ${Math.round(masteryAfter)}%.`,
            reason: `Mastery increased by ${Math.round(masteryChange)} percentage points.`,
            sourceType: 'mastery_improvement',
            conceptName: concept.conceptName,
            sortOrder: praiseRows.length,
          });
        }
        if (accuracy >= 80) {
          praiseRows.push({
            praiseText: `You got ${accuracy}% accuracy in ${concept.conceptName}.`,
            reason: `${acc.correct} out of ${acc.attempted} answers correct.`,
            sourceType: 'accuracy',
            conceptName: concept.conceptName,
            sortOrder: praiseRows.length,
          });
        }
      }

      for (const praise of praiseRows) {
        await ssStore.insertPraise(summaryRow.id, praise);
      }

      for (const upcoming of upcomingRows) {
        await ssStore.insertUpcoming(summaryRow.id, upcoming);
      }

      await ssStore.close();
      await cqStore.close();
    } catch {
      // do not fail PB processing if session summary creation fails
    }

    return ok(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Personal Best processing failed.';
    const status = message === 'Unauthorized' || message === 'Missing user context' ? 401 : 500;
    return NextResponse.json({ status: '0', message }, { status });
  }
}
