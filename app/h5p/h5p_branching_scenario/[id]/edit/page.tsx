'use client';

import { ContentTypeEditPage } from '../../../components/content-type-form';
import { branchingScenarioApi } from '../../../data/h5p-branching';
import { ScenarioEditorForRoute, emptyScenarioState, scenarioStateFromRow, scenarioToSavePayload, validateScenarioState } from '../../components/editor';

export default function BranchingScenarioEditPage() {
  return ContentTypeEditPage({
    path: 'h5p_branching_scenario',
    noun: 'scenario',
    createTitle: '',
    createDescription: '',
    editTitle: 'Edit branching scenario',
    editDescription: 'Change the steps, the choices and where each one leads',
    api: branchingScenarioApi,
    emptyState: emptyScenarioState,
    stateFromRow: scenarioStateFromRow,
    toPayload: scenarioToSavePayload,
    validate: validateScenarioState,
    renderEditor: ({ state, onChange, disabled }) => <ScenarioEditorForRoute state={state} onChange={onChange} disabled={disabled} />,
  });
}
