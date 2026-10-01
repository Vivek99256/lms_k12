import {
  buildSessionContext,
  createAuthHeaders,
  readNumber,
  readString,
  type SessionContext,
} from '@/lib/erp-client';

export interface PortfolioItem {
  id: number;
  title: string;
  description: string;
  type: 'Project' | 'Assignment' | 'Lab Work' | 'Art & Craft' | 'Certificate' | 'Research';
  subjectName?: string;
  fileName?: string;
  fileUrl?: string;
  feedback?: string;
  feedbackBy?: string;
  teacherName?: string;
  studentName?: string;
  standardName?: string;
  createdAt: string;
  rating?: number; // 1-5 scale
  badge?: string; // e.g. "Excellence", "Creative Master", "Innovative"
}

export interface NewPortfolioItem {
  title: string;
  description: string;
  type: PortfolioItem['type'];
  subjectName?: string;
  fileName?: string;
  file?: File | null;
}

export interface PortfolioFilters {
  search?: string;
  type?: string;
  subject?: string;
}

const DEMO_PORTFOLIO_ITEMS: PortfolioItem[] = [
  {
    id: 101,
    title: 'Solar System Interactive 3D Model & Report',
    description:
      'Created an interactive physical and digital model explaining planetary orbits, rotation speeds, and atmospheric composition of inner and outer planets.',
    type: 'Project',
    subjectName: 'Science & Physics',
    fileName: 'solar_system_project_report.pdf',
    fileUrl: '#',
    feedback: 'Outstanding research and detail on orbital mechanics! Great presentation in front of the class.',
    feedbackBy: 'Dr. Ananya Sharma',
    teacherName: 'Dr. Ananya Sharma',
    studentName: 'Evaan Rajali',
    standardName: 'Class 6 - C',
    createdAt: '28-09-2026',
    rating: 5,
    badge: 'Excellence',
  },
  {
    id: 102,
    title: 'Algebraic Functions & Real-World Applications Worksheet',
    description:
      'Solved complex linear equation systems and mapped linear growth functions to real-life financial budgeting scenarios.',
    type: 'Assignment',
    subjectName: 'Mathematics',
    fileName: 'math_algebra_assignment.pdf',
    fileUrl: '#',
    feedback: 'Very clean step-by-step solutions. Excellent graphical representations.',
    feedbackBy: 'Mr. Rajesh Verma',
    teacherName: 'Mr. Rajesh Verma',
    studentName: 'Evaan Rajali',
    standardName: 'Class 6 - C',
    createdAt: '22-09-2026',
    rating: 5,
    badge: 'Problem Solver',
  },
  {
    id: 103,
    title: 'Water Purification & Chemical Filtration Experiment',
    description:
      'Conducted a multi-stage bio-sand and activated charcoal water filtration experiment to test turbidity reduction.',
    type: 'Lab Work',
    subjectName: 'Chemistry',
    fileName: 'lab_water_filtration_notes.pdf',
    fileUrl: '#',
    feedback: 'Well documented procedure with accurate pH and clarity measurements.',
    feedbackBy: 'Mrs. Sunita Rao',
    teacherName: 'Mrs. Sunita Rao',
    studentName: 'Evaan Rajali',
    standardName: 'Class 6 - C',
    createdAt: '15-09-2026',
    rating: 4,
    badge: 'Lab Genius',
  },
  {
    id: 104,
    title: 'National Science Olympiad - Certificate of Merit',
    description:
      'Achieved Top 5 Rank in the District Science Olympiad competition with a distinction in physics reasoning.',
    type: 'Certificate',
    subjectName: 'General Science',
    fileName: 'science_olympiad_certificate.png',
    fileUrl: '#',
    feedback: 'Hearty congratulations! Proud moment for our institute.',
    feedbackBy: 'Principal Office',
    teacherName: 'Dr. Ananya Sharma',
    studentName: 'Evaan Rajali',
    standardName: 'Class 6 - C',
    createdAt: '10-09-2026',
    rating: 5,
    badge: 'Gold Scholar',
  },
  {
    id: 105,
    title: 'Digital Canvas: Ecosystems & Biodiversity Poster',
    description:
      'Designed a digital poster detailing food webs, endangered species preservation, and ecological conservation principles.',
    type: 'Art & Craft',
    subjectName: 'Environmental Studies',
    fileName: 'biodiversity_poster.png',
    fileUrl: '#',
    feedback: 'Vibrant visuals and thoughtful layout summarizing ecosystem balance.',
    feedbackBy: 'Ms. Priya Kapoor',
    teacherName: 'Ms. Priya Kapoor',
    studentName: 'Evaan Rajali',
    standardName: 'Class 6 - C',
    createdAt: '02-09-2026',
    rating: 5,
    badge: 'Creative Master',
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

export async function fetchPortfolioItems(
  filters: PortfolioFilters = {},
  signal?: AbortSignal
): Promise<{ items: PortfolioItem[]; total: number }> {
  const session = getSessionSafe();

  if (session) {
    try {
      const url = new URL(`${session.baseUrl}/api/lms/portfolio`);
      if (session.syear) url.searchParams.set('syear', session.syear);

      const res = await fetch(url.toString(), {
        headers: { ...createAuthHeaders(session), 'X-Requested-With': 'XMLHttpRequest' },
        signal,
      });

      if (res.ok) {
        const body = await res.json();
        if (body.success && Array.isArray(body.data) && body.data.length > 0) {
          const remoteItems: PortfolioItem[] = body.data.map((row: Record<string, unknown>, index: number) => ({
            id: readNumber(row.id) || index + 1,
            title: readString(row.title) || 'Untitled Portfolio Item',
            description: readString(row.description) || '',
            type: (readString(row.type) as PortfolioItem['type']) || 'Project',
            fileName: readString(row.file_name),
            feedback: readString(row.feedback),
            teacherName: readString(row.teacher_name) || readString(row.feedback_by),
            studentName: readString(row.student_name),
            standardName: readString(row.standard_name),
            createdAt: readString(row.created_at) || new Date().toLocaleDateString('en-IN'),
            rating: 5,
          }));

          let filtered = remoteItems;
          if (filters.search) {
            const q = filters.search.toLowerCase();
            filtered = filtered.filter(
              (item) => item.title.toLowerCase().includes(q) || item.description.toLowerCase().includes(q)
            );
          }
          if (filters.type) {
            filtered = filtered.filter((item) => item.type === filters.type);
          }
          return { items: filtered, total: filtered.length };
        }
      }
    } catch {
      // Fallback to local demo items on network/API unavailability
    }
  }

  // Filter local demo dataset
  let items = [...DEMO_PORTFOLIO_ITEMS];
  if (filters.search) {
    const q = filters.search.toLowerCase();
    items = items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        (item.subjectName && item.subjectName.toLowerCase().includes(q))
    );
  }
  if (filters.type) {
    items = items.filter((item) => item.type === filters.type);
  }

  return { items, total: items.length };
}

export async function createPortfolioItem(newItem: NewPortfolioItem): Promise<PortfolioItem> {
  const item: PortfolioItem = {
    id: Date.now(),
    title: newItem.title,
    description: newItem.description,
    type: newItem.type,
    subjectName: newItem.subjectName || 'General Studies',
    fileName: newItem.file?.name || newItem.fileName || 'submitted_artifact.pdf',
    createdAt: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    rating: 5,
    badge: 'New Submission',
  };

  DEMO_PORTFOLIO_ITEMS.unshift(item);
  return item;
}
