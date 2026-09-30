'use client';
import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Upload, Check, AudioLines } from 'lucide-react';
import type { Media } from '@/lib/admin-media';
import { uploadMedia } from '@/lib/media-client';
import { useAdmin } from './context';

export function MediaManager({
  kind,
  onSelect,
}: {
  kind?: 'audio' | 'image';
  onSelect?: (media: Media) => void;
}) {
  const { data } = useAdmin();
  const [items, setItems] = useState<Media[]>([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [recording, setRecording] = useState(false),
    [seconds, setSeconds] = useState(0),
    [recorded, setRecorded] = useState<{ file: File; duration: number; url: string } | null>(null),
    [search, setSearch] = useState('');
  const recorder = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    timer = useRef<ReturnType<typeof setInterval> | null>(null),
    mounted = useRef(true);
  async function load() {
    const r = await fetch('/api/admin/media');
    const result = await r.json();
    if (!r.ok) throw new Error(result.error);
    setItems(result);
  }
  useEffect(() => {
    mounted.current = true;
    load().catch((e) => setError(e.message));
    return () => {
      mounted.current = false;
      if (recorder.current?.state === 'recording') recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
      if (timer.current) clearInterval(timer.current);
    };
  }, []);
  useEffect(
    () => () => {
      if (recorded) URL.revokeObjectURL(recorded.url);
    },
    [recorded],
  );
  async function upload(file: File, knownDuration?: number) {
    setBusy(true);
    setError('');
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('Ukuran maksimal 20 MB.');
      let duration = knownDuration ?? 0;
      if (!file.type.startsWith('image/') && !knownDuration) {
        const context = new AudioContext();
        try {
          duration = (await context.decodeAudioData(await file.arrayBuffer())).duration;
        } finally {
          await context.close();
        }
      }
      const media = await uploadMedia(file, duration);
      await load();
      setRecorded(null);
      onSelect?.(media);
    } catch (e) {
      setError((e as Error).message || 'File tidak bisa dibaca. Coba format WAV atau MP3.');
    } finally {
      setBusy(false);
    }
  }
  async function startRecording() {
    setError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
        throw new Error(
          'Perekaman memerlukan browser yang mendukung mikrofon di localhost atau HTTPS.',
        );
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) {
        stream.current.getTracks().forEach((t) => t.stop());
        return;
      }
      const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find((t) =>
        MediaRecorder.isTypeSupported(t),
      );
      const r = new MediaRecorder(stream.current, mimeType ? { mimeType } : undefined);
      recorder.current = r;
      const chunks: Blob[] = [];
      const started = Date.now();
      r.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      r.onstop = () => {
        stream.current?.getTracks().forEach((t) => t.stop());
        if (timer.current) clearInterval(timer.current);
        if (!mounted.current) return;
        const file = new File(
          chunks,
          'Rekaman-' +
            new Date().toISOString().replace(/[:.]/g, '-') +
            (r.mimeType.includes('mp4') ? '.m4a' : r.mimeType.includes('ogg') ? '.ogg' : '.webm'),
          { type: r.mimeType },
        );
        setRecorded({
          file,
          duration: Math.min(180, (Date.now() - started) / 1000),
          url: URL.createObjectURL(file),
        });
        setRecording(false);
      };
      r.start();
      setRecorded(null);
      setRecording(true);
      setSeconds(0);
      timer.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - started) / 1000);
        setSeconds(elapsed);
        if (elapsed >= 179 && r.state === 'recording') r.stop();
      }, 500);
    } catch (e) {
      stream.current?.getTracks().forEach((t) => t.stop());
      setError(
        (e as Error).name === 'NotAllowedError'
          ? 'Izin mikrofon belum diberikan. Izinkan mikrofon melalui pengaturan browser.'
          : (e as Error).message,
      );
    }
  }
  const referenced = data.questions.flatMap((q) => [
    ...q.data.audio.map((a, i) => ({
      url: a.url,
      name: `${q.data.category} · klip ${i + 1}`,
      kind: 'audio' as const,
      duration: a.duration,
      size: 0,
      type: '',
      createdAt: '',
    })),
    ...q.data.options
      .filter((o) => o.image)
      .map((o) => ({
        url: o.image!,
        name: o.text || 'Gambar soal',
        kind: 'image' as const,
        duration: 0,
        size: 0,
        type: '',
        createdAt: '',
      })),
  ]);
  const media = [...new Map([...referenced, ...items].map((m) => [m.url, m])).values()].filter(
    (m) => (!kind || m.kind === kind) && m.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="media-manager">
      <div className="admin-upload">
        <AudioLines size={26} />
        <div>
          <h3>{kind === 'image' ? 'Tambahkan gambar' : 'Unggah atau rekam media'}</h3>
          <p>
            Audio maksimal 3 menit, file maksimal 20 MB. Media yang disimpan dapat digunakan
            kembali untuk soal lain.
          </p>
        </div>
        <label className="button outline">
          <Upload size={16} />
          Unggah file
          <input
            aria-label="Unggah media"
            type="file"
            disabled={busy || recording}
            accept={
              kind === 'image'
                ? 'image/png,image/jpeg,image/webp'
                : kind === 'audio'
                  ? 'audio/*'
                  : 'audio/*,image/png,image/jpeg,image/webp'
            }
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
              e.target.value = '';
            }}
          />
        </label>
        {kind !== 'image' && (
          <button
            type="button"
            className={'button ' + (recording ? 'danger' : 'primary')}
            disabled={busy}
            onClick={() => (recording ? recorder.current?.stop() : void startRecording())}
          >
            {recording ? <Square size={16} /> : <Mic size={16} />}
            {recording ? `Hentikan · ${seconds} dtk` : 'Rekam suara'}
          </button>
        )}
      </div>
      {busy && <p role="status">Mengunggah media…</p>}
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {recorded && (
        <div className="panel">
          <h3>Dengarkan rekaman</h3>
          <audio controls src={recorded.url} />
          <div className="actions">
            <button
              className="button primary"
              disabled={busy}
              onClick={() => void upload(recorded.file, recorded.duration)}
            >
              Simpan rekaman{onSelect ? ' dan gunakan' : ''}
            </button>
            <button className="button outline" disabled={busy} onClick={() => setRecorded(null)}>
              Buang rekaman
            </button>
          </div>
        </div>
      )}
      <label className="field">
        Cari media
        <input
          placeholder="Cari berdasarkan nama…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <div className="admin-media-grid">
        {media.map((m) => (
          <article className="admin-media-card" key={m.url}>
            {m.kind === 'audio' ? (
              <audio controls preload="none" src={m.url} />
            ) : (
              <img src={m.url} alt={m.name} />
            )}
            <strong>{m.name}</strong>
            <small>
              {m.kind === 'audio' ? `${m.duration.toFixed(1)} detik` : 'Gambar'}
              {m.size > 0 ? ` · ${(m.size / 1024).toFixed(0)} KB` : ''}
            </small>
            {onSelect && (
              <button type="button" className="button outline" onClick={() => onSelect(m)}>
                <Check size={15} />
                Gunakan media
              </button>
            )}
          </article>
        ))}
      </div>
      {!media.length && (
        <div className="admin-empty">Belum ada media yang cocok. Unggah file pertama Anda.</div>
      )}
    </div>
  );
}
