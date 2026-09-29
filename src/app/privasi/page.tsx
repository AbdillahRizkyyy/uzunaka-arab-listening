import { settings } from '@/lib/admin-controls';
export const dynamic = 'force-dynamic';
export default async function Page() {
  const { name, supportEmail: support } = await settings();
  return (
    <article className="narrow">
      <div className="eyebrow">PRIVASI & BANTUAN</div>
      <h1>Belajar dengan tenang.</h1>
      <section className="panel">
        <h2>Data yang disimpan</h2>
        <p>
          <bdi>{name}</bdi> menyimpan nama, email, password yang di-hash, progres, hasil tes, dan poin untuk
          menjalankan akun belajar. Sesi live menyimpan nama tampilan, jawaban, waktu menjawab, dan
          penggunaan replay. Latihan tidak mengakses mikrofon peserta. Admin dapat memberi izin
          mikrofon untuk merekam materi; rekaman tersebut disimpan sebagai media aplikasi.
        </p>
        <h2>Sesi bersama</h2>
        <p>
          Nama tampilan dan skor dapat dilihat peserta lain dalam ruang. Peserta tamu mendapat token
          pada perangkat untuk masuk kembali ke sesi yang sama. Cookie sesi dipakai untuk login.
        </p>
        <h2>Penyimpanan dan penghapusan</h2>
        <p>
          Detail sesi dan jawaban disimpan hingga 90 hari. Ringkasan progres dan poin akun disimpan
          sampai akun dihapus. Penghapusan akun tersedia pada halaman Akun saya; nama pada sesi
          bersama akan dianonimkan.
        </p>
        <h2>Penyedia layanan</h2>
        <p>
          Aplikasi dirancang menggunakan Vercel, Railway, Supabase, dan layanan email yang
          dikonfigurasi pengelola. Data diproses untuk menyediakan layanan belajar, tanpa iklan atau
          penjualan data.
        </p>
        <h2>Butuh bantuan?</h2>
        {support && !support.endsWith('@example.com') ? (
          <p>
            Hubungi{' '}
            <a className="text-button" href={'mailto:' + support}>
              {support}
            </a>
            . Masalah materi juga dapat dilaporkan dari halaman latihan.
          </p>
        ) : (
          <p>Kontak dukungan sedang disiapkan. Layanan belum dibuka untuk peluncuran publik.</p>
        )}
      </section>
    </article>
  );
}
