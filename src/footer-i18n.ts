import type {Locale} from "./config";

export type FooterCopy={utilityNavigation:string;hub:string;contact:string};

export const footerCopyProvenance:Record<Locale,"reviewed"|"gpt">={
  "en-US":"reviewed","ko-KR":"reviewed","ja-JP":"gpt","zh-CN":"gpt","zh-TW":"gpt","fr-FR":"gpt","it-IT":"gpt","de-DE":"gpt","es-ES":"gpt","pt-BR":"gpt","ru-RU":"gpt","id-ID":"gpt","es-419":"gpt","th-TH":"gpt","tr-TR":"gpt","vi-VN":"gpt","pl-PL":"gpt"
};

export const footerCopy:Record<Locale,FooterCopy>={
  "en-US":{utilityNavigation:"Site links",hub:"Woofy Hub",contact:"Contact and feedback"},
  "ko-KR":{utilityNavigation:"사이트 링크",hub:"Woofy Hub",contact:"문의 및 제안"},
  "ja-JP":{utilityNavigation:"サイトリンク",hub:"Woofy Hub",contact:"お問い合わせ・ご意見"},
  "zh-CN":{utilityNavigation:"网站链接",hub:"Woofy Hub",contact:"联系与反馈"},
  "zh-TW":{utilityNavigation:"網站連結",hub:"Woofy Hub",contact:"聯絡與意見回饋"},
  "fr-FR":{utilityNavigation:"Liens du site",hub:"Woofy Hub",contact:"Contact et suggestions"},
  "it-IT":{utilityNavigation:"Link del sito",hub:"Woofy Hub",contact:"Contatti e feedback"},
  "de-DE":{utilityNavigation:"Website-Links",hub:"Woofy Hub",contact:"Kontakt und Feedback"},
  "es-ES":{utilityNavigation:"Enlaces del sitio",hub:"Woofy Hub",contact:"Contacto y sugerencias"},
  "pt-BR":{utilityNavigation:"Links do site",hub:"Woofy Hub",contact:"Contato e sugestões"},
  "ru-RU":{utilityNavigation:"Ссылки сайта",hub:"Woofy Hub",contact:"Связь и предложения"},
  "id-ID":{utilityNavigation:"Tautan situs",hub:"Woofy Hub",contact:"Kontak dan masukan"},
  "es-419":{utilityNavigation:"Enlaces del sitio",hub:"Woofy Hub",contact:"Contacto y sugerencias"},
  "th-TH":{utilityNavigation:"ลิงก์เว็บไซต์",hub:"Woofy Hub",contact:"ติดต่อและข้อเสนอแนะ"},
  "tr-TR":{utilityNavigation:"Site bağlantıları",hub:"Woofy Hub",contact:"İletişim ve geri bildirim"},
  "vi-VN":{utilityNavigation:"Liên kết trang",hub:"Woofy Hub",contact:"Liên hệ và góp ý"},
  "pl-PL":{utilityNavigation:"Linki witryny",hub:"Woofy Hub",contact:"Kontakt i opinie"}
};
