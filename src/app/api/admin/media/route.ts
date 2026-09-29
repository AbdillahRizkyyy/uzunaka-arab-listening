import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { assert } from '@/lib/domain';
import { failure } from '@/lib/http';
import { listMedia, saveMedia } from '@/lib/admin-media';
import { limit } from '@/lib/security';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json(await listMedia());
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin();
    assert(
      request.headers.get('origin') === new URL(process.env.APP_URL ?? request.url).origin,
      'Asal permintaan tidak diizinkan.',
      403,
    );
    await limit('media:' + user.id, 30, 3600);
    const max = 21 * 1024 * 1024;
    assert(Number(request.headers.get('content-length') ?? 0) <= max, 'File terlalu besar.', 413);
    const reader = request.body?.getReader();
    assert(reader, 'File belum dipilih.');
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > max) {
        await reader.cancel();
        assert(false, 'File terlalu besar.', 413);
      }
      chunks.push(value);
    }
    const form = await new Response(Buffer.concat(chunks), {
      headers: { 'Content-Type': request.headers.get('content-type') ?? '' },
    }).formData();
    const file = form.get('file');
    assert(file instanceof File, 'File belum dipilih.');
    const media = await saveMedia(
      Buffer.from(await file.arrayBuffer()),
      file.name,
      Number(form.get('duration')),
    );
    return NextResponse.json(media, { status: 201 });
  } catch (e) {
    return failure(e);
  }
}
