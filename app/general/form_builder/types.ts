export type FieldType = 'text' | 'textarea' | 'number' | 'email' | 'date' | 'select' | 'radio-group' | 'checkbox' | 'header' | 'paragraph';

export interface BuilderFieldOption {
  label: string;
  value: string;
}

export interface BuilderField {
  id: string;
  type: FieldType;
  label: string;
  name?: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
  className?: string;
  options?: BuilderFieldOption[];
  min?: number;
  max?: number;
  step?: number;
  rows?: number;
  description?: string;
  multiple?: boolean;
  maxlength?: number;
  subtype?: string;
}

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: 'Text Input',
  textarea: 'Textarea',
  number: 'Number',
  email: 'Email',
  date: 'Date',
  select: 'Dropdown',
  'radio-group': 'Radio Group',
  checkbox: 'Checkbox',
  header: 'Heading',
  paragraph: 'Paragraph',
};

export const FIELD_TYPE_ICONS: Record<FieldType, string> = {
  text: 'T',
  textarea: '¶',
  number: '#',
  email: '@',
  date: '📅',
  select: '▼',
  'radio-group': '◉',
  checkbox: '☑',
  header: 'H',
  paragraph: 'P',
};
