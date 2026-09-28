'use client';

import React from 'react';
import { useEditor } from '@craftjs/core';
import { X } from 'lucide-react';

type TabKey = 'content' | 'design' | 'data' | 'action' | 'list';

/** Which extra tabs (beyond Content/Design) a block type gets, keyed by its Craft resolvedName -- see shared/layoutTransform.ts's RESOLVER. */
const EXTRA_TABS: Record<string, TabKey[]> = {
  MobileTextBlock: ['data'],
  MobileImageBlock: ['data'],
  MobileInputBlock: ['data'],
  MobileButtonBlock: ['action'],
  MobileListBlock: ['list'],
};

const TAB_LABELS: Record<TabKey, string> = {
  content: 'Content',
  design: 'Design',
  data: 'Data',
  action: 'Action',
  list: 'List Setup',
};

/**
 * The property inspector for whatever block is selected. Same Content/
 * Design split as the document-template editor's SettingsPanel, plus two
 * tabs it doesn't have: Data (bind to the page's data source) and Action
 * (Button only). Which extra tabs show depends on the selected block's
 * type -- a Divider has neither, a Text block has Data, a Button has
 * Action, nothing has both.
 */
export const MobileSettingsPanel = ({ onClose }: { onClose?: () => void }) => {
  const [tab, setTab] = React.useState<TabKey>('design');

  const { selected } = useEditor((state, query) => {
    const currentNodeId = query.getEvent('selected').first();
    if (!currentNodeId) return { selected: undefined };

    const node = state.nodes[currentNodeId];
    const resolvedName = node?.data?.name as string;

    return {
      selected: {
        id: currentNodeId,
        settings: node?.related?.settings,
        tabs: (['content', 'design', ...(EXTRA_TABS[resolvedName] ?? [])] as TabKey[]),
      },
    };
  });

  // Reset to a tab the newly-selected block actually has (e.g. leaving
  // "Action" when the selection moves from a Button to a Divider) rather
  // than rendering a tab body for a tab that button doesn't own.
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (selected && !selected.tabs.includes(tab)) setTab('content');
  }, [selected, tab]);

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Settings</h3>
        {onClose && (
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700">
            <X className="size-4" />
          </button>
        )}
      </div>

      {selected ? (
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex shrink-0 gap-1 border-b border-slate-200 px-3 py-2">
            {selected.tabs.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  tab === key ? 'bg-blue-50 text-[#0D6EFD]' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {TAB_LABELS[key]}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {selected.settings ? (
              React.createElement(selected.settings, { tab })
            ) : (
              <p className="text-sm text-slate-500">No settings for this block.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="flex h-40 items-center justify-center p-4 text-center text-sm text-slate-500">
          Select a block on the phone screen to edit its properties.
        </div>
      )}
    </div>
  );
};
