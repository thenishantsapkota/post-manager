// Line-drawn zodiac glyphs on a 24×24 grid, drawn with a 2px round stroke.
// Plain SVG path data so the same shapes work in the UI (<svg>) and on
// server-rendered images (canvas Path2D).

export const ZODIAC_GLYPHS: Record<string, { paths: string[]; circles?: Array<[number, number, number]> }> = {
  // ♈ Aries — ram's horns curling out of a stem
  mesh: {
    paths: [
      'M12 21V9',
      'M12 9C12 5.5 10 3 7.25 3S3 5 3 7.5 4.75 11.5 7 11.5',
      'M12 9C12 5.5 14 3 16.75 3S21 5 21 7.5 19.25 11.5 17 11.5',
    ],
  },
  // ♉ Taurus — circle with horns
  brish: {
    paths: ['M3.5 3c0 4.2 3.8 7 8.5 7s8.5-2.8 8.5-7'],
    circles: [[12, 15.5, 5.5]],
  },
  // ♊ Gemini — twin pillars
  mithun: {
    paths: ['M4 3.5c5 1.8 11 1.8 16 0', 'M4 20.5c5-1.8 11-1.8 16 0', 'M9 4.6v14.8', 'M15 4.6v14.8'],
  },
  // ♋ Cancer — two interlocking claws
  karkat: {
    paths: ['M6.5 6.5C10.5 3.5 17 3.8 21 7.5', 'M17.5 17.5C13.5 20.5 7 20.2 3 16.5'],
    circles: [
      [6.5, 9.5, 3],
      [17.5, 14.5, 3],
    ],
  },
  // ♌ Leo — lion's mane
  simha: {
    paths: ['M9.5 15.5V8.5a5 5 0 0 1 10 0c0 3.5-3.5 5-3.5 8.5a2.5 2.5 0 0 0 5 0'],
    circles: [[6.5, 15.5, 3]],
  },
  // ♍ Virgo — "m" with a looped tail
  kanya: {
    paths: [
      'M3 5.5c1.3 0 2 .9 2 2.3V18',
      'M5 8.5C5 6.6 6.3 5.5 8 5.5S11 6.6 11 8.5V18',
      'M11 8.5C11 6.6 12.3 5.5 14 5.5s3 1.1 3 3V15c0 2.8 1.4 4.8 4 5.7',
      'M17 13.5c1.6-1.8 4.2-1.2 4.2.9 0 2.2-2.4 3.6-4.2 3.6',
    ],
  },
  // ♎ Libra — scales over a base line
  tula: {
    paths: ['M3 20h18', 'M3 16h5.2a4.5 4.5 0 1 1 7.6 0H21'],
  },
  // ♏ Scorpio — "m" with an arrow tail
  brishchik: {
    paths: [
      'M3 5.5c1.3 0 2 .9 2 2.3V18',
      'M5 8.5C5 6.6 6.3 5.5 8 5.5S11 6.6 11 8.5V18',
      'M11 8.5C11 6.6 12.3 5.5 14 5.5s3 1.1 3 3V16c0 1.5 1 2.5 2.5 2.5H21',
      'M18.8 16.2 21 18.5l-2.2 2.3',
    ],
  },
  // ♐ Sagittarius — archer's arrow
  dhanu: {
    paths: ['M4 20 20 4', 'M12 4h8v8', 'M6.5 11.5l6 6'],
  },
  // ♑ Capricorn — sea-goat
  makar: {
    paths: [
      'M3 5.5c1.6 0 2.8 1.4 2.8 3.2V18',
      'M5.8 9c0-2.8 1.7-4.5 3.7-4.5S13 6 13 8.5v6.5c0 3.2 1.8 5 4.3 5a3.1 3.1 0 1 0 0-6.2c-2.4 0-4.3 2.5-4.3 5.7',
    ],
  },
  // ♒ Aquarius — two waves
  kumbha: {
    paths: ['M3 10l3-3 3 3 3-3 3 3 3-3 3 3', 'M3 17l3-3 3 3 3-3 3 3 3-3 3 3'],
  },
  // ♓ Pisces — two fish joined by a line
  meen: {
    paths: ['M5 3c4.3 4.5 4.3 13.5 0 18', 'M19 3c-4.3 4.5-4.3 13.5 0 18', 'M4 12h16'],
  },
}
