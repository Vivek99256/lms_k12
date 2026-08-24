'use client';

/**
 * Result templates — CRUD over the report-card HTML templates, backed by
 * the dedicated `api/result/result-template` REST API (validates
 * module_name/title/html_content server-side; native PUT/DELETE routes
 * work transparently with MasterCrud's spoofed-POST client via Laravel's
 * method-override).
 */

import React from 'react';
import { ExternalLink, FileCode2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/result/PageHeader';
import MasterCrud from '@/components/result/MasterCrud';
import type { MasterScreenDef } from '@/lib/result/types';

const SCREEN: MasterScreenDef = {
  slug: 'result-templates',
  title: 'Result templates',
  subtitle: 'Report card HTML templates with placeholder tags',
  icon: FileCode2,
  api: {
    index: 'api/result/result-template',
    store: 'api/result/result-template',
    update: 'api/result/result-template',
    destroy: 'api/result/result-template',
  },
  entityName: 'template',
  columns: [
    { key: 'id', header: 'Id', mono: true, width: '70px' },
    { key: 'module_name', header: 'Module name', sortable: true, searchable: true },
    { key: 'title', header: 'Title', sortable: true, searchable: true },
    { key: 'user_created', header: 'Created by' },
    { key: 'created_at', header: 'Created on' },
  ],
  fields: [
    { name: 'module_name', label: 'Module name', type: 'text', required: true, maxLength: 255, section: 'Template' },
    { name: 'title', label: 'Result type', type: 'text', required: true, maxLength: 255, section: 'Template' },
    { name: 'html_content', label: 'HTML content', type: 'editor', required: true, section: 'Template' },
  ],
};

export default function ResultTemplatesPage() {
  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto space-y-6">
        <PageHeader
          icon={FileCode2}
          title="Result templates"
          subtitle="Report card HTML templates with placeholder tags"
          breadcrumbs={[
            { label: 'Result', href: '/result' },
            { label: 'Entry' },
            { label: 'Result templates' },
          ]}
          actions={
            <Button
              type="button"
              variant="outline"
              onClick={() => window.open('/api/proxy?path=api/result/result-template/tags', '_blank')}
              className="h-9 rounded-lg px-4 text-sm font-medium"
            >
              <ExternalLink className="h-4 w-4" />
              View default tags
            </Button>
          }
        />

        <MasterCrud screen={SCREEN} embedded />
      </div>
    </div>
  );
}
