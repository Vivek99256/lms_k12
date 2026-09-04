'use client';

import type { CareerOption } from '../_lib/constants';

export function HeaderList({
  option,
  onClick,
  isSelected,
}: {
  option: CareerOption;
  onClick: () => void;
  isSelected: boolean;
}) {
  return (
    <div onClick={onClick} className="cursor-pointer text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={isSelected ? option.image2 : option.src}
        alt={option.alt}
        width={100}
        height={100}
        className="mx-auto"
      />
      <p className="mt-1 text-primary-foreground text-sm">{option.label}</p>
    </div>
  );
}
