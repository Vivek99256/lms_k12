/**
 * Ported verbatim from G2G's `lib/greeting.ts`. lms_k12 had no equivalent
 * helper, so it is copied here rather than invented differently.
 */

export type GreetingPeriod = 'Morning' | 'Afternoon' | 'Evening' | 'Night'

export function getGreetingPeriod(): GreetingPeriod {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return 'Morning'
  if (hour >= 12 && hour < 17) return 'Afternoon'
  if (hour >= 17 && hour < 21) return 'Evening'
  return 'Night'
}

export function getGreeting(name: string): string {
  const period = getGreetingPeriod()
  return `Good ${period}, ${name}! 👋`
}
