/**
 * Маршрут по адресам пациентов в Яндекс Картах — на машине.
 * Яндекс принимает точки через «~» в параметре rtext; пустая первая точка — «от меня» (текущее местоположение).
 * В маршрут идёт только «Адрес» (город, улица, дом) — квартира и подъезд Яндексу не нужны.
 */

type RouteOptions = { fromMyLocation: boolean };

export const buildYandexRouteUrl = (addresses: string[], { fromMyLocation }: RouteOptions): string => {
  const points = addresses.map((address) => address.trim()).filter(Boolean);
  const rtext = (fromMyLocation ? ['', ...points] : points).map((point) => encodeURIComponent(point)).join('~');
  return `https://yandex.ru/maps/?rtext=${rtext}&rtt=auto`;
};
