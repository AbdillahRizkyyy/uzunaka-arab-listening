'use client';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowUp, ArrowDown, Plus, Trash2, Eye, Save } from 'lucide-react';
import { questionSchema, typeLabels, type Question } from '@/lib/contracts';
import { grade } from '@/lib/domain';
import { useAdmin } from './context';
import { MediaManager } from './media-manager';
import { QuestionInput } from '@/components/question-input';
import type { Media } from '@/lib/admin-media';

import { RevisionHistory } from './controls';

const option = () => ({ id: crypto.randomUUID(), text: '' });
export function emptyQuestion(unitId: string, level: number): Question {
  const options = [option(), option()];
  return {
    id: 'soal-' + crypto.randomUUID(),
    version: 1,
    unitId,
    level,
    pool: 'practice',
    type: 'pilihan_ganda',
    prompt: '',
    category: '',
    audio: [],
    options,
    accepted: [options[0].id],
    transcript: '',
    explanation: '',
    harakat: 'full',
    seconds: 30,
  };
}
export function QuestionEditor({ initial, onClose }: { initial: Question; onClose: () => void }) {
  const { data, busy, mutate } = useAdmin();
  const [q, setQ] = useState<Question>(() => structuredClone(initial)),
    [error, setError] = useState(''),
    [preview, setPreview] = useState(false),
    [previewResult, setPreviewResult] = useState<string | null>(null),
    [picker, setPicker] = useState<{ kind: 'audio' | 'image'; index: number } | null>(null);
  const dirty = JSON.stringify(q) !== JSON.stringify(initial);
  useEffect(() => {
    if (!dirty) return;
    const leave = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    const link = (e: MouseEvent) => {
      const a = (e.target as Element).closest('a[href]');
      if (a && !window.confirm('Perubahan belum disimpan. Tinggalkan editor?')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', leave);
    document.addEventListener('click', link, true);
    return () => {
      window.removeEventListener('beforeunload', leave);
      document.removeEventListener('click', link, true);
    };
  }, [dirty]);
  const close = () => {
    if (!dirty || window.confirm('Buang perubahan yang belum disimpan?')) onClose();
  };
  const existing = data.questions.some((row) => row.id === initial.id);
  const set = <K extends keyof Question>(key: K, value: Question[K]) =>
    setQ((old) => ({ ...old, [key]: value }));
  function changeType(type: Question['type']) {
    const options =
      type === 'dikte' ? [] : q.options.length >= 2 ? q.options : [option(), option()];
    setQ({
      ...q,
      type,
      options,
      accepted:
        type === 'dikte' ? [''] : type === 'urutkan' ? [options.map((o) => o.id)] : [options[0].id],
    });
  }
  function updateOptions(options: Question['options']) {
    let accepted = q.accepted;
    if (q.type === 'urutkan') accepted = [options.map((o) => o.id)];
    else {
      accepted = accepted.filter((a) => typeof a === 'string' && options.some((o) => o.id === a));
      if (!accepted.length && options.length) accepted = [options[0].id];
    }
    setQ({ ...q, options, accepted });
  }
  function chooseMedia(media: Media) {
    if (!picker) return;
    if (picker.kind === 'audio') {
      const audio = [...q.audio];
      audio[picker.index] = {
        url: media.url,
        duration: media.duration,
        native: false,
        reviewed: false,
        license: '',
      };
      set('audio', audio);
    } else
      set(
        'options',
        q.options.map((o, i) =>
          i === picker.index ? { ...o, image: media.url, license: o.license ?? '' } : o,
        ),
      );
    setPicker(null);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (q.options.some((o) => !o.text.trim())) {
      setError('Isi teks untuk setiap pilihan atau token.');
      return;
    }
    const parsed = questionSchema.safeParse(q);
    if (!parsed.success) {
      setError(
        parsed.error.issues
          .map((i) =>
            i.path[0] === 'audio'
              ? 'Tambahkan audio lengkap (beda bunyi minimal dua klip).'
              : i.path[0] === 'accepted'
                ? 'Lengkapi kunci jawaban.'
                : i.message,
          )
          .join(' '),
      );
      return;
    }
    if (
      await mutate(
        'question',
        parsed.data,
        'Soal disimpan sebagai draft. Tinjau lalu terbitkan dari bank soal.',
      )
    )
      onClose();
  }
  if (picker)
    return (
      <section className="panel">
        <button className="text-button" onClick={() => setPicker(null)}>
          <ArrowLeft size={16} />
          Kembali ke soal
        </button>
        <h2>{picker.kind === 'audio' ? 'Pilih audio soal' : 'Pilih gambar jawaban'}</h2>
        <MediaManager kind={picker.kind} onSelect={chooseMedia} />
      </section>
    );
  return (
    <div>
      <div className="admin-heading">
        <div>
          <button className="text-button" onClick={close}>
            <ArrowLeft size={16} />
            Kembali ke bank soal
          </button>
          <h1>{existing ? 'Edit soal' : 'Buat soal baru'}</h1>
          <p>Lengkapi materi, audio, dan kunci jawaban. Semua perubahan disimpan sebagai draft.</p>
        </div>
        <button
          className="button outline"
          onClick={() => {
            setPreview(!preview);
            setPreviewResult(null);
          }}
        >
          <Eye size={16} />
          {preview ? 'Tutup pratinjau' : 'Pratinjau soal'}
        </button>
      </div>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {preview && (
        <section className="panel admin-preview">
          <span className="eyebrow">PRATINJAU PESERTA · TANPA POIN</span>
          <h2>{q.prompt || 'Instruksi soal'}</h2>
          {q.audio.map((a, i) => (
            <audio key={i} controls src={a.url} />
          ))}
          <QuestionInput
            key={JSON.stringify([q.type, q.options])}
            question={q}
            disabled={false}
            busy={false}
            onSubmit={(v) =>
              setPreviewResult(grade(q, v) ? 'Jawaban benar.' : 'Jawaban belum tepat.')
            }
          />
          {previewResult && (
            <p role="status">
              {previewResult} {q.explanation}
            </p>
          )}
        </section>
      )}
      {existing && <RevisionHistory question={initial} onRestored={onClose} />}
      <form onSubmit={save}>
        <fieldset disabled={busy} className="admin-fieldset">
          <section className="panel">
            <h2>1. Identitas soal</h2>
            <div className="form-grid">
              <label className="field">
                Paket materi
                <select
                  required
                  value={q.unitId}
                  onChange={(e) => {
                    const u = data.units.find((u) => u.id === e.target.value)!;
                    setQ({ ...q, unitId: u.id, level: u.level });
                  }}
                >
                  {data.units.map((u) => (
                    <option key={u.id} value={u.id}>
                      Level {u.level} · {u.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Digunakan untuk
                <select
                  value={q.pool}
                  onChange={(e) => set('pool', e.target.value as Question['pool'])}
                >
                  <option value="practice">Latihan & sesi live</option>
                  <option value="assessment">Tes penempatan & naik level</option>
                </select>
              </label>
              <label className="field">
                Tipe soal
                <select
                  value={q.type}
                  onChange={(e) => changeType(e.target.value as Question['type'])}
                >
                  {Object.entries(typeLabels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Kategori keterampilan
                <input
                  required
                  maxLength={120}
                  value={q.category}
                  placeholder="Misalnya: Kosakata kampus"
                  onChange={(e) => set('category', e.target.value)}
                />
              </label>
            </div>
            <label className="field">
              Instruksi soal
              <textarea
                required
                maxLength={1000}
                value={q.prompt}
                onChange={(e) => set('prompt', e.target.value)}
                placeholder="Dengarkan kalimat, lalu pilih tempat yang disebutkan."
              />
            </label>
            <div className="form-grid">
              <label className="field">
                Waktu menjawab (detik)
                <input
                  type="number"
                  required
                  min={10}
                  max={180}
                  value={q.seconds}
                  onChange={(e) => set('seconds', Number(e.target.value))}
                />
              </label>
              <label className="field">
                Penulisan harakat
                <select
                  value={q.harakat}
                  onChange={(e) => set('harakat', e.target.value as Question['harakat'])}
                >
                  <option value="full">Harakat lengkap</option>
                  <option value="partial">Harakat sebagian</option>
                  <option value="none">Tanpa harakat</option>
                </select>
              </label>
            </div>
          </section>
          <section className="panel">
            <h2>2. Audio pertanyaan</h2>
            <p>
              {q.type === 'beda_bunyi'
                ? 'Tambahkan minimal dua klip. Peserta mendengar semua klip sesuai urutan.'
                : 'Unggah, rekam suara, atau pilih rekaman dari pustaka media.'}
            </p>
            {q.audio.map((a, i) => (
              <div className="admin-audio-row" key={i}>
                <div className="section-heading">
                  <h3>
                    Klip {i + 1} · {a.duration.toFixed(1)} detik
                  </h3>
                  <div className="actions">
                    <button
                      type="button"
                      className="text-button"
                      disabled={i === 0}
                      aria-label={`Naikkan klip ${i + 1}`}
                      onClick={() => {
                        const audio = [...q.audio];
                        [audio[i - 1], audio[i]] = [audio[i], audio[i - 1]];
                        set('audio', audio);
                      }}
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => setPicker({ kind: 'audio', index: i })}
                    >
                      Ganti audio
                    </button>
                    <button
                      type="button"
                      className="text-button"
                      aria-label={`Hapus klip ${i + 1}`}
                      onClick={() =>
                        set(
                          'audio',
                          q.audio.filter((_, j) => j !== i),
                        )
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <audio controls src={a.url} />
                <label className="field">
                  Izin penggunaan audio
                  <input
                    value={a.license}
                    onChange={(e) =>
                      set(
                        'audio',
                        q.audio.map((clip, j) =>
                          j === i ? { ...clip, license: e.target.value } : clip,
                        ),
                      )
                    }
                    placeholder="Misalnya: Rekaman sendiri, diizinkan untuk aplikasi ini"
                  />
                </label>
                <div className="admin-checks">
                  <label>
                    <input
                      type="checkbox"
                      checked={a.native}
                      onChange={(e) =>
                        set(
                          'audio',
                          q.audio.map((clip, j) =>
                            j === i ? { ...clip, native: e.target.checked } : clip,
                          ),
                        )
                      }
                    />
                    Direkam penutur native
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={a.reviewed}
                      onChange={(e) =>
                        set(
                          'audio',
                          q.audio.map((clip, j) =>
                            j === i ? { ...clip, reviewed: e.target.checked } : clip,
                          ),
                        )
                      }
                    />
                    Pelafalan sudah ditinjau
                  </label>
                </div>
              </div>
            ))}
            <button
              type="button"
              className="button outline"
              disabled={q.audio.length >= 5}
              onClick={() => setPicker({ kind: 'audio', index: q.audio.length })}
            >
              <Plus size={16} />
              Tambahkan audio
            </button>
          </section>
          <section className="panel">
            <h2>3. Jawaban dan kunci</h2>
            {q.type === 'dikte' ? (
              <>
                <p>
                  Kunci dikte harus sama persis dengan jawaban peserta, termasuk harakat, spasi, dan
                  tanda baca.
                </p>
                <label className="field">
                  Kunci dikte
                  <textarea
                    required
                    className="arabic"
                    dir="rtl"
                    lang="ar"
                    value={String(q.accepted[0] ?? '')}
                    onChange={(e) => set('accepted', [e.target.value])}
                  />
                </label>
              </>
            ) : (
              <>
                <p>
                  {q.type === 'urutkan'
                    ? 'Masukkan satu kata per token. Atur urutan kunci di bawah; setiap token memiliki identitas sendiri meskipun teksnya sama.'
                    : 'Isi pilihan jawaban, lalu centang pilihan yang benar.'}
                </p>
                {q.options.map((o, i) => (
                  <div className="admin-option-editor" key={o.id}>
                    <div className="admin-option-line">
                      <span className="status-chip">{i + 1}</span>
                      <label className="field">
                        {q.type === 'urutkan' ? 'Token' : 'Pilihan'} {i + 1}
                        <input
                          required
                          dir="auto"
                          value={o.text}
                          onChange={(e) =>
                            set(
                              'options',
                              q.options.map((x, j) =>
                                j === i ? { ...x, text: e.target.value } : x,
                              ),
                            )
                          }
                        />
                      </label>
                      {q.type !== 'urutkan' && (
                        <label className="admin-checkbox">
                          <input
                            type="checkbox"
                            checked={q.accepted.includes(o.id)}
                            onChange={(e) =>
                              set(
                                'accepted',
                                e.target.checked
                                  ? [...q.accepted, o.id]
                                  : q.accepted.filter((id) => id !== o.id),
                              )
                            }
                          />
                          Benar
                        </label>
                      )}
                      <button
                        type="button"
                        className="text-button"
                        aria-label={`Hapus pilihan ${i + 1}`}
                        disabled={q.options.length <= 2}
                        onClick={() => updateOptions(q.options.filter((_, j) => j !== i))}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                    {q.type === 'pilih_gambar' && (
                      <div className="admin-image-option">
                        {o.image && <img src={o.image} alt={o.text} />}
                        <button
                          type="button"
                          className="button outline"
                          onClick={() => setPicker({ kind: 'image', index: i })}
                        >
                          {o.image ? 'Ganti gambar' : 'Pilih gambar'}
                        </button>
                        <label className="field">
                          Izin penggunaan gambar
                          <input
                            required
                            value={o.license ?? ''}
                            onChange={(e) =>
                              set(
                                'options',
                                q.options.map((x, j) =>
                                  j === i ? { ...x, license: e.target.value } : x,
                                ),
                              )
                            }
                          />
                        </label>
                      </div>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  className="button outline"
                  disabled={q.options.length >= 20}
                  onClick={() => updateOptions([...q.options, option()])}
                >
                  <Plus size={16} />
                  {q.type === 'urutkan' ? 'Tambah token' : 'Tambah pilihan'}
                </button>
                {q.type === 'urutkan' && (
                  <div className="admin-orders">
                    <h3>Urutan jawaban yang diterima</h3>
                    {q.accepted.map((sequence, i) => (
                      <div className="admin-order" key={i}>
                        <strong>Urutan {i + 1}</strong>
                        <div className="tokens" dir="rtl">
                          {(Array.isArray(sequence) ? sequence : []).map((id, j) => (
                            <span className="admin-token" key={id}>
                              {q.options.find((o) => o.id === id)?.text ||
                                `Token ${q.options.findIndex((o) => o.id === id) + 1}`}
                              <button
                                type="button"
                                aria-label={`Urutan ${i + 1} token ${j + 1} maju`}
                                disabled={j === 0}
                                onClick={() => {
                                  const order = [...(sequence as string[])];
                                  [order[j - 1], order[j]] = [order[j], order[j - 1]];
                                  set(
                                    'accepted',
                                    q.accepted.map((a, k) => (k === i ? order : a)),
                                  );
                                }}
                              >
                                <ArrowUp size={14} />
                              </button>
                              <button
                                type="button"
                                aria-label={`Urutan ${i + 1} token ${j + 1} mundur`}
                                disabled={j === (sequence as string[]).length - 1}
                                onClick={() => {
                                  const order = [...(sequence as string[])];
                                  [order[j + 1], order[j]] = [order[j], order[j + 1]];
                                  set(
                                    'accepted',
                                    q.accepted.map((a, k) => (k === i ? order : a)),
                                  );
                                }}
                              >
                                <ArrowDown size={14} />
                              </button>
                            </span>
                          ))}
                        </div>
                        {i > 0 && (
                          <button
                            type="button"
                            className="text-button"
                            onClick={() =>
                              set(
                                'accepted',
                                q.accepted.filter((_, j) => j !== i),
                              )
                            }
                          >
                            Hapus alternatif
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => set('accepted', [...q.accepted, q.options.map((o) => o.id)])}
                    >
                      + Tambah urutan alternatif
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
          <section className="panel">
            <h2>4. Transkrip dan pembahasan</h2>
            <label className="field">
              Transkrip audio
              <textarea
                required
                className="arabic"
                lang="ar"
                dir="rtl"
                value={q.transcript}
                onChange={(e) => set('transcript', e.target.value)}
              />
            </label>
            <label className="field">
              Pembahasan jawaban
              <textarea
                required
                value={q.explanation}
                onChange={(e) => set('explanation', e.target.value)}
                placeholder="Jelaskan mengapa jawaban tersebut benar."
              />
            </label>
          </section>
          <div className="admin-savebar">
            <span>Versi {existing ? initial.version + 1 : 1} · Disimpan sebagai draft</span>
            <button type="button" className="button outline" onClick={close}>
              Batal
            </button>
            <button className="button primary" type="submit">
              <Save size={16} />
              {busy ? 'Menyimpan…' : 'Simpan draft'}
            </button>
          </div>
        </fieldset>
      </form>
    </div>
  );
}
