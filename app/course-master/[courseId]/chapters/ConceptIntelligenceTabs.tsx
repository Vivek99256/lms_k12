// Moved to components/intelligence/ConceptIntelligenceTabs.tsx so that
// Teach/Learn -> Curriculum can render the same intelligence tabs without
// reaching across into a course-master route folder.
//
// Re-exported from here so course-master's own import keeps working unchanged.
export { ConceptIntelligenceTabs } from '@/components/intelligence/ConceptIntelligenceTabs';
