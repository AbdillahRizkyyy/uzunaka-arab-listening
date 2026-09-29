'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '@/lib/client';
import type { Question } from '@/lib/contracts';
export type Unit = {
  id: string;
  level: number;
  title: string;
  theme: string;
  description: string;
  archived?: boolean;
  developmentOnly?: boolean;
  _count?: { questions: number };
};
export type AdminData = {
  questions: {
    id: string;
    unitId: string;
    level: number;
    pool: string;
    status: string;
    version: number;
    position: number;
    data: Question;
  }[];
  units: Unit[];
  rooms: {
    id: string;
    code: string;
    status: string;
    host: { name: string; email: string };
    _count: { participants: number };
  }[];
  users: {
    id: string;
    name: string;
    email: string;
    role: string;
    verifiedAt: string | null;
    level: number;
    onboarding: boolean;
  }[];
  reports: { id: string; questionId: string; message: string }[];
  review: { approved: boolean; reviewer: string | null } | null;
  stats: {
    users: number;
    questions: number;
    published: number;
    draft: number;
    activeRooms: number;
  };
  settings: { name: string; tagline: string; supportEmail: string };
  currentUserId: string;
};
type Context = {
  data: AdminData;
  busy: boolean;
  refresh: () => Promise<void>;
  mutate: (path: string, value: unknown, message?: string) => Promise<boolean>;
};
const AdminContext = createContext<Context | null>(null);
export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AdminData | null>(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  async function refresh() {
    setData(await api<AdminData>('admin'));
  }
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, []);
  async function mutate(path: string, value: unknown, message = 'Perubahan tersimpan.') {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api('admin/' + path, value);
      await refresh();
      setNotice(message);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {error && (
        <div className="notice error" role="alert">
          {error}
          <button onClick={() => setError('')}>Tutup</button>
        </div>
      )}
      {notice && (
        <div className="notice success" role="status">
          {notice}
          <button onClick={() => setNotice('')}>Tutup</button>
        </div>
      )}
      {data ? (
        <AdminContext.Provider value={{ data, busy, refresh, mutate }}>
          {children}
        </AdminContext.Provider>
      ) : (
        <div className="panel">
          <p>{error ? 'Panel belum dapat dimuat.' : 'Memuat panel admin…'}</p>
          {error && (
            <button
              className="button outline"
              onClick={() =>
                refresh()
                  .then(() => setError(''))
                  .catch((e) => setError(e.message))
              }
            >
              Coba lagi
            </button>
          )}
        </div>
      )}
    </>
  );
}
export function useAdmin() {
  const context = useContext(AdminContext);
  if (!context) throw new Error('Admin provider required');
  return context;
}
