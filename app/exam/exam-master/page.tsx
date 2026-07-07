'use client';

import React, { useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, Search, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ExamMaster {
  id: string;
  srNo: number;
  examType: string;
  standard: string;
  term: string;
  weightage: number;
  sortOrder: number;
}

const standardOptions = [
  { value: '', label: 'Select Standard' },
  { value: 'NR', label: 'Nursery' },
  { value: 'KG', label: 'KG' },
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4' },
  { value: '5', label: '5' },
  { value: '6', label: '6' },
  { value: '7', label: '7' },
  { value: '8', label: '8' },
  { value: '9', label: '9' },
  { value: '10', label: '10' },
  { value: '11', label: '11' },
  { value: '12', label: '12' },
];

const termOptions = [
  { value: '', label: 'Select Term' },
  { value: 'SEMESTER-1', label: 'SEMESTER-1' },
  { value: 'SEMESTER-2', label: 'SEMESTER-2' },
];

const sampleData: ExamMaster[] = [
  { srNo: 1, id: '1', examType: 'F.P', standard: '', term: '', weightage: 0, sortOrder: 2 },
  { srNo: 2, id: '2', examType: 'S.P', standard: '', term: '', weightage: 0, sortOrder: 3 },
  { srNo: 3, id: '3', examType: 'Final', standard: '', term: '', weightage: 0, sortOrder: 4 },
  { srNo: 4, id: '4', examType: 'ST', standard: '', term: '', weightage: 0, sortOrder: 5 },
  { srNo: 5, id: '5', examType: 'PERIODIC TEST', standard: 'NR', term: 'SEMESTER-1', weightage: 10, sortOrder: 1 },
];

export default function ExamMasterPage() {
  const [data, setData] = useState<ExamMaster[]>(sampleData);
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: keyof ExamMaster; dir: 'asc' | 'desc' } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ExamMaster | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteItem, setDeleteItem] = useState<ExamMaster | null>(null);
  const [formData, setFormData] = useState({
    examType: '',
    standard: '',
    term: '',
    weightage: '',
    sortOrder: '',
  });

  const filteredData = useMemo(() => {
    return data.filter(item =>
      item.examType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.standard.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.term.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [data, searchQuery]);

  const sortedData = useMemo(() => {
    if (!sortConfig) return filteredData;
    const sorted = [...filteredData];
    sorted.sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortConfig.dir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.dir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return 0;
    });
    return sorted;
  }, [filteredData, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const paginatedData = sortedData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleSort = (key: keyof ExamMaster) => {
    setSortConfig(prev => ({
      key,
      dir: prev?.key === key && prev.dir === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleSelectChange = (value: string | null) => value ?? '';

  const openAddModal = () => {
    setEditingItem(null);
    setFormData({ examType: '', standard: '', term: '', weightage: '', sortOrder: '' });
    setShowModal(true);
  };

  const openEditModal = (item: ExamMaster) => {
    setEditingItem(item);
    setFormData({
      examType: item.examType,
      standard: item.standard,
      term: item.term,
      weightage: String(item.weightage),
      sortOrder: String(item.sortOrder),
    });
    setShowModal(true);
  };

  const openDeleteModal = (item: ExamMaster) => {
    setDeleteItem(item);
    setShowDeleteModal(true);
  };

  const handleSave = () => {
    if (!formData.examType || !formData.standard || !formData.term || !formData.weightage || !formData.sortOrder) {
      return;
    }

    if (editingItem) {
      setData(prev => prev.map(item =>
        item.id === editingItem.id
          ? { ...item, examType: formData.examType, standard: formData.standard, term: formData.term, weightage: Number(formData.weightage), sortOrder: Number(formData.sortOrder) }
          : item
      ));
    } else {
      const newItem: ExamMaster = {
        id: Date.now().toString(),
        srNo: data.length + 1,
        examType: formData.examType,
        standard: formData.standard,
        term: formData.term,
        weightage: Number(formData.weightage),
        sortOrder: Number(formData.sortOrder),
      };
      setData(prev => [...prev, newItem]);
    }
    setShowModal(false);
  };

  const handleDelete = () => {
    if (deleteItem) {
      setData(prev => prev.filter(item => item.id !== deleteItem.id));
    }
    setShowDeleteModal(false);
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Exam Master</h1>
              <p className="text-sm text-slate-500">Manage exam types and configurations</p>
            </div>
          </div>
          <Button
            onClick={openAddModal}
            className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            + Add New
          </Button>
        </div>

        <Card className="border-slate-200/80 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative min-w-[260px] flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search by exam type, standard, or term"
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs font-medium text-slate-500">Show</Label>
                <select
                  value={pageSize}
                  onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <Label className="text-xs font-medium text-slate-500">entries</Label>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 font-semibold">SrNo.</th>
                  <th className="px-5 py-3 font-semibold">
                    <button onClick={() => handleSort('examType')} className="flex items-center gap-1 font-semibold text-slate-700 hover:text-blue-600">
                      Exam Type
                      {sortConfig?.key === 'examType' && (sortConfig.dir === 'asc' ? '↑' : '↓')}
                    </button>
                  </th>
                  <th className="px-5 py-3 font-semibold">
                    <button onClick={() => handleSort('standard')} className="flex items-center gap-1 font-semibold text-slate-700 hover:text-blue-600">
                      Standard
                      {sortConfig?.key === 'standard' && (sortConfig.dir === 'asc' ? '↑' : '↓')}
                    </button>
                  </th>
                  <th className="px-5 py-3 font-semibold">
                    <button onClick={() => handleSort('term')} className="flex items-center gap-1 font-semibold text-slate-700 hover:text-blue-600">
                      Term
                      {sortConfig?.key === 'term' && (sortConfig.dir === 'asc' ? '↑' : '↓')}
                    </button>
                  </th>
                  <th className="px-5 py-3 font-semibold">Weightage</th>
                  <th className="px-5 py-3 font-semibold">Sort Order</th>
                  <th className="px-5 py-3 text-center font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedData.length > 0 ? (
                  paginatedData.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/60">
                      <td className="px-5 py-4 text-slate-600">{item.srNo}</td>
                      <td className="px-5 py-4 font-medium text-slate-900">{item.examType}</td>
                      <td className="px-5 py-4 text-slate-600">{item.standard || '-'}</td>
                      <td className="px-5 py-4 text-slate-600">{item.term || '-'}</td>
                      <td className="px-5 py-4 text-slate-600">{item.weightage || '-'}</td>
                      <td className="px-5 py-4 text-slate-600">{item.sortOrder}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditModal(item)}
                            className="h-8 w-8 rounded-lg p-0 text-blue-600 hover:bg-blue-50"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openDeleteModal(item)}
                            className="h-8 w-8 rounded-lg p-0 text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-500">
                      No exam records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-500">
              {data.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, sortedData.length)} of {sortedData.length} records
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="h-8 w-8 rounded-lg p-0"
              >
                ‹
              </Button>
              <span className="px-2 text-sm font-medium text-slate-700">{currentPage} / {totalPages}</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="h-8 w-8 rounded-lg p-0"
              >
                ›
              </Button>
            </div>
          </div>
        </Card>

        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowModal(false)}></div>
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
              <div className="flex items-center justify-between p-6 border-b border-slate-200">
                <h2 className="text-xl font-bold text-slate-900">{editingItem ? 'Edit Exam' : 'Add Exam'}</h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  ×
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">Exam Type *</Label>
                  <Input
                    type="text"
                    placeholder="Enter exam type"
                    value={formData.examType}
                    onChange={e => setFormData({ ...formData, examType: e.target.value })}
                    className="h-10 rounded-lg border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">Standard *</Label>
                  <Select value={formData.standard} onValueChange={v => setFormData({ ...formData, standard: (v ?? '') as string })}>
                    <SelectTrigger className="h-10 rounded-lg border-slate-200">
                      <SelectValue placeholder="Select Standard" />
                    </SelectTrigger>
                    <SelectContent>
                      {standardOptions.slice(1).map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">Term *</Label>
                  <Select value={formData.term} onValueChange={v => setFormData({ ...formData, term: (v ?? '') as string })}>
                    <SelectTrigger className="h-10 rounded-lg border-slate-200">
                      <SelectValue placeholder="Select Term" />
                    </SelectTrigger>
                    <SelectContent>
                      {termOptions.slice(1).map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">Weightage *</Label>
                  <Input
                    type="number"
                    placeholder="Enter weightage"
                    value={formData.weightage}
                    onChange={e => setFormData({ ...formData, weightage: e.target.value })}
                    className="h-10 rounded-lg border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">Sort Order *</Label>
                  <Input
                    type="number"
                    placeholder="Enter sort order"
                    value={formData.sortOrder}
                    onChange={e => setFormData({ ...formData, sortOrder: e.target.value })}
                    className="h-10 rounded-lg border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 bg-slate-50">
                <Button variant="outline" onClick={() => setShowModal(false)} className="h-10 rounded-lg">
                  Cancel
                </Button>
                <Button onClick={handleSave} className="h-10 rounded-lg bg-blue-600 text-white hover:bg-blue-700">
                  {editingItem ? 'Update' : 'Save'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {showDeleteModal && deleteItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowDeleteModal(false)}></div>
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-2">Confirm Delete</h3>
              <p className="text-sm text-slate-600 mb-4">
                Are you sure you want to delete &ldquo;{deleteItem.examType}&rdquo;? This action cannot be undone.
              </p>
              <div className="flex items-center justify-end gap-3">
                <Button variant="outline" onClick={() => setShowDeleteModal(false)} className="h-9 rounded-lg">
                  Cancel
                </Button>
                <Button onClick={handleDelete} className="h-9 rounded-lg bg-red-600 text-white hover:bg-red-700">
                  Delete
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}