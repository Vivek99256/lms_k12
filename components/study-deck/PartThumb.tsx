import { assetUrl } from '@/lib/study-deck/deck';
import type { DeckImage } from '@/lib/study-deck/types';

/** A small picture of a part beside its name in the list: the part by its name, not an icon. Decorative: the name next to it says the same. */
export function PartThumb({ image, assetBase }: { image: DeckImage; assetBase: string | null }) {
  return (
    <span aria-hidden="true" className="flex h-[2.2em] w-[3.4em] shrink-0 items-center justify-center overflow-hidden rounded-[0.4em] border border-sd-line bg-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={assetUrl(image.url, assetBase)} alt="" className="h-full w-full object-contain" />
    </span>
  );
}
