import fs from 'fs';

const filePath = 'app/pal/feedback/concept/[conceptId]/page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

if (!content.includes("from '@/app/pal/data/pal-progression'")) {
  content = content.replace(
    "import { BandRow } from '@/app/pal/_components/BandMeter';",
    "import { BandRow } from '@/app/pal/_components/BandMeter';\nimport { recordStageProgression } from '@/app/pal/data/pal-progression';"
  );
}

if (!content.includes("recordStageProgression(conceptId, 'check')")) {
  content = content.replace(
    "                <Link href={`/pal/eso?conceptId=${conceptId}`} className={cn(buttonVariants(), 'mt-3')}>",
    "                <Link href={`/pal/eso?conceptId=${conceptId}`} onClick={() => recordStageProgression(conceptId, 'check')} className={cn(buttonVariants(), 'mt-3')}>"
  );
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated feedback page');

