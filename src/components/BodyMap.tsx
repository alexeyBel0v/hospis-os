import { useId, useState } from 'react';
import type { CatheterType, WoundStage, Wounds } from '../types/index.ts';
import { BODY_ZONES, CATHETER_MARK, countWounds, findZone, zoneLabel, type BodyView } from '../lib/body.ts';
import { hapticSelection } from '../lib/telegram.ts';
import { cn } from '../utils/cn.ts';
import { RotateIcon } from './icons.tsx';
import { Segmented } from './ui.tsx';

/** Правая половина силуэта; левая — её зеркальное отражение. Координаты фигуры 140×320. */
const HALF_BODY =
  'M70 6 C80 6 87 13 87 24 C87 33 84 40 79 44 L78 50 C80 54 86 56 96 58 C104 60 109 66 110 74 C112 86 113 98 114 108 ' +
  'C116 122 118 134 119 146 C120 156 121 164 122 172 C124 178 124 186 120 190 C116 192 113 186 113 178 C112 168 110 158 108 146 ' +
  'C106 132 104 118 102 104 C101 98 100 92 99 88 C98 100 97 112 95 122 C94 130 96 138 99 148 C102 160 101 174 99 188 ' +
  'C97 210 95 232 94 252 C93 268 94 284 92 298 C92 304 96 310 96 314 C96 318 90 319 82 318 C79 317 78 312 79 304 ' +
  'C80 290 79 272 78 256 C77 236 76 214 74 196 C73 190 71 186 70 186 Z';

const DETAILS: Record<BodyView, { lines: string; dashed: string }> = {
  front: {
    lines:
      'M56 60 C62 63 66 64 70 64 C74 64 78 63 84 60 M70 66 V108 M58 104 C62 110 78 110 82 104 ' +
      'M70 132 m-1.5 0 a1.5 1.5 0 1 0 3 0 a1.5 1.5 0 1 0 -3 0 M50 248 C53 244 58 244 61 248 M79 248 C82 244 87 244 90 248',
    dashed: '',
  },
  back: {
    lines:
      'M46 74 C50 90 56 98 62 96 M94 74 C90 90 84 98 78 96 M58 166 C62 172 68 176 70 176 C72 176 78 172 82 166 ' +
      'M54 196 C60 200 66 200 70 196 C74 200 80 200 86 196 M50 262 C54 266 58 266 61 262 M79 262 C82 266 86 266 90 262',
    dashed: 'M70 54 V160',
  },
};

type Props = {
  wounds: Wounds;
  catheterType: CatheterType;
  onChange: (wounds: Wounds) => void;
};

type FigureProps = {
  view: BodyView;
  wounds: Wounds;
  selected: string | null;
  catheterType: CatheterType;
  active: boolean;
  onZone: (zoneId: string) => void;
};

const Figure = ({ view, wounds, selected, catheterType, active, onZone }: FigureProps) => {
  const uid = useId().replace(/:/g, '');
  const skin = `skin-${uid}`;
  const shade = `shade-${uid}`;
  const mark = catheterType !== 'none' && view === 'front' ? CATHETER_MARK[catheterType] : null;

  return (
    <div className="figure">
      <svg width="140" height="320" viewBox="0 0 140 320" aria-hidden="true">
        <defs>
          <linearGradient id={skin} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="140" y2="0">
            <stop offset="0" stopColor="var(--skin-1)" />
            <stop offset="0.3" stopColor="var(--skin-2)" />
            <stop offset="0.5" stopColor="var(--skin-3)" />
            <stop offset="0.7" stopColor="var(--skin-2)" />
            <stop offset="1" stopColor="var(--skin-1)" />
          </linearGradient>
          <radialGradient id={shade} cx="0.5" cy="0.98" r="0.5">
            <stop offset="0" stopColor="#7d8b94" stopOpacity="0.45" />
            <stop offset="1" stopColor="#7d8b94" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="70" cy="318" rx="44" ry="6" fill={`url(#${shade})`} />
        <g fill={`url(#${skin})`} stroke={`url(#${skin})`} strokeWidth="0.8">
          <path d={HALF_BODY} />
          <path d={HALF_BODY} transform="translate(140 0) scale(-1 1)" />
        </g>
        <path d={DETAILS[view].lines} fill="none" stroke="var(--skin-line)" strokeWidth="1.2" strokeLinecap="round" />
        {DETAILS[view].dashed && (
          <path d={DETAILS[view].dashed} fill="none" stroke="var(--skin-line)" strokeWidth="1.2" strokeDasharray="2 4" strokeLinecap="round" />
        )}
      </svg>
      {BODY_ZONES.filter((zone) => zone.view === view).map((zone) => {
        const stage = wounds[zone.id];
        return (
          <button
            key={zone.id}
            type="button"
            tabIndex={active ? 0 : -1}
            className={cn('zone', stage && 'zone--wound', selected === zone.id && stage && 'zone--selected')}
            style={{ left: zone.x, top: zone.y }}
            aria-label={`${zoneLabel(zone)}${stage ? `, стадия ${stage}` : ', отметить рану'}`}
            aria-pressed={Boolean(stage)}
            onClick={() => onZone(zone.id)}
          >
            <span className="zone__dot">{stage ?? ''}</span>
          </button>
        );
      })}
      {mark && (
        <span className="cath-mark" style={{ left: mark.x, top: mark.y }} title="Катетер">
          К
        </span>
      )}
    </div>
  );
};

const STAGES: WoundStage[] = [1, 2, 3, 4];

/** Схема тела: отметка пролежней по зонам, поворот спереди/сзади с 3D-эффектом. */
export const BodyMap = ({ wounds, catheterType, onChange }: Props) => {
  const [view, setView] = useState<BodyView>(() => (countWounds(wounds, 'back') > 0 || countWounds(wounds, 'front') === 0 ? 'back' : 'front'));
  const [selected, setSelected] = useState<string | null>(null);
  const isBack = view === 'back';
  const selectedZone = selected && wounds[selected] ? findZone(selected) : undefined;

  const pickZone = (zoneId: string) => {
    hapticSelection();
    if (wounds[zoneId]) {
      setSelected(zoneId);
      return;
    }
    onChange({ ...wounds, [zoneId]: 1 });
    setSelected(zoneId);
  };

  const setStage = (stage: WoundStage) => {
    if (!selectedZone) return;
    onChange({ ...wounds, [selectedZone.id]: stage });
  };

  const removeSelected = () => {
    if (!selectedZone) return;
    const next = { ...wounds };
    delete next[selectedZone.id];
    onChange(next);
    setSelected(null);
  };

  const countLabel = (side: BodyView) => {
    const count = countWounds(wounds, side);
    return count ? <span style={{ color: 'var(--late-text)' }}> · {count}</span> : null;
  };

  const woundIds = Object.keys(wounds).filter((id) => findZone(id));

  return (
    <div className="card card--stack">
      <Segmented<BodyView>
        label="Сторона"
        value={view}
        onChange={setView}
        options={[
          { value: 'front', label: <>Спереди{countLabel('front')}</> },
          { value: 'back', label: <>Сзади{countLabel('back')}</> },
        ]}
      />

      <div className="body-stage">
        <span className="body-stage__title">{isBack ? 'Вид сзади' : 'Вид спереди'}</span>
        <span className="body-stage__side" style={{ left: 14 }}>
          {isBack ? 'Л' : 'П'}
        </span>
        <span className="body-stage__side" style={{ right: 14 }}>
          {isBack ? 'П' : 'Л'}
        </span>
        <button type="button" className="body-stage__flip" onClick={() => setView(isBack ? 'front' : 'back')}>
          <RotateIcon width={18} height={18} />
          Повернуть
        </button>
        <div className="flip-scene">
          <div className={cn('flip-card', isBack && 'flip-card--back')}>
            <div className="flip-face" style={{ pointerEvents: isBack ? 'none' : 'auto' }} aria-hidden={isBack}>
              <Figure view="front" wounds={wounds} selected={selected} catheterType={catheterType} active={!isBack} onZone={pickZone} />
            </div>
            <div className="flip-face flip-face--back" style={{ pointerEvents: isBack ? 'auto' : 'none' }} aria-hidden={!isBack}>
              <Figure view="back" wounds={wounds} selected={selected} catheterType={catheterType} active={isBack} onZone={pickZone} />
            </div>
          </div>
        </div>
      </div>

      {selectedZone && (
        <div className="wound-editor">
          <div className="row-flex" style={{ justifyContent: 'space-between' }}>
            <strong>{zoneLabel(selectedZone)}</strong>
            <button type="button" className="btn btn--danger btn--sm" style={{ minHeight: 36 }} onClick={removeSelected}>
              Убрать
            </button>
          </div>
          <span className="muted small">Стадия</span>
          <div className="chip-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
            {STAGES.map((stage) => (
              <button
                key={stage}
                type="button"
                className={cn('chip chip--late', wounds[selectedZone.id] === stage && 'chip--on')}
                onClick={() => setStage(stage)}
              >
                {stage}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        {woundIds.length > 0 ? (
          woundIds.map((id) => {
            const zone = findZone(id);
            if (!zone) return null;
            return (
              <button
                key={id}
                type="button"
                className="wound-list__row"
                style={{ width: '100%', border: 0, background: 'none', textAlign: 'left', padding: 0, color: 'inherit' }}
                onClick={() => {
                  setView(zone.view);
                  setSelected(id);
                }}
              >
                <span className="stage-dot">{wounds[id]}</span>
                <span style={{ flex: 1 }}>{zoneLabel(zone)}</span>
                <span className="muted small">{zone.view === 'back' ? 'сзади' : 'спереди'}</span>
              </button>
            );
          })
        ) : (
          <p className="muted small">Ран не отмечено.</p>
        )}
        <p className="muted small" style={{ marginTop: 8 }}>
          Нажмите на точку, чтобы отметить рану. Л и П — стороны пациента.
        </p>
      </div>
    </div>
  );
};
