import fs from 'fs';

const filePath = 'app/pal/mastery/concept/[conceptId]/page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

if (!content.includes("from '@/app/pal/data/pal-progression'")) {
  content = content.replace(
    "import { PalRailSection, PalRailStat, PalWorkspace } from '@/app/pal/_components/PalWorkspace';",
    "import { PalRailSection, PalRailStat, PalWorkspace } from '@/app/pal/_components/PalWorkspace';\nimport { recordStageProgression } from '@/app/pal/data/pal-progression';"
  );
}

if (!content.includes("recordStageProgression(conceptId, 'mastery')")) {
  content = content.replace(
    "        .then(([conceptResult, masteryRow]) => {\n          setResult(conceptResult);\n          setRow(masteryRow);",
    "        .then(([conceptResult, masteryRow]) => {\n          setResult(conceptResult);\n          setRow(masteryRow);\n          if (conceptId) {\n            const isDone = (masteryRow && (masteryRow.stage === 'mastered' || (masteryRow.pMastery != null && masteryRow.pMastery >= 0.8))) || conceptResult?.readyForProgression;\n            if (isDone) {\n              recordStageProgression(conceptId, 'completed');\n            } else {\n              recordStageProgression(conceptId, 'mastery');\n            }\n          }"
  );
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated concept mastery page');

