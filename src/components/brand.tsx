import Image from 'next/image';
import { BRAND_NAME, BRAND_DESCRIPTION } from '@/lib/brand';

/** Original client artwork; compact navigation shows its ear emblem through CSS. */
export function BrandLockup({ name = BRAND_NAME }: { name?: string }) {
  return (
    <span className="brand-lockup">
      <span className="brand-emblem" aria-hidden="true">
        <Image src="/brand/udhunak-logo.jpeg" alt="" width={1254} height={1254} unoptimized />
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
      src="/brand/udhunak-logo.jpeg"
      alt={`Logo ${BRAND_NAME} — ${BRAND_DESCRIPTION}, simbol telinga dan headphone.`}
      width={1254}
      height={1254}
      unoptimized
    />
  );
}
