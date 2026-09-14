'use client';

import { NotificationConsole } from './_components/NotificationConsole';

/**
 * Platform services -> Communication.
 *
 * Module and component-wise notification configuration: which notification each
 * component raises, on which channels, and whether the recipient may switch it
 * off. Everything shown comes from GET /api/platform/registry and the institute's
 * saved overrides; nothing on this screen is a fixed list.
 */
export default function NotificationPage() {
  return <NotificationConsole />;
}
