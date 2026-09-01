import { getLocales } from 'expo-localization';

export const SUPPORTED_LANGUAGES = ['en', 'es', 'pt-BR', 'fr', 'de'] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_TAGS: Record<AppLanguage, string> = {
  en: 'en-US',
  es: 'es-ES',
  'pt-BR': 'pt-BR',
  fr: 'fr-FR',
  de: 'de-DE',
};

export function resolveLanguage(): AppLanguage {
  for (const locale of getLocales()) {
    const tag = locale.languageTag;
    if (tag === 'pt-BR' || tag === 'pt-PT') return 'pt-BR';
    if ((SUPPORTED_LANGUAGES as readonly string[]).includes(tag)) {
      return tag as AppLanguage;
    }
    const code = locale.languageCode;
    if (code === 'pt') return 'pt-BR';
    if (code && (SUPPORTED_LANGUAGES as readonly string[]).includes(code)) {
      return code as AppLanguage;
    }
  }
  return 'en';
}

export function languageTagOf(language: string = resolveLanguage()): string {
  return LANGUAGE_TAGS[language as AppLanguage] ?? language;
}
