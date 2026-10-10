const TIME_ZONE = "Europe/Paris";
const DAY_MS = 86_400_000;
const FIRST_QUOTA_RESET_SUNDAY = 3; // 4 janvier 1970, indexé depuis le 1er janvier.

export function parisDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function previousParisDateKey(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  const previous = new Date(Date.UTC(year, month - 1, day - 1));
  return previous.toISOString().slice(0, 10);
}

export function quotaSundayKey(date = new Date()) {
  const key = parisDateKey(date);
  const current = new Date(`${key}T00:00:00Z`);
  current.setUTCDate(current.getUTCDate() - current.getUTCDay());
  return current.toISOString().slice(0, 10);
}

export function currentQuotaPeriodKey(date = new Date()) {
  const sunday = quotaSundayKey(date);
  const sundayDay = Math.floor(Date.parse(`${sunday}T00:00:00Z`) / DAY_MS);
  const weeksSinceAnchor = Math.floor((sundayDay - FIRST_QUOTA_RESET_SUNDAY) / 7);
  const resetWeeks = Math.floor(weeksSinceAnchor / 2) * 2;
  return new Date((FIRST_QUOTA_RESET_SUNDAY + resetWeeks * 7) * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

function isSundayInParis(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    weekday: "short",
  }).format(date) === "Sun";
}

function sundayPhase(date: Date) {
  const sunday = quotaSundayKey(date);
  const sundayDay = Math.floor(Date.parse(`${sunday}T00:00:00Z`) / DAY_MS);
  return ((sundayDay - FIRST_QUOTA_RESET_SUNDAY) % 14 + 14) % 14;
}

export function isQuotaResetSunday(date = new Date()) {
  return isSundayInParis(date) && sundayPhase(date) === 0;
}

export function isQuotaReminderSunday(date = new Date()) {
  return isSundayInParis(date) && sundayPhase(date) === 7;
}