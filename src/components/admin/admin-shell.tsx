'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  LayoutDashboard,
  BookOpen,
  Layers,
  AudioLines,
  Users,
  Radio,
  Flag,
  Settings,
  ArrowUpRight,
  LogOut,
} from 'lucide-react';
import { AdminProvider } from './context';
import { BrandLockup } from '@/components/brand';
export const adminLinks = [
  { href: '/admin', label: 'Ringkasan', icon: LayoutDashboard },
  { href: '/admin/soal', label: 'Bank soal', icon: BookOpen },
  { href: '/admin/paket', label: 'Paket materi', icon: Layers },
  { href: '/admin/media', label: 'Media', icon: AudioLines },
  { href: '/admin/pengguna', label: 'Pengguna', icon: Users },
  { href: '/admin/live', label: 'Sesi live', icon: Radio },
  { href: '/admin/hasil', label: 'Hasil belajar', icon: LayoutDashboard },
  { href: '/admin/laporan', label: 'Laporan', icon: Flag },
  { href: '/admin/pengaturan', label: 'Pengaturan', icon: Settings },
];
export function AdminShell({ name, children }: { name: string; children: React.ReactNode }) {
  const path = usePathname();
  return (
    <div className="admin-app">
      <aside className="admin-sidebar">
        <Link href="/admin" className="admin-brand">
          <BrandLockup />
          <span className="admin-badge">ADMIN</span>
        </Link>
        <p className="eyebrow">KELOLA RUANG BELAJAR</p>
        <nav aria-label="Navigasi admin">
          {adminLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={path === href ? 'page' : undefined}
              className={'admin-nav ' + (path === href ? 'active' : '')}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="admin-sidebar-bottom">
          <Link href="/" className="admin-nav">
            <ArrowUpRight size={18} />
            Buka aplikasi belajar
          </Link>
          <button className="admin-nav" onClick={() => signOut({ callbackUrl: '/admin/login' })}>
            <LogOut size={18} />
            Keluar
          </button>
        </div>
      </aside>
      <div className="admin-workspace">
        <header className="admin-topbar">
          <span>
            Panel pengelola <b>/ {adminLinks.find((l) => l.href === path)?.label ?? 'Konten'}</b>
          </span>
          <span className="admin-person">
            <i>{name.slice(0, 1).toUpperCase()}</i>
            {name}
          </span>
          <div className="admin-mobile-actions">
            <Link href="/" aria-label="Buka aplikasi belajar">
              <ArrowUpRight size={18} />
            </Link>
            <button onClick={() => signOut({ callbackUrl: '/admin/login' })} aria-label="Keluar">
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <main className="admin-main">
          <AdminProvider>{children}</AdminProvider>
        </main>
      </div>
    </div>
  );
}
