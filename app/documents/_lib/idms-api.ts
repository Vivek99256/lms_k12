'use client';

import { buildSessionContext, createAuthHeaders } from '@/lib/erp-client';

export interface DocumentItem {
  id: number;
  title: string;
  original_file_name: string;
  mime_type: string;
  size: number;
  current_version: number;
  document_type: string | null;
  category: string | null;
  department_id: number | null;
  department_name: string | null;
  subject: string | null;
  document_date: string | null;
  academic_year: string | null;
  organization: string | null;
  project: string | null;
  lifecycle_status: 'active' | 'expired' | 'archived' | 'filed';
  summary: string | null;
  confidence: number | null;
  people: string[];
  keywords: string[];
  tags: Array<{ name: string; source: 'ai' | 'user'; status: 'accepted' | 'suggested' | 'rejected' }>;
  tag_names: string[];
  owner_id: number;
  owner_name: string | null;
  visibility: 'private' | 'department' | 'organization';
  permissions: any[];
  processing_status: 'pending' | 'processing' | 'ready_for_review' | 'done' | 'failed';
  processing_error: string | null;
  warnings: any[];
  logical_location: {
    root: string;
    department: string;
    document_type: string;
    academic_year: string;
    subject: string;
    path: string;
  };
  snippet?: string;
  created_at: string;
  updated_at: string;
}

export interface SearchParseResult {
  raw_query: string;
  keywords: string;
  filters: Record<string, string>;
  chips: Array<{ field: string; label: string; value: string }>;
}

export interface BrowseTreeItem {
  id: number;
  name: string;
  count: number;
  types: Array<{
    name: string;
    count: number;
    years: Array<{ year: string; count: number }>;
  }>;
}

export interface TagCloudItem {
  name: string;
  count: number;
}

async function requestApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const session = buildSessionContext();
  const base = session.baseUrl || '';

  const headers = {
    ...createAuthHeaders(session),
    ...(options.headers || {}),
  };

  const response = await fetch(`${base}/api/v1${path}`, {
    ...options,
    headers,
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.status === 0) {
    throw new Error(json.message || `Request failed with code ${response.status}`);
  }
  return json as T;
}

export const IdmsApi = {
  async listDocuments(params: Record<string, string | number | undefined> = {}) {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') q.set(k, String(v));
    });
    return requestApi<{ status: number; data: DocumentItem[]; pagination: any }>(`/documents?${q.toString()}`);
  },

  async uploadDocument(file: File, visibility: string = 'organization') {
    const session = buildSessionContext();
    const base = session.baseUrl || '';
    const form = new FormData();
    form.append('file', file);
    form.append('visibility', visibility);
    if (session.subInstituteId) form.append('sub_institute_id', session.subInstituteId);
    if (session.userId) form.append('user_id', session.userId);

    const headers: Record<string, string> = {};
    if (session.token) headers['Authorization'] = `Bearer ${session.token}`;

    const res = await fetch(`${base}/api/v1/documents`, {
      method: 'POST',
      body: form,
      headers,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.status === 0) throw new Error(json.message || 'Upload failed');
    return json;
  },

  async getDocument(id: number) {
    return requestApi<{ status: number; data: DocumentItem }>(`/documents/${id}`);
  },

  async confirmDocument(id: number, edits: Partial<DocumentItem>) {
    return requestApi<{ status: number; data: DocumentItem }>(`/documents/${id}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(edits),
    });
  },

  async updateTags(id: number, tags: any[]) {
    return requestApi<{ status: number; tags: any[] }>(`/documents/${id}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags }),
    });
  },

  async parseSearch(query: string) {
    return requestApi<{ status: number; data: SearchParseResult }>(`/search/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
  },

  async getBrowseTree() {
    return requestApi<{ status: number; data: BrowseTreeItem[] }>(`/browse/tree`);
  },

  async getTags() {
    return requestApi<{ status: number; data: TagCloudItem[] }>(`/tags`);
  },

  async getPreviewUrl(id: number) {
    return requestApi<{ status: number; preview_url: string; mime_type: string }>(`/documents/${id}/preview`);
  },

  async getDownloadUrl(id: number) {
    return requestApi<{ status: number; download_url: string; file_name: string }>(`/documents/${id}/download`);
  },

  async getVersions(id: number) {
    return requestApi<{ status: number; versions: any[] }>(`/documents/${id}/versions`);
  },

  async restoreVersion(id: number, versionNumber: number) {
    return requestApi<{ status: number; message: string }>(`/documents/${id}/versions/${versionNumber}/restore`, {
      method: 'POST',
    });
  },

  async getAuditLogs(documentId?: number) {
    const q = documentId ? `?document_id=${documentId}` : '';
    return requestApi<{ status: number; data: any[]; pagination: any }>(`/audit${q}`);
  },
};
