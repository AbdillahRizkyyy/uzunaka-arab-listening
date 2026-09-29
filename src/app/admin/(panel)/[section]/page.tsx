import { notFound } from 'next/navigation';
import { AdminSection } from '@/components/admin/sections';
export default async function Page({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!['hasil', 'soal', 'paket', 'media', 'pengguna', 'live', 'laporan', 'pengaturan'].includes(section))
    notFound();
  return <AdminSection section={section} />;
}
