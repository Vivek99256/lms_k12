'use client';

/**
 * The Library module's AI Stack declaration.
 *
 * See `lib/exam/exam-ai-stack.ts` for what a descriptor is and what it is not. Nothing
 * here is a record.
 *
 * THREE TABLES, THREE DIFFERENT THINGS
 *
 *   `library_books`              the TITLE — 35,663 across this estate
 *   `library_items`              the COPY — one row per physical item
 *   `library_book_circulations`  the LOAN — 67,487 of them
 *
 * Confusing the first two is the easy mistake: a library with 35,663 titles does not have
 * 35,663 books on the shelf. So the catalogue read reports `copies` beside each title and
 * every published prompt forbids reporting a count of titles as a count of books.
 *
 * OVERDUE IS EXACT, AND IT IS THE ONE JUDGEMENT THIS MODULE MAKES
 *
 * A loan is out when no return date is recorded and overdue when the due date has also
 * passed — two recorded columns and no estimation. A loan with no due date is undated
 * rather than overdue and is excluded from every overdue count.
 *
 * WHAT IS NOT RECORDED
 *
 * No fine, no penalty, no reservation queue, no renewal count. So nothing may state what
 * anybody owes or that a book is reserved — and nothing may describe a named child as an
 * unreliable borrower. A child with an overdue book has an overdue book.
 */

import type { AiStackModule } from '@/app/_components/ai-stack/ai-stack-module';

export const LIBRARY_MODULE_KEY = 'library';

/** The route the Library AI Stack reports itself as when it builds a report. */
export const LIBRARY_AI_STACK_ROUTE = '/modules/library/ai-stack';

export const LIBRARY_AI_STACK: AiStackModule = {
  key: LIBRARY_MODULE_KEY,
  menuSlug: 'library',
  label: 'Library',
  records: 'library loans',
  record: 'library loan',
  route: LIBRARY_AI_STACK_ROUTE,
  subjectEntityKey: 'library_loan',

  copy: {
    centralRisk:
      'one catalogue row is a TITLE and not a book on the shelf — this estate holds 35,663 titles and a different number of physical copies — so every published prompt forbids reporting one count as the other. The second risk is about children: the system records no fine, penalty, reservation or renewal, so nothing may state what a borrower owes, and nothing may describe a named child as careless or unreliable. An overdue book is an overdue book.',
    policyNamePlaceholder: 'Library circulation policy',
    promptSystemDefault:
      'You summarise library circulation for a school librarian. Use only the records you are given. A loan is OUT when no return date is recorded and OVERDUE when the due date has also passed; a loan with no due date is undated, not overdue. One catalogue row is a TITLE, not a book on the shelf. This system records NO fine, penalty, reservation or renewal: never state what a borrower owes, and never describe a named child as an unreliable or careless borrower.',
    reportCanPrint: 'the titles, borrowers and dates come from the circulation record itself rather than from a model.',
    groundedOn: 'the loan records above, which is the stronger ground of the two.',
    capabilityAgent:
      'No agent manifest is bound to Library, so nothing here opens a case or chases a borrower. The tool agents on the Automations tab still read the catalogue and the loans.',
    capabilityWorkflow:
      'No workflow is bound to Library. Issuing a book, taking it back and deciding what to do about an overdue one stay a librarian’s acts.',
  },

  report: {
    defaultDataSource: 'library.circulation',
    // Exactly the arguments `library.circulation` accepts, from the tool's own schema.
    filters: [
      { key: 'state', label: 'State', kind: 'text', placeholder: 'any', hint: 'any, out, overdue or returned. A loan with no due date is undated, not overdue.' },
      { key: 'student_id', label: 'Borrower (student id)', kind: 'number', placeholder: 'all' },
      { key: 'book_id', label: 'Title id', kind: 'number', placeholder: 'all' },
      { key: 'from_date', label: 'Issued from', kind: 'text', placeholder: 'YYYY-MM-DD' },
      { key: 'to_date', label: 'Issued to', kind: 'text', placeholder: 'YYYY-MM-DD' },
      { key: 'limit', label: 'Rows', kind: 'number', defaultValue: '200' },
    ],
    operation: 'library_circulation_report',
    emptyNote:
      'No library loans matched those filters, so no report was created. A period with nothing issued returns nothing rather than the whole circulation history.',
  },

  presets: [
    {
      name: 'Circulation reader',
      description:
        'Reads loans, including the ones still out and the ones overdue. Changes nothing.',
      module: LIBRARY_MODULE_KEY,
      tools_allowed: ['library.circulation'],
      instructions:
        'A loan with no due date is undated and is not overdue — do not include one in an overdue count. No fine or penalty is recorded anywhere, so never state what a borrower owes. Never describe a named child as unreliable or careless: an overdue book is an overdue book.',
      status: 'active',
    },
    {
      name: 'Catalogue reader',
      description:
        'Reads titles with how many copies are held and how many are on loan. Changes nothing.',
      module: LIBRARY_MODULE_KEY,
      tools_allowed: ['library.catalogue'],
      instructions:
        'One row is a TITLE and not a book on the shelf — report `copies` when somebody asks how many books there are, and never present a count of titles as a count of books. No reservation is recorded, so never say a title is reserved or on hold.',
      status: 'active',
    },
  ],

  boundAgent: null,
  noAgentReason:
    'The catalogue and the loans are readable and overdue is an exact derivation, but the Library module has no agent manifest of its own. Chasing a child about a book is a librarian’s conversation, and no fine or escalation exists here for an agent to apply.',

  operations: {
    library_circulation_report: {
      key: 'library_circulation_report',
      label: 'Library circulation report',
      capability: 'generative',
      uses: 'report_template',
      prefers: ['report', 'circulation'],
    },
    library_summary: {
      key: 'library_summary',
      label: 'Library summary',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['summary'],
    },
    library_analysis: {
      key: 'library_analysis',
      label: 'Library circulation analysed',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['analysis'],
    },
    library_agent_run: {
      key: 'library_agent_run',
      label: 'Library agent run',
      capability: 'agent',
      uses: 'agent',
    },
  },
};
