'use client';
import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Play, RotateCcw, Volume2, AlertCircle } from 'lucide-react';
import type { PublicQuestion } from '@/lib/contracts';
export function AudioPlayer({
  question,
  replays,
  onStart,
  onComplete,
  autoAt,
  disabled = false,
}: {
  question: PublicQuestion;
  replays: number;
  onStart: (replay: boolean) => Promise<void>;
  onComplete: () => void;
  autoAt?: number;
  disabled?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null),
    wave = useRef<WaveSurfer | null>(null),
    running = useRef(false),
    everPlayed = useRef(false),
    onCompleteRef = useRef(onComplete);
  const [ready, setReady] = useState(false),
    [playing, setPlaying] = useState(false),
    [completed, setCompleted] = useState(false),
    [error, setError] = useState(''),
    [progress, setProgress] = useState(0),
    [clip, setClip] = useState(0),
    [retry, setRetry] = useState(0);
  onCompleteRef.current = onComplete;
  useEffect(() => {
    if (!container.current) return;
    let disposed = false,
      index = 0;
    const ws = WaveSurfer.create({
      container: container.current,
      height: 75,
      waveColor: '#cad5bc',
      progressColor: '#527448',
      cursorColor: '#bd9950',
      barWidth: 3,
      barGap: 3,
      barRadius: 4,
      interact: false,
      normalize: true,
    });
    wave.current = ws;
    ws.on('ready', () => {
      if (!disposed) setReady(true);
    });
    ws.on('timeupdate', (time) => {
      if (!disposed) setProgress((time / (ws.getDuration() || 1)) * 100);
    });
    ws.on('error', () => {
      if (!disposed) {
        setError('Audio gagal dimuat. Periksa koneksi lalu coba lagi.');
        setPlaying(false);
        running.current = false;
      }
    });
    ws.on('finish', async () => {
      if (disposed) return;
      if (index + 1 < question.audio.length) {
        index++;
        setClip(index);
        setReady(false);
        try {
          await ws.load(question.audio[index].url);
          await ws.play();
        } catch {
          setError('Klip berikutnya gagal diputar. Coba lagi.');
          setPlaying(false);
          running.current = false;
        }
      } else {
        running.current = false;
        setPlaying(false);
        setCompleted(true);
        onCompleteRef.current();
      }
    });
    void ws.load(question.audio[0].url).catch(() => {});
    // Preload the remaining clips without exposing transcripts or answer keys.
    const preload = question.audio.slice(1).map((a) => {
      const el = new Audio();
      el.preload = 'auto';
      el.src = a.url;
      return el;
    });
    (ws as WaveSurfer & { restartSequence?: () => void }).restartSequence = () => {
      index = 0;
      setClip(0);
    };
    return () => {
      disposed = true;
      ws.destroy();
      wave.current = null;
      preload.forEach((el) => {
        el.removeAttribute('src');
        el.load();
      });
    };
  }, [question.id, retry]);
  async function play() {
    if (!wave.current || running.current || disabled) return;
    running.current = true;
    setError('');
    try {
      await onStart(everPlayed.current && completed);
      const ws = wave.current as WaveSurfer & { restartSequence?: () => void };
      ws.restartSequence?.();
      if (clip > 0) await ws.load(question.audio[0].url);
      else ws.setTime(0);
      await ws.play();
      everPlayed.current = true;
      setPlaying(true);
      setCompleted(false);
    } catch (e) {
      running.current = false;
      setError((e as Error).message || 'Ketuk Putar audio untuk mengizinkan pemutaran.');
    }
  }
  const playRef = useRef(play);
  playRef.current = play;
  useEffect(() => {
    if (!autoAt) return;
    const timer = setTimeout(
      () => {
        if (!everPlayed.current) void playRef.current();
      },
      Math.max(0, autoAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [autoAt]);
  return (
    <div className="audio-player">
      <div className="connection" style={{ justifyContent: 'center', marginBottom: 12 }}>
        <Volume2 size={15} />
        {question.audio.length > 1
          ? `Klip ${clip + 1} dari ${question.audio.length}`
          : 'Dengarkan dengan saksama'}
      </div>
      <div className="waveform" ref={container} />
      <div className="progress-track" aria-label="Progres audio">
        <span style={{ width: progress + '%' }} />
      </div>
      <div className="audio-controls">
        <button
          className="button primary"
          disabled={!ready || playing || disabled || (completed && replays >= 2)}
          onClick={play}
        >
          {completed ? <RotateCcw size={17} /> : <Play size={17} />}{' '}
          {playing ? 'Sedang diputar…' : completed ? 'Putar ulang' : 'Putar audio'}
        </button>
        <small>{2 - replays}× replay tersisa</small>
      </div>
      {error && (
        <div className="notice" role="alert">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button
            onClick={() => {
              setError('');
              setReady(false);
              setRetry((n) => n + 1);
            }}
          >
            Muat ulang
          </button>
        </div>
      )}
    </div>
  );
}
