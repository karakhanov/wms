import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import ru from './locales/ru.json'
import uz from './locales/uz.json'
import en from './locales/en.json'
import { storageGet, storageSet } from './storage'

const saved = storageGet('wms_lang', 'ru') || 'ru'

i18n
  .use(initReactI18next)
  .init({
    resources: {
      ru: { translation: ru },
      uz: { translation: uz },
      en: { translation: en },
    },
    lng: saved,
    fallbackLng: 'ru',
    interpolation: {
      escapeValue: false,
    },
    /* Иначе useTranslation() «зависает» в Suspense без <Suspense> — белый экран */
    react: {
      useSuspense: false,
    },
  })

i18n.on('languageChanged', (lng) => {
  storageSet('wms_lang', lng)
})

export default i18n
