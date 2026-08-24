export interface Course {
  id: string;
  title: string;
  code: string;
  subject: string;
  category: string;
  classGrade: string;
  status: 'Active' | 'Draft' | 'Archived';
  chapters: number;
  enrollments: number;
  progress: number;
  instructor: string;
  createdAt: string;
  accentColor: string;
  icon: 'book-open' | 'flask-conical' | 'calculator' | 'globe' | 'pen-tool' | 'music' | 'dumbbell' | 'briefcase' | 'palette' | 'library' | 'cpu' | 'compass';
}

export const courses: Course[] = [
  { id: 'c1', title: 'Social Science Fundamentals', code: 'SS-101', subject: 'Social Sciences', category: 'My Course', classGrade: 'Class 8', status: 'Active', chapters: 12, enrollments: 340, progress: 78, instructor: 'Mrs. Sharma', createdAt: '2024-06-15', accentColor: '#F59E0B', icon: 'globe' },
  { id: 'c2', title: 'Advanced Science Concepts', code: 'SCI-201', subject: 'Science', category: 'STEM Resources', classGrade: 'Class 9', status: 'Active', chapters: 15, enrollments: 420, progress: 65, instructor: 'Mr. Verma', createdAt: '2024-05-20', accentColor: '#10B981', icon: 'flask-conical' },
  { id: 'c3', title: 'Mathematics Mastery', code: 'MATH-101', subject: 'Mathematics', category: 'Foundational Skills', classGrade: 'Class 8', status: 'Active', chapters: 18, enrollments: 510, progress: 82, instructor: 'Ms. Rao', createdAt: '2024-04-10', accentColor: '#6366F1', icon: 'calculator' },
  { id: 'c4', title: 'English Literature', code: 'ENG-101', subject: 'English', category: 'My Course', classGrade: 'Class 9', status: 'Active', chapters: 10, enrollments: 290, progress: 90, instructor: 'Mrs. Kapoor', createdAt: '2024-07-01', accentColor: '#8B5CF6', icon: 'book-open' },
  { id: 'c5', title: 'Hindi Vyakaran', code: 'HIN-101', subject: 'Hindi', category: 'My Course', classGrade: 'Class 8', status: 'Active', chapters: 8, enrollments: 180, progress: 45, instructor: 'Mr. Singh', createdAt: '2024-06-20', accentColor: '#EF4444', icon: 'pen-tool' },
  { id: 'c6', title: 'Sanskrit Basics', code: 'SAN-101', subject: 'Sanskrit', category: 'Hobbies and Activities', classGrade: 'Class 7', status: 'Draft', chapters: 6, enrollments: 45, progress: 20, instructor: 'Ms. Joshi', createdAt: '2024-08-05', accentColor: '#D97706', icon: 'pen-tool' },
  { id: 'c7', title: 'Physical Education', code: 'PE-101', subject: 'Sports', category: 'Sports', classGrade: 'Class 8', status: 'Active', chapters: 4, enrollments: 620, progress: 100, instructor: 'Coach Kumar', createdAt: '2024-03-12', accentColor: '#84CC16', icon: 'dumbbell' },
  { id: 'c8', title: 'Vocational Skills - Coding', code: 'VOC-101', subject: 'Computer', category: 'Vocational Training', classGrade: 'Class 9', status: 'Active', chapters: 14, enrollments: 210, progress: 55, instructor: 'Mr. Patel', createdAt: '2024-05-08', accentColor: '#06B6D4', icon: 'cpu' },
  { id: 'c9', title: 'Career Guidance', code: 'CAR-101', subject: 'Career Counselling', category: 'Career Counselling', classGrade: 'Class 10', status: 'Active', chapters: 5, enrollments: 380, progress: 30, instructor: 'Ms. Nair', createdAt: '2024-07-15', accentColor: '#7C3AED', icon: 'compass' },
  { id: 'c10', title: 'SEL - Emotional Wellness', code: 'SEL-101', subject: 'SEL', category: 'SEL', classGrade: 'Class 7', status: 'Active', chapters: 8, enrollments: 440, progress: 60, instructor: 'Ms. Iyer', createdAt: '2024-06-02', accentColor: '#EC4899', icon: 'music' },
  { id: 'c11', title: 'Soft Skills Development', code: 'SSK-101', subject: 'Soft Skills', category: 'Soft Skills', classGrade: 'Class 8', status: 'Active', chapters: 10, enrollments: 350, progress: 72, instructor: 'Ms. Das', createdAt: '2024-04-25', accentColor: '#F43F5E', icon: 'briefcase' },
  { id: 'c12', title: 'Creative Arts & Craft', code: 'ART-101', subject: 'Art & Craft', category: 'Hobbies and Activities', classGrade: 'Class 7', status: 'Archived', chapters: 3, enrollments: 120, progress: 95, instructor: 'Mr. Reddy', createdAt: '2024-01-18', accentColor: '#6366F1', icon: 'palette' },
  { id: 'c13', title: 'Digital Library Basics', code: 'LIB-101', subject: 'Library', category: 'Library', classGrade: 'Class 8', status: 'Active', chapters: 6, enrollments: 275, progress: 40, instructor: 'Ms. Bose', createdAt: '2024-05-15', accentColor: '#DB2777', icon: 'library' },
  { id: 'c14', title: 'STEM Robotics', code: 'STEM-101', subject: 'STEM', category: 'STEM Resources', classGrade: 'Class 9', status: 'Active', chapters: 12, enrollments: 165, progress: 48, instructor: 'Mr. Menon', createdAt: '2024-07-22', accentColor: '#0891B2', icon: 'cpu' },
  { id: 'c15', title: 'General Knowledge', code: 'GK-101', subject: 'Gen Knowledge', category: 'My Course', classGrade: 'Class 7', status: 'Draft', chapters: 9, enrollments: 190, progress: 15, instructor: 'Mrs. Ghosh', createdAt: '2024-08-10', accentColor: '#14B8A6', icon: 'book-open' },
  { id: 'c16', title: 'Foundational Literacy', code: 'FL-101', subject: 'Foundational Skills', category: 'Foundational Skills', classGrade: 'Class 6', status: 'Active', chapters: 20, enrollments: 400, progress: 85, instructor: 'Ms. Pillai', createdAt: '2024-02-28', accentColor: '#3B82F6', icon: 'book-open' },
  { id: 'c17', title: 'Nature & Wildlife', code: 'NW-101', subject: 'Science', category: 'Hobbies and Activities', classGrade: 'Class 7', status: 'Active', chapters: 5, enrollments: 130, progress: 50, instructor: 'Mr. Naidu', createdAt: '2024-06-30', accentColor: '#16A34A', icon: 'flask-conical' },
  { id: 'c18', title: 'Yoga & Wellness', code: 'YW-101', subject: 'Sports', category: 'Sports', classGrade: 'Class 8', status: 'Active', chapters: 4, enrollments: 300, progress: 70, instructor: 'Ms. Agarwal', createdAt: '2024-04-12', accentColor: '#84CC16', icon: 'dumbbell' },
  { id: 'c19', title: 'Music Appreciation', code: 'MUS-101', subject: 'Music', category: 'Hobbies and Activities', classGrade: 'Class 9', status: 'Active', chapters: 7, enrollments: 160, progress: 35, instructor: 'Mr. D\'Souza', createdAt: '2024-05-22', accentColor: '#F43F5E', icon: 'music' },
  { id: 'c20', title: 'Handwriting Skills', code: 'HWS-101', subject: 'Soft Skills', category: 'Soft Skills', classGrade: 'Class 6', status: 'Archived', chapters: 6, enrollments: 85, progress: 100, instructor: 'Ms. Kaur', createdAt: '2024-01-05', accentColor: '#F43F5E', icon: 'pen-tool' },
  { id: 'c21', title: 'Library Research Methods', code: 'LRM-101', subject: 'Library', category: 'Library', classGrade: 'Class 9', status: 'Active', chapters: 4, enrollments: 210, progress: 25, instructor: 'Mr. Mukherjee', createdAt: '2024-07-10', accentColor: '#DB2777', icon: 'library' },
  { id: 'c22', title: 'Entrepreneurship Basics', code: 'ENT-101', subject: 'Vocational Training', category: 'Vocational Training', classGrade: 'Class 10', status: 'Active', chapters: 8, enrollments: 140, progress: 55, instructor: 'Ms. Johar', createdAt: '2024-06-18', accentColor: '#7C3AED', icon: 'briefcase' },
  { id: 'c23', title: 'Digital Citizenship', code: 'DC-101', subject: 'SEL', category: 'SEL', classGrade: 'Class 8', status: 'Active', chapters: 5, enrollments: 320, progress: 68, instructor: 'Mr. Rangan', createdAt: '2024-05-05', accentColor: '#EC4899', icon: 'music' },
  { id: 'c24', title: 'Space & Astronomy', code: 'SPA-101', subject: 'STEM', category: 'STEM Resources', classGrade: 'Class 10', status: 'Active', chapters: 10, enrollments: 250, progress: 42, instructor: 'Dr. Saxena', createdAt: '2024-07-28', accentColor: '#0891B2', icon: 'cpu' },
];

export const categories = [
  'My Course',
  'SEL',
  'STEM Resources',
];

export const subjects = [...new Set(courses.map(c => c.subject))];
export const classGrades = [...new Set(courses.map(c => c.classGrade))].sort();