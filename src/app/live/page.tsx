'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Radio, ArrowRight, Users } from 'lucide-react';
import { api } from '@/lib/client';
function LiveLobby() {
  const params = useSearchParams(),
    router = useRouter(),
    [code, setCode] = useState(params.get('code') ?? ''),
    [name, setName] = useState(''),
    [unit, setUnit] = useState(''),
    [catalog, setCatalog] = useState<any>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api('catalog')
      .then((c) => {
        setCatalog(c);
        setName(c.user?.name ?? '');
      })
      .catch((e) => setError(e.message));
  }, []);
  async function join(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const room = await api(
        'rooms/join',
        { code: code.toUpperCase(), name },
        localStorage.getItem('room:' + code.toUpperCase()) ?? undefined,
      );
      localStorage.setItem('room:' + room.code, room.token);
      router.push('/live/' + room.code);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <div className="eyebrow">BELAJAR BERSAMA</div>
      <h1>Satu kode. Satu ruang belajar.</h1>
      <p className="muted" style={{ marginTop: 12 }}>
        Dengarkan lewat perangkat Anda. Siapkan headphone sebelum bergabung.
      </p>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      <div className="live-layout">
        <section className="panel">
          <Radio size={27} />
          <h2 style={{ marginTop: 18 }}>Gabung sesi</h2>
          <p>Masukkan kode dari host. Anda dapat mengikuti sesi sebagai tamu.</p>
          <form onSubmit={join}>
            <label className="field">
              Kode ruang
              <input
                placeholder="Contoh: AB3DEF"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ''))}
                minLength={6}
                maxLength={6}
                required
                autoComplete="off"
                style={{ letterSpacing: 5, textTransform: 'uppercase' }}
              />
            </label>
            <label className="field">
              Nama tampilan
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                maxLength={40}
              />
            </label>
            <button className="button primary" disabled={busy}>
              Gabung ruang
              <ArrowRight size={17} />
            </button>
          </form>
        </section>
        <section className="panel">
          <Users size={27} />
          <h2 style={{ marginTop: 18 }}>Jadi host</h2>
          <p>Pilih paket dan undang hingga 30 peserta.</p>
          {catalog?.activeRoom ? (
            <Link className="button primary" href={'/live/' + catalog.activeRoom.code}>
              Kembali ke ruang
            </Link>
          ) : catalog?.user ? (
            <>
              <label className="field">
                Paket soal
                <select value={unit} onChange={(e) => setUnit(e.target.value)}>
                  <option value="">Pilih paket</option>
                  {catalog.units
                    .filter((u: any) => u.count > 0)
                    .map((u: any) => (
                      <option key={u.id} value={u.id}>
                        Level {u.level} · {u.title}
                      </option>
                    ))}
                </select>
              </label>
              <button
                className="button outline"
                disabled={!unit || busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const room = await api('rooms', { unitId: unit });
                    router.push('/live/' + room.code);
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Buat ruang
                <ArrowRight size={16} />
              </button>
            </>
          ) : (
            <Link className="button outline" href="/akun">
              Masuk untuk menjadi host
            </Link>
          )}
        </section>
      </div>
    </div>
  );
}
export default function Page() {
  return (
    <Suspense fallback={<div className="loading">Menyiapkan ruang…</div>}>
      <LiveLobby />
    </Suspense>
  );
}
