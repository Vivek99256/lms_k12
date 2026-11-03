import fs from 'fs';

const filePath = 'app/pal/journey/_components/StepDetailPanel.tsx';
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
  'onClick={() => recordStageProgression(selectedConceptId || step?.conceptId, stageKeyToConceptStage(stageKey))}',
  'onClick={() => recordStageProgression(selectedConceptId || step?.conceptId, stageKeyToConceptStage(stageKey, step?.attemptNumber ?? (selectedNode?.source !== \'main\' ? 2 : 1)))}'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Updated StepDetailPanel');

