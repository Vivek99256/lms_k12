'use client';

/**
 * The lesson-plan editor's rich-text form field: a small Tiptap wrapper (bold /
 * italic / underline / bullet / numbered list - matching what the old TinyMCE config
 * actually exposed on this screen, not a full toolbar) with an `AiFieldAssistant`
 * popover beside the label, same placement as the existing `CreateLessonPlanDialog`
 * usage. No reusable rich-text form field existed yet in this app; every other
 * component this editor uses is copied from an existing pattern, this is the one new
 * primitive.
 */

import { useEffect } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { Bold, Italic, Underline as UnderlineIcon, List, ListOrdered } from 'lucide-react';
import { AiFieldAssistant } from '@/components/ai/AiFieldAssistant';
import type { AiFieldType } from '@/lib/ai/field-edit/types';
import { Label } from '@/components/ui/label';
import { sanitizeHtml } from '@/lib/security/sanitize-html';
import { cn } from '@/lib/utils';

export interface RichTextFieldAiConfig {
  fieldType: AiFieldType;
  entityType: string;
  grade?: string | number | null;
  subject?: string | null;
  related?: Record<string, string>;
}

export interface RichTextFieldProps {
  label: string;
  value: string | null;
  onChange: (html: string) => void;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  ai: RichTextFieldAiConfig;
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        'flex size-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:pointer-events-none disabled:opacity-40',
        active && 'bg-slate-900/5 text-slate-900'
      )}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor, disabled }: { editor: Editor | null; disabled?: boolean }) {
  if (!editor) return null;

  return (
    <div className="flex items-center gap-0.5 border-b border-slate-100 px-1.5 py-1">
      <ToolbarButton
        label="Bold"
        active={editor.isActive('bold')}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Italic"
        active={editor.isActive('italic')}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Underline"
        active={editor.isActive('underline')}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Bullet list"
        active={editor.isActive('bulletList')}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Numbered list"
        active={editor.isActive('orderedList')}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="size-3.5" />
      </ToolbarButton>
    </div>
  );
}

export function RichTextField({ label, value, onChange, required, disabled, error, ai }: RichTextFieldProps) {
  const editor = useEditor({
    extensions: [StarterKit, Underline],
    content: value || '',
    editable: !disabled,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(sanitizeHtml(editor.getHTML())),
  });

  // Keep the editor in sync when `value` changes from outside a keystroke - loading
  // the document, resetting the form, or an AI Apply, which both go through `onChange`
  // but land here as a prop update rather than an editor transaction.
  useEffect(() => {
    if (!editor) return;
    const next = value || '';
    if (editor.getHTML() !== next) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-[13px] font-semibold text-slate-700" required={required}>
          {label}
        </Label>
        <AiFieldAssistant
          value={value ?? ''}
          onApply={onChange}
          label={label}
          module="course-master"
          page="Lesson plan"
          disabled={disabled}
          {...ai}
        />
      </div>
      <div
        className={cn(
          'rounded-xl border bg-white transition-colors focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20',
          error ? 'border-rose-300' : 'border-slate-200',
          disabled && 'cursor-not-allowed bg-slate-50 opacity-70'
        )}
      >
        <Toolbar editor={editor} disabled={disabled} />
        <EditorContent
          editor={editor}
          className="prose prose-sm max-w-none px-3 py-2.5 text-[14px] text-slate-800 prose-p:my-1.5 [&_.ProseMirror]:min-h-[88px] [&_.ProseMirror]:outline-none"
        />
      </div>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
