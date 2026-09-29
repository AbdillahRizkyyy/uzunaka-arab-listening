import 'dotenv/config';
import { atomic, db } from '../src/lib/db';
async function main() {
  const cutoff = new Date(Date.now() - 90 * 86400000);
  await atomic(async (tx) => {
    // Keep attempt result summaries and first-answer correctness for progress. Remove
    // raw response text and timing from older personal attempt details.
    await tx.answer.updateMany({
      where: { attemptId: { not: null }, createdAt: { lt: cutoff } },
      data: { value: { redacted: true }, elapsedMs: 0, replayCount: 0 },
    });
    await tx.room.deleteMany({ where: { status: 'ended', updatedAt: { lt: cutoff } } });
    await tx.report.deleteMany({ where: { createdAt: { lt: cutoff } } });
    await tx.authToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    await tx.rateLimit.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  });
  console.log('Retensi selesai. Ringkasan progres dan ledger poin dipertahankan.');
}
main().finally(() => db.$disconnect());
