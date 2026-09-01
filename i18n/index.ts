import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import de from '../locales/de.json';
import en from '../locales/en.json';
import es from '../locales/es.json';
import fr from '../locales/fr.json';
import ptBR from '../locales/pt-BR.json';
import { resolveLanguage } from './languages';

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
    'pt-BR': { translation: ptBR },
    fr: { translation: fr },
    de: { translation: de },
  },
  lng: resolveLanguage(),
  fallbackLng: {
    pt: ['pt-BR', 'en'],
    default: ['en'],
  },
  supportedLngs: ['en', 'es', 'pt-BR', 'fr', 'de'],
  nonExplicitSupportedLngs: true,
  interpolation: { escapeValue: false },
  returnNull: false,
  react: { useSuspense: false },
});

export default i18n;

