'use client';

import React, { useState } from 'react';
import {
  Bell,
  BookOpen,
  Calendar,
  CheckCircle2,
  Download,
  FileText,
  Filter,
  Megaphone,
  Paperclip,
  Pin,
  Plus,
  Search,
  Share2,
  Tag,
  User,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface Announcement {
  id: string;
  title: string;
  author: string;
  role: string;
  date: string;
  category: string;
  targetClass: string;
  isPinned: boolean;
  content: string;
  attachment?: {
    name: string;
    size: string;
  };
}

const INITIAL_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'ann-1',
    title: 'CBSE Class 10 Board Model Question Papers & Marking Scheme 2026',
    author: 'Dr. Ananya Sharma',
    role: 'Head of Academic Curriculum',
    date: '04 Nov 2026',
    category: 'Examination',
    targetClass: 'Class 10 (All Sections)',
    isPinned: true,
    content: 'The official CBSE Class 10 model question papers and step-by-step marking rubrics for Science, Mathematics, and Social Science have been uploaded to the LMS course repository. All students are advised to attempt the sample test before the upcoming diagnostic assessment.',
    attachment: {
      name: 'CBSE_Class10_Model_Question_Paper_2026.pdf',
      size: '2.4 MB',
    },
  },
  {
    id: 'ann-2',
    title: 'Live Virtual Lab Demo: Optics & Laser Refraction Practical',
    author: 'Rajesh Patel',
    role: 'Senior Science Faculty',
    date: '03 Nov 2026',
    category: 'Live Session',
    targetClass: 'Class 10 & 11 Science',
    isPinned: true,
    content: 'A special live interactive ray-optics demonstration using simulation tools will take place this Thursday at 11:30 AM. Attendance is mandatory for all students enrolled in the Experimental Physics module. The meeting link is active in Sessions & Calendar.',
    attachment: {
      name: 'Optics_Experiment_Lab_Manual.pdf',
      size: '1.1 MB',
    },
  },
  {
    id: 'ann-3',
    title: 'Interactive Python Coding Sandbox Now Active for Grade 8-10',
    author: 'Vikram Malhotra',
    role: 'Computer Science Department',
    date: '01 Nov 2026',
    category: 'Course Update',
    targetClass: 'Classes 8, 9, 10',
    isPinned: false,
    content: 'We have updated the Computer Science curriculum with interactive browser-based code execution exercises. Students can now practice loops, functions, and algorithmic puzzles directly inside their LMS modules without installing external software.',
  },
  {
    id: 'ann-4',
    title: 'Submissions Window for Q3 Science Project & Portfolio Review',
    author: 'Priya Nair',
    role: 'Curriculum Coordinator',
    date: '28 Oct 2026',
    category: 'Assignment',
    targetClass: 'Class 9 (Sections A, B, C)',
    isPinned: false,
    content: 'The assignment submission portal for the Q3 Science Working Model video presentation is open. Ensure your lab report documentation and 2-minute demonstration videos are uploaded before the 15th November deadline.',
    attachment: {
      name: 'Project_Rubric_and_Guidelines.pdf',
      size: '860 KB',
    },
  },
  {
    id: 'ann-5',
    title: 'National Digital Library & E-Book Access Portal Integration',
    author: 'Academic Administration',
    role: 'LMS Central Library',
    date: '25 Oct 2026',
    category: 'Resource',
    targetClass: 'All Grades (6-12)',
    isPinned: false,
    content: 'Students and faculty now have integrated single-sign-on access to over 5,000+ reference volumes, NCERT audiobooks, and competitive foundation prep materials through the Course Builder digital resources library.',
  },
];

export function LmsAnnouncementsBoard() {
  const [announcements, setAnnouncements] = useState<Announcement[]>(INITIAL_ANNOUNCEMENTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // New announcement form state
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Examination');
  const [newTargetClass, setNewTargetClass] = useState('All Grades');
  const [newContent, setNewContent] = useState('');
  const [newIsPinned, setNewIsPinned] = useState(false);

  const filtered = announcements.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.author.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.category.toLowerCase() === selectedCategory.toLowerCase();
    return matchesSearch && matchesCategory;
  });

  const handleCreateAnnouncement = () => {
    if (!newTitle.trim() || !newContent.trim()) return;

    const newItem: Announcement = {
      id: `ann-${Date.now()}`,
      title: newTitle.trim(),
      author: 'Academic Faculty (You)',
      role: 'Instructor / Administrator',
      date: 'Just now',
      category: newCategory,
      targetClass: newTargetClass,
      isPinned: newIsPinned,
      content: newContent.trim(),
    };

    setAnnouncements([newItem, ...announcements]);
    setIsCreateOpen(false);
    setNewTitle('');
    setNewContent('');
    setNewIsPinned(false);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header & Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Megaphone className="size-5 text-[#5846EA]" />
            LMS Notices &amp; Course Announcements
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Publish course updates, exam advisories, and syllabus bulletins to students and staff.
          </p>
        </div>

        <Button
          onClick={() => setIsCreateOpen(true)}
          className="rounded-xl bg-[#5846EA] text-white hover:bg-[#4936d8] shadow-md shadow-[#5846EA]/25 font-bold cursor-pointer h-10 px-4"
        >
          <Plus className="size-4 mr-1.5" />
          Create announcement
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search announcements, subjects, or circulars…"
            className="pl-10 h-10 rounded-xl border-slate-200 bg-white"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            aria-label="Filter by notice category"
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-[#5846EA] cursor-pointer"
          >
            <option value="all">All Categories</option>
            <option value="examination">Examination</option>
            <option value="live session">Live Session</option>
            <option value="assignment">Assignment</option>
            <option value="course update">Course Update</option>
            <option value="resource">Resource</option>
          </select>
        </div>
      </div>

      {/* Announcements List */}
      <div className="space-y-4">
        {filtered.map((item) => (
          <article
            key={item.id}
            className={`rounded-2xl border bg-white p-6 shadow-xs transition-all hover:border-[#5846EA]/30 ${
              item.isPinned ? 'border-indigo-200/90 bg-indigo-50/20' : 'border-slate-200/80'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                {item.isPinned && (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-100 text-[#5846EA] px-2.5 py-0.5 text-xs font-bold">
                    <Pin className="size-3 fill-current" />
                    Pinned
                  </span>
                )}
                <span className="rounded-lg bg-slate-100 text-slate-700 px-2.5 py-0.5 text-xs font-semibold">
                  {item.category}
                </span>
                <span className="text-xs font-medium text-slate-500">
                  Target: <strong className="text-slate-700 font-semibold">{item.targetClass}</strong>
                </span>
              </div>

              <span className="text-xs font-medium text-slate-500 tabular-nums">{item.date}</span>
            </div>

            <h3 className="mt-2.5 text-lg font-bold text-slate-900 tracking-tight leading-snug">
              {item.title}
            </h3>

            <p className="mt-2 text-sm text-slate-600 leading-relaxed whitespace-pre-line">
              {item.content}
            </p>

            {item.attachment && (
              <div className="mt-4 flex items-center gap-3">
                <a
                  href={`#download-${item.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    alert(`Downloading attachment: ${item.attachment?.name}`);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50/70 px-3.5 py-2 text-xs font-bold text-[#5846EA] transition-colors hover:bg-indigo-100/70"
                >
                  <Paperclip className="size-3.5" />
                  <span>{item.attachment.name}</span>
                  <span className="text-[11px] font-medium text-indigo-400">({item.attachment.size})</span>
                  <Download className="size-3.5 ml-1" />
                </a>
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <div className="size-6 rounded-full bg-indigo-100 text-[#5846EA] font-bold flex items-center justify-center text-[10px]">
                  {item.author.slice(0, 2).toUpperCase()}
                </div>
                <span>
                  Posted by <strong className="font-semibold text-slate-700">{item.author}</strong> ({item.role})
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText?.(`${window.location.origin}/modules/lms/communication#${item.id}`);
                  alert('Announcement link copied to clipboard!');
                }}
                className="inline-flex items-center gap-1.5 text-slate-500 hover:text-[#5846EA] font-medium transition-colors cursor-pointer"
              >
                <Share2 className="size-3.5" />
                Share link
              </button>
            </div>
          </article>
        ))}

        {filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
            <Megaphone className="size-8 text-slate-300 mx-auto mb-2" />
            <p className="text-base font-bold text-slate-700">No announcements match your search</p>
            <p className="text-sm text-slate-500 mt-1">Try selecting another category or clear your search query.</p>
          </div>
        )}
      </div>

      {/* Create Announcement Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">Publish New LMS Announcement</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-1">
                Announcement Title *
              </label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="E.g. Term 1 Mathematics Blueprint & Sample Questions"
                className="h-10 rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-1">
                  Category
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none"
                >
                  <option value="Examination">Examination</option>
                  <option value="Live Session">Live Session</option>
                  <option value="Assignment">Assignment</option>
                  <option value="Course Update">Course Update</option>
                  <option value="Resource">Resource</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-1">
                  Target Audience
                </label>
                <Input
                  value={newTargetClass}
                  onChange={(e) => setNewTargetClass(e.target.value)}
                  placeholder="E.g. Class 10 (All Sections)"
                  className="h-10 rounded-xl"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-1">
                Announcement Body *
              </label>
              <Textarea
                rows={5}
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Write the complete announcement text for students and educators…"
                className="rounded-xl"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={newIsPinned}
                onChange={(e) => setNewIsPinned(e.target.checked)}
                className="rounded text-[#5846EA] focus:ring-[#5846EA]"
              />
              <span className="text-sm font-medium text-slate-700">Pin this announcement to top of feed</span>
            </label>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsCreateOpen(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button
              onClick={handleCreateAnnouncement}
              disabled={!newTitle.trim() || !newContent.trim()}
              className="rounded-xl bg-[#5846EA] text-white hover:bg-[#4936d8] font-bold"
            >
              Publish Announcement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

