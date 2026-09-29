'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CheckCircle2, XCircle, Clock3, Flag } from 'lucide-react';
import { api } from '@/lib/client';
import { AudioPlayer } from './audio-player';
import { QuestionInput } from './question-input';
import type { PublicQuestion, AnswerValue } from '@/lib/contracts';
import type { Playback } from '@/lib/domain';
export type Feedback = {
  correct?: boolean;
  score?: number;
  accepted: AnswerValue[];
  transcript: string;
  explanation: string;
};
export function FeedbackView({
  feedback,
  question,
}: {
  feedback: Feedback;
  question: PublicQuestion;
}) {
  const answer = feedback.accepted
    .map((a) =>
      Array.isArray(a)
        ? a.map((id) => question.options.find((o) => o.id === id)?.text).join(' ')
        : question.type === 'dikte'
          ? a
          : question.options.find((o) => o.id === a)?.text,
    )
    .join(' / ');
  return (
    <section className="feedback" aria-live="polite">
      <h3>
        {feedback.correct ? <CheckCircle2 size={21} /> : <XCircle size={21} />}{' '}
        {feedback.correct ? 'Tepat, Anda menangkap maknanya.' : 'Mari dengarkan maknanya lagi.'}
        {feedback.score !== undefined && <span className="muted">+{feedback.score} poin</span>}
      </h3>
      <p>Jawaban benar:</p>
      <p className="arabic" lang="ar" dir="rtl">
        {answer}
      </p>
      <p>{feedback.explanation}</p>
      <details>
        <summary>Lihat teks Arab</summary>
        <p className="arabic" lang="ar" dir="rtl">
          {feedback.transcript}
        </p>
      </details>
    </section>
  );
}
type Snapshot = {
  id: string;
  kind: string;
  index: number;
  total: number;
  question: PublicQuestion | null;
  nextAudio: string[];
  playback: Playback;
  answered: boolean;
  finished: boolean;
  serverNow: number;
  deadline: number | null;
  feedback: Feedback | null;
  result?: {
    correct: number;
    total: number;
    score: number;
    passed: boolean;
    level: number;
    weak: string[];
  };
};
export function Quiz({ id }: { id: string }) {
  const [data, setData] = useState<Snapshot | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [heard, setHeard] = useState(false),
    [now, setNow] = useState(Date.now()),
    [report, setReport] = useState(''),
    [showReport, setShowReport] = useState(false),
    [offset, setOffset] = useState(0);
  async function refresh() {
    try {
      const result = await api<Snapshot>('attempts/' + id);
      setData(result);
      setOffset(result.serverNow - Date.now());
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [id]);
  useEffect(() => {
    if (data?.deadline && !data.answered && !data.finished && now + offset > data.deadline)
      void refresh();
  }, [Math.floor(now / 1000), data?.deadline, data?.answered]);
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
  async function command(action: string, value?: AnswerValue) {
    setBusy(true);
    setError('');
    try {
      const result = await api<Snapshot>('attempts/' + id, {
        action,
        ...(value !== undefined ? { value } : {}),
      });
      setData(result);
      setOffset(result.serverNow - Date.now());
      if (action === 'next') setHeard(false);
      return result;
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setBusy(false);
    }
  }
  if (!data)
    return (
      <div className="narrow">
        <div className="loading">{error || 'Menyiapkan ruang listening…'}</div>
        {error && (
          <button className="button outline" onClick={refresh}>
            Coba lagi
          </button>
        )}
      </div>
    );
  if (data.finished && data.result)
    return (
      <div className="narrow">
        <div className="eyebrow">SESI SELESAI</div>
        <h1>
          {data.kind === 'practice'
            ? 'Satu langkah lebih jauh.'
            : data.kind === 'onboarding'
              ? 'Titik mulai Anda sudah ditemukan.'
              : data.result.passed
                ? 'Level baru terbuka.'
                : 'Terus asah pendengaran Anda.'}
        </h1>
        <section className="panel">
          <div className="big-number">
            {data.result.correct}
            <span className="muted"> / {data.result.total} benar</span>
          </div>
          <p>
            {data.kind === 'practice'
              ? `${data.result.score} poin diperoleh.`
              : data.kind === 'onboarding'
                ? `Mulai dari level ${data.result.level}. Ini penempatan awal, bukan sertifikasi kemampuan.`
                : data.result.passed
                  ? 'Selamat! Bonus 1.000 poin telah diberikan.'
                  : 'Ulangi kategori yang perlu dilatih. Tes tersedia lagi setelah 24 jam.'}
          </p>
          {data.result.weak.length > 0 && <p>Perlu dilatih: {data.result.weak.join(', ')}.</p>}
          <Link href="/" className="button primary">
            Kembali ke materi
            <ArrowRight size={16} />
          </Link>
        </section>
      </div>
    );
  const q = data.question!,
    remaining = data.deadline
      ? Math.max(0, Math.ceil((data.deadline - now - offset) / 1000))
      : q.seconds;
  return (
    <div className="narrow">
      <Link className="text-button" href="/">
        <ArrowLeft size={15} />
        Kembali ke materi
      </Link>
      <div className="quiz-head">
        <span className="eyebrow">
          {data.kind === 'practice'
            ? 'LATIHAN MANDIRI'
            : data.kind === 'onboarding'
              ? 'TES PENEMPATAN'
              : 'TES NAIK LEVEL'}{' '}
          · {data.index + 1}/{data.total}
        </span>
        <span className="connection">
          <Clock3 size={16} />
          {remaining} detik
        </span>
      </div>
      <div className="progress-track">
        <span style={{ width: (data.index / data.total) * 100 + '%' }} />
      </div>
      <h1 className="quiz-prompt">{q.prompt}</h1>
      <p className="muted">
        {q.category} ·{' '}
        {data.kind === 'practice'
          ? 'Dengarkan sekali penuh, lalu jawab.'
          : 'Kunci dan transkrip tidak ditampilkan dalam tes.'}
      </p>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      <AudioPlayer
        key={'audio:' + q.id}
        question={q}
        replays={data.playback.replayCount}
        onStart={async (replay) => {
          await command(replay ? 'replay' : 'play');
        }}
        onComplete={() => {
          void command('heard')
            .then(() => setHeard(true))
            .catch(() => {});
        }}
        disabled={data.answered}
      />
      {!data.answered ? (
        <QuestionInput
          key={'input:' + q.id}
          question={q}
          disabled={!heard || remaining === 0}
          busy={busy}
          onSubmit={(value) => {
            void command('answer', value).catch(() => {});
          }}
        />
      ) : (
        <>
          <div className="notice success">
            <CheckCircle2 size={18} />
            Jawaban tersimpan.
          </div>
          {data.feedback && <FeedbackView feedback={data.feedback} question={q} />}
          <div className="actions">
            <button
              className="button primary"
              disabled={busy}
              onClick={() => {
                void command('next').catch(() => {});
              }}
            >
              {data.index + 1 === data.total ? 'Lihat hasil' : 'Soal berikutnya'}
              <ArrowRight size={16} />
            </button>
          </div>
        </>
      )}
      <button
        className="text-button"
        style={{ marginTop: 24 }}
        onClick={() => setShowReport(!showReport)}
      >
        <Flag size={14} />
        Laporkan masalah soal
      </button>
      {showReport && (
        <div className="panel">
          <label className="field">
            Jelaskan kendalanya
            <textarea value={report} onChange={(e) => setReport(e.target.value)} maxLength={2000} />
          </label>
          <button
            className="button outline"
            disabled={report.trim().length < 10}
            onClick={async () => {
              try {
                await api('reports', { questionId: q.id, message: report });
                setShowReport(false);
                setReport('');
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Kirim laporan
          </button>
        </div>
      )}
    </div>
  );
}
