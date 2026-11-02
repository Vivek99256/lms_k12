import fs from 'fs';

const filePath = 'app/pal/intervention/concept/[conceptId]/page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

if (!content.includes("from '@/app/pal/data/pal-progression'")) {
  content = content.replace(
    "import { BandRow } from '@/app/pal/_components/BandMeter';",
    "import { BandRow } from '@/app/pal/_components/BandMeter';\nimport { recordStageProgression } from '@/app/pal/data/pal-progression';"
  );
}

if (!content.includes("recordStageProgression(conceptId, 'learn_2')")) {
  content = content.replace(
    "            href={`/pal/learn/concept/${conceptId}${chapterId ? `?chapterId=${chapterId}` : ''}`}\n            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'w-full justify-start')}",
    "            href={`/pal/learn/concept/${conceptId}${chapterId ? `?chapterId=${chapterId}` : ''}`}\n            onClick={() => recordStageProgression(conceptId, 'learn_2')}\n            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'w-full justify-start')}"
  );
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated intervention page');

