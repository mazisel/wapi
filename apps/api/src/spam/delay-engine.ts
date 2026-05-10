import { config } from "../config/index.js";

function random(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function calculateDelay(hourlyCount: number): number {
  // 8-25 saniye baz gecikme
  const base = random(8_000, 25_000);

  // Yüke göre artan ek gecikme
  const load = hourlyCount / config.HOURLY_MSG_LIMIT;
  const loadPenalty = random(0, Math.floor(load * 30_000));

  // %2 olasılıkla 1-3 dakika "insan molası"
  const longPause = Math.random() < 0.02 ? random(60_000, 180_000) : 0;

  return base + loadPenalty + longPause;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
