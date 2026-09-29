import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AppError, assert } from './domain';
export function failure(error: unknown) {
  if (error instanceof AppError)
    return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError)
    return NextResponse.json(
      { error: error.issues.map((i) => i.message).join(' ') },
      { status: 400 },
    );
  console.error(
    JSON.stringify({
      event: 'request_failure',
      type: error instanceof Error ? error.name : 'unknown',
    }),
  );
  return NextResponse.json(
    { error: 'Layanan belum tersedia. Coba kembali sebentar lagi.' },
    { status: 503 },
  );
}
export async function body(request: NextRequest) {
  const origin = request.headers.get('origin');
  assert(
    origin === new URL(process.env.APP_URL ?? request.url).origin,
    'Asal permintaan tidak diizinkan.',
    403,
  );
  const text = await request.text();
  assert(text.length <= 100000, 'Permintaan terlalu besar.', 413);
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError('JSON tidak valid.');
  }
}
