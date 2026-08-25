'use client'

/**
 * Ported from G2G's `hooks/use-employee-profile.ts` — only the
 * `useCompetencyEmployeeProfile` export. That file's `useEmployeeProfile`
 * export is an unrelated HRMS "my profile" hook (built on
 * `@/components/auth/gtg-auth`'s `useAuth` and `@/services/hrms`) that has
 * no equivalent screen in this port and was intentionally left out.
 *
 * Adaptation: G2G resolved the caller's identity via `useAuth()` from
 * `@/hooks/use-auth` and built a `LaravelContext` from the logged-in user.
 * This repo has no such hook — `buildSessionContext()` (see
 * `employee-profiles-api.ts` / `lib/erp-client.ts`) already reads the
 * session (including `userId`) straight out of storage, so `resolveContext`
 * here calls it directly instead of depending on a user object. Everything
 * else — the `loadData` merge of profile/notes/certs/plans/evidence/career,
 * the returned shape, and every request's field names — is unchanged.
 */

import { useCallback, useEffect, useState } from 'react'
import {
  buildSessionContext,
  employeeProfileService,
  type AvailableSkill,
  type CareerPathData,
  type EmployeeCertification,
  type EmployeeDevelopmentPlan,
  type EmployeeEvidence,
  type EmployeeProfileData,
  type SessionContext,
  type SkillHistoryData,
} from './employee-profiles-api'

function toMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

function useLaravelContext() {
  return useCallback((): SessionContext => buildSessionContext(), [])
}

export function useCompetencyEmployeeProfile(userId: string | null) {
  const resolveContext = useLaravelContext()

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<EmployeeProfileData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [availableSkills, setAvailableSkills] = useState<AvailableSkill[]>([])
  const [availableSkillsLoading, setAvailableSkillsLoading] = useState(false)

  const [skillHistory, setSkillHistory] = useState<SkillHistoryData | null>(null)
  const [skillHistoryLoading, setSkillHistoryLoading] = useState(false)

  const [notes, setNotes] = useState('')
  const [notesLoading, setNotesLoading] = useState(false)

  const [certifications, setCertifications] = useState<EmployeeCertification[]>([])
  const [developmentPlans, setDevelopmentPlans] = useState<EmployeeDevelopmentPlan[]>([])
  const [evidence, setEvidence] = useState<EmployeeEvidence[]>([])
  const [careerPath, setCareerPath] = useState<CareerPathData | null>(null)

  const [saving, setSaving] = useState(false)

  const loadData = useCallback(async () => {
    if (!userId) return

    setLoading(true)
    setError(null)

    setNotesLoading(true)
    try {
      const [profileRes, notesRes, certsRes, plansRes, evidenceRes, careerRes] = await Promise.all([
        employeeProfileService.getEmployeeProfile(resolveContext(), userId),
        employeeProfileService.getNotes(resolveContext(), userId).catch(() => null),
        employeeProfileService.getCertifications(resolveContext(), userId).catch(() => null),
        employeeProfileService.getDevelopmentPlans(resolveContext(), userId).catch(() => null),
        employeeProfileService.getEvidence(resolveContext(), userId).catch(() => null),
        employeeProfileService.getCareerPath(resolveContext(), userId).catch(() => null),
      ])
      setData(profileRes.data)
      setNotes(notesRes?.data?.note ?? '')
      setCertifications(certsRes?.data ?? [])
      setDevelopmentPlans(plansRes?.data ?? [])
      setEvidence(evidenceRes?.data ?? [])
      setCareerPath(careerRes?.data ?? null)
    } catch (err) {
      setError(toMessage(err, 'Failed to load employee profile.'))
    } finally {
      setLoading(false)
      setNotesLoading(false)
    }
  }, [resolveContext, userId])

  useEffect(() => {
    queueMicrotask(() => {
      loadData()
    })
  }, [loadData])

  const loadAvailableSkills = useCallback(async () => {
    if (!userId) return
    setAvailableSkillsLoading(true)
    try {
      const res = await employeeProfileService.getAvailableSkills(resolveContext(), userId)
      setAvailableSkills(res.data)
    } catch {
      setAvailableSkills([])
    } finally {
      setAvailableSkillsLoading(false)
    }
  }, [resolveContext, userId])

  const addSkill = useCallback(async (skillId: number, skillLevel: number) => {
    if (!userId) return { ok: false, message: 'No user' }
    setSaving(true)
    try {
      await employeeProfileService.addSkill(resolveContext(), userId, { skill_id: skillId, skill_level: skillLevel })
      await loadData()
      return { ok: true }
    } catch (err) {
      return { ok: false, message: toMessage(err, 'Failed to add competency.') }
    } finally {
      setSaving(false)
    }
  }, [resolveContext, userId, loadData])

  const updateSkill = useCallback(async (matrixId: number, skillLevel: number) => {
    if (!userId) return { ok: false, message: 'No user' }
    setSaving(true)
    try {
      await employeeProfileService.updateSkill(resolveContext(), userId, matrixId, { skill_level: skillLevel })
      await loadData()
      return { ok: true }
    } catch (err) {
      return { ok: false, message: toMessage(err, 'Failed to update rating.') }
    } finally {
      setSaving(false)
    }
  }, [resolveContext, userId, loadData])

  const loadSkillHistory = useCallback(async (skillId: number) => {
    if (!userId) return
    setSkillHistoryLoading(true)
    try {
      const res = await employeeProfileService.getSkillHistory(resolveContext(), userId, skillId)
      setSkillHistory(res.data)
    } catch {
      setSkillHistory(null)
    } finally {
      setSkillHistoryLoading(false)
    }
  }, [resolveContext, userId])

  const addEvidence = useCallback(async (payload: { title: string; evidence_type?: string; description?: string; link?: string; competency_id?: number; status?: string }) => {
    if (!userId) return { ok: false, message: 'No user' }
    setSaving(true)
    try {
      await employeeProfileService.addEvidence(resolveContext(), userId, payload)
      await loadData()
      return { ok: true, message: 'Evidence added.' }
    } catch (err) {
      return { ok: false, message: toMessage(err, 'Failed to add evidence.') }
    } finally {
      setSaving(false)
    }
  }, [resolveContext, userId, loadData])

  const removeEvidence = useCallback(async (evidenceId: number) => {
    if (!userId) return { ok: false, message: 'No user' }
    setSaving(true)
    try {
      await employeeProfileService.deleteEvidence(resolveContext(), userId, evidenceId)
      await loadData()
      return { ok: true, message: 'Evidence removed.' }
    } catch (err) {
      return { ok: false, message: toMessage(err, 'Failed to remove evidence.') }
    } finally {
      setSaving(false)
    }
  }, [resolveContext, userId, loadData])

  const saveNotes = useCallback(async (note: string) => {
    if (!userId) return { ok: false, message: 'No user' }
    setSaving(true)
    try {
      await employeeProfileService.saveNotes(resolveContext(), userId, note)
      setNotes(note)
      return { ok: true, message: 'Notes saved.' }
    } catch (err) {
      return { ok: false, message: toMessage(err, 'Failed to save notes.') }
    } finally {
      setSaving(false)
    }
  }, [resolveContext, userId])

  const requestReassessment = useCallback(async (payload: { title: string; jobrole?: string; due_date?: string }) => {
    if (!userId) return { ok: false, message: 'No user' }
    setSaving(true)
    try {
      await employeeProfileService.requestReassessment(resolveContext(), { ...payload, user_id: userId })
      return { ok: true, message: 'Re-assessment requested.' }
    } catch (err) {
      return { ok: false, message: toMessage(err, 'Failed to request re-assessment.') }
    } finally {
      setSaving(false)
    }
  }, [resolveContext, userId])

  const assignDevelopmentPlan = useCallback(async (payload: { title: string; jobrole?: string; competency_id?: number; due_date?: string }) => {
    if (!userId) return { ok: false, message: 'No user' }
    setSaving(true)
    try {
      await employeeProfileService.assignDevelopmentPlan(resolveContext(), { ...payload, user_id: userId })
      await loadData()
      return { ok: true, message: 'Development plan assigned.' }
    } catch (err) {
      return { ok: false, message: toMessage(err, 'Failed to assign development plan.') }
    } finally {
      setSaving(false)
    }
  }, [resolveContext, userId, loadData])

  const addCertification = useCallback(async (payload: { name: string; jobrole?: string; issuing_body?: string; issued_date?: string; expiry_date?: string }) => {
    if (!userId) return { ok: false, message: 'No user' }
    setSaving(true)
    try {
      await employeeProfileService.addCertification(resolveContext(), { ...payload, user_id: userId })
      await loadData()
      return { ok: true, message: 'Certification added.' }
    } catch (err) {
      return { ok: false, message: toMessage(err, 'Failed to add certification.') }
    } finally {
      setSaving(false)
    }
  }, [resolveContext, userId, loadData])

  return {
    loading,
    data,
    error,
    retry: loadData,
    // Available skills for Add Competency
    availableSkills,
    availableSkillsLoading,
    loadAvailableSkills,
    // Add / Update
    addSkill,
    updateSkill,
    saving,
    // History
    skillHistory,
    skillHistoryLoading,
    loadSkillHistory,
    clearSkillHistory: () => setSkillHistory(null),
    // Notes + quick actions
    notes,
    notesLoading,
    saveNotes,
    requestReassessment,
    assignDevelopmentPlan,
    addCertification,
    // Employee-scoped lists
    certifications,
    developmentPlans,
    evidence,
    careerPath,
    addEvidence,
    removeEvidence,
  }
}
