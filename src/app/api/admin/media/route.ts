import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { assert } from '@/lib/domain';
import { failure } from '@/lib/http';
import { cloudMediaEnabled, finalizeMediaUpload, listMedia, prepareMediaUpload, saveMedia } from '@/lib/admin-media';
import { mediaUploadAction } from '@/lib/media-contracts';
import { limit } from '@/lib/security';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
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
    await limit('media:' + user.id, 90, 3600);
    const json = request.headers.get('content-type')?.startsWith('application/json');
    const max = json ? 16000 : 21 * 1024 * 1024;
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
    const bytes = Buffer.concat(chunks);
    if (json) {
      let value: unknown;
      try {
        value = JSON.parse(bytes.toString('utf8'));
      } catch {
        assert(false, 'Permintaan unggahan tidak valid.');
      }
      const input = mediaUploadAction.parse(value);
      if (input.action === 'finalize')
        return NextResponse.json(await finalizeMediaUpload(input.verificationTicket), { status: 201 });
      if (cloudMediaEnabled())
        return NextResponse.json({ mode: 'direct', ...(await prepareMediaUpload(input)) });
      assert(process.env.NODE_ENV !== 'production', 'Penyimpanan media online belum dikonfigurasi.', 503);
      return NextResponse.json({ mode: 'local' });
    }
    assert(!cloudMediaEnabled(), 'Gunakan unggahan langsung untuk penyimpanan online.');
    const form = await new Response(bytes, {
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
