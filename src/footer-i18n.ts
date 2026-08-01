import type {Locale} from "./config";

export type FooterCopy={utilityNavigation:string;hub:string;contact:string;privacy:string};

export const footerCopyProvenance:Record<Locale,"reviewed"|"gpt">={
  "en-US":"reviewed","ko-KR":"reviewed","ja-JP":"gpt","zh-CN":"gpt","zh-TW":"gpt","fr-FR":"gpt","it-IT":"gpt","de-DE":"gpt","es-ES":"gpt","pt-BR":"gpt","ru-RU":"gpt","id-ID":"gpt","es-419":"gpt","th-TH":"gpt","tr-TR":"gpt","vi-VN":"gpt","pl-PL":"gpt"
};

export const footerCopy:Record<Locale,FooterCopy>={
  "en-US":{utilityNavigation:"Site links",hub:"Woofy Hub",contact:"Contact and feedback",privacy:"Privacy"},
  "ko-KR":{utilityNavigation:"사이트 링크",hub:"Woofy Hub",contact:"문의 및 제안",privacy:"개인정보"},
  "ja-JP":{utilityNavigation:"サイトリンク",hub:"Woofy Hub",contact:"お問い合わせ・ご意見",privacy:"プライバシー"},
  "zh-CN":{utilityNavigation:"网站链接",hub:"Woofy Hub",contact:"联系与反馈",privacy:"隐私"},
  "zh-TW":{utilityNavigation:"網站連結",hub:"Woofy Hub",contact:"聯絡與意見回饋",privacy:"隱私權"},
  "fr-FR":{utilityNavigation:"Liens du site",hub:"Woofy Hub",contact:"Contact et suggestions",privacy:"Confidentialité"},
  "it-IT":{utilityNavigation:"Link del sito",hub:"Woofy Hub",contact:"Contatti e feedback",privacy:"Privacy"},
  "de-DE":{utilityNavigation:"Website-Links",hub:"Woofy Hub",contact:"Kontakt und Feedback",privacy:"Datenschutz"},
  "es-ES":{utilityNavigation:"Enlaces del sitio",hub:"Woofy Hub",contact:"Contacto y sugerencias",privacy:"Privacidad"},
  "pt-BR":{utilityNavigation:"Links do site",hub:"Woofy Hub",contact:"Contato e sugestões",privacy:"Privacidade"},
  "ru-RU":{utilityNavigation:"Ссылки сайта",hub:"Woofy Hub",contact:"Связь и предложения",privacy:"Конфиденциальность"},
  "id-ID":{utilityNavigation:"Tautan situs",hub:"Woofy Hub",contact:"Kontak dan masukan",privacy:"Privasi"},
  "es-419":{utilityNavigation:"Enlaces del sitio",hub:"Woofy Hub",contact:"Contacto y sugerencias",privacy:"Privacidad"},
  "th-TH":{utilityNavigation:"ลิงก์เว็บไซต์",hub:"Woofy Hub",contact:"ติดต่อและข้อเสนอแนะ",privacy:"ความเป็นส่วนตัว"},
  "tr-TR":{utilityNavigation:"Site bağlantıları",hub:"Woofy Hub",contact:"İletişim ve geri bildirim",privacy:"Gizlilik"},
  "vi-VN":{utilityNavigation:"Liên kết trang",hub:"Woofy Hub",contact:"Liên hệ và góp ý",privacy:"Quyền riêng tư"},
  "pl-PL":{utilityNavigation:"Linki witryny",hub:"Woofy Hub",contact:"Kontakt i opinie",privacy:"Prywatność"}
};
