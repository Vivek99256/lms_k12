'use client';

import { TextActivityListPage } from '../text_activity/components/screens';

/**
 * Blanks — list.
 *
 * The screen lives in `app/h5p/text_activity/components/screens.tsx` and is
 * shared with the other two text-passage types; this file exists because a
 * Next.js route is a directory. See that module for why the screens are not
 * copied three times.
 */
export default function Page() {
  return <TextActivityListPage type="fill_in_the_blanks" />;
}
