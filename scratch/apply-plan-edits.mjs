import fs from 'fs';

const filePath = 'app/pal/plan/chapter/[chapterId]/page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

if (!content.includes("from '@/app/pal/data/pal-progression'")) {
  content = content.replace(
    "import { PalRailSection, PalRailStat, PalWorkspace } from '@/app/pal/_components/PalWorkspace';",
    "import { PalRailSection, PalRailStat, PalWorkspace } from '@/app/pal/_components/PalWorkspace';\nimport { recordStageProgression } from '@/app/pal/data/pal-progression';"
  );
}

if (!content.includes("onClick={() => recordStageProgression(step.conceptId, 'learn')}")) {
  content = content.replace(
    "              href={`/pal/learn/concept/${step.conceptId}?chapterId=${chapterId}`}\n              className={buttonVariants({ size: 'sm' })}",
    "              href={`/pal/learn/concept/${step.conceptId}?chapterId=${chapterId}`}\n              onClick={() => recordStageProgression(step.conceptId, 'learn')}\n              className={buttonVariants({ size: 'sm' })}"
  );
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated plan page');

