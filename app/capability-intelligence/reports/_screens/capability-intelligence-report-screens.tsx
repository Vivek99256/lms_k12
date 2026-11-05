'use client'

import React from 'react'
import { GitMerge, Layers, LayoutDashboard, Target } from 'lucide-react'
import type { ModuleStaticScreen } from '@/app/_components/module-category-page'
import { CommandCenter } from '@/app/capability-intelligence/dashboard/components/command-center'
import { SkillCoverageReportView } from '../_components/SkillCoverageReportView'
import { DevelopmentPlansReportView } from '../_components/DevelopmentPlansReportView'
import { MentorCrosswalkReportView } from '../_components/MentorCrosswalkReportView'

/**
 * Capability Intelligence -> Reports static screens suite.
 * Provides high-level Command Center metrics, Skill Matrix Coverage,
 * Employee Development Plans tracking, and Mentor Crosswalk reports.
 */
export const CAPABILITY_INTELLIGENCE_REPORT_SCREENS: ModuleStaticScreen[] = [
  {
    id: 'command-center',
    label: 'Command Center & KPIs',
    icon: LayoutDashboard,
    render: () => <CommandCenter />,
  },
  {
    id: 'skill-coverage',
    label: 'Skill Coverage Matrix',
    icon: Layers,
    render: () => <SkillCoverageReportView />,
  },
  {
    id: 'development-plans',
    label: 'Development Plans Report',
    icon: Target,
    render: () => <DevelopmentPlansReportView />,
  },
  {
    id: 'mentor-crosswalk',
    label: 'Mentor Crosswalk Report',
    icon: GitMerge,
    render: () => <MentorCrosswalkReportView />,
  },
]

