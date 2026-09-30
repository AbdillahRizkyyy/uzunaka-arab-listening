import Image from 'next/image';
import { BRAND_NAME, BRAND_DESCRIPTION } from '@/lib/brand';

/** Compact web mark adapted from the client's ear and headphone identity. */
export function BrandLockup({ name = BRAND_NAME }: { name?: string }) {
  return (
    <span className="brand-lockup">
      <span className="brand-emblem" aria-hidden="true">
        <Image
          src="/brand/uzunaka-mark.png"
          alt=""
          width={1254}
          height={1254}
          sizes="64px"
          loading="eager"
        />
      </span>
      <span className="brand-copy">
        <bdi className="brand-wordmark" dir="auto">
          {name}
        </bdi>
        <small>{BRAND_DESCRIPTION}</small>
      </span>
    </span>
  );
}

export function BrandArtwork({ className = '' }: { className?: string }) {
  return (
    <Image
      className={'brand-artwork ' + className}
      src="/brand/uzunaka-mark.png"
      alt={`Logo ${BRAND_NAME} — ${BRAND_DESCRIPTION}, simbol telinga dan headphone.`}
      width={1254}
      height={1254}
      sizes="240px"
      loading="eager"
    />
  );
}
