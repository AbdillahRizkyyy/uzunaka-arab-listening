import { LiveRoom } from '@/components/live-room';
export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <LiveRoom code={code.toUpperCase()} />;
}
