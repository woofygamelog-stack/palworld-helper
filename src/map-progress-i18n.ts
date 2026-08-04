import type {Locale} from "./config";

export const mapProgressCopyProvenance="gpt" as const;

export const mapProgressCopy:Record<Locale,{unfinished:string;complete:string;reopen:string}>={
  "en-US":{unfinished:"Unfinished only",complete:"Mark complete",reopen:"Mark unfinished"},
  "ko-KR":{unfinished:"미완료만 보기",complete:"완료로 표시",reopen:"미완료로 되돌리기"},
  "ja-JP":{unfinished:"未完了のみ",complete:"完了にする",reopen:"未完了に戻す"},
  "zh-CN":{unfinished:"仅看未完成",complete:"标记完成",reopen:"标记未完成"},
  "zh-TW":{unfinished:"僅看未完成",complete:"標記完成",reopen:"標記未完成"},
  "fr-FR":{unfinished:"Non terminés uniquement",complete:"Marquer terminé",reopen:"Marquer non terminé"},
  "it-IT":{unfinished:"Solo non completati",complete:"Segna completato",reopen:"Segna non completato"},
  "de-DE":{unfinished:"Nur unerledigte",complete:"Als erledigt markieren",reopen:"Als unerledigt markieren"},
  "es-ES":{unfinished:"Solo sin completar",complete:"Marcar completado",reopen:"Marcar sin completar"},
  "es-419":{unfinished:"Solo sin completar",complete:"Marcar completado",reopen:"Marcar sin completar"},
  "pt-BR":{unfinished:"Somente incompletos",complete:"Marcar como concluído",reopen:"Marcar como incompleto"},
  "ru-RU":{unfinished:"Только незавершённые",complete:"Отметить завершённым",reopen:"Отметить незавершённым"},
  "id-ID":{unfinished:"Hanya belum selesai",complete:"Tandai selesai",reopen:"Tandai belum selesai"},
  "th-TH":{unfinished:"เฉพาะที่ยังไม่เสร็จ",complete:"ทำเครื่องหมายว่าเสร็จ",reopen:"ทำเครื่องหมายว่ายังไม่เสร็จ"},
  "tr-TR":{unfinished:"Yalnızca tamamlanmayanlar",complete:"Tamamlandı olarak işaretle",reopen:"Tamamlanmadı olarak işaretle"},
  "vi-VN":{unfinished:"Chỉ mục chưa hoàn thành",complete:"Đánh dấu hoàn thành",reopen:"Đánh dấu chưa hoàn thành"},
  "pl-PL":{unfinished:"Tylko nieukończone",complete:"Oznacz jako ukończone",reopen:"Oznacz jako nieukończone"}
};
