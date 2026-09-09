export const LANGUAGES = Object.freeze({
  en: 'English', es: 'Spanish', ht: 'Haitian Kreyòl',
  fr: 'French', de: 'German', it: 'Italian', pt: 'Portuguese',
});
export const SPEECH_LANGUAGES = Object.keys(LANGUAGES).filter(code => code !== 'ht');
