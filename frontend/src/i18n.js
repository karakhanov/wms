import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import ru from './locales/ru.json'
import uz from './locales/uz.json'
import en from './locales/en.json'

const saved = localStorage.getItem('wms_lang') || 'ru'

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
  })

i18n.on('languageChanged', (lng) => {
  localStorage.setItem('wms_lang', lng)
})

export default i18n
