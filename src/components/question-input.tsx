'use client';
import { useRef, useState } from 'react';
import { PublicQuestion, AnswerValue } from '@/lib/contracts';
import { RotateCcw } from 'lucide-react';
export function QuestionInput({
  question,
  disabled,
  onSubmit,
  busy,
}: {
  question: PublicQuestion;
  disabled: boolean;
  onSubmit: (value: AnswerValue) => void;
  busy: boolean;
}) {
  const [selected, setSelected] = useState(''),
    [tokens, setTokens] = useState<string[]>([]),
    [text, setText] = useState('');
  const input = useRef<HTMLTextAreaElement>(null);
  const value = question.type === 'urutkan' ? tokens : question.type === 'dikte' ? text : selected;
  function insert(char: string) {
    const el = input.current,
      start = el?.selectionStart ?? text.length,
      end = el?.selectionEnd ?? text.length;
    setText(text.slice(0, start) + char + text.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + char.length, start + char.length);
    });
  }
  return (
    <div>
      <fieldset
        disabled={disabled || busy}
        style={{ border: 0, padding: 0, margin: 0, opacity: disabled ? 0.55 : 1 }}
      >
        <legend className="muted" style={{ marginBottom: 15 }}>
          {disabled ? 'Jawaban terbuka setelah audio selesai.' : 'Pilih jawaban Anda.'}
        </legend>
        {question.type === 'dikte' ? (
          <>
            <label className="field">
              Tulis persis yang didengar, termasuk harakat, spasi, dan tanda baca.
              <textarea
                ref={input}
                className="arabic"
                dir="rtl"
                lang="ar"
                value={text}
                onChange={(e) => setText(e.target.value)}
                spellCheck={false}
                autoComplete="off"
                maxLength={2000}
              />
            </label>
            <div className="harakat" aria-label="Bantuan karakter Arab">
              {[
                'َ',
                'ِ',
                'ُ',
                'ْ',
                'ّ',
                'ً',
                'ٍ',
                'ٌ',
                'أ',
                'إ',
                'آ',
                'ء',
                'ؤ',
                'ئ',
                'ة',
                'ى',
                '،',
                '؟',
                '۔',
              ].map((char) => (
                <button key={char} aria-label={'Sisipkan ' + char} onClick={() => insert(char)}>
                  {char}
                </button>
              ))}
            </div>
          </>
        ) : question.type === 'urutkan' ? (
          <>
            <div className="tokens arabic" dir="rtl" aria-label="Urutan jawaban">
              {tokens.map((id, i) => (
                <button key={id} onClick={() => setTokens(tokens.filter((_, j) => i !== j))}>
                  {question.options.find((o) => o.id === id)?.text}
                </button>
              ))}
            </div>
            <p className="muted" style={{ margin: '12px 0' }}>
              Ketuk kata sesuai urutan. Ketuk kata terpilih untuk mengembalikannya.
            </p>
            <div className="tokens arabic" dir="rtl">
              {question.options
                .filter((o) => !tokens.includes(o.id))
                .map((o) => (
                  <button key={o.id} onClick={() => setTokens([...tokens, o.id])}>
                    {o.text}
                  </button>
                ))}
            </div>
            <button className="text-button" onClick={() => setTokens([])}>
              <RotateCcw size={15} />
              Atur ulang
            </button>
          </>
        ) : (
          <div className="options" role="group" aria-label="Pilihan jawaban">
            {question.options.map((o, i) => (
              <button
                key={o.id}
                aria-pressed={selected === o.id}
                className={
                  'option ' +
                  (selected === o.id ? 'selected ' : '') +
                  (question.type === 'pilih_gambar' ? 'image-option' : '')
                }
                onClick={() => setSelected(o.id)}
              >
                <span className="letter">{String.fromCharCode(65 + i)}</span>
                {o.image && <img src={o.image} alt={o.text} />}
                <span className="arabic" lang="ar" dir="rtl">
                  {o.text}
                </span>
              </button>
            ))}
          </div>
        )}
        <div className="actions">
          <button
            className="button primary"
            disabled={
              disabled ||
              busy ||
              (Array.isArray(value) ? value.length !== question.options.length : !value)
            }
            onClick={() => onSubmit(value)}
          >
            {busy ? 'Mengirim…' : 'Kirim jawaban'}
          </button>
        </div>
      </fieldset>
    </div>
  );
}
