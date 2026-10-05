import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import { BRAND_I18N_VARIABLES } from '@area-code/shared/constants/brand'

import en from './locales/en.json'

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false, defaultVariables: BRAND_I18N_VARIABLES },
})

export default i18n
