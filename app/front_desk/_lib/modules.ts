export type ModuleField = {
  name: string;
  label: string;
  type: 'text' | 'date' | 'textarea' | 'select' | 'file' | 'checkbox';
  required?: boolean;
  multiple?: boolean;
  options?: Array<{ label: string; value: string }>;
  optionsEndpoint?: string;
  optionsDataKey?: string;
  accept?: string;
  visibleWhen?: { field: string; value: string };
};

export type ModuleColumn = {
  key: string;
  label: string;
};

export type FrontDeskModule = {
  title: string;
  description: string;
  endpoint: string;
  storeEndpoint?: string;
  method?: 'GET' | 'POST';
  classFields?: Array<'section' | 'standard' | 'division'>;
  /** Parameter names expected by legacy report endpoints for the class picker. */
  classFieldParams?: Partial<Record<'section' | 'standard' | 'division', string>>;
  multipleClassFields?: boolean;
  fields?: ModuleField[];
  /** Values required by legacy endpoints even when their related control is hidden. */
  defaultFormValues?: Record<string, string>;
  filters?: ModuleField[];
  columns: ModuleColumn[];
  submitLabel?: string;
  report?: boolean;
  supportsPrint?: boolean;
};

export const frontDeskModules = {
  gallery: {
    title: 'Photo video gallery',
    description: 'Publish class-targeted photo albums and video links.',
    endpoint: 'front_desk/photo_video_gallary',
    storeEndpoint: 'front_desk/photo_video_gallary',
    method: 'GET',
    classFields: ['section', 'standard', 'division'],
    multipleClassFields: true,
    fields: [
      { name: 'date_', label: 'Date', type: 'date', required: true },
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'album_title', label: 'Album title', type: 'text', required: true },
      {
        name: 'type',
        label: 'Type',
        type: 'select',
        required: true,
        options: [
          { label: 'Photo', value: 'Photo' },
          { label: 'Video', value: 'Video' },
        ],
      },
      {
        name: 'attachment[]',
        label: 'Photos',
        type: 'file',
        multiple: true,
        accept: 'image/*',
        visibleWhen: { field: 'type', value: 'Photo' },
      },
      {
        name: 'youtube_link',
        label: 'YouTube link',
        type: 'text',
        visibleWhen: { field: 'type', value: 'Video' },
      },
    ],
    defaultFormValues: { youtube_link: '' },
    columns: [
      { key: 'album_title', label: 'Album' },
      { key: 'title', label: 'Title' },
      { key: 'type', label: 'Type' },
      { key: 'date_', label: 'Date' },
      { key: 'std_name', label: 'Standard' },
      { key: 'div_name', label: 'Division' },
      { key: 'ai', label: 'Status' },
    ],
    submitLabel: 'Publish media',
  },
  circular: {
    title: 'Circular',
    description: 'Publish circulars to selected classes or all standards.',
    endpoint: 'front_desk/circular',
    storeEndpoint: 'front_desk/circular',
    method: 'GET',
    classFields: ['section', 'standard', 'division'],
    multipleClassFields: true,
    fields: [
      { name: 'date_', label: 'Date', type: 'date', required: true },
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'type', label: 'Circular type ID', type: 'text', required: true },
      { name: 'message', label: 'Message', type: 'textarea' },
      {
        name: 'attachment[]',
        label: 'Attachment',
        type: 'file',
        accept: 'image/*,application/pdf',
      },
      { name: 'allstd', label: 'Send to all standards', type: 'checkbox' },
    ],
    columns: [
      { key: 'circular_type', label: 'Type' },
      { key: 'title', label: 'Title' },
      { key: 'message', label: 'Message' },
      { key: 'date_', label: 'Date' },
      { key: 'std_name', label: 'Standard' },
      { key: 'div_name', label: 'Division' },
      { key: 'file_name', label: 'File' },
    ],
    submitLabel: 'Publish circular',
  },
  examSchedule: {
    title: 'Exam schedule',
    description: 'Publish exam schedules and supporting documents by class.',
    endpoint: 'front_desk/exam_schedule',
    storeEndpoint: 'front_desk/exam_schedule',
    method: 'GET',
    classFields: ['section', 'standard', 'division'],
    multipleClassFields: true,
    fields: [
      { name: 'date_', label: 'Date', type: 'date', required: true },
      { name: 'title', label: 'Title', type: 'text', required: true },
      {
        name: 'attechment',
        label: 'Schedule file',
        type: 'file',
        required: true,
        accept: 'image/*,application/pdf',
      },
    ],
    columns: [
      { key: 'syear', label: 'Academic year' },
      { key: 'title', label: 'Title' },
      { key: 'date_', label: 'Date' },
      { key: 'std_name', label: 'Standard' },
      { key: 'div_name', label: 'Division' },
      { key: 'file_name', label: 'File' },
    ],
    submitLabel: 'Publish schedule',
  },
  calendar: {
    title: 'Calendar',
    description: 'Maintain class events and vacations in the academic calendar.',
    endpoint: 'calendar/calendar',
    storeEndpoint: 'calendar/calendar',
    method: 'GET',
    classFields: ['section', 'standard'],
    multipleClassFields: true,
    fields: [
      { name: 'school_date', label: 'Event date', type: 'date', required: true },
      { name: 'title', label: 'Event name', type: 'text', required: true },
      { name: 'description', label: 'Description', type: 'textarea' },
      {
        name: 'event_type',
        label: 'Event type',
        type: 'select',
        required: true,
        options: [
          { label: 'Event', value: 'event' },
          { label: 'Vacation', value: 'vacation' },
        ],
      },
    ],
    columns: [
      { key: 'standard', label: 'Standard' },
      { key: 'title', label: 'Title' },
      { key: 'description', label: 'Description' },
      { key: 'school_date', label: 'Date' },
      { key: 'event_type', label: 'Type' },
    ],
    submitLabel: 'Add event',
  },
} satisfies Record<string, FrontDeskModule>;
