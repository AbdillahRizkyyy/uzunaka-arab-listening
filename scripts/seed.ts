import 'dotenv/config';
import { db } from '../src/lib/db';
import { levels, CONFIG_VERSION } from '../src/lib/contracts';
const themes = [
  ['Kehidupan kampus', 'Kegiatan sehari-hari'],
  ['Percakapan formal', 'Di kantor'],
  ['Berita singkat', 'Kisah dan narasi'],
  ['Bunyi akhir kata', 'Pelafalan mirip'],
  ['Pengumuman', 'Pemahaman utuh'],
];
async function main() {
  for (const level of levels)
    for (let i = 0; i < 2; i++) {
      const id = `level-${level.id}-unit-${i + 1}`,
        title = themes[level.id - 1][i];
      await db.unit.upsert({
        where: { id },
        create: {
          id,
          level: level.id,
          title,
          theme: title,
          description: `Latihan ${level.title.toLowerCase()} dengan tema ${title.toLowerCase()}.`,
        },
        update: {},
      });
    }
  await db.reviewConfig.upsert({
    where: { id: CONFIG_VERSION },
    create: { id: CONFIG_VERSION },
    update: {},
  });
  if (process.env.ADMIN_EMAIL) {
    const user = await db.user.findUnique({
      where: { email: process.env.ADMIN_EMAIL.toLowerCase() },
    });
    if (user?.verifiedAt) await db.user.update({ where: { id: user.id }, data: { role: 'admin' } });
    else
      console.log(
        'ADMIN_EMAIL belum memiliki akun terverifikasi. Daftar, verifikasi, lalu jalankan seed lagi.',
      );
  }
  console.log(
    '10 unit dan konfigurasi tes disiapkan. Tidak ada soal atau persetujuan pengajar yang dibuat otomatis.',
  );
}
main().finally(() => db.$disconnect());
