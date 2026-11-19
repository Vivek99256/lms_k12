/**
 * The trail shown in the simulation player's top bar: Standard -> Subject -> Chapter -> Topic, so a learner can see where the simulation they
 * are playing belongs in the curriculum.
 *
 * Nothing here is stored per simulation. The standard, subject and chapter are the ones the page the learner came from is already showing, and the
 * topic comes from the simulation's own links to concepts of that chapter. So every simulation - including one added tomorrow, to a chapter or topic
 * that does not exist today - gets its trail the moment it is linked, with nothing to maintain. A part that is not known is left out, never guessed.
 */
import type { SimulationLink } from './simulation-links'

export type TrailKind = 'standard' | 'subject' | 'chapter' | 'topic'

export interface TrailSegment {
  kind: TrailKind
  label: string
  /** The full text when `label` is shortened (several topics), for a tooltip. */
  title?: string
}

export interface TrailInput {
  /** The standard's name as the page shows it: "9", "10", "CBSE-SR". */
  standard?: string | null
  subject?: string | null
  chapter?: string | null
  /** The chapter the player was opened from. Only links to this chapter name the topic: a link elsewhere says nothing about this trail. */
  chapterId?: number | null
  links?: readonly Pick<SimulationLink, 'chapter_id' | 'topic_name'>[] | null
}

const text = (value: string | null | undefined): string => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '')

/** "9" -> "Class 9"; a name that already says what it is ("CBSE-SR", "Class 9") is kept. */
export function standardLabel(value: string | null | undefined): string {
  const v = text(value)
  if (!v) return ''
  return /^\d+$/.test(v) ? `Class ${v}` : v
}

/** The distinct topic names this simulation is linked to within the chapter, in the order the links came. */
export function topicNamesFor(links: TrailInput['links'], chapterId: number | null | undefined): string[] {
  if (!links || chapterId == null) return []
  const names: string[] = []
  for (const link of links) {
    if (link.chapter_id !== chapterId) continue
    const name = text(link.topic_name)
    if (name && !names.includes(name)) names.push(name)
  }
  return names
}

export function buildSimulationTrail(input: TrailInput): TrailSegment[] {
  const trail: TrailSegment[] = []
  const standard = standardLabel(input.standard)
  const subject = text(input.subject)
  const chapter = text(input.chapter)
  if (standard) trail.push({ kind: 'standard', label: standard })
  if (subject) trail.push({ kind: 'subject', label: subject })
  if (chapter) trail.push({ kind: 'chapter', label: chapter })

  const topics = topicNamesFor(input.links, input.chapterId)
  if (topics.length === 1) trail.push({ kind: 'topic', label: topics[0] })
  else if (topics.length > 1) trail.push({ kind: 'topic', label: `${topics[0]} +${topics.length - 1} more`, title: topics.join(' · ') })
  return trail
}
