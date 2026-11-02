import fs from 'fs';

const filePath = 'app/pal/learn/concept/[conceptId]/page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add import
if (!content.includes("from '@/app/pal/data/pal-progression'")) {
  content = content.replace(
    "import { PalRailSection, PalRailStat, PalWorkspace } from '@/app/pal/_components/PalWorkspace';",
    "import { PalRailSection, PalRailStat, PalWorkspace } from '@/app/pal/_components/PalWorkspace';\nimport { recordStageProgression } from '@/app/pal/data/pal-progression';"
  );
}

// 2. Add progression recording in useEffect
if (!content.includes("recordStageProgression(conceptId, 'learn')")) {
  content = content.replace(
    "  useEffect(() => {\n    if (checkingCompletion || completed) return;\n    return load();\n  }, [load, checkingCompletion, completed]);",
    "  useEffect(() => {\n    if (conceptId) {\n      recordStageProgression(conceptId, 'learn');\n    }\n    if (checkingCompletion || completed) return;\n    return load();\n  }, [load, checkingCompletion, completed, conceptId]);"
  );
}

// 3. Add progression in continueToNextStep
if (!content.includes("recordStageProgression(conceptId, 'practice')")) {
  content = content.replace(
    "const outcome = await acknowledgeConceptLearn(conceptId);",
    "const outcome = await acknowledgeConceptLearn(conceptId);\n      recordStageProgression(conceptId, 'practice');"
  );
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated learn page');

