export type CallingCode = {
  code: string;
  name: string;
};

export const CALLING_CODES: CallingCode[] = [
  { code: '+1', name: 'United States / Canada' },
  { code: '+44', name: 'United Kingdom' },
  { code: '+46', name: 'Sweden' },
  { code: '+47', name: 'Norway' },
  { code: '+45', name: 'Denmark' },
  { code: '+49', name: 'Germany' },
  { code: '+33', name: 'France' },
  { code: '+31', name: 'Netherlands' },
  { code: '+32', name: 'Belgium' },
  { code: '+41', name: 'Switzerland' },
  { code: '+43', name: 'Austria' },
  { code: '+39', name: 'Italy' },
  { code: '+34', name: 'Spain' },
  { code: '+351', name: 'Portugal' },
  { code: '+353', name: 'Ireland' },
  { code: '+48', name: 'Poland' },
  { code: '+420', name: 'Czechia' },
  { code: '+358', name: 'Finland' },
  { code: '+30', name: 'Greece' },
  { code: '+90', name: 'Turkey' },
  { code: '+20', name: 'Egypt' },
  { code: '+27', name: 'South Africa' },
  { code: '+234', name: 'Nigeria' },
  { code: '+971', name: 'United Arab Emirates' },
  { code: '+966', name: 'Saudi Arabia' },
  { code: '+974', name: 'Qatar' },
  { code: '+965', name: 'Kuwait' },
  { code: '+961', name: 'Lebanon' },
  { code: '+962', name: 'Jordan' },
  { code: '+972', name: 'Israel' },
  { code: '+91', name: 'India' },
  { code: '+92', name: 'Pakistan' },
  { code: '+880', name: 'Bangladesh' },
  { code: '+62', name: 'Indonesia' },
  { code: '+63', name: 'Philippines' },
  { code: '+66', name: 'Thailand' },
  { code: '+84', name: 'Vietnam' },
  { code: '+60', name: 'Malaysia' },
  { code: '+65', name: 'Singapore' },
  { code: '+81', name: 'Japan' },
  { code: '+82', name: 'South Korea' },
  { code: '+86', name: 'China' },
  { code: '+852', name: 'Hong Kong' },
  { code: '+61', name: 'Australia' },
  { code: '+64', name: 'New Zealand' },
  { code: '+55', name: 'Brazil' },
  { code: '+52', name: 'Mexico' },
  { code: '+54', name: 'Argentina' },
];

const TZ_TO_CODE: Record<string, string> = {
  'Europe/Stockholm': '+46',
  'Europe/Oslo': '+47',
  'Europe/Copenhagen': '+45',
  'Europe/Berlin': '+49',
  'Europe/Paris': '+33',
  'Europe/Amsterdam': '+31',
  'Europe/Brussels': '+32',
  'Europe/Zurich': '+41',
  'Europe/Vienna': '+43',
  'Europe/Rome': '+39',
  'Europe/Madrid': '+34',
  'Europe/Lisbon': '+351',
  'Europe/London': '+44',
  'Europe/Dublin': '+353',
  'Europe/Warsaw': '+48',
  'Europe/Prague': '+420',
  'Europe/Helsinki': '+358',
  'Europe/Athens': '+30',
  'Europe/Istanbul': '+90',
  'Africa/Cairo': '+20',
  'Africa/Johannesburg': '+27',
  'Africa/Lagos': '+234',
  'Asia/Dubai': '+971',
  'Asia/Riyadh': '+966',
  'Asia/Qatar': '+974',
  'Asia/Kuwait': '+965',
  'Asia/Beirut': '+961',
  'Asia/Amman': '+962',
  'Asia/Jerusalem': '+972',
  'Asia/Tokyo': '+81',
  'Asia/Seoul': '+82',
  'Asia/Shanghai': '+86',
  'Asia/Hong_Kong': '+852',
  'Asia/Singapore': '+65',
  'Asia/Kolkata': '+91',
  'Asia/Karachi': '+92',
  'Asia/Dhaka': '+880',
  'Asia/Bangkok': '+66',
  'Asia/Jakarta': '+62',
  'Asia/Manila': '+63',
  'Australia/Sydney': '+61',
  'Pacific/Auckland': '+64',
  'America/New_York': '+1',
  'America/Chicago': '+1',
  'America/Denver': '+1',
  'America/Los_Angeles': '+1',
  'America/Toronto': '+1',
  'America/Vancouver': '+1',
  'America/Sao_Paulo': '+55',
  'America/Mexico_City': '+52',
  'America/Argentina/Buenos_Aires': '+54',
};

const SORTED_CODES = [...CALLING_CODES].sort((a, b) => b.code.length - a.code.length);

export function defaultCallingCode(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && TZ_TO_CODE[tz]) return TZ_TO_CODE[tz];
  } catch {
    // Intl timezone can be missing in some runtimes.
  }
  return '+1';
}

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

export function toE164(callingCode: string, national: string): string {
  const code = callingCode.startsWith('+') ? callingCode : `+${callingCode}`;
  return `${code}${digitsOnly(national)}`;
}

export function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(phone);
}

/** If the user pastes a full international number into the national field, split it. */
export function splitPastedNumber(raw: string, fallbackCode: string): { code: string; national: string } {
  const trimmed = raw.trim();
  if (trimmed.startsWith('+')) {
    const match = SORTED_CODES.find((item) => trimmed.startsWith(item.code));
    if (match) {
      return { code: match.code, national: digitsOnly(trimmed.slice(match.code.length)) };
    }
    return { code: fallbackCode, national: digitsOnly(trimmed) };
  }
  return { code: fallbackCode, national: digitsOnly(trimmed) };
}

export function maskPhone(phone?: string | null): string {
  if (!phone) return '';
  const digits = digitsOnly(phone);
  if (digits.length < 6) return phone;
  return `${phone.slice(0, phone.length - 4).replace(/\d/g, '•')}${phone.slice(-4)}`;
}
