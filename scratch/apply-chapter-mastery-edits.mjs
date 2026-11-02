import fs from 'fs';

const filePath = 'app/pal/mastery/chapter/[chapterId]/page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

if (!content.includes("from '@/app/pal/data/pal-progression'")) {
  content = content.replace(
    "import { PalRailSection, PalRailStat, PalWorkspace } from '@/app/pal/_components/PalWorkspace';",
    "import { PalRailSection, PalRailStat, PalWorkspace } from '@/app/pal/_components/PalWorkspace';\nimport { recordStageProgression } from '@/app/pal/data/pal-progression';"
  );
}

if (!content.includes("recordStageProgression(c.conceptId, 'completed')")) {
  content = content.replace(
    "        .then(setData)",
    `        .then((masteryData) => {
          setData(masteryData);
          if (masteryData?.concepts) {
            masteryData.concepts.forEach((c) => {
              if (c.stage === 'mastered' || (c.pMastery != null && c.pMastery >= 0.8)) {
                recordStageProgression(c.conceptId, 'completed');
              }
            });
          }
        })`
  );
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated chapter mastery page');

