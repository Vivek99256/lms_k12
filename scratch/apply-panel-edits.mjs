import fs from 'fs';

const filePath = 'app/pal/journey/_components/StepDetailPanel.tsx';
let content = fs.readFileSync(filePath, 'utf8');

if (!content.includes("from '@/app/pal/data/pal-progression'")) {
  content = content.replace(
    "import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';",
    "import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';\nimport { recordStageProgression, stageKeyToConceptStage } from '@/app/pal/data/pal-progression';"
  );
}

if (!content.includes("onClick={() => recordStageProgression(selectedConceptId")) {
  content = content.replace(
    "            <Link\n              href={href}\n              className={buttonVariants({",
    "            <Link\n              href={href}\n              onClick={() => recordStageProgression(selectedConceptId || step?.conceptId, stageKeyToConceptStage(stageKey))}\n              className={buttonVariants({"
  );
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated StepDetailPanel');

