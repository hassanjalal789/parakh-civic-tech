/**
 * Urdu and English only (FR-COMMON.1). Punjabi is not a written interface
 * language in Release 0. Urdu is right-to-left; digits stay left-to-right.
 * The bundled Urdu font and app-wide I18nManager RTL are T-032 (DG-44).
 */
/* eslint-disable import/no-named-as-default-member -- react-i18next needs the default i18next instance */
import { getLocales } from "expo-localization";
import i18n from "i18next";
import { initReactI18next, useTranslation } from "react-i18next";
import type { TextStyle, ViewStyle } from "react-native";

import en from "./en.json";
import ur from "./ur.json";

export type Language = "ur" | "en";

const deviceLanguage = getLocales()[0]?.languageCode;

void i18n.use(initReactI18next).init({
  resources: { ur: { translation: ur }, en: { translation: en } },
  lng: deviceLanguage === "en" ? "en" : "ur",
  fallbackLng: false,
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;

export function setLanguage(language: Language): Promise<unknown> {
  return i18n.changeLanguage(language);
}

export function isRtl(language: string): boolean {
  return language === "ur";
}

/** Direction-aware text and row styles for the current language. */
export function useDirection(): { rtl: boolean; text: TextStyle; row: ViewStyle } {
  const { i18n: instance } = useTranslation();
  const rtl = isRtl(instance.language);
  return {
    rtl,
    text: { writingDirection: rtl ? "rtl" : "ltr", textAlign: rtl ? "right" : "left" },
    row: { flexDirection: rtl ? "row-reverse" : "row" },
  };
}
