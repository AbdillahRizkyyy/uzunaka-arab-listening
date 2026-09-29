import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { AdminLogin } from '@/components/admin/admin-login';
export const dynamic = 'force-dynamic';
export default async function Page() {
  const user = await currentUser();
  if (user?.role === 'admin') redirect('/admin');
  return <AdminLogin />;
}
