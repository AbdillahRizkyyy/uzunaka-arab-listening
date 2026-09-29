'use client';
import { useState } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { ArrowRight } from 'lucide-react';
import { BrandLockup, BrandArtwork } from '@/components/brand';
export function AdminLogin() {
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await signIn('credentials', {
        email,
        password,
        portal: 'admin',
        redirect: false,
      });
      if (!result?.ok || result.error)
        throw new Error('Email atau password tidak sesuai, atau akun tidak memiliki akses admin.');
      window.location.href = '/admin';
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <main className="admin-login">
      <section className="admin-login-intro">
        <Link href="/" className="admin-brand">
          <BrandLockup />
          <span className="admin-badge">ADMIN</span>
        </Link>
        <div>
          <BrandArtwork className="admin-login-artwork" />
          <h1>Ruang pengelola belajar.</h1>
          <p>Kelola materi, rekaman, dan sesi listening dari satu dashboard.</p>
        </div>
        <span className="eyebrow">DENGARKAN. PAHAMI. BERTUMBUH.</span>
      </section>
      <section className="admin-login-form">
        <div className="eyebrow">PANEL PENGELOLA</div>
        <h2>Masuk sebagai admin</h2>
        <p>Gunakan akun admin yang sudah diberikan akses.</p>
        <form onSubmit={submit}>
          <label className="field">
            Email
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="field">
            Password
            <input
              type="password"
              autoComplete="current-password"
              required
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && (
            <div className="notice error" role="alert">
              {error}
            </div>
          )}
          <button className="button primary" disabled={busy}>
            {busy ? 'Memproses…' : 'Masuk ke dashboard'}
            <ArrowRight size={17} />
          </button>
        </form>
        <div className="actions">
          <Link className="text-button" href="/akun?mode=forgot">
            Lupa password?
          </Link>
          <Link className="text-button" href="/akun">
            Login pengguna biasa
          </Link>
        </div>
      </section>
    </main>
  );
}
