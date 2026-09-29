'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { signIn, signOut } from 'next-auth/react';
import Link from 'next/link';
import { ArrowRight, Mail, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/client';
import { BRAND_NAME } from '@/lib/brand';
function Account() {
  const params = useSearchParams(),
    [mode, setMode] = useState(params.get('mode') ?? 'login'),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [name, setName] = useState(''),
    [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [user, setUser] = useState<any>(null),
    [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => {
    api('catalog')
      .then((c) => setUser(c.user))
      .catch(() => {});
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (mode === 'login') {
        const r = await signIn('credentials', { email, password, portal: 'user', redirect: false });
        if (r?.error)
          throw new Error(
            r.error === 'Gunakan halaman login admin.'
              ? r.error
              : 'Email atau password tidak sesuai, atau email belum diverifikasi.',
          );
        window.location.href = '/';
        return;
      }
      const response = await fetch('/api/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: mode, name, email, password, token: params.get('token') }),
      });
      const r = await response.json();
      if (!response.ok) throw new Error(r.error);
      setMessage(r.message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (user)
    return (
      <div className="narrow">
        <div className="eyebrow">AKUN SAYA</div>
        <h1>Ahlan, {user.name}.</h1>
        <section className="panel">
          <p>{user.email}</p>
          <p>
            Level {user.level} · {user.points} poin
          </p>
          <div className="actions">
            {user.role === 'admin' && (
              <Link href="/admin" className="button primary">
                Dashboard admin
                <ArrowRight size={16} />
              </Link>
            )}
            <Link href="/" className="button primary">
              Jelajahi materi
              <ArrowRight size={16} />
            </Link>
            <button className="button outline" onClick={() => signOut({ callbackUrl: '/' })}>
              Keluar
            </button>
          </div>
        </section>
        <section className="panel">
          <h2>Hapus akun</h2>
          <p>
            Progres, poin, dan riwayat latihan Anda akan dihapus. Nama Anda pada sesi bersama
            dianonimkan.
          </p>
          <button className="text-button" onClick={() => setConfirmDelete(!confirmDelete)}>
            Saya ingin menghapus akun
          </button>
          {confirmDelete && (
            <>
              <label className="field">
                Konfirmasi dengan password
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <button
                className="button danger"
                disabled={busy || !password}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const res = await fetch('/api/account', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'delete', password }),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error);
                    await signOut({ callbackUrl: '/' });
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Hapus akun dan progres
              </button>
            </>
          )}
          {error && <div className="notice error">{error}</div>}
        </section>
      </div>
    );
  return (
    <div className="narrow">
      <div className="eyebrow">PERJALANAN DIMULAI DI SINI</div>
      <h1>
        {mode === 'verify' ? (
          'Verifikasi email Anda.'
        ) : mode === 'reset' ? (
          'Buat password baru.'
        ) : (
          <>
            Selamat datang di{' '}
            <bdi lang="ar" dir="rtl">
              {BRAND_NAME}
            </bdi>
            .
          </>
        )}
      </h1>
      <section className="panel">
        {['login', 'register'].includes(mode) && (
          <div className="tabs">
            <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>
              Masuk
            </button>
            <button
              className={mode === 'register' ? 'active' : ''}
              onClick={() => setMode('register')}
            >
              Daftar akun
            </button>
          </div>
        )}
        <form onSubmit={submit}>
          {mode === 'register' && (
            <label className="field">
              Nama
              <input
                required
                minLength={2}
                maxLength={60}
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
          )}
          {!['verify', 'reset'].includes(mode) && (
            <label className="field">
              Email
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
          )}
          {['login', 'register', 'reset'].includes(mode) && (
            <label className="field">
              Password
              <input
                type="password"
                required
                minLength={mode === 'login' ? 1 : 12}
                maxLength={128}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {mode !== 'login' && <small className="muted">Minimal 12 karakter.</small>}
            </label>
          )}
          {mode === 'verify' && <p>Klik tombol di bawah untuk mengonfirmasi alamat email Anda.</p>}
          {mode === 'register' && (
            <p>
              Dengan mendaftar, Anda memahami{' '}
              <Link className="text-button" href="/privasi">
                pemberitahuan privasi
              </Link>
              .
            </p>
          )}
          <button className="button primary" disabled={busy}>
            {busy
              ? 'Memproses…'
              : mode === 'login'
                ? 'Masuk'
                : mode === 'register'
                  ? 'Buat akun'
                  : mode === 'verify'
                    ? 'Verifikasi email'
                    : mode === 'reset'
                      ? 'Simpan password'
                      : 'Kirim tautan'}
            <ArrowRight size={16} />
          </button>
        </form>
        {message && (
          <div className="notice success">
            <CheckCircle2 size={18} />
            {message}
          </div>
        )}
        {error && (
          <div className="notice error" role="alert">
            {error}
          </div>
        )}
        <div className="actions">
          {mode === 'login' ? (
            <>
              <button className="text-button" onClick={() => setMode('forgot')}>
                Lupa password?
              </button>
              <button className="text-button" onClick={() => setMode('resend')}>
                <Mail size={15} />
                Kirim ulang verifikasi
              </button>
              <Link className="text-button" href="/admin/login">
                Login admin
              </Link>
            </>
          ) : (
            <button className="text-button" onClick={() => setMode('login')}>
              Kembali ke masuk
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
export default function Page() {
  return (
    <Suspense fallback={<div className="loading">Memuat akun…</div>}>
      <Account />
    </Suspense>
  );
}
