'use client';

import { forwardRef, useImperativeHandle, useRef } from 'react';

import { cn } from '@/lib/utils';
import { documentShell } from '@/lib/intelligence/admission-document';

/**
 * A document, shown and printed without ever entering this app's DOM.
 *
 * Reports and certificates are HTML that an administrator can edit and that the
 * generator composes from database rows. `template_master` has always stored that
 * column unfiltered, and a hand-rolled sanitiser here would be a claim of safety this
 * component cannot keep. So the document is put in a frame that cannot run anything:
 * `allow-scripts` is deliberately absent, and a script pasted into a template has
 * nothing to execute in whether it is being read or printed.
 *
 * `allow-same-origin` is present for exactly one reason — the parent has to reach
 * `contentWindow.print()` to print the sheet rather than the surrounding application
 * chrome. Printing from the frame is also what makes the printed page match the
 * preview, since both are the same document with the same stylesheet.
 */

export interface DocumentFrameHandle {
  print: () => boolean;
}

export const DocumentFrame = forwardRef<
  DocumentFrameHandle,
  { html: string; title: string; className?: string }
>(function DocumentFrame({ html, title, className }, ref) {
  const frameRef = useRef<HTMLIFrameElement>(null);

  useImperativeHandle(
    ref,
    () => ({
      print: () => {
        const frame = frameRef.current?.contentWindow;

        if (!frame) return false;

        frame.focus();
        frame.print();

        return true;
      },
    }),
    []
  );

  return (
    <iframe
      ref={frameRef}
      title={title}
      srcDoc={documentShell(html, title)}
      sandbox="allow-same-origin allow-modals"
      className={cn('w-full rounded-md border border-slate-200 bg-white', className)}
    />
  );
});
