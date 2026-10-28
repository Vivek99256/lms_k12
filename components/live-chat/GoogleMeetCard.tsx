'use client';

import { useState } from 'react';
import { Check, Copy, ExternalLink, Video } from 'lucide-react';

interface GoogleMeetCardProps {
  meetUrl: string;
  senderName: string;
  createdAt?: string;
  isCurrentUser?: boolean;
}

export function GoogleMeetCard({
  meetUrl,
  senderName,
  createdAt,
  isCurrentUser = false,
}: GoogleMeetCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(meetUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const formattedTime = createdAt
    ? new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="my-2 max-w-[340px] overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-teal-500/5 to-cyan-500/5 p-4 shadow-sm backdrop-blur-md">
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-500/20">
          <Video className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h4 className="text-sm font-semibold text-gray-900">Google Meet Call</h4>
            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
              Live
            </span>
          </div>
          <p className="truncate text-xs text-gray-500">
            {isCurrentUser ? 'You initiated this call' : `${senderName} invited you to meet`}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between rounded-xl border border-gray-200/80 bg-white/90 px-3 py-2 text-xs text-gray-600 shadow-inner">
        <span className="truncate font-mono font-medium text-gray-800">{meetUrl.replace(/^https?:\/\//, '')}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="ml-2 flex items-center gap-1 rounded-md px-1.5 py-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
          title="Copy meeting link"
        >
          {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
          <span className="text-[11px]">{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <a
          href={meetUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-emerald-600/20 transition-all hover:brightness-105 active:scale-[0.98]"
        >
          <Video className="size-4" />
          <span>Join Google Meet</span>
          <ExternalLink className="size-3 opacity-80" />
        </a>
      </div>

      {formattedTime ? (
        <div className="mt-2 text-right text-[10px] text-gray-400">{formattedTime}</div>
      ) : null}
    </div>
  );
}
