import type {Locale} from "./config";

export type ShellCopy={primaryNavigation:string;more:string};

export const shellCopyProvenance="gpt" as const;

export const shellCopy:Record<Locale,ShellCopy>={
  "en-US":{primaryNavigation:"Primary navigation",more:"More"},
  "ko-KR":{primaryNavigation:"주 메뉴",more:"더보기"},
  "ja-JP":{primaryNavigation:"メインメニュー",more:"その他"},
  "zh-CN":{primaryNavigation:"主菜单",more:"更多"},
  "zh-TW":{primaryNavigation:"主選單",more:"更多"},
  "fr-FR":{primaryNavigation:"Navigation principale",more:"Plus"},
  "it-IT":{primaryNavigation:"Navigazione principale",more:"Altro"},
  "de-DE":{primaryNavigation:"Hauptnavigation",more:"Mehr"},
  "es-ES":{primaryNavigation:"Navegación principal",more:"Más"},
  "es-419":{primaryNavigation:"Navegación principal",more:"Más"},
  "pt-BR":{primaryNavigation:"Navegação principal",more:"Mais"},
  "ru-RU":{primaryNavigation:"Основная навигация",more:"Ещё"},
  "id-ID":{primaryNavigation:"Navigasi utama",more:"Lainnya"},
  "th-TH":{primaryNavigation:"เมนูหลัก",more:"เพิ่มเติม"},
  "tr-TR":{primaryNavigation:"Ana gezinme",more:"Daha fazla"},
  "vi-VN":{primaryNavigation:"Điều hướng chính",more:"Thêm"},
  "pl-PL":{primaryNavigation:"Główna nawigacja",more:"Więcej"}
};
