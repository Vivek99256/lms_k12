'use client';

import { ContentTypeListPage } from '../components/content-type-list';
import { memoryGameApi, type H5pMemoryGame } from '../data/h5p-content-types';

/**
 * Memory game — list page.
 *
 * The "Pairs in play" column is the one worth having: an author who filtered
 * to a pair set or set a pair limit has a deck smaller than the number of
 * pairs they wrote, and that difference is exactly what surprises them when
 * publish refuses.
 */
function pairsInPlay(row: H5pMemoryGame): number {
  const sets = row.active_pair_sets;
  const inSets =
    Array.isArray(sets) && sets.length > 0
      ? (row.cards ?? []).filter((card) => sets.map(Number).includes(Number(card.pair_set)))
      : (row.cards ?? []);

  return row.pairs_to_use > 0 ? Math.min(row.pairs_to_use, inSets.length) : inSets.length;
}

export default function MemoryGameListPage() {
  return (
    <ContentTypeListPage<H5pMemoryGame>
      path="h5p_memory_game"
      title="Memory game"
      description="Match pairs of cards to improve memory and recall"
      noun="memory game"
      emptyHint="Build a deck of pairs — pictures, words or one of each — or import an existing .h5p package."
      api={memoryGameApi as never}
      searchText={(row) => row.task_description ?? ''}
      columns={[
        {
          header: 'Pairs',
          numeric: true,
          render: (row) => {
            const authored = row.cards?.length ?? 0;
            const playing = pairsInPlay(row);
            return playing === authored ? authored : `${playing} of ${authored}`;
          },
        },
        { header: 'Scoring', render: (row) => (row.scoring_mode === 'moves' ? 'By moves' : 'By pairs') },
        {
          header: 'Time limit',
          numeric: true,
          render: (row) => (row.time_limit_seconds > 0 ? `${row.time_limit_seconds}s` : 'Untimed'),
        },
      ]}
    />
  );
}
