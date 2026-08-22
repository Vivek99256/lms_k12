'use client'

/**
 * Attendance Regularization / punch-correction requests.
 *
 * BACKEND GAP: unlike attendance-api.ts and leave-api.ts (both ported 1:1
 * from an existing Laravel HRMS integration), there is no
 * `/api/attendance/regulariz*` endpoint anywhere in that integration to port
 * from - see the header comment in attendance-api.ts. This module is written
 * to the same request/response shape as the rest of `_lib` so that once a
 * real endpoint ships, `submitRegularization` / `fetchRegularizationRequests`
 * below are the only functions that need to change (swap the in-memory store
 * for `apiPost`/`apiGet` calls via `buildSessionContext()`, matching the
 * pattern in attendance-api.ts).
 *
 * Until then, requests live in a module-level in-memory store: real for the
 * current browser session (submit, list, cancel all work), but not persisted
 * and not shared across users/devices/reloads.
 */

export type RegularizationReasonCode =
  | 'missing-punch-in'
  | 'missing-punch-out'
  | 'early-exit'
  | 'wrong-time'
  | 'other'

export type RegularizationStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

export interface RegularizationRequest {
  id: string
  date: string
  reasonCode: RegularizationReasonCode
  requestedPunchIn?: string
  requestedPunchOut?: string
  comment: string
  status: RegularizationStatus
  submittedDate: string
}

export interface RegularizationApplyPayload {
  date: string
  reasonCode: RegularizationReasonCode
  requestedPunchIn?: string
  requestedPunchOut?: string
  comment: string
}

export const reasonLabels: Record<RegularizationReasonCode, string> = {
  'missing-punch-in': 'Missing Punch-In',
  'missing-punch-out': 'Missing Punch-Out',
  'early-exit': 'Early Exit',
  'wrong-time': 'Wrong Punch Time',
  other: 'Other',
}

export const reasonOptions = (Object.keys(reasonLabels) as RegularizationReasonCode[]).map((value) => ({
  value,
  label: reasonLabels[value],
}))

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Seed data mirrors the mock alerts already shown on the Attendance Tracking
 * dashboard (Missing Punch-Out Jun 18, Regularization Pending, Early Exit Jun
 * 20) so navigating in from an alert lands on a list that already contains
 * the record the alert was about, instead of an empty one.
 */
let store: RegularizationRequest[] = [
  {
    id: 'reg-seed-1',
    date: '2026-06-18',
    reasonCode: 'missing-punch-out',
    requestedPunchIn: undefined,
    requestedPunchOut: '06:15 PM',
    comment: 'Forgot to punch out before leaving for a client visit.',
    status: 'pending',
    submittedDate: '2026-06-19',
  },
  {
    id: 'reg-seed-2',
    date: '2026-06-20',
    reasonCode: 'early-exit',
    requestedPunchIn: undefined,
    requestedPunchOut: '05:45 PM',
    comment: 'Left early for a medical appointment; manager informed in advance.',
    status: 'pending',
    submittedDate: '2026-06-20',
  },
]

let listeners: Array<() => void> = []

function notify() {
  listeners.forEach((listener) => listener())
}

export function subscribeRegularizationStore(listener: () => void) {
  listeners.push(listener)
  return () => {
    listeners = listeners.filter((entry) => entry !== listener)
  }
}

export function getRegularizationRequests(): RegularizationRequest[] {
  return store
}

export async function submitRegularization(
  payload: RegularizationApplyPayload,
): Promise<{ ok: boolean; message: string }> {
  if (!payload.date || !payload.reasonCode || payload.comment.trim().length < 3) {
    return { ok: false, message: 'Please fill in date, reason and a short comment before submitting.' }
  }

  const request: RegularizationRequest = {
    id: `reg-${Date.now()}`,
    date: payload.date,
    reasonCode: payload.reasonCode,
    requestedPunchIn: payload.requestedPunchIn,
    requestedPunchOut: payload.requestedPunchOut,
    comment: payload.comment.trim(),
    status: 'pending',
    submittedDate: todayIso(),
  }

  store = [request, ...store]
  notify()

  return { ok: true, message: 'Regularization request submitted for approval.' }
}

export async function cancelRegularization(id: string): Promise<{ ok: boolean; message: string }> {
  const target = store.find((request) => request.id === id)
  if (!target || target.status !== 'pending') {
    return { ok: false, message: 'Only pending requests can be cancelled.' }
  }

  store = store.map((request) => (request.id === id ? { ...request, status: 'cancelled' } : request))
  notify()

  return { ok: true, message: 'Regularization request cancelled.' }
}
