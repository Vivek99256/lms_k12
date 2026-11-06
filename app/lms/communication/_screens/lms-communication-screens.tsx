'use client';

import React, { useEffect } from 'react';
import { History, Megaphone, Send, Zap } from 'lucide-react';
import type { ModuleStaticScreen } from '@/app/_components/module-category-page';
import { ModuleBroadcastNotice, type NoticeTemplate } from '@/app/_components/module-notice/ModuleBroadcastNotice';
import { ModuleDeliveryLog } from '@/app/_components/module-notice/ModuleDeliveryLog';
import { LmsAnnouncementsBoard } from '../_components/LmsAnnouncementsBoard';
import { LmsAutomatedTriggers } from '../_components/LmsAutomatedTriggers';
import { getStoredDispatches, recordBatchDispatches } from '@/lib/communication/dispatch-store';

const MODULE_KEY = 'lms';

const FIELDS = {
  student_name: 'Learner / Student name',
  course_name: 'Course / Subject title',
  instructor_name: 'Instructor / Teacher name',
  date: 'Session / Class Date',
  due_date: 'Submission / Due Date',
};

const TEMPLATES: NoticeTemplate[] = [
  {
    id: 'course-enrolled',
    name: 'Course Enrollment Notice',
    tag: 'Enrollment',
    subject: 'New Course Assigned: {course_name}',
    body: 'Dear {student_name}, you have been enrolled in {course_name}. Please log into the LMS portal and begin module 1 before {due_date}.',
  },
  {
    id: 'live-class-link',
    name: 'Live Virtual Session Advisory',
    tag: 'Live Class',
    subject: 'Live Classroom Training: {course_name}',
    body: 'Dear {student_name}, your live interactive session for {course_name} with instructor {instructor_name} is scheduled on {date}. Join link is active on your LMS dashboard.',
  },
  {
    id: 'assessment-reminder',
    name: 'Assessment & Test Due Advisory',
    tag: 'Assessment',
    subject: 'Urgent: {course_name} Assessment Due on {due_date}',
    body: 'Dear {student_name}, your competency assessment for {course_name} is pending submission. The test closes on {due_date}. Please complete all questions promptly.',
  },
  {
    id: 'certificate-ready',
    name: 'Course Completion & Certificate Issued',
    tag: 'Certification',
    subject: 'Congratulations! Certificate Issued for {course_name}',
    body: 'Dear {student_name}, congratulations on successfully finishing {course_name}! Your verified digital completion certificate is now ready for download in LMS Records.',
  },
  {
    id: 'assignment-published',
    name: 'New Homework & Worksheet Published',
    tag: 'Homework',
    subject: 'New Worksheet Assigned in {course_name}',
    body: 'Dear {student_name}, teacher {instructor_name} has published a new learning worksheet for {course_name}. Please review the materials and submit your work by {due_date}.',
  },
];

/** Seed realistic dispatches for LMS if none exist in localStorage yet. */
function ensureSampleDispatches() {
  if (typeof window === 'undefined') return;
  const existing = getStoredDispatches(MODULE_KEY);
  if (existing.length === 0) {
    recordBatchDispatches(
      MODULE_KEY,
      'whatsapp',
      [
        { recipientName: 'Dr. Ananya Sharma', mobileNumber: '+91 98250 11001' },
        { recipientName: 'Rajesh Patel', mobileNumber: '+91 98251 22002' },
        { recipientName: 'Priya Nair', mobileNumber: '+91 98795 33003' },
      ],
      {
        event_key: 'lms.course.assigned',
        subject: 'New Course Assigned: Class 10 Science & Math Pedagogy',
        messageBody: 'Dear Educator, you have been assigned to lead the Class 10 STEM competency curriculum. Materials are available in your LMS Course Builder.',
        status: 'sent',
      },
    );
    recordBatchDispatches(
      MODULE_KEY,
      'sms',
      [
        { recipientName: 'Vikram Malhotra', mobileNumber: '+91 98254 44004' },
        { recipientName: 'Sunita Deshmukh', mobileNumber: '+91 98255 55005' },
      ],
      {
        event_key: 'lms.assessment.due_soon',
        subject: 'Diagnostic Assessment Deadline Advisory',
        messageBody: 'Reminder: The Annual K-12 Educator Competency Assessment sitting closes tomorrow at 11:59 PM. Please submit your answers on LMS.',
        status: 'sent',
      },
    );
  }
}

function LmsNoticeWrapper() {
  useEffect(() => {
    ensureSampleDispatches();
  }, []);

  return (
    <div style={{ ['--primary' as string]: '#5846EA', ['--primary-foreground' as string]: '#ffffff' }}>
      <ModuleBroadcastNotice
        moduleKey={MODULE_KEY}
        eventKey="lms.course.broadcast"
        title="LMS Communication Broadcast"
        description="Broadcast course circulars, assessment reminders, virtual class links, and student enrollment notices."
        templates={TEMPLATES}
        fields={FIELDS}
      />
    </div>
  );
}

function LmsDeliveryLogWrapper() {
  useEffect(() => {
    ensureSampleDispatches();
  }, []);

  return (
    <div style={{ ['--primary' as string]: '#5846EA', ['--primary-foreground' as string]: '#ffffff' }}>
      <ModuleDeliveryLog moduleKey={MODULE_KEY} />
    </div>
  );
}

/**
 * LMS -> Communication static screens suite.
 * Provides complete multi-channel notice broadcasting, delivery tracking,
 * interactive course announcements feed, and automated trigger rules.
 */
export const LMS_COMMUNICATION_SCREENS: ModuleStaticScreen[] = [
  {
    id: 'broadcast-notice',
    label: 'Send notice',
    icon: Send,
    render: () => <LmsNoticeWrapper />,
  },
  {
    id: 'delivery-log',
    label: 'Delivery log',
    icon: History,
    render: () => <LmsDeliveryLogWrapper />,
  },
  {
    id: 'announcements',
    label: 'Course Announcements',
    icon: Megaphone,
    render: () => (
      <div className="p-4" style={{ ['--primary' as string]: '#5846EA', ['--primary-foreground' as string]: '#ffffff' }}>
        <LmsAnnouncementsBoard />
      </div>
    ),
  },
  {
    id: 'automated-triggers',
    label: 'Automated Triggers',
    icon: Zap,
    render: () => (
      <div className="p-4" style={{ ['--primary' as string]: '#5846EA', ['--primary-foreground' as string]: '#ffffff' }}>
        <LmsAutomatedTriggers />
      </div>
    ),
  },
];

