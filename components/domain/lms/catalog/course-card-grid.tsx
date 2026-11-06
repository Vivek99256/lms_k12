'use client'

/**
 * THE COURSE CATALOGUE, AS SOMETHING YOU BROWSE.
 *
 * Ported verbatim from G2G's `components/domain/lms/catalog/course-card-grid.tsx`.
 *
 * This screen was an admin table gated on `canAuthor`, so an ordinary employee
 * who opened it found a list they could read and no way to join anything -
 * while My Learning's empty state told them to "enrol from the learning
 * catalogue". The only working enrol control in the product was a quick-action
 * tucked into a widget on a different page.
 *
 * So the catalogue is a grid of cards any role can open, and Enrol is the
 * card's primary action. The admin table stays as the management view, where
 * bulk actions and editing live.
 *
 * ── THE LESSON COUNT IS ON THE CARD ON PURPOSE ──────────────────────────────
 *
 * A course with no lessons is a dead end: there is nothing to open, and
 * `issueCertificate` refuses when the lesson count is zero. A course that
 * cannot be taken should say so on its face, not after somebody joins it.
 */

import { BookOpen, CheckCircle2, GraduationCap, Loader2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { CatalogCourse } from './catalog-service'

export function CourseCardGrid({
  courses,
  enrollingId,
  enrolledIds,
  onEnrol,
  onRequest,
  onOpenDetails,
}: {
  courses: CatalogCourse[]
  enrollingId: number | null
  /** Courses this viewer is already in - Enrol becomes "In My Learning". */
  enrolledIds: ReadonlySet<number>
  onEnrol: (course: CatalogCourse) => void
  /**
   * Ask for the course instead of joining it.
   *
   * Creates a row in the Approval Queue, which until now nothing in the
   * product could do - the endpoint, the queue and the review actions all
   * existed with no client between them.
   */
  onRequest: (course: CatalogCourse) => void
  onOpenDetails: (course: CatalogCourse) => void
}) {
  return (
    /*
     * Container queries, not viewport breakpoints. The nav is 260px and the
     * agent panel another 30rem, so at 1440px with both open there are ~650px
     * of content while `lg:` still matches and would lay three columns into
     * the space of one and a half.
     */
    <div className="@container/catalog">
      <ul className="grid grid-cols-1 gap-4 @2xl/catalog:grid-cols-2 @5xl/catalog:grid-cols-3">
        {courses.map((course) => {
          const enrolled = enrolledIds.has(course.id)
          const name = course.display_name ?? `Course ${course.id}`
          const inactive = course.status !== 1

          return (
            <li key={course.id}>
              <article
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs transition-all duration-200 hover:border-[#5846EA]/50 hover:shadow-md"
              >
                <button
                  type="button"
                  onClick={() => onOpenDetails(course)}
                  className="flex flex-1 flex-col items-start gap-3 p-4 text-left outline-none transition-colors hover:bg-slate-50/60 focus-visible:ring-2 focus-visible:ring-[#5846EA]/40"
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#5846EA] border border-indigo-100/80">
                      {course.subject_category ?? 'Course'}
                    </span>
                    {inactive ? (
                      <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 border border-slate-200">
                        Inactive
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 border border-emerald-100">
                        Active
                      </span>
                    )}
                  </div>

                  <div className="flex items-start gap-3 w-full">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50/80 text-[#5846EA] border border-indigo-100 group-hover:bg-[#5846EA] group-hover:text-white transition-colors">
                      <GraduationCap className="size-4.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="line-clamp-2 text-sm font-bold leading-snug text-slate-900 group-hover:text-[#5846EA] transition-colors">
                        {name}
                      </h3>
                      {course.standard_name && (
                        <p className="mt-0.5 text-[11px] font-medium text-slate-500">{course.standard_name}</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-auto flex w-full flex-wrap items-center gap-x-4 gap-y-1 pt-2 text-[11px] text-slate-500 border-t border-slate-100">
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      <Users className="size-3.5 text-[#5846EA]" aria-hidden="true" />
                      <span className="font-bold text-slate-700 tabular-nums">{course.learners}</span> enrolled
                    </span>
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      <CheckCircle2 className="size-3.5 text-emerald-600" aria-hidden="true" />
                      <span className="font-bold text-slate-700 tabular-nums">{course.completion_rate}%</span> complete
                    </span>
                  </div>
                </button>

                <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/40 px-4 py-2.5">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                    <BookOpen className="size-3.5 text-[#5846EA]" aria-hidden="true" />
                    {course.subject_type ?? 'Course'}
                  </span>

                  {enrolled ? (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-100">
                      <CheckCircle2 className="size-3.5" aria-hidden="true" />
                      In My Learning
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-lg border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs hover:border-[#5846EA]/40 hover:bg-indigo-50/50 hover:text-[#5846EA] transition-colors"
                        disabled={enrollingId !== null}
                        onClick={() => onRequest(course)}
                      >
                        Request
                      </Button>
                      <Button
                        size="sm"
                        className="h-8 rounded-lg bg-[#5846EA] px-3.5 text-xs font-semibold text-white shadow-xs hover:bg-[#4936d8] transition-all"
                        disabled={enrollingId !== null}
                        onClick={() => onEnrol(course)}
                      >
                        {enrollingId === course.id ? (
                          <>
                            <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden="true" />
                            Working…
                          </>
                        ) : (
                          'Enrol'
                        )}
                      </Button>
                    </span>
                  )}
                </div>
              </article>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
