import { useState } from 'react';
import type { Patient } from '../types/index.ts';
import { fullAddress } from '../lib/address.ts';
import { buildYandexRouteUrl } from '../lib/route.ts';
import { openExternalLink } from '../lib/telegram.ts';
import { cn } from '../utils/cn.ts';
import { Sheet } from './Sheet.tsx';
import { Toggle } from './ui.tsx';

type Props = { patients: Patient[]; onClose: () => void };

/** Маршрут на машине по всем адресам на сегодня: порядок — стрелками, точку можно выключить. */
export const RouteSheet = ({ patients, onClose }: Props) => {
  const withAddress = patients.filter((patient) => patient.address.trim());
  const withoutAddress = patients.length - withAddress.length;
  const [order, setOrder] = useState(() => withAddress.map((patient) => patient.id));
  const [skipped, setSkipped] = useState<Set<string>>(() => new Set());
  const [fromMe, setFromMe] = useState(true);

  const byId = new Map(withAddress.map((patient) => [patient.id, patient]));
  const ordered = order.map((id) => byId.get(id)).filter((patient): patient is Patient => Boolean(patient));
  const included = ordered.filter((patient) => !skipped.has(patient.id));

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    const [item] = next.splice(index, 1);
    if (item) next.splice(target, 0, item);
    setOrder(next);
  };

  const toggle = (id: string) =>
    setSkipped((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const open = () => openExternalLink(buildYandexRouteUrl(included.map((patient) => patient.address), { fromMyLocation: fromMe }));

  return (
    <Sheet title="Маршрут на машине" subtitle="Порядок объезда — стрелками. Нажмите на номер, чтобы пропустить" onClose={onClose}>
      <div className="row-flex" style={{ justifyContent: 'space-between' }}>
        <span className="set-row__text">
          <span>Начать от моего места</span>
          <span className="set-row__hint">Яндекс спросит доступ к геопозиции</span>
        </span>
        <Toggle checked={fromMe} label="От моего места" onChange={setFromMe} />
      </div>

      <div className="list" style={{ background: 'var(--bg)' }}>
        {ordered.map((patient, index) => {
          const off = skipped.has(patient.id);
          return (
            <div key={patient.id} className="route-row" style={{ opacity: off ? 0.45 : 1 }}>
              <button
                type="button"
                className={cn('route-row__num', off && 'route-row__num--off')}
                aria-label={off ? `Включить: ${patient.fullName}` : `Пропустить: ${patient.fullName}`}
                onClick={() => toggle(patient.id)}
              >
                {off ? '—' : included.indexOf(patient) + 1}
              </button>
              <span className="lrow__main">
                <span className="prow__name">
                  {patient.fullName}
                </span>
                <span className="prow__sub">{fullAddress(patient)}</span>
              </span>
              <span className="route-row__arrows">
                <button type="button" className="icon-btn icon-btn--ghost" aria-label="Выше" disabled={index === 0} onClick={() => move(index, -1)}>
                  ↑
                </button>
                <button
                  type="button"
                  className="icon-btn icon-btn--ghost"
                  aria-label="Ниже"
                  disabled={index === ordered.length - 1}
                  onClick={() => move(index, 1)}
                >
                  ↓
                </button>
              </span>
            </div>
          );
        })}
      </div>

      {withoutAddress > 0 && <p className="notice small">Без адреса, в маршрут не попали: {withoutAddress}.</p>}

      <button type="button" className="btn btn--primary btn--block btn--lg" disabled={included.length === 0} onClick={open}>
        Открыть в Яндекс Картах · {included.length}
      </button>
    </Sheet>
  );
};
