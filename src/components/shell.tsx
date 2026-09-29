'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BrandLockup } from './brand';
import { BRAND_NAME, BRAND_TAGLINE } from '@/lib/brand';
import { BookOpen, Radio, UserRound, Headphones, ArrowUpRight, ShieldCheck } from 'lucide-react';
export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [brand, setBrand] = useState({
    name: BRAND_NAME,
    tagline: BRAND_TAGLINE,
  });
  useEffect(() => {
    api<typeof brand>('site-settings')
      .then(setBrand)
      .catch(() => {});
  }, [path]);
  if (path === '/admin' || path.startsWith('/admin/')) return <>{children}</>;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="brand" aria-label={`${brand.name} — Beranda`}>
          <BrandLockup name={brand.name} />
        </Link>
        <div className="sidebar-label">RUANG BELAJAR</div>
        <nav aria-label="Navigasi utama">
          {[
            { href: '/', icon: BookOpen, label: 'Jelajahi materi' },
            { href: '/live', icon: Radio, label: 'Sesi live' },
            { href: '/akun', icon: UserRound, label: 'Akun saya' },
          ].map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={path === n.href ? 'nav-item active' : 'nav-item'}
            >
              <n.icon size={19} />
              {n.label}
              {path === n.href && <span className="nav-mark" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="headphone-card">
            <Headphones size={25} />
            <strong>Mulai dari mendengar.</strong>
            <p>Gunakan headphone agar setiap bunyi terdengar jelas.</p>
          </div>
          <Link href="/privasi" className="privacy-link">
            <ShieldCheck size={15} />
            Privasi & bantuan
            <ArrowUpRight size={14} />
          </Link>
          <span className="copyright">
            <bdi dir="auto">{brand.name}</bdi> · BELAJAR DENGAN MAKNA
          </span>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>
            Bahasa Arab <span className="slash">/</span>{' '}
            <b>
              {path.startsWith('/live')
                ? 'Belajar bersama'
                : path.startsWith('/belajar')
                  ? 'Latihan listening'
                  : path.startsWith('/admin')
                    ? 'Kelola konten'
                    : 'Ruang belajar'}
            </b>
          </span>
          <Link href="/live" className="header-join">
            <Radio size={16} />
            Gabung sesi
          </Link>
        </header>
        <main>{children}</main>
        <footer>
          {brand.tagline}
          <span lang="ar" dir="rtl">
            استمع وافهم
          </span>
        </footer>
      </div>
    </div>
  );
}
