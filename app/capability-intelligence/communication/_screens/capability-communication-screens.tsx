'use client'

import React from 'react'
import { History, Send } from 'lucide-react'
import type { ModuleStaticScreen } from '@/app/_components/module-category-page'
import { ModuleBroadcastNotice, type NoticeTemplate } from '@/app/_components/module-notice/ModuleBroadcastNotice'
import { ModuleDeliveryLog } from '@/app/_components/module-notice/ModuleDeliveryLog'

const MODULE_KEY = 'capability-intelligence'

const FIELDS = {
  name: 'Staff / Employee name',
  skill: 'Capability / Skill name',
  date: 'Assessment / Training Date',
  role: 'Job Role',
}

const TEMPLATES: NoticeTemplate[] = [
  {
    id: 'skill-assessment-notice',
    name: 'Skill Assessment Intimation',
    tag: 'Assessment',
    subject: 'Competency Assessment Scheduled: {skill}',
    body: 'Dear {name}, your capability assessment for {skill} in role {role} is scheduled for {date}. Please review the competency framework requirements beforehand.',
  },
  {
    id: 'development-plan-assigned',
    name: 'Development Plan Initiated',
    tag: 'Development',
    subject: 'New Capability Development Plan Assigned',
    body: 'Dear {name}, a new capability development plan has been assigned to you focusing on {skill}. Please check your Capability Intelligence portal for target milestones.',
  },
  {
    id: 'mentor-assignment-notice',
    name: 'Career Mentor Assigned',
    tag: 'Mentorship',
    subject: 'Career Mentorship Opportunity',
    body: 'Dear {name}, you have been mapped as a mentor for {skill}. Your expertise will guide aspirants aligned with these industry capabilities.',
  },
  {
    id: 'certification-renewal-reminder',
    name: 'Certification Renewal Reminder',
    tag: 'Compliance',
    subject: 'Competency Certification Expiry Notice',
    body: 'Dear {name}, your certification for {skill} is due for renewal by {date}. Please submit updated evidence or schedule an evaluation.',
  },
]

export const CAPABILITY_INTELLIGENCE_COMMUNICATION_SCREENS: ModuleStaticScreen[] = [
  {
    id: 'send-notice',
    label: 'Send Notice',
    icon: Send,
    render: () => (
      <div style={{ ['--primary' as string]: '#4F46E5' }}>
        <ModuleBroadcastNotice
          moduleKey={MODULE_KEY}
          eventKey="capability.assessment.notice"
          title="Capability Intelligence Broadcast"
          description="Send capability notices, skill assessments, and mentorship announcements to staff and employees."
          templates={TEMPLATES}
          fields={FIELDS}
        />
      </div>
    ),
  },
  {
    id: 'delivery-log',
    label: 'Delivery Log',
    icon: History,
    render: () => (
      <div style={{ ['--primary' as string]: '#4F46E5' }}>
        <ModuleDeliveryLog moduleKey={MODULE_KEY} />
      </div>
    ),
  },
]

