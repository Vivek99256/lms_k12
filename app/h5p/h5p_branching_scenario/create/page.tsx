'use client';

import { ContentTypeCreatePage } from '../../components/content-type-form';
import { branchingScenarioApi } from '../../data/h5p-branching';
import { ScenarioEditorForRoute, emptyScenarioState, scenarioStateFromRow, scenarioToSavePayload, validateScenarioState } from '../components/editor';

export default function BranchingScenarioCreatePage() {
  return ContentTypeCreatePage({
    path: 'h5p_branching_scenario',
    noun: 'scenario',
    createTitle: 'New branching scenario',
    createDescription: 'Screens of content, decisions that lead to different places, and the endings they reach',
    editTitle: '',
    editDescription: '',
    api: branchingScenarioApi,
    emptyState: emptyScenarioState,
    stateFromRow: scenarioStateFromRow,
    toPayload: scenarioToSavePayload,
    validate: validateScenarioState,
    renderEditor: ({ state, onChange, disabled }) => <ScenarioEditorForRoute state={state} onChange={onChange} disabled={disabled} />,
  });
}
