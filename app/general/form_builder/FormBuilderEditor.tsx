'use client';

import { useEffect, useState } from 'react';
import { GripVertical, Trash2, Plus, Settings2, X, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { type BuilderField, type FieldType, FIELD_TYPE_ICONS, FIELD_TYPE_LABELS } from './types';

function slugify(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'field';
}

const EMPTY_FIELD = (type: FieldType): BuilderField => {
  const label = FIELD_TYPE_LABELS[type];
  const base: BuilderField = {
    id: crypto.randomUUID(),
    type,
    label,
    name: type === 'header' || type === 'paragraph' ? '' : slugify(label),
    required: false,
    className: '',
  };

  switch (type) {
    case 'text':
      return { ...base, placeholder: 'Enter text', defaultValue: '', maxlength: 255, subtype: 'text' };
    case 'textarea':
      return { ...base, placeholder: 'Enter text', defaultValue: '', rows: 4, description: '', subtype: 'textarea' };
    case 'number':
      return { ...base, placeholder: 'Enter number', defaultValue: '', min: 0, max: 100, step: 1 };
    case 'email':
      return { ...base, placeholder: 'Enter email address', defaultValue: '', maxlength: 255, subtype: 'email' };
    case 'date':
      return { ...base, placeholder: '', defaultValue: '', subtype: 'date' };
    case 'select':
      return { ...base, placeholder: 'Select an option', options: [{ label: 'Option 1', value: '1' }, { label: 'Option 2', value: '2' }], multiple: false };
    case 'radio-group':
      return { ...base, options: [{ label: 'Option 1', value: '1' }, { label: 'Option 2', value: '2' }] };
    case 'checkbox':
      return { ...base, defaultValue: '', options: [{ label: 'Option 1', value: '1' }, { label: 'Option 2', value: '2' }] };
    case 'header':
      return { ...base, subtype: 'h2' };
    case 'paragraph':
      return { ...base, defaultValue: '', description: 'Paragraph text goes here.' };
    default:
      return base;
  }
};

function buildFormJson(fields: BuilderField[]): string {
  const data = fields.map((field) => {
    const obj: Record<string, unknown> = { type: field.type, label: field.label };

    if (field.name) obj.name = field.name;
    if (field.placeholder) obj.placeholder = field.placeholder;
    if (field.required) obj.required = true;
    if (field.className) obj.className = field.className;
    if (field.defaultValue) obj.value = field.defaultValue;

    switch (field.type) {
      case 'text':
      case 'email':
      case 'date':
        if (field.subtype) obj.subtype = field.subtype;
        if (field.maxlength) obj.maxlength = field.maxlength;
        break;
      case 'textarea':
        obj.subtype = field.subtype || 'textarea';
        if (field.rows) obj.rows = field.rows;
        if (field.description) obj.description = field.description;
        break;
      case 'number':
        if (field.min !== undefined) obj.min = field.min;
        if (field.max !== undefined) obj.max = field.max;
        if (field.step !== undefined) obj.step = field.step;
        break;
      case 'select':
        if (field.placeholder) obj.placeholder = field.placeholder;
        if (field.multiple) obj.multiple = true;
        if (field.options && field.options.length > 0) {
          obj.values = field.options.map((opt) => ({
            label: opt.label,
            value: opt.value,
          }));
        }
        break;
      case 'radio-group':
        if (field.options && field.options.length > 0) {
          obj.values = field.options.map((opt) => ({
            label: opt.label,
            value: opt.value,
          }));
        }
        break;
      case 'checkbox':
        if (field.options && field.options.length > 0) {
          obj.values = field.options.map((opt) => ({
            label: opt.label,
            value: opt.value,
          }));
        }
        break;
      case 'header':
        if (field.subtype) obj.subtype = field.subtype;
        break;
      case 'paragraph':
        if (field.description) obj.description = field.description;
        break;
    }

    return obj;
  });

  return JSON.stringify(data);
}

function buildFormXml(fields: BuilderField[]): string {
  const fieldNodes = fields
    .map((field) => {
      const attrs = `type="${field.type}" label="${escapeXml(field.label)}"${field.name ? ` name="${escapeXml(field.name)}"` : ''}${field.required ? ' required="true"' : ''}${field.className ? ` className="${escapeXml(field.className)}"` : ''}`;

      switch (field.type) {
        case 'text':
        case 'email':
        case 'date':
          return `<field ${attrs}${field.placeholder ? ` placeholder="${escapeXml(field.placeholder)}"` : ''}${field.subtype ? ` subtype="${escapeXml(field.subtype)}"` : ''}${field.maxlength ? ` maxlength="${field.maxlength}"` : ''}${field.defaultValue ? ` value="${escapeXml(field.defaultValue)}"` : ''} />`;
        case 'textarea':
          return `<field ${attrs}${field.placeholder ? ` placeholder="${escapeXml(field.placeholder)}"` : ''} subtype="${field.subtype || 'textarea'}"${field.rows ? ` rows="${field.rows}"` : ''}${field.description ? ` description="${escapeXml(field.description)}"` : ''}>${field.defaultValue ? escapeXml(field.defaultValue) : ''}</field>`;
        case 'number':
          return `<field ${attrs}${field.placeholder ? ` placeholder="${escapeXml(field.placeholder)}"` : ''}${field.min !== undefined ? ` min="${field.min}"` : ''}${field.max !== undefined ? ` max="${field.max}"` : ''}${field.step !== undefined ? ` step="${field.step}"` : ''}${field.defaultValue ? ` value="${escapeXml(field.defaultValue)}"` : ''} />`;
        case 'select':
          const optionNodes = (field.options || [])
            .map((opt) => `<option label="${escapeXml(opt.label)}" value="${escapeXml(opt.value)}" />`)
            .join('');
          return `<field ${attrs}${field.placeholder ? ` placeholder="${escapeXml(field.placeholder)}"` : ''}${field.multiple ? ' multiple="true"' : ''}>${optionNodes}</field>`;
        case 'radio-group':
          const radioNodes = (field.options || [])
            .map((opt) => `<option label="${escapeXml(opt.label)}" value="${escapeXml(opt.value)}" />`)
            .join('');
          return `<field ${attrs}>${radioNodes}</field>`;
        case 'checkbox':
          const checkboxNodes = (field.options || [])
            .map((opt) => `<option label="${escapeXml(opt.label)}" value="${escapeXml(opt.value)}" />`)
            .join('');
          return `<field ${attrs}${field.defaultValue ? ` value="${escapeXml(field.defaultValue)}"` : ''}>${checkboxNodes}</field>`;
        case 'header':
          return `<field ${attrs}${field.subtype ? ` subtype="${escapeXml(field.subtype)}"` : ''} />`;
        case 'paragraph':
          return `<field ${attrs}${field.description ? ` description="${escapeXml(field.description)}"` : ''}>${field.defaultValue ? escapeXml(field.defaultValue) : ''}</field>`;
        default:
          return `<field ${attrs} />`;
      }
    })
    .join('\n  ');

  return `<form>\n  ${fieldNodes}\n</form>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function parseFormJson(jsonStr: string): BuilderField[] {
  try {
    const data = JSON.parse(jsonStr);
    if (!Array.isArray(data)) return [];
    return data.map((item: Record<string, unknown>) => {
      const type = (item.type as FieldType) || 'text';
      const field: BuilderField = {
        id: crypto.randomUUID(),
        type,
        label: (item.label as string) || '',
        name: (item.name as string) || '',
        placeholder: (item.placeholder as string) || '',
        required: Boolean(item.required),
        defaultValue: (item.value as string) || '',
        className: (item.className as string) || '',
        subtype: (item.subtype as string) || undefined,
        maxlength: item.maxlength ? Number(item.maxlength) : undefined,
        min: item.min !== undefined ? Number(item.min) : undefined,
        max: item.max !== undefined ? Number(item.max) : undefined,
        step: item.step !== undefined ? Number(item.step) : undefined,
        rows: item.rows ? Number(item.rows) : undefined,
        description: (item.description as string) || undefined,
        multiple: Boolean(item.multiple),
      };

      if ((type === 'select' || type === 'radio-group' || type === 'checkbox')) {
        const source = Array.isArray(item.values) ? item.values : Array.isArray(item.options) ? item.options : [];
        if (source.length > 0) {
          field.options = source.map((opt: Record<string, unknown>) => ({
            label: (opt.label as string) || '',
            value: (opt.value as string) || '',
          }));
        }
      }

      return field;
    });
  } catch {
    return [];
  }
}

function FieldPreview({ field, onChange }: { field: BuilderField; onChange: (updates: Partial<BuilderField>) => void }) {
  const inputId = `preview-${field.id}`;
  const stop = (e: React.MouseEvent | React.PointerEvent) => e.stopPropagation();

  switch (field.type) {
    case 'text':
    case 'email':
      return (
        <input
          id={inputId}
          type={field.subtype || 'text'}
          placeholder={field.placeholder || ''}
          value={field.defaultValue || ''}
          maxLength={field.maxlength}
          onChange={(e) => onChange({ defaultValue: e.target.value })}
          onClick={stop}
          draggable={false}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      );
    case 'number':
      return (
        <input
          id={inputId}
          type="number"
          placeholder={field.placeholder || ''}
          value={field.defaultValue || ''}
          min={field.min}
          max={field.max}
          step={field.step}
          onChange={(e) => onChange({ defaultValue: e.target.value })}
          onClick={stop}
          draggable={false}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      );
    case 'date':
      return (
        <input
          id={inputId}
          type="date"
          value={field.defaultValue || ''}
          onChange={(e) => onChange({ defaultValue: e.target.value })}
          onClick={stop}
          draggable={false}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      );
    case 'textarea':
      return (
        <div>
          <textarea
            id={inputId}
            placeholder={field.placeholder || ''}
            value={field.defaultValue || ''}
            rows={field.rows || 4}
            onChange={(e) => onChange({ defaultValue: e.target.value })}
            onClick={stop}
            draggable={false}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          {field.description && <p className="mt-1 text-xs text-slate-500">{field.description}</p>}
        </div>
      );
    case 'select':
      return (
        <select
          id={inputId}
          value={field.defaultValue || ''}
          multiple={field.multiple}
          onChange={(e) => onChange({ defaultValue: e.target.value })}
          onClick={stop}
          draggable={false}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          {field.placeholder && <option value="">{field.placeholder}</option>}
          {(field.options || []).map((opt, idx) => (
            <option key={idx} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      );
    case 'radio-group':
      return (
        <div className="flex flex-wrap gap-4">
          {(field.options || []).map((opt, idx) => (
            <label key={idx} className="flex items-center gap-2 text-sm text-slate-700" onClick={stop}>
              <input
                type="radio"
                name={inputId}
                value={opt.value}
                checked={field.defaultValue === opt.value}
                onChange={() => onChange({ defaultValue: opt.value })}
                className="accent-blue-600"
              />
              {opt.label}
            </label>
          ))}
        </div>
      );
    case 'checkbox': {
      const checkedValues = (field.defaultValue || '').split(',').map((v) => v.trim()).filter(Boolean);
      return (
        <div className="flex flex-wrap gap-4">
          {(field.options || []).map((opt, idx) => (
            <label key={idx} className="flex items-center gap-2 text-sm text-slate-700" onClick={stop}>
              <input
                type="checkbox"
                value={opt.value}
                checked={checkedValues.includes(opt.value)}
                onChange={(e) => {
                  const next = e.target.checked
                    ? [...checkedValues, opt.value]
                    : checkedValues.filter((v) => v !== opt.value);
                  onChange({ defaultValue: next.join(',') });
                }}
                className="size-4 accent-blue-600"
              />
              {opt.label}
            </label>
          ))}
        </div>
      );
    }
    case 'header':
      const HeadingTag = field.subtype === 'h1' ? 'h1' : field.subtype === 'h2' ? 'h2' : field.subtype === 'h3' ? 'h3' : field.subtype === 'h4' ? 'h4' : field.subtype === 'h5' ? 'h5' : field.subtype === 'h6' ? 'h6' : 'h2';
      return <HeadingTag className={`text-lg font-bold text-slate-900 ${field.className || ''}`}>{field.label}</HeadingTag>;
    case 'paragraph':
      return (
        <div>
          {field.description && <p className={`text-sm text-slate-600 ${field.className || ''}`}>{field.description}</p>}
        </div>
      );
    default:
      return null;
  }
}

export default function FormBuilderEditor({
  initialFormName = '',
  initialFields = [],
  recordId,
  onSave,
  onCancel,
}: {
  initialFormName?: string;
  initialFields?: BuilderField[];
  recordId?: number;
  onSave: (data: { form_name: string; form_json: string; form_xml: string; form_active: boolean }) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [formName, setFormName] = useState(initialFormName);
  const [fields, setFields] = useState<BuilderField[]>(initialFields);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [paletteDragType, setPaletteDragType] = useState<FieldType | null>(null);

  const editingField = fields.find((f) => f.id === editingFieldId) || null;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFormName(initialFormName);
    setFields(initialFields);
    setSelectedFieldId(null);
    setEditingFieldId(null);
    setError('');
  }, [initialFormName, initialFields]);

  function addField(type: FieldType) {
    const newField = EMPTY_FIELD(type);
    setFields((current) => [...current, newField]);
    setSelectedFieldId(newField.id);
  }

  function updateField(id: string, updates: Partial<BuilderField>) {
    setFields((current) =>
      current.map((field) => (field.id === id ? { ...field, ...updates } : field))
    );
  }

  function removeField(id: string) {
    setFields((current) => current.filter((field) => field.id !== id));
    setSelectedFieldId((current) => (current === id ? null : current));
    setEditingFieldId((current) => (current === id ? null : current));
  }

  function moveField(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;
    setFields((current) => {
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  function duplicateField(id: string) {
    const index = fields.findIndex((f) => f.id === id);
    if (index === -1) return;
    const field = fields[index];
    const copy = { ...field, id: crypto.randomUUID(), label: `${field.label} (Copy)`, name: field.name ? `${field.name}_copy` : '' };
    setFields((current) => {
      const next = [...current];
      next.splice(index + 1, 0, copy);
      return next;
    });
    setSelectedFieldId(copy.id);
  }

  function handleDragStart(index: number) {
    setDragIndex(index);
    setPaletteDragType(null);
  }

  function handlePaletteDragStart(type: FieldType) {
    setPaletteDragType(type);
    setDragIndex(null);
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    setDragOverIndex(index);
  }

  function handleCanvasDragOver(e: React.DragEvent) {
    e.preventDefault();
    if (paletteDragType) {
      e.dataTransfer.dropEffect = 'copy';
    }
  }

  function handleDrop(index: number) {
    if (paletteDragType) {
      addField(paletteDragType);
      setPaletteDragType(null);
      setDragOverIndex(null);
      return;
    }
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    moveField(dragIndex, index);
    setDragIndex(null);
    setDragOverIndex(null);
  }

  function handleCanvasDrop(e: React.DragEvent) {
    e.preventDefault();
    if (paletteDragType) {
      addField(paletteDragType);
      setPaletteDragType(null);
    }
    setDragIndex(null);
    setDragOverIndex(null);
  }

  function handleDragEnd() {
    setDragIndex(null);
    setDragOverIndex(null);
    setPaletteDragType(null);
  }

  async function handleSave() {
    if (!formName.trim()) {
      setError('Form name is required.');
      return;
    }
    if (fields.length === 0) {
      setError('Please add at least one field to the form.');
      return;
    }

    const formJson = buildFormJson(fields);
    const formXml = buildFormXml(fields);

    setSaving(true);
    setError('');
    try {
      await onSave({
        form_name: formName.trim(),
        form_json: formJson,
        form_xml: formXml,
        form_active: false,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save form.');
    } finally {
      setSaving(false);
    }
  }

  function handleClear() {
    if (!window.confirm('Clear all fields? This cannot be undone.')) return;
    setFields([]);
    setSelectedFieldId(null);
    setEditingFieldId(null);
    setError('');
  }

  const fieldPaletteItems = (Object.keys(FIELD_TYPE_LABELS) as FieldType[]).map((type) => ({
    type,
    label: FIELD_TYPE_LABELS[type],
    icon: FIELD_TYPE_ICONS[type],
  }));

  return (
    <div className="flex h-[calc(100vh-120px)] flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-1 items-center gap-3">
          <Input
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="Enter form name"
            className="max-w-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleClear} disabled={saving || fields.length === 0}>
            Clear
          </Button>
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
            {recordId ? 'Update' : 'Save'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Left Palette */}
        <div className="w-56 border-r border-slate-200 bg-slate-50 p-3 overflow-y-auto">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Fields</h3>
          <div className="space-y-1.5">
            {fieldPaletteItems.map((item) => (
              <button
                key={item.type}
                type="button"
                draggable
                onDragStart={() => handlePaletteDragStart(item.type)}
                onClick={() => addField(item.type)}
                className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:border-blue-300 hover:bg-blue-50"
              >
                <span className="flex size-6 items-center justify-center rounded-md bg-slate-100 text-xs font-bold text-slate-600">
                  {item.icon}
                </span>
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Center Canvas */}
        <div
          className="flex-1 overflow-y-auto bg-slate-100 p-6"
          onDragOver={handleCanvasDragOver}
          onDrop={handleCanvasDrop}
        >
          <div className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            {fields.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <Plus className="size-6" />
                </div>
                <p className="text-sm font-medium text-slate-600">No fields added yet</p>
                <p className="mt-1 text-xs text-slate-400">Click or drag a field type from the left panel to add it here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {fields.map((field, index) => {
                  const isSelected = field.id === selectedFieldId;
                  const isDragOver = dragOverIndex === index && dragIndex !== index;
                  const isDragging = dragIndex === index;

                  const isEditing = field.id === editingFieldId;

                  return (
                    <div
                      key={field.id}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDrop={() => handleDrop(index)}
                      onClick={() => setSelectedFieldId(field.id)}
                      className={[
                        'group relative rounded-xl border-2 p-4 transition-all',
                        isEditing ? 'border-blue-500 ring-2 ring-blue-500/20' : isSelected ? 'border-blue-300' : 'border-slate-200 hover:border-slate-300',
                        isDragging ? 'opacity-50' : '',
                        isDragOver ? 'border-blue-300 border-dashed' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <span
                          draggable
                          onDragStart={() => handleDragStart(index)}
                          onDragEnd={handleDragEnd}
                          onClick={(e) => e.stopPropagation()}
                          className="cursor-grab text-slate-400 hover:text-slate-600"
                          title="Drag to reorder"
                        >
                          <GripVertical className="size-4" />
                        </span>
                        {field.type !== 'header' && field.type !== 'paragraph' && (
                          <span className="text-sm font-medium text-slate-800">
                            {field.label || 'Untitled field'}
                            {field.required && <span className="ml-1 text-red-500">*</span>}
                          </span>
                        )}
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          {FIELD_TYPE_LABELS[field.type]}
                        </span>
                      </div>

                      <div>
                        <FieldPreview field={field} onChange={(updates) => updateField(field.id, updates)} />
                      </div>

                      <div className="mt-3 flex items-center justify-end gap-1 border-t border-slate-100 pt-2">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={(e) => { e.stopPropagation(); moveField(index, index - 1); }}
                          disabled={index === 0}
                          className="h-7 w-7 text-slate-400 hover:text-blue-600 disabled:pointer-events-none disabled:opacity-30"
                          title="Move up"
                        >
                          <ArrowUp className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={(e) => { e.stopPropagation(); moveField(index, index + 1); }}
                          disabled={index === fields.length - 1}
                          className="mr-auto h-7 w-7 text-slate-400 hover:text-blue-600 disabled:pointer-events-none disabled:opacity-30"
                          title="Move down"
                        >
                          <ArrowDown className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); setSelectedFieldId(field.id); setEditingFieldId(isEditing ? null : field.id); }}
                          className={`h-7 gap-1 px-2 text-xs ${isEditing ? 'text-blue-600' : 'text-slate-500 hover:text-blue-600'}`}
                          title="Edit properties"
                        >
                          <Settings2 className="size-3.5" /> Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={(e) => { e.stopPropagation(); duplicateField(field.id); }}
                          className="h-7 w-7 text-slate-400 hover:text-blue-600"
                          title="Duplicate"
                        >
                          <Plus className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={(e) => { e.stopPropagation(); removeField(field.id); }}
                          className="h-7 w-7 text-slate-400 hover:text-red-600"
                          title="Delete"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
                <div
                  onDragOver={handleCanvasDragOver}
                  onDrop={handleCanvasDrop}
                  className="flex h-16 items-center justify-center rounded-xl border-2 border-dashed border-slate-200 text-xs text-slate-400"
                >
                  Drop here to add to the end
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Properties Panel — shown only while editing a field */}
        {editingField && (
          <div className="w-80 shrink-0 border-l border-slate-200 bg-white p-4 overflow-y-auto">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">Field Properties</h3>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                    {FIELD_TYPE_LABELS[editingField.type]}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setEditingFieldId(null)}
                    className="h-6 w-6 text-slate-400 hover:text-slate-700"
                    title="Close properties panel"
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <Label htmlFor="prop-label" className="text-xs font-medium text-slate-600">Label</Label>
                  <Input
                    id="prop-label"
                    value={editingField.label}
                    onChange={(e) => updateField(editingField.id, { label: e.target.value })}
                    className="mt-1"
                  />
                </div>

                {editingField.type !== 'header' && editingField.type !== 'paragraph' && (
                  <div>
                    <Label htmlFor="prop-name" className="text-xs font-medium text-slate-600">Field Name</Label>
                    <Input
                      id="prop-name"
                      value={editingField.name || ''}
                      onChange={(e) => updateField(editingField.id, { name: e.target.value })}
                      className="mt-1 font-mono text-xs"
                      placeholder="auto-generated from label"
                    />
                  </div>
                )}

                {(editingField.type === 'text' || editingField.type === 'email' || editingField.type === 'date' || editingField.type === 'number') && (
                  <div>
                    <Label htmlFor="prop-placeholder" className="text-xs font-medium text-slate-600">Placeholder</Label>
                    <Input
                      id="prop-placeholder"
                      value={editingField.placeholder || ''}
                      onChange={(e) => updateField(editingField.id, { placeholder: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                )}

                {(editingField.type === 'text' || editingField.type === 'email' || editingField.type === 'number' || editingField.type === 'date') && (
                  <div>
                    <Label htmlFor="prop-default" className="text-xs font-medium text-slate-600">Default Value</Label>
                    <Input
                      id="prop-default"
                      value={editingField.defaultValue || ''}
                      onChange={(e) => updateField(editingField.id, { defaultValue: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                )}

                {editingField.type === 'text' && (
                  <div>
                    <Label htmlFor="prop-subtype" className="text-xs font-medium text-slate-600">Input Type</Label>
                    <select
                      id="prop-subtype"
                      value={editingField.subtype || 'text'}
                      onChange={(e) => updateField(editingField.id, { subtype: e.target.value })}
                      className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                    >
                      <option value="text">Text</option>
                      <option value="email">Email</option>
                      <option value="password">Password</option>
                      <option value="tel">Phone</option>
                      <option value="url">URL</option>
                    </select>
                  </div>
                )}

                {editingField.type === 'email' && (
                  <div>
                    <Label htmlFor="prop-subtype" className="text-xs font-medium text-slate-600">Input Type</Label>
                    <select
                      id="prop-subtype"
                      value={editingField.subtype || 'email'}
                      onChange={(e) => updateField(editingField.id, { subtype: e.target.value })}
                      className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                    >
                      <option value="email">Email</option>
                      <option value="text">Text</option>
                      <option value="password">Password</option>
                    </select>
                  </div>
                )}

                {editingField.type === 'header' && (
                  <div>
                    <Label htmlFor="prop-subtype" className="text-xs font-medium text-slate-600">Heading Tag</Label>
                    <select
                      id="prop-subtype"
                      value={editingField.subtype || 'h2'}
                      onChange={(e) => updateField(editingField.id, { subtype: e.target.value })}
                      className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                    >
                      <option value="h1">H1</option>
                      <option value="h2">H2</option>
                      <option value="h3">H3</option>
                      <option value="h4">H4</option>
                      <option value="h5">H5</option>
                      <option value="h6">H6</option>
                    </select>
                  </div>
                )}

                {editingField.type === 'textarea' && (
                  <>
                    <div>
                      <Label htmlFor="prop-rows" className="text-xs font-medium text-slate-600">Rows</Label>
                      <Input
                        id="prop-rows"
                        type="number"
                        min={1}
                        max={20}
                        value={editingField.rows || 4}
                        onChange={(e) => updateField(editingField.id, { rows: parseInt(e.target.value, 10) || 4 })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="prop-description" className="text-xs font-medium text-slate-600">Description / Help Text</Label>
                      <Textarea
                        id="prop-description"
                        value={editingField.description || ''}
                        onChange={(e) => updateField(editingField.id, { description: e.target.value })}
                        className="mt-1"
                        rows={2}
                      />
                    </div>
                  </>
                )}

                {editingField.type === 'paragraph' && (
                  <div>
                    <Label htmlFor="prop-content" className="text-xs font-medium text-slate-600">Content</Label>
                    <Textarea
                      id="prop-content"
                      value={editingField.description || editingField.defaultValue || ''}
                      onChange={(e) => updateField(editingField.id, { description: e.target.value, defaultValue: e.target.value })}
                      className="mt-1"
                      rows={3}
                    />
                  </div>
                )}

                {editingField.type === 'number' && (
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label htmlFor="prop-min" className="text-xs font-medium text-slate-600">Min</Label>
                      <Input
                        id="prop-min"
                        type="number"
                        value={editingField.min ?? 0}
                        onChange={(e) => updateField(editingField.id, { min: Number(e.target.value) })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="prop-max" className="text-xs font-medium text-slate-600">Max</Label>
                      <Input
                        id="prop-max"
                        type="number"
                        value={editingField.max ?? 100}
                        onChange={(e) => updateField(editingField.id, { max: Number(e.target.value) })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="prop-step" className="text-xs font-medium text-slate-600">Step</Label>
                      <Input
                        id="prop-step"
                        type="number"
                        value={editingField.step ?? 1}
                        onChange={(e) => updateField(editingField.id, { step: Number(e.target.value) })}
                        className="mt-1"
                      />
                    </div>
                  </div>
                )}

                {(editingField.type === 'text' || editingField.type === 'email') && (
                  <div>
                    <Label htmlFor="prop-maxlength" className="text-xs font-medium text-slate-600">Max Length</Label>
                    <Input
                      id="prop-maxlength"
                      type="number"
                      min={1}
                      value={editingField.maxlength || 255}
                      onChange={(e) => updateField(editingField.id, { maxlength: parseInt(e.target.value, 10) || 255 })}
                      className="mt-1"
                    />
                  </div>
                )}

                {editingField.type === 'select' && (
                  <div>
                    <Label className="text-xs font-medium text-slate-600">Options</Label>
                    <div className="mt-1 space-y-1.5">
                      {(editingField.options || []).map((opt, idx) => (
                        <div key={idx} className="flex items-center gap-1.5">
                          <Input
                            value={opt.label}
                            onChange={(e) => {
                              const newOpts = [...(editingField.options || [])];
                              newOpts[idx] = { ...newOpts[idx], label: e.target.value };
                              updateField(editingField.id, { options: newOpts });
                            }}
                            placeholder="Label"
                            className="h-8 text-xs"
                          />
                          <Input
                            value={opt.value}
                            onChange={(e) => {
                              const newOpts = [...(editingField.options || [])];
                              newOpts[idx] = { ...newOpts[idx], value: e.target.value };
                              updateField(editingField.id, { options: newOpts });
                            }}
                            placeholder="Value"
                            className="h-8 w-20 text-xs font-mono"
                          />
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => {
                              const newOpts = (editingField.options || []).filter((_, i) => i !== idx);
                              updateField(editingField.id, { options: newOpts });
                            }}
                            className="h-7 w-7 shrink-0 text-slate-400 hover:text-red-600"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const newOpts = [...(editingField.options || []), { label: `Option ${(editingField.options?.length || 0) + 1}`, value: String((editingField.options?.length || 0) + 1) }];
                          updateField(editingField.id, { options: newOpts });
                        }}
                        className="h-7 w-full text-xs"
                      >
                        <Plus className="mr-1 size-3.5" /> Add Option
                      </Button>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="prop-multiple"
                        checked={editingField.multiple || false}
                        onChange={(e) => updateField(editingField.id, { multiple: e.target.checked })}
                        className="size-3.5 accent-blue-600"
                      />
                      <Label htmlFor="prop-multiple" className="text-xs text-slate-600">Allow multiple selection</Label>
                    </div>
                  </div>
                )}

                {(editingField.type === 'radio-group' || editingField.type === 'checkbox') && (
                  <div>
                    <Label className="text-xs font-medium text-slate-600">Options</Label>
                    <div className="mt-1 space-y-1.5">
                      {(editingField.options || []).map((opt, idx) => (
                        <div key={idx} className="flex items-center gap-1.5">
                          <Input
                            value={opt.label}
                            onChange={(e) => {
                              const newOpts = [...(editingField.options || [])];
                              newOpts[idx] = { ...newOpts[idx], label: e.target.value };
                              updateField(editingField.id, { options: newOpts });
                            }}
                            placeholder="Label"
                            className="h-8 text-xs"
                          />
                          <Input
                            value={opt.value}
                            onChange={(e) => {
                              const newOpts = [...(editingField.options || [])];
                              newOpts[idx] = { ...newOpts[idx], value: e.target.value };
                              updateField(editingField.id, { options: newOpts });
                            }}
                            placeholder="Value"
                            className="h-8 w-20 text-xs font-mono"
                          />
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => {
                              const newOpts = (editingField.options || []).filter((_, i) => i !== idx);
                              updateField(editingField.id, { options: newOpts });
                            }}
                            className="h-7 w-7 shrink-0 text-slate-400 hover:text-red-600"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const newOpts = [...(editingField.options || []), { label: `Option ${(editingField.options?.length || 0) + 1}`, value: String((editingField.options?.length || 0) + 1) }];
                          updateField(editingField.id, { options: newOpts });
                        }}
                        className="h-7 w-full text-xs"
                      >
                        <Plus className="mr-1 size-3.5" /> Add Option
                      </Button>
                    </div>
                  </div>
                )}

                <div>
                  <Label htmlFor="prop-class" className="text-xs font-medium text-slate-600">CSS Class</Label>
                  <Input
                    id="prop-class"
                    value={editingField.className || ''}
                    onChange={(e) => updateField(editingField.id, { className: e.target.value })}
                    className="mt-1 font-mono text-xs"
                    placeholder="form-control"
                  />
                </div>

                <div className="flex items-center gap-2 rounded-lg border border-slate-200 p-2">
                  <input
                    type="checkbox"
                    id="prop-required"
                    checked={editingField.required || false}
                    onChange={(e) => updateField(editingField.id, { required: e.target.checked })}
                    className="size-4 accent-blue-600"
                  />
                  <Label htmlFor="prop-required" className="text-sm font-medium text-slate-700">Required field</Label>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export { buildFormJson, buildFormXml, parseFormJson };
