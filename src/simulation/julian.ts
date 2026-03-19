export function toJulianDate(date: Date) {
  return date.getTime() / 86400000 + 2440587.5;
}

export function daysSinceJ2000(date: Date) {
  return toJulianDate(date) - 2451545.0;
}
