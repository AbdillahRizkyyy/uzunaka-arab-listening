'use client';
import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import QRCode from 'qrcode';
import Link from 'next/link';
import {
  Radio,
  Users,
  CheckCircle2,
  Wifi,
  WifiOff,
  X,
  Play,
  Clock3,
  ArrowRight,
  Trophy,
} from 'lucide-react';
import { api } from '@/lib/client';
import { AudioPlayer } from './audio-player';
import { QuestionInput } from './question-input';
import { FeedbackView, Feedback } from './quiz';
import type { PublicQuestion, AnswerValue } from '@/lib/contracts';
import type { Playback } from '@/lib/domain';
type RoomSnapshot = {
  id: string;
  code: string;
  host: boolean;
  status: string;
  index: number;
  total: number;
  serverNow: number;
  openedAt: number | null;
  deadline: number | null;
  hostOnline: boolean;
  cancelled: boolean;
  question: PublicQuestion | null;
  nextAudio: string[];
  playback: Playback;
  answered: boolean;
  ready: boolean;
  feedback: Feedback | null;
  players: { id: string; name: string; ready: boolean }[];
  answeredCount: number;
  leaderboard: { id: string; name: string; score: number; rank: number }[];
};
export function LiveRoom({ code }: { code: string }) {
  const [data, setData] = useState<RoomSnapshot | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [connected, setConnected] = useState(false),
    [qr, setQr] = useState(''),
    [heard, setHeard] = useState(false),
    [testHeard, setTestHeard] = useState(false),
    [now, setNow] = useState(Date.now()),
    [offset, setOffset] = useState(0);
  const identity = useRef<string | undefined>(undefined),
    socket = useRef<Socket | null>(null),
    lastIndex = useRef(-1),
    inflight = useRef(false),
    refreshRef = useRef<() => Promise<void>>(async () => {});
  function accept(result: RoomSnapshot) {
    if (result.index !== lastIndex.current) {
      setHeard(false);
      lastIndex.current = result.index;
    }
    setData(result);
    setOffset(result.serverNow - Date.now());
  }
  async function refresh() {
    if (inflight.current) return;
    inflight.current = true;
    try {
      accept(await api<RoomSnapshot>('rooms/' + code, undefined, identity.current));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      inflight.current = false;
    }
  }
  refreshRef.current = refresh;
  useEffect(() => {
    identity.current = localStorage.getItem('room:' + code) ?? undefined;
    let disposed = false;
    void refresh();
    void QRCode.toDataURL(location.origin + '/live?code=' + code, {
      width: 190,
      margin: 1,
      color: { dark: '#194d3c', light: '#ffffff' },
    }).then(setQr);
    async function connect() {
      try {
        const { ticket } = await api('rooms/' + code + '/ticket', {}, identity.current);
        if (disposed) return;
        const s = io(process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:3001', {
          auth: { ticket },
          reconnection: false,
        });
        socket.current = s;
        s.on('connect', () => setConnected(true));
        s.on('disconnect', () => setConnected(false));
        s.on('connect_error', () => setConnected(false));
        s.on('snapshot:changed', () => void refreshRef.current());
      } catch {
        setConnected(false);
      }
    }
    void connect();
    const poll = setInterval(() => {
      setNow(Date.now());
      if (!socket.current?.connected) void refreshRef.current();
      socket.current?.emit('heartbeat');
    }, 3000);
    const reconnect = setInterval(() => {
      if (!socket.current?.connected) {
        socket.current?.disconnect();
        void connect();
      }
    }, 15000);
    const clock = setInterval(() => setNow(Date.now()), 250);
    return () => {
      disposed = true;
      clearInterval(poll);
      clearInterval(reconnect);
      clearInterval(clock);
      socket.current?.disconnect();
    };
  }, [code]);
  useEffect(() => {
    const clips =
      data?.nextAudio.map((url) => {
        const audio = new Audio(url);
        audio.preload = 'auto';
        audio.load();
        return audio;
      }) ?? [];
    return () =>
      clips.forEach((a) => {
        a.removeAttribute('src');
        a.load();
      });
  }, [data?.index]);
  async function command(action: string, value?: AnswerValue, participantId?: string) {
    setBusy(true);
    setError('');
    try {
      const result = await api<RoomSnapshot|{ack:true}>(
          'rooms/' + code,
          {
            action,
            ...(value !== undefined ? { value } : {}),
            ...(participantId ? { participantId } : {}),
          },
          identity.current,
        );
      if('ack' in result){setData(previous=>previous?{...previous,answered:true}:previous);void refresh();}
      else accept(result);
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setBusy(false);
    }
  }
  async function testAudio() {
    try {
      const AudioContextClass = window.AudioContext;
      const ctx = new AudioContextClass();
      await ctx.resume();
      const osc = ctx.createOscillator(),
        gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 440;
      gain.gain.value = 0.08;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.65);
      osc.onended = () => {
        void ctx.close();
        setTestHeard(true);
      };
    } catch {
      setError('Audio belum diizinkan. Periksa pengaturan browser dan coba lagi.');
    }
  }
  if (!data)
    return (
      <div className="narrow">
        <div className="loading">{error || 'Menghubungkan ke ruang…'}</div>
        <Link className="button outline" href={'/live?code=' + code}>
          Kembali ke halaman gabung
        </Link>
      </div>
    );
  const q = data.question,
    remaining = data.deadline ? Math.max(0, Math.ceil((data.deadline - now - offset) / 1000)) : 0;
  return (
    <div>
      <div className="quiz-head">
        <div>
          <div className="eyebrow">{data.host ? 'RUANG HOST' : 'SESI LIVE'}</div>
          <h1>Belajar bersama.</h1>
        </div>
        <span className="connection">
          {connected ? <Wifi size={16} /> : <WifiOff size={16} />}{' '}
          {connected ? 'Terhubung' : 'Menyambungkan ulang'}
        </span>
      </div>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {!data.hostOnline && data.status !== 'ended' && (
        <div className="notice">Host sedang terputus. Soal aktif tetap berakhir sesuai waktu.</div>
      )}
      <div className="live-layout">
        <section>
          {['lobby', 'check'].includes(data.status) ? (
            <div className="panel">
              <span className="pill">
                <Radio size={15} />
                KODE RUANG
              </span>
              <div className="code" style={{ margin: '14px 0' }}>
                {code}
              </div>
              <p>Bagikan kode atau pindai QR untuk bergabung.</p>
              {qr && <img src={qr} width={160} height={160} alt={'QR gabung ruang ' + code} />}
              <div className="actions">
                {data.host ? (
                  <>
                    <button
                      className="button primary"
                      disabled={busy}
                      onClick={() =>
                        void command(data.status === 'lobby' ? 'check' : 'start').catch(() => {})
                      }
                    >
                      {data.status === 'lobby' ? 'Mulai audio check' : 'Mulai kuis'}
                      <ArrowRight size={16} />
                    </button>
                    <p className="muted">
                      {data.players.filter((p) => p.ready).length} dari {data.players.length}{' '}
                      peserta siap.
                    </p>
                  </>
                ) : (
                  <>
                    <button className="button outline" onClick={testAudio}>
                      <Play size={16} />
                      Tes audio saya
                    </button>
                    <button
                      className="button primary"
                      disabled={!testHeard || data.ready || busy}
                      onClick={() => void command('ready').catch(() => {})}
                    >
                      <CheckCircle2 size={16} />
                      {data.ready ? 'Saya sudah siap' : 'Suara terdengar, saya siap'}
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : data.status === 'ended' ? (
            <div className="panel">
              <Trophy size={36} />
              <h2 style={{ marginTop: 18 }}>Sesi selesai.</h2>
              <p>Terima kasih sudah mendengarkan dan belajar bersama.</p>
              {data.leaderboard.map((row) => (
                <div className="leader-row" key={row.id}>
                  <strong>{row.rank}</strong>
                  <span>{row.name}</span>
                  <strong>{row.score} poin</strong>
                </div>
              ))}
              <Link className="button primary" style={{ marginTop: 22 }} href="/">
                Kembali ke materi
              </Link>
            </div>
          ) : (
            q && (
              <div className="panel">
                <div className="quiz-head">
                  <span className="eyebrow">
                    SOAL {data.index + 1} / {data.total}
                  </span>
                  <span className="connection">
                    <Clock3 size={16} />
                    {remaining} detik
                  </span>
                </div>
                <h2 className="quiz-prompt">{q.prompt}</h2>
                {data.cancelled ? (
                  <div className="notice">Soal dibatalkan host. Tidak ada poin yang dihitung.</div>
                ) : (
                  <>
                    {data.status === 'question' && !data.host && (
                      <>
                        <AudioPlayer
                        key={'audio:' + q.id}
                          question={q}
                          replays={data.playback.replayCount}
                          onStart={async (replay) => command(replay ? 'replay' : 'play')}
                          onComplete={() => {
                            void command('heard')
                              .then(() => setHeard(true))
                              .catch(() => {});
                          }}
                          autoAt={data.openedAt ? data.openedAt + 15000 - offset : undefined}
                          disabled={data.answered}
                        />
                        {data.answered ? (
                          <div className="notice success">
                            <CheckCircle2 size={18} />
                            Jawaban tersimpan. Tunggu peserta lainnya.
                          </div>
                        ) : (
                          <QuestionInput
                          key={'input:' + q.id}
                            question={q}
                            disabled={!heard || remaining === 0}
                            busy={busy}
                            onSubmit={(v) => void command('answer', v).catch(() => {})}
                          />
                        )}
                      </>
                    )}
                    {data.host && data.status === 'question' && (
                      <div className="empty">
                        <Users size={35} style={{ margin: '0 auto 18px' }} />
                        <div className="big-number">
                          {data.answeredCount}
                          <span className="muted"> / {data.players.length}</span>
                        </div>
                        <p>peserta sudah menjawab</p>
                      </div>
                    )}
                    {data.feedback && data.status === 'reveal' && (
                      <FeedbackView feedback={data.feedback} question={q} />
                    )}
                  </>
                )}
                {data.status === 'leaderboard' && (
                  <>
                    <h2>Peringkat sementara</h2>
                    {data.leaderboard.slice(0, 5).map((row) => (
                      <div className="leader-row" key={row.id}>
                        <strong>{row.rank}</strong>
                        <span>{row.name}</span>
                        <strong>{row.score}</strong>
                      </div>
                    ))}
                  </>
                )}
                {data.host && (
                  <div className="actions">
                    {data.status === 'question' ? (
                      <button
                        className="button outline"
                        disabled={busy}
                        onClick={() => {
                          if (window.confirm('Batalkan soal ini untuk semua peserta tanpa poin?'))
                            void command('cancel').catch(() => {});
                        }}
                      >
                        Batalkan soal bermasalah
                      </button>
                    ) : (
                      <button
                        className="button primary"
                        disabled={busy}
                        onClick={() => void command('next').catch(() => {})}
                      >
                        {data.status === 'reveal'
                          ? 'Lihat leaderboard'
                          : data.index + 1 === data.total
                            ? 'Selesaikan sesi'
                            : 'Soal berikutnya'}
                        <ArrowRight size={16} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          )}
        </section>
        <aside>
          <section className="panel">
            <h2>
              <Users size={18} style={{ display: 'inline', marginRight: 8 }} />
              {data.players.length} pendengar
            </h2>
            <div className="participant-list">
              {data.players.map((p) => (
                <span className="participant" key={p.id}>
                  {p.ready && <CheckCircle2 size={13} />} {p.name}
                  {data.host && data.status !== 'ended' && (
                    <button
                      title={'Keluarkan ' + p.name}
                      onClick={() => {
                        if (window.confirm('Keluarkan ' + p.name + ' dari ruang?'))
                          void command('remove', undefined, p.id).catch(() => {});
                      }}
                    >
                      <X size={13} />
                    </button>
                  )}
                </span>
              ))}
            </div>
            {!data.players.length && <p>Peserta akan muncul di sini setelah bergabung.</p>}
            {data.host && data.status !== 'ended' && (
              <button
                className="text-button"
                onClick={() => {
                  if (window.confirm('Akhiri sesi untuk semua peserta?'))
                    void command('end').catch(() => {});
                }}
              >
                Akhiri sesi
              </button>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
