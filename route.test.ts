import { describe, expect, it } from 'vitest';
import { buildYandexRouteUrl } from './route.ts';

describe('маршрут в Яндекс Картах', () => {
  it('собирает точки по порядку, от моего местоположения', () => {
    const url = buildYandexRouteUrl(['ул. Ленина, 15', ' ', 'Профсоюзная ул., 104'], { fromMyLocation: true });
    expect(url).toBe(
      `https://yandex.ru/maps/?rtext=~${encodeURIComponent('ул. Ленина, 15')}~${encodeURIComponent('Профсоюзная ул., 104')}&rtt=auto`,
    );
  });

  it('без «от меня» начинает с первого адреса, всегда на машине', () => {
    const url = buildYandexRouteUrl(['А', 'Б'], { fromMyLocation: false });
    expect(url).toBe('https://yandex.ru/maps/?rtext=%D0%90~%D0%91&rtt=auto');
  });
});
