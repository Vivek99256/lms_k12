import {
  Activity, Boxes, Brain, ChartNoAxesColumn, CircleGauge, Database, FileSearch,
  FolderTree, Gauge, Layers, Library, ListChecks, Network, Notebook, Radio,
  Scale, Settings, Sparkles, Target, TrendingUp, Upload, Users, Workflow,
} from 'lucide-react';
import type { MenuIcon } from '@/app/data/menuItems';

/**
 * The Enterprise Brain navigation, in one place.
 *
 * Sections and screens are the same seven groups and the same screens as
 * hp-enterprise-brain/web/src/shell/viewMeta.ts, re-expressed as the LMS's own
 * three-level menu: Level 1 "Enterprise Brain" → Level 2 section → Level 3
 * screen. That is what lets the existing Sidebar and Level3Subheader drive the
 * Brain with no navigation component of its own.
 */

export const BRAIN_ROOT = '/enterprise-brain';
export const BRAIN_MENU_LABEL = 'Enterprise Brain';

export interface BrainScreenNav {
  /** Key the API knows this screen by (registry key, or a dedicated action). */
  key: string;
  label: string;
  href: string;
  icon: MenuIcon;
  description: string;
}

export interface BrainSectionNav {
  /** Section key the API knows, for /sections/{section}. */
  key: string;
  label: string;
  href: string;
  icon: MenuIcon;
  description: string;
  screens: BrainScreenNav[];
}

export const BRAIN_SECTIONS: BrainSectionNav[] = [
  {
    key: 'overview',
    label: 'Overview',
    href: `${BRAIN_ROOT}`,
    icon: CircleGauge,
    description: 'What this organization contains, and how far its data has travelled through the loop.',
    screens: [
      {
        key: 'overview',
        label: 'Organization',
        href: `${BRAIN_ROOT}`,
        icon: CircleGauge,
        description: 'Organization, foundation counts and the state of the intelligence loop.',
      },
    ],
  },
  {
    key: 'foundation',
    label: 'Foundation',
    href: `${BRAIN_ROOT}/foundation`,
    icon: FolderTree,
    description: 'The organization the Brain reasons about — reused from the LMS, not duplicated.',
    screens: [
      {
        key: 'departments',
        label: 'Departments',
        href: `${BRAIN_ROOT}/foundation/departments`,
        icon: FolderTree,
        description: 'How the organization is structured, and who leads each unit.',
      },
      {
        key: 'people',
        label: 'People',
        href: `${BRAIN_ROOT}/foundation/people`,
        icon: Users,
        description: 'Everyone recorded in this organization, and whose record is incomplete.',
      },
      {
        key: 'capabilities',
        label: 'Capabilities',
        href: `${BRAIN_ROOT}/capabilities`,
        icon: Target,
        description: 'What people need to be able to do, and who is assigned to each.',
      },
      {
        key: 'ingestion',
        label: 'Ingestion',
        href: `${BRAIN_ROOT}/ingestion`,
        icon: Upload,
        description: 'Bring this organization’s LMS data into the Brain.',
      },
    ],
  },
  {
    key: 'intelligence-loop',
    label: 'Intelligence Loop',
    href: `${BRAIN_ROOT}/intelligence-loop`,
    icon: Brain,
    description: 'Signal → evidence → case → recommendation → decision → execution.',
    screens: [
      {
        key: 'signals',
        label: 'Signals',
        href: `${BRAIN_ROOT}/intelligence-loop/signals`,
        icon: Radio,
        description: 'What the data has flagged, and who it concerns.',
      },
      {
        key: 'evidence',
        label: 'Evidence',
        href: `${BRAIN_ROOT}/intelligence-loop/evidence`,
        icon: FileSearch,
        description: 'What supports each signal, and how firmly it is held.',
      },
      {
        key: 'deliberation',
        label: 'Deliberation',
        href: `${BRAIN_ROOT}/intelligence-loop/deliberation`,
        icon: Scale,
        description: 'Open investigations and the decisions waiting on them.',
      },
      {
        key: 'workspace',
        label: 'Intelligence Workspace',
        href: `${BRAIN_ROOT}/intelligence-loop/workspace`,
        icon: Brain,
        description: 'What this organization currently knows about itself.',
      },
      {
        key: 'executions',
        label: 'Execution Center',
        href: `${BRAIN_ROOT}/intelligence-loop/executions`,
        icon: Workflow,
        description: 'What has been done about approved decisions, and the result.',
      },
    ],
  },
  {
    key: 'analytics',
    label: 'Analytics',
    href: `${BRAIN_ROOT}/analytics`,
    icon: ChartNoAxesColumn,
    description: 'How the organization and its decisions are performing.',
    screens: [
      {
        key: 'executive',
        label: 'Executive Dashboard',
        href: `${BRAIN_ROOT}/analytics/executive`,
        icon: Gauge,
        description: 'Organization health at a glance.',
      },
      {
        key: 'decision-analytics',
        label: 'Decision Analytics',
        href: `${BRAIN_ROOT}/analytics/decisions`,
        icon: ChartNoAxesColumn,
        description: 'How decisions are performing over time.',
      },
      {
        key: 'decision-intelligence',
        label: 'Decision Intelligence',
        href: `${BRAIN_ROOT}/analytics/decision-intelligence`,
        icon: TrendingUp,
        description: 'Patterns across decisions, risks and outcomes.',
      },
      {
        key: 'mental-models',
        label: 'Organizational Knowledge',
        href: `${BRAIN_ROOT}/analytics/mental-models`,
        icon: Notebook,
        description: 'The mental models the organization reasons with.',
      },
    ],
  },
  {
    key: 'knowledge',
    label: 'Knowledge',
    href: `${BRAIN_ROOT}/knowledge`,
    icon: Library,
    description: 'What the organization knows, and how it is connected.',
    screens: [
      {
        key: 'graph',
        label: 'Graph Explorer',
        href: `${BRAIN_ROOT}/knowledge/graph`,
        icon: Network,
        description: 'Entities and the relationships between them.',
      },
      {
        key: 'kasba',
        label: 'KASBA Explorer',
        href: `${BRAIN_ROOT}/knowledge/kasba`,
        icon: Layers,
        description: 'Knowledge, ability, skill, behaviour and attitude.',
      },
      {
        key: 'knowledge-library',
        label: 'Knowledge Library',
        href: `${BRAIN_ROOT}/knowledge/library`,
        icon: Library,
        description: 'Reusable knowledge assets.',
      },
      {
        key: 'memory',
        label: 'Memory',
        href: `${BRAIN_ROOT}/knowledge/memory`,
        icon: Database,
        description: 'What the Brain retains between sessions.',
      },
      {
        key: 'ai-assistant',
        label: 'AI Assistant',
        href: `${BRAIN_ROOT}/knowledge/ai-assistant`,
        icon: Sparkles,
        description: 'Context-scoped search, conversation and AI operation history.',
      },
      {
        key: 'eso-library',
        label: 'ESO Library',
        href: `${BRAIN_ROOT}/knowledge/eso-library`,
        icon: Boxes,
        description: 'Executable strategic objectives.',
      },
    ],
  },
  {
    key: 'automation',
    label: 'Automation',
    href: `${BRAIN_ROOT}/automation`,
    icon: Workflow,
    description: 'Who and what acts on the Brain’s decisions.',
    screens: [
      {
        key: 'agents',
        label: 'Agent Monitor',
        href: `${BRAIN_ROOT}/automation/agents`,
        icon: Activity,
        description: 'What the agents are doing, and on whose authority.',
      },
      {
        key: 'tasks',
        label: 'Task Orchestrator',
        href: `${BRAIN_ROOT}/automation/tasks`,
        icon: ListChecks,
        description: 'Scheduled and queued work.',
      },
      {
        key: 'policies',
        label: 'Policy Management',
        href: `${BRAIN_ROOT}/automation/policies`,
        icon: Workflow,
        description: 'The rules execution must respect.',
      },
    ],
  },
  {
    key: 'account',
    label: 'Account / Settings',
    href: `${BRAIN_ROOT}/settings`,
    icon: Settings,
    description: 'Configuration, permissions, keys and audit for this organization.',
    screens: [
      {
        key: 'settings',
        label: 'Settings',
        href: `${BRAIN_ROOT}/settings`,
        icon: Settings,
        description: 'Configuration, permissions, keys and audit for this organization.',
      },
    ],
  },
];

/** Every Brain route that resolves to a page, for active-state matching. */
export const BRAIN_ROUTES: string[] = BRAIN_SECTIONS.flatMap((section) => [
  section.href,
  ...section.screens.map((screen) => screen.href),
]);

export function findBrainSection(pathname: string): BrainSectionNav | null {
  const path = (pathname || '').toLowerCase();
  if (!path.startsWith(BRAIN_ROOT)) return null;

  // Longest match wins, so /enterprise-brain/capabilities picks Foundation
  // rather than Overview, whose href is the bare root.
  let best: BrainSectionNav | null = null;
  let bestLength = -1;

  for (const section of BRAIN_SECTIONS) {
    for (const candidate of [section.href, ...section.screens.map((s) => s.href)]) {
      const href = candidate.toLowerCase();
      if ((path === href || path.startsWith(`${href}/`)) && href.length > bestLength) {
        best = section;
        bestLength = href.length;
      }
    }
  }

  return best;
}

export function findBrainScreen(pathname: string): BrainScreenNav | null {
  const path = (pathname || '').toLowerCase();
  let best: BrainScreenNav | null = null;
  let bestLength = -1;

  for (const section of BRAIN_SECTIONS) {
    for (const screen of section.screens) {
      const href = screen.href.toLowerCase();
      if ((path === href || path.startsWith(`${href}/`)) && href.length > bestLength) {
        best = screen;
        bestLength = href.length;
      }
    }
  }

  return best;
}
