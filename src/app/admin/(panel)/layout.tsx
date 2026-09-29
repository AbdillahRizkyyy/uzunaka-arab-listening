import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { AdminShell } from '@/components/admin/admin-shell';

export const dynamic = 'force-dynamic';
export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect('/admin/login');
  if (user.role !== 'admin')
    return (
      <main className="narrow">
        <h1>Akses khusus admin</h1>
        <p>Akun ini tidak memiliki izin mengelola aplikasi.</p>
        <Link className="button outline" href="/admin/login">
          Masuk dengan akun admin
        </Link>
        <Link className="button primary" href="/">
          Kembali ke materi
        </Link>
      </main>
    );
  return <AdminShell name={user.name}>{children}</AdminShell>;
}
