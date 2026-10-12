'use client';

import { ContentTypeListPage } from '../components/content-type-list';
import { branchingScenarioApi, type H5pBranchingScenario } from '../data/h5p-branching';
import { GenerateScenarioButton } from './components/generate-scenario';

/**
 * Branching scenario — list page.
 *
 * The shared list gives it create, edit, duplicate, publish, export, import and
 * delete, and the student's card view. What this page adds is the one thing
 * only this type does: generating a scenario from the chapter, for review.
 *
 * A teacher's most useful summary of a scenario is how it is built: steps,
 * decisions and endings, and whether it has been written from the chapter's own
 * material. Marks are shown only for a scenario that is marked.
 */
function countOf(row: H5pBranchingScenario, type: string): number {
  return (row.nodes ?? []).filter((node) => node.node_type === type).length;
}

export default function BranchingScenarioListPage() {
  return (
    <ContentTypeListPage<H5pBranchingScenario>
      path="h5p_branching_scenario"
      title="Branching scenario"
      description="Decision-based lessons: learners choose, see the consequence explained, and reach different endings"
      noun="scenario"
      emptyHint="Generate a complete scenario from this chapter and review it, build one step by step, or import an existing .h5p package."
      api={branchingScenarioApi as never}
      searchText={(row) => (row.nodes ?? []).map((node) => node.title ?? '').join(' ')}
      extraActions={({ ctx, reload, notify }) => <GenerateScenarioButton ctx={ctx} reload={reload} notify={notify} />}
      columns={[
        { header: 'Steps', numeric: true, render: (row) => row.nodes?.length ?? 0 },
        { header: 'Decisions', numeric: true, render: (row) => countOf(row, 'branching_question') },
        { header: 'Endings', numeric: true, render: (row) => countOf(row, 'ending') },
        {
          header: 'Written from',
          render: (row) => (row.generation ? `${row.generation.concept_ids.length} concept${row.generation.concept_ids.length === 1 ? '' : 's'} (AI draft)` : 'By hand'),
        },
        {
          header: 'Marks',
          numeric: true,
          render: (row) => (row.max_score && row.scoring_option !== 'no-score' ? row.max_score : 'Not marked'),
        },
      ]}
    />
  );
}
