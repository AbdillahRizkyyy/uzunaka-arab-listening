import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { mediaDirectory, type Media } from '@/lib/admin-media';
export const runtime = 'nodejs';
export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!/^[a-f0-9-]{36}\.(wav|mp3|m4a|webm|ogg|png|jpg|webp)$/.test(name))
    return new Response(null, { status: 404 });
  try {
    const metadata: Media = JSON.parse(
      await readFile(resolve(mediaDirectory, name + '.json'), 'utf8'),
    );
    const bytes = await readFile(resolve(mediaDirectory, name));
    return new Response(bytes, {
      headers: {
        'Content-Type': metadata.type,
        'Content-Length': String(bytes.length),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
