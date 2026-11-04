'use client';

import React, { useMemo, useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';

import { updateAgent } from '@/lib/agents/client';
import { findModule, toolsForModule, type AgentTool } from '@/lib/agents/registry';
import type { Agent, AgentStatus, AgentTrigger } from '@/lib/agents/types';

import { RiskPill } from './CreateAgentForm';

interface EditAgentDialogProps {
  agent: Agent;
  onClose: () => void;
  onUpdated: (agent: Agent) => void;
}

export function EditAgentDialog({ agent, onClose, onUpdated }: EditAgentDialogProps) {
  const [name, setName] = useState(agent.name);
  const [description, setDescription] = useState(agent.description || '');
  const [instructions, setInstructions] = useState(agent.instructions || '');
  const [status, setStatus] = useState<AgentStatus>(agent.status);
  const [trigger, setTrigger] = useState<AgentTrigger>(agent.trigger || 'manual');
  const [tools, setTools] = useState<string[]>(agent.tools_allowed || []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableTools = useMemo(() => toolsForModule(agent.module), [agent.module]);

  const toggleTool = (tool: AgentTool) => {
    if (!tool.available) return;
    setTools((current) =>
      current.includes(tool.key) ? current.filter((k) => k !== tool.key) : [...current, tool.key],
    );
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please provide a name for the agent.');
      return;
    }

    if (!tools.length) {
      setError('Select at least one allowed tool.');
      return;
    }

    setBusy(true);
    try {
      const updated = await updateAgent(agent.id, {
        name: trimmedName,
        description: description.trim(),
        instructions: instructions.trim(),
        status,
        trigger,
        tools_allowed: tools,
      });
      onUpdated(updated);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to update agent configuration.');
    } finally {
      setBusy(false);
    }
  };

  const moduleInfo = findModule(agent.module);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-agent-title"
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-4 shrink-0">
          <div className="min-w-0">
            <h2 id="edit-agent-title" className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Pencil size={16} className="text-indigo-600" />
              Edit Agent Configuration
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              <span className="font-mono">{agent.id}</span> · Module:{' '}
              <span className="font-semibold text-slate-700">{moduleInfo?.label ?? agent.module}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-slate-400 hover:bg-gray-100 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={submit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50/80 p-3 text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Agent Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                required
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="e.g. Course catalogue reader"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="What this agent does and how it operates"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as AgentStatus)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Trigger Execution</label>
              <select
                value={trigger}
                onChange={(e) => setTrigger(e.target.value as AgentTrigger)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="manual">Manual (when user clicks Run)</option>
                <option value="scheduled">Scheduled / Pipeline automated</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                System Instructions &amp; Prompt
              </label>
              <textarea
                rows={3}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
                placeholder="Instructions governing agent behavior and analysis..."
              />
            </div>

            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Allowed Tools ({tools.length} selected)
                </label>
                <span className="text-[11px] text-slate-500">
                  Select available tools for {moduleInfo?.label ?? agent.module}
                </span>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-xl border border-gray-100 bg-slate-50/60 p-2.5">
                {availableTools.map((tool) => {
                  const isChecked = tools.includes(tool.key);
                  return (
                    <div
                      key={tool.key}
                      onClick={() => toggleTool(tool)}
                      className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-colors border ${
                        isChecked
                          ? 'bg-indigo-50/80 border-indigo-200 text-indigo-950'
                          : 'bg-white border-gray-200 text-slate-700 hover:bg-slate-50'
                      } ${!tool.available ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={!tool.available}
                        onChange={() => {}} // handled by div click
                        className="mt-1 h-3.5 w-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-slate-900">{tool.label}</span>
                          <RiskPill risk={tool.risk} />
                        </div>
                        <p className="text-[11px] text-slate-500 leading-snug mt-0.5 line-clamp-2">
                          {tool.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {busy ? (
                'Saving...'
              ) : (
                <>
                  <Check size={14} /> Save changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
