'use client';

import { Building2 } from 'lucide-react';
import { useState } from 'react';

type ProfileImageProps = {
  src?: string | null;
  alt: string;
  className?: string;
  fallbackClassName?: string;
  fallbackSrc?: string;
};

function validImageSource(src?: string | null): string {
  const value = src?.trim() ?? '';
  return value && value !== 'null' && value !== 'undefined' ? value : '';
}

/** Keeps profile cards usable when the ERP provides a stale or empty image URL. */
export function ProfileImage({ src, alt, className, fallbackClassName, fallbackSrc }: ProfileImageProps) {
  const [failed, setFailed] = useState(false);
  const imageSource = validImageSource(src);

  if (!imageSource || failed) {
    return (
      fallbackSrc ? (
        // eslint-disable-next-line @next/next/no-img-element -- project-local static fallback asset.
        <img className={className} src={fallbackSrc} alt={alt} />
      ) : (
        <div className={fallbackClassName ?? className} role="img" aria-label={`${alt || 'Profile'} image unavailable`}>
          <Building2 aria-hidden="true" className="size-10 text-primary/70" />
        </div>
      )
    );
  }

  // eslint-disable-next-line @next/next/no-img-element -- source is supplied by the ERP API.
  return <img className={className} src={imageSource} alt={alt} onError={() => setFailed(true)} />;
}
