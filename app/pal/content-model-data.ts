import { BookOpen, Briefcase, CircleDollarSign, GitBranch, HeartHandshake, Music2, Rocket, Trophy } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface PalSubmoduleItem {
  slug: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  accent: string;
  bullets: string[];
  coverage: string;
  implementation: string;
  gap: string;
}

export interface PalParentModule {
  slug: 'framework' | 'ulu';
  title: 'Framework' | 'ULU';
  subtitle: string;
  icon: LucideIcon;
  accent: string;
  bullets: string[];
  href: string;
}

export const palParentModules: PalParentModule[] = [
  {
    slug: 'framework',
    title: 'Framework',
    subtitle: 'Standards, pedagogy systems, and pathway models that shape how New PAL delivers learning.',
    icon: Briefcase,
    accent: 'bg-blue-50 text-blue-700 border-blue-200',
    bullets: ['CASEL', 'NGSS', 'NCDG', 'Pedagogy', 'Music', 'Sports', 'Finance'],
    href: '/pal/frameworks',
  },
  {
    slug: 'ulu',
    title: 'ULU',
    subtitle: 'Unified Learning Units that combine academic, SEL, STEM, career, and real-world skill layers in one experience.',
    icon: GitBranch,
    accent: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    bullets: ['5 layers', 'Scenario design', 'Examples', 'Optimization loop'],
    href: '/pal/ulu',
  },
];

export const frameworkModules: PalSubmoduleItem[] = [
  {
    slug: 'casel-sel-integration',
    title: 'CASEL / SEL Integration',
    subtitle: '5 domains: Self-Awareness, Self-Management, Social Awareness, Relationship Skills, Responsible Decision Making.',
    icon: HeartHandshake,
    accent: 'bg-rose-50 text-rose-700 border-rose-200',
    bullets: ['5 CASEL domains', 'Evidence tracking', 'Reflection prompts'],
    coverage: '5 domains with learner evidence and integrated SEL tagging.',
    implementation: 'Not Implemented',
    gap: 'No CASEL tagging and no SEL evidence collection.',
  },
  {
    slug: 'ngss-stem-framework',
    title: 'NGSS / STEM Framework',
    subtitle: '8 practices: Asking Questions, Developing Models, Investigations, Data Analysis, Computation, Explanation, Argumentation, Communication.',
    icon: Rocket,
    accent: 'bg-sky-50 text-sky-700 border-sky-200',
    bullets: ['8 STEM practices', 'Practice tagging', 'Cross-domain evidence'],
    coverage: 'Full NGSS/STEM practice mapping across PAL content.',
    implementation: 'Not Implemented',
    gap: 'No NGSS tagging and no STEM practice tracking.',
  },
  {
    slug: 'ncdg-career-development',
    title: 'NCDG Career Development',
    subtitle: '8 goals: PS1, PS2, EDL1, EDL2, CM1, CM2, CM3, CM4.',
    icon: Briefcase,
    accent: 'bg-amber-50 text-amber-700 border-amber-200',
    bullets: ['8 NCDG goals', 'Career evidence', 'Pathway signals'],
    coverage: 'Career development goal mapping across learner pathways.',
    implementation: 'Not Implemented',
    gap: 'No NCDG integration and no career development goal tracking.',
  },
  {
    slug: 'pedagogy-types',
    title: '12 Pedagogy Types',
    subtitle: 'Inquiry-based, experiential, art-integrated, game-based, scenario-based, and more.',
    icon: BookOpen,
    accent: 'bg-violet-50 text-violet-700 border-violet-200',
    bullets: ['12 pedagogy types', 'Selection engine', 'Effectiveness tracking'],
    coverage: 'All pedagogy types selectable and measurable by content performance.',
    implementation: 'Partially Implemented',
    gap: 'UI shows pedagogy type in content, but there is no pedagogy selection engine or pedagogy effectiveness tracking.',
  },
  {
    slug: 'music-framework',
    title: 'Music Framework',
    subtitle: 'Theory, Performance, Composition, and Appreciation across 4 competency bands.',
    icon: Music2,
    accent: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
    bullets: ['Theory', 'Performance', 'Composition'],
    coverage: 'Music pathway with competency and evidence progression.',
    implementation: 'Not Implemented',
    gap: 'No music pathway and no music competency tracking.',
  },
  {
    slug: 'sports-framework',
    title: 'Sports Framework',
    subtitle: 'Fitness, Technical, Tactical, Sportsmanship across 4 development bands.',
    icon: Trophy,
    accent: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    bullets: ['Fitness', 'Technical', 'Tactical'],
    coverage: 'Sports pathway with performance evidence and progression.',
    implementation: 'Not Implemented',
    gap: 'No sports pathway and no sports competency tracking.',
  },
  {
    slug: 'finance-framework',
    title: 'Finance Framework',
    subtitle: 'Level 1 Literacy, Level 2 Products, Level 3 Planning, Level 4 Investing.',
    icon: CircleDollarSign,
    accent: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    bullets: ['Literacy', 'Products', 'Planning', 'Investing'],
    coverage: 'Financial literacy pathway with real-life decision skills.',
    implementation: 'Not Implemented',
    gap: 'No finance pathway and no financial literacy tracking.',
  },
];

export const uluModules: PalSubmoduleItem[] = [
  {
    slug: 'five-layer-structure',
    title: '5-Layer ULU Structure',
    subtitle: 'Academic Core + SEL Layer + STEM Practice + Career Signal + Real Skill.',
    icon: GitBranch,
    accent: 'bg-blue-50 text-blue-700 border-blue-200',
    bullets: ['Academic core', 'SEL layer', 'STEM practice', 'Career signal', 'Real skill'],
    coverage: 'Multi-layer ULU structure for holistic lesson design.',
    implementation: 'Not Implemented',
    gap: 'No ULU structure and no multi-layer content delivery.',
  },
  {
    slug: 'scenario-template',
    title: 'ULU Scenario Template',
    subtitle: 'Context + Academic Hook + Decision Point + Reflection inside one real-world learning flow.',
    icon: BookOpen,
    accent: 'bg-amber-50 text-amber-700 border-amber-200',
    bullets: ['Context', 'Academic hook', 'Decision point', 'Reflection'],
    coverage: 'Reusable scenario template for India-specific branching experiences.',
    implementation: 'Not Implemented',
    gap: 'No scenario structure, no branching scenarios, and no real-world contexts.',
  },
  {
    slug: 'complete-examples',
    title: '6 Complete ULU Examples',
    subtitle: 'Reference implementations for Math, Science, Language, Social Studies, Statistics, and EVS.',
    icon: Trophy,
    accent: 'bg-violet-50 text-violet-700 border-violet-200',
    bullets: ['Math', 'Science', 'Language', 'Social Studies', 'EVS'],
    coverage: 'Six complete sample ULUs for content and product teams to reference.',
    implementation: 'Not Implemented',
    gap: 'No example ULUs, no sample content, and no reference implementations in the UI flow.',
  },
  {
    slug: 'content-optimization-loop',
    title: 'Content Optimization Loop',
    subtitle: 'completion_rate < 0.75 triggers review, avg_attempts and drop-off signals drive improvements.',
    icon: CircleDollarSign,
    accent: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    bullets: ['Completion rate', 'Drop-off points', 'Revision triggers'],
    coverage: 'Analytics loop for ULU performance and content improvement.',
    implementation: 'Not Implemented',
    gap: 'No analytics loop, no drop-off detection, and no content improvement triggers.',
  },
];

export const frameworkModuleMap = Object.fromEntries(frameworkModules.map((item) => [item.slug, item])) as Record<string, PalSubmoduleItem>;
export const uluModuleMap = Object.fromEntries(uluModules.map((item) => [item.slug, item])) as Record<string, PalSubmoduleItem>;
