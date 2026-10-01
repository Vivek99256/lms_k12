import {
  buildSessionContext,
  createAuthHeaders,
  readNumber,
  readString,
  type SessionContext,
} from '@/lib/erp-client';

export interface VirtualClassroomSession {
  id: number;
  roomName: string;
  description: string;
  subjectName: string;
  chapterName?: string;
  topicName?: string;
  teacherName: string;
  eventDate: string; // e.g. "2026-10-01"
  fromTime: string; // e.g. "10:30 AM"
  toTime: string; // e.g. "11:30 AM"
  status: 'live' | 'upcoming' | 'completed';
  meetingUrl: string;
  passcode?: string;
  recurring?: string;
  attendeesCount?: number;
  recordingUrl?: string;
}

export interface NewVirtualSession {
  roomName: string;
  description: string;
  subjectName: string;
  chapterName?: string;
  topicName?: string;
  eventDate: string;
  fromTime: string;
  toTime: string;
  meetingUrl: string;
  passcode?: string;
  recurring?: string;
}

export interface VirtualSessionFilters {
  search?: string;
  status?: 'all' | 'live' | 'upcoming' | 'completed';
  subject?: string;
}

const DEMO_VIRTUAL_SESSIONS: VirtualClassroomSession[] = [
  {
    id: 201,
    roomName: 'Live Interactive Session: Physics - Quantum Mechanics Intro',
    description: 'Real-time problem solving, interactive simulations, and wave-particle duality discussion.',
    subjectName: 'Physics',
    chapterName: 'Modern Physics',
    topicName: 'Wave-Particle Duality',
    teacherName: 'Dr. Ananya Sharma',
    eventDate: new Date().toISOString().split('T')[0],
    fromTime: '02:30 PM',
    toTime: '03:30 PM',
    status: 'live',
    meetingUrl: 'https://meet.google.com/abc-defg-hij',
    passcode: 'PHYS-2026',
    recurring: 'Weekly',
    attendeesCount: 38,
  },
  {
    id: 202,
    roomName: 'Algebra & Geometry Revision & Doubts Clearing',
    description: 'Interactive board session focusing on quadratic equations, theorem proofs, and homework review.',
    subjectName: 'Mathematics',
    chapterName: 'Quadratic Equations',
    topicName: 'Roots & Graphical Proofs',
    teacherName: 'Mr. Rajesh Verma',
    eventDate: new Date().toISOString().split('T')[0],
    fromTime: '04:00 PM',
    toTime: '05:00 PM',
    status: 'upcoming',
    meetingUrl: 'https://zoom.us/j/9876543210',
    passcode: 'MATH-6C',
    recurring: 'Bi-Weekly',
    attendeesCount: 42,
  },
  {
    id: 203,
    roomName: 'Organic Chemistry Reactions & Molecular Visualizer',
    description: '3D rendering of hydrocarbon structures and live Q&A session for upcoming unit assessment.',
    subjectName: 'Chemistry',
    chapterName: 'Carbon Compounds',
    topicName: 'Isomerism & Nomenclature',
    teacherName: 'Mrs. Sunita Rao',
    eventDate: '2026-10-02',
    fromTime: '11:00 AM',
    toTime: '12:00 PM',
    status: 'upcoming',
    meetingUrl: 'https://teams.microsoft.com/l/meetup-join/chem-6c',
    passcode: 'CHEM-PASS',
    recurring: 'None',
    attendeesCount: 35,
  },
  {
    id: 204,
    roomName: 'English Literature: Shakespearean Drama Analysis',
    description: 'Character analysis and thematic breakdown of Act III with interactive roleplay reading.',
    subjectName: 'English',
    chapterName: 'Classic Drama',
    topicName: 'Character Motivation',
    teacherName: 'Ms. Priya Kapoor',
    eventDate: '2026-09-29',
    fromTime: '10:00 AM',
    toTime: '11:00 AM',
    status: 'completed',
    meetingUrl: 'https://meet.google.com/xyz-uvwx-rst',
    recordingUrl: 'https://lms.k12.edu/recordings/eng_drama_act3.mp4',
    passcode: 'ENG-READ',
    recurring: 'Weekly',
    attendeesCount: 40,
  },
];

function getSessionSafe(): SessionContext | null {
  try {
    const session = buildSessionContext();
    return session.baseUrl ? session : null;
  } catch {
    return null;
  }
}

export async function fetchVirtualSessions(
  filters: VirtualSessionFilters = {},
  signal?: AbortSignal
): Promise<{ sessions: VirtualClassroomSession[]; total: number }> {
  const session = getSessionSafe();

  if (session) {
    try {
      const url = new URL(`${session.baseUrl}/api/lms/virtual-classroom`);
      if (session.syear) url.searchParams.set('syear', session.syear);

      const res = await fetch(url.toString(), {
        headers: { ...createAuthHeaders(session), 'X-Requested-With': 'XMLHttpRequest' },
        signal,
      });

      if (res.ok) {
        const body = await res.json();
        if (body.success && Array.isArray(body.data) && body.data.length > 0) {
          const remoteSessions: VirtualClassroomSession[] = body.data.map(
            (row: Record<string, unknown>, index: number) => ({
              id: readNumber(row.id) || index + 1,
              roomName: readString(row.room_name) || 'Virtual Classroom Session',
              description: readString(row.description) || '',
              subjectName: readString(row.subject_name) || 'General',
              chapterName: readString(row.chapter_name),
              topicName: readString(row.topic_name),
              teacherName: readString(row.teacher_name) || 'Faculty',
              eventDate: readString(row.event_date) || new Date().toISOString().split('T')[0],
              fromTime: readString(row.from_time) || '10:00 AM',
              toTime: readString(row.to_time) || '11:00 AM',
              status: (readString(row.status) as VirtualClassroomSession['status']) || 'upcoming',
              meetingUrl: readString(row.url) || '#',
              passcode: readString(row.password),
              recurring: readString(row.recurring),
            })
          );

          let filtered = remoteSessions;
          if (filters.search) {
            const q = filters.search.toLowerCase();
            filtered = filtered.filter(
              (item) => item.roomName.toLowerCase().includes(q) || item.subjectName.toLowerCase().includes(q)
            );
          }
          if (filters.status && filters.status !== 'all') {
            filtered = filtered.filter((item) => item.status === filters.status);
          }
          return { sessions: filtered, total: filtered.length };
        }
      }
    } catch {
      // Fallback to local demo data
    }
  }

  let items = [...DEMO_VIRTUAL_SESSIONS];
  if (filters.search) {
    const q = filters.search.toLowerCase();
    items = items.filter(
      (item) =>
        item.roomName.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.subjectName.toLowerCase().includes(q) ||
        item.teacherName.toLowerCase().includes(q)
    );
  }
  if (filters.status && filters.status !== 'all') {
    items = items.filter((item) => item.status === filters.status);
  }

  return { sessions: items, total: items.length };
}

export async function createVirtualSession(newSession: NewVirtualSession): Promise<VirtualClassroomSession> {
  const sessionItem: VirtualClassroomSession = {
    id: Date.now(),
    roomName: newSession.roomName,
    description: newSession.description,
    subjectName: newSession.subjectName,
    chapterName: newSession.chapterName,
    topicName: newSession.topicName,
    teacherName: 'Dr. Ananya Sharma',
    eventDate: newSession.eventDate,
    fromTime: newSession.fromTime,
    toTime: newSession.toTime,
    status: 'upcoming',
    meetingUrl: newSession.meetingUrl || 'https://meet.google.com/new-live-room',
    passcode: newSession.passcode || 'PASS2026',
    recurring: newSession.recurring || 'None',
    attendeesCount: 0,
  };

  DEMO_VIRTUAL_SESSIONS.unshift(sessionItem);
  return sessionItem;
}
