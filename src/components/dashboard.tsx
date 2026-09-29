'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Headphones,
  LockKeyhole,
  BookOpen,
  MessagesSquare,
  Radio,
  AudioLines,
  Ear,
  FileAudio,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { levels } from '@/lib/contracts';
import { api } from '@/lib/client';
import { BrandArtwork } from './brand';
type Catalog = {
  user: null | { name: string; level: number; onboarding: boolean; points: number; role: string };
  units: { id: string; level: number; title: string; description: string; count: number }[];
  progress: { allowed: boolean; completedUnits: number; totalUnits: number } | null;
  activeRoom: { code: string } | null;
  attempts: { id: string; kind: string; unitId: string | null; completedAt: string | null }[];
};
const icons = [BookOpen, MessagesSquare, FileAudio, AudioLines, Ear];
export function Dashboard() {
  const [catalog, setCatalog] = useState<Catalog | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(''),
    [selected, setSelected] = useState<number | null>(null);
  const router = useRouter();
  useEffect(() => {
    api<Catalog>('catalog')
      .then(setCatalog)
      .catch((e) => setError(e.message));
  }, []);
  async function begin(kind: string, unitId?: string) {
    if (!catalog?.user) {
      router.push('/akun');
      return;
    }
    setBusy(unitId ?? kind);
    setError('');
    try {
      const a = await api('attempts', { kind, unitId });
      router.push('/belajar/' + a.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  }
  const user = catalog?.user;
  return (
    <div className="dashboard">
      <div className="page-heading">
        <div>
          <div className="eyebrow">DENGARKAN. PAHAMI. BERTUMBUH.</div>
          <h1>{user ? `Ahlan, ${user.name.split(' ')[0]}.` : 'Ahlan, selamat datang.'}</h1>
          <p>Luangkan waktu untuk mendengar. Temukan makna di setiap kata.</p>
        </div>
        <div className="date-badge">
          <span lang="ar" dir="rtl">
            أهلاً وسهلاً
          </span>
          Ruang listening bahasa Arab
        </div>
      </div>
      <section className="welcome-card">
        <div className="welcome-copy">
          <span className="pill light">
            <Headphones size={14} />
            PERJALANAN LISTENING ANDA
          </span>
          <h2>
            {user?.onboarding
              ? 'Latihan kecil.\nPemahaman lebih dalam.'
              : 'Temukan titik mulai\nyang tepat untuk Anda.'}
          </h2>
          <p>
            {user?.onboarding
              ? 'Lanjutkan materi sesuai kemampuan Anda, satu percakapan pada satu waktu.'
              : 'Kenali kemampuan listening Anda melalui tes penempatan singkat sebelum mulai belajar.'}
          </p>
          <button
            className="button gold"
            disabled={!!busy}
            onClick={() => (user?.onboarding ? setSelected(user.level) : begin('onboarding'))}
          >
            {user?.onboarding ? 'Lanjutkan belajar' : 'Mulai tes penempatan'}
            <ArrowRight size={18} />
          </button>
          <span className="welcome-note">
            {user?.onboarding
              ? `Level ${user.level} dari 5 · Belajar dengan ritme Anda`
              : '15 soal · 5 kategori · Penempatan awal'}
          </span>
        </div>
        <div className="welcome-brand">
          <BrandArtwork />
        </div>
      </section>
      <div className="stats-row">
        <div>
          <span className="stat-icon">
            <BookOpen size={20} />
          </span>
          <span>
            <strong>{user?.onboarding ? `${user.level} / 5` : '5 level'}</strong>
            <small>{user?.onboarding ? 'Level terbuka' : 'Perjalanan belajar'}</small>
          </span>
        </div>
        <div>
          <span className="stat-icon">
            <Headphones size={20} />
          </span>
          <span>
            <strong>{catalog?.units.reduce((n, u) => n + u.count, 0) ?? '—'}</strong>
            <small>Soal latihan tersedia</small>
          </span>
        </div>
        <div>
          <span className="stat-icon">
            <Sparkles size={20} />
          </span>
          <span>
            <strong>{user ? user.points.toLocaleString('id-ID') : 'Mulai dari sini'}</strong>
            <small>{user ? 'Poin terkumpul' : 'Belajar sesuai kemampuan'}</small>
          </span>
        </div>
      </div>
      {error && (
        <div className="notice" role="alert">
          <AlertCircle size={19} />
          <span>
            {error}
            {!catalog && ' Materi akan muncul setelah layanan terhubung.'}
          </span>
          <button
            onClick={() => {
              setError('');
              api<Catalog>('catalog')
                .then(setCatalog)
                .catch((e) => setError(e.message));
            }}
          >
            Coba lagi
          </button>
        </div>
      )}
      <section>
        <div className="section-heading">
          <div>
            <div className="eyebrow">KURIKULUM LISTENING</div>
            <h2>Lima langkah, lebih banyak makna.</h2>
          </div>
          <span className="muted">Dari kalimat hingga pemahaman utuh</span>
        </div>
        <div className="level-grid">
          {levels.map((level, i) => {
            const Icon = icons[i],
              locked = !!user && (!user.onboarding || user.level < level.id),
              available =
                catalog?.units
                  .filter((u) => u.level === level.id)
                  .reduce((n, u) => n + u.count, 0) ?? 0;
            return (
              <motion.button
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                key={level.id}
                className={'level-card ' + (selected === level.id ? 'selected' : '')}
                onClick={() => setSelected(selected === level.id ? null : level.id)}
                aria-expanded={selected === level.id}
              >
                <div className="level-top">
                  <span className="level-icon">
                    <Icon size={22} />
                  </span>
                  <span className="level-number">0{level.id}</span>
                </div>
                <span className="level-arabic" lang="ar" dir="rtl">
                  {level.arabic}
                </span>
                <h3>{level.title}</h3>
                <p>{level.description}</p>
                <div className="level-bottom">
                  <span>
                    {locked ? (
                      <>
                        <LockKeyhole size={13} />
                        Terkunci
                      </>
                    ) : available ? (
                      <>
                        <CheckCircle2 size={13} />
                        {available} soal
                      </>
                    ) : (
                      'Materi segera tersedia'
                    )}
                  </span>
                  <ArrowRight size={17} />
                </div>
              </motion.button>
            );
          })}
        </div>
      </section>
      {selected && (
        <section className="unit-panel">
          <div className="section-heading">
            <h2>{levels[selected - 1].title}</h2>
            <button className="text-button" onClick={() => setSelected(null)}>
              Tutup
            </button>
          </div>
          {catalog?.units
            .filter((u) => u.level === selected)
            .map((unit) => (
              <div className="unit-row" key={unit.id}>
                <span className="stat-icon">
                  <Headphones size={20} />
                </span>
                <div>
                  <h3>{unit.title}</h3>
                  <p>
                    {unit.description} · {unit.count} soal
                  </p>
                </div>
                <button
                  className="button outline"
                  disabled={
                    !!busy || !unit.count || (!!user && (!user.onboarding || selected > user.level))
                  }
                  onClick={() => begin('practice', unit.id)}
                >
                  {busy === unit.id ? 'Menyiapkan…' : 'Latihan'}
                  <ArrowRight size={16} />
                </button>
              </div>
            ))}
          {!catalog?.units.some((u) => u.level === selected) && (
            <p className="muted">Paket untuk level ini sedang disiapkan dan ditinjau.</p>
          )}
          {user && !user.onboarding && <p>Selesaikan tes penempatan untuk membuka materi.</p>}
          {user?.onboarding && selected === user.level && selected < 5 && (
            <button
              className="button primary"
              disabled={!catalog?.progress?.allowed || !!busy}
              onClick={() => begin('level_up')}
            >
              Ikuti tes naik level
              <ArrowRight size={16} />
            </button>
          )}
        </section>
      )}
      <section className="live-banner">
        <span className="live-banner-icon">
          <Radio size={28} />
        </span>
        <div>
          <span className="eyebrow">LEBIH SERU BERSAMA</span>
          <h2>Satu ruang, banyak pendengar.</h2>
          <p>Gabung kuis kelas atau ajak teman belajar bersama.</p>
        </div>
        <Link
          className="button outline"
          href={catalog?.activeRoom ? '/live/' + catalog.activeRoom.code : '/live'}
        >
          {catalog?.activeRoom ? 'Kembali ke ruang' : 'Buka sesi live'}
          <ArrowRight size={17} />
        </Link>
      </section>
      {user?.role === 'admin' && (
        <Link className="text-button" href="/admin">
          Kelola konten dan validasi pengajar <ArrowRight size={15} />
        </Link>
      )}
    </div>
  );
}
