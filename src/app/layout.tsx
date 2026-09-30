import type { Metadata } from 'next';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/dm-sans/700.css';
import '@fontsource/noto-naskh-arabic/400.css';
import '@fontsource/noto-naskh-arabic/600.css';
import './globals.css';
import { Shell } from '@/components/shell';
import { BRAND_DESCRIPTION, BRAND_NAME } from '@/lib/brand';
export const metadata: Metadata = {
  title: { default: `${BRAND_NAME} — ${BRAND_DESCRIPTION}`, template: `%s · ${BRAND_NAME}` },
  description: `${BRAND_NAME}, telingamu. Dengarkan, pahami, dan latih bahasa Arab melalui latihan mandiri dan kuis bersama kelas.`,
  icons: { icon: '/brand/uzunaka-mark.png', apple: '/brand/uzunaka-mark.png' },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
