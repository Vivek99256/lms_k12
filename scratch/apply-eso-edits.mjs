import fs from 'fs';

const filePath = 'app/pal/eso/page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

if (!content.includes("from '@/app/pal/data/pal-progression'")) {
  content = content.replace(
    "import { useViewAsStudent } from '@/app/pal/data/pal-view-as';",
    "import { useViewAsStudent } from '@/app/pal/data/pal-view-as';\nimport { recordStageProgression } from '@/app/pal/data/pal-progression';"
  );
}

if (!content.includes("recordStageProgression(conceptId, 'practice')")) {
  content = content.replace(
    "    setAction((previous) => {",
    "    if (conceptId) {\n      if (next.action === 'practice') recordStageProgression(conceptId, 'practice');\n      else if (next.action === 'check') recordStageProgression(conceptId, 'check');\n      else if (next.action === 'mastery') recordStageProgression(conceptId, 'mastery');\n    }\n    setAction((previous) => {"
  );
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated eso/page.tsx');

