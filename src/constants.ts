export const NOTE_MAX_LENGTH = 140;
export const NOTE_TTL_MS = 60 * 60 * 1000;
export const PRESENCE_TTL_MS = 60 * 60 * 1000;
export const MIN_AGE = 17;

export const APP_REVIEW_VENUE_ID = 'app-review-cafe';
export const APP_REVIEW_VENUE = {
  id: APP_REVIEW_VENUE_ID,
  name: 'App Review Café',
  city: 'Cupertino',
  geohash: '9q8yy',
  isDemo: true,
};

export const LEGAL_URLS = {
  privacy: 'https://shytext.com/privacy',
  terms: 'https://shytext.com/terms',
  supportEmail: 'shytext.info@gmail.com',
};

export const API_PATHS = {
  notify: '/api/notify',
  report: '/api/report',
};

export const STORAGE_KEYS = {
  onboardingSeen: 'hasSeenOnboarding',
  ageConfirmed: 'ageConfirmed17',
  ghostMode: 'ghostMode',
  lastVenueId: 'lastVenueId',
};
