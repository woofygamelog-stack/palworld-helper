import type {Locale} from "./config.ts";

type ExtraMapLabels={camp:string;note:string;supplyDrop:string;oilRig:string;supplyBoundary:string;grade:string};
export const mapExtraLabelsProvenance="gpt" as const;

export const mapExtraLabels:Record<Locale,ExtraMapLabels>={
  "en-US":{camp:"Enemy camps",note:"Collectible notes",supplyDrop:"Possible supply drop zones",oilRig:"Oil rig",supplyBoundary:"Supply markers show possible drop zones, not a currently active crate.",grade:"Grade"},
  "ko-KR":{camp:"적 진영 캠프",note:"수집 메모",supplyDrop:"보급 투하 가능 지점",oilRig:"오일 리그",supplyBoundary:"보급 표시는 현재 활성화된 상자가 아니라 투하될 수 있는 지점을 나타냅니다.",grade:"등급"},
  "zh-CN":{camp:"敌对营地",note:"可收集笔记",supplyDrop:"可能的补给投放区",oilRig:"石油钻井平台",supplyBoundary:"补给标记表示可能的投放区域，而不是当前已出现的补给箱。",grade:"等级"},
  "zh-TW":{camp:"敵對營地",note:"可收集筆記",supplyDrop:"可能的補給投放區",oilRig:"石油鑽井平台",supplyBoundary:"補給標記表示可能的投放區域，而不是目前已出現的補給箱。",grade:"等級"},
  "ja-JP":{camp:"敵対キャンプ",note:"収集メモ",supplyDrop:"物資投下候補地点",oilRig:"オイルリグ",supplyBoundary:"物資マーカーは現在出現中の箱ではなく、投下される可能性がある地点を示します。",grade:"グレード"},
  "fr-FR":{camp:"Camps ennemis",note:"Notes à collecter",supplyDrop:"Zones possibles de largage",oilRig:"Plateforme pétrolière",supplyBoundary:"Les marqueurs indiquent des zones de largage possibles, pas une caisse actuellement active.",grade:"Niveau"},
  "it-IT":{camp:"Accampamenti nemici",note:"Note collezionabili",supplyDrop:"Possibili zone di lancio",oilRig:"Piattaforma petrolifera",supplyBoundary:"I marcatori indicano possibili zone di lancio, non una cassa attualmente attiva.",grade:"Grado"},
  "de-DE":{camp:"Feindlager",note:"Sammelbare Notizen",supplyDrop:"Mögliche Versorgungslieferzonen",oilRig:"Ölplattform",supplyBoundary:"Versorgungsmarkierungen zeigen mögliche Abwurfzonen, keine aktuell aktive Kiste.",grade:"Stufe"},
  "es-ES":{camp:"Campamentos enemigos",note:"Notas coleccionables",supplyDrop:"Posibles zonas de suministros",oilRig:"Plataforma petrolífera",supplyBoundary:"Los marcadores indican posibles zonas de entrega, no una caja activa en este momento.",grade:"Nivel"},
  "pt-BR":{camp:"Acampamentos inimigos",note:"Notas colecionáveis",supplyDrop:"Possíveis zonas de suprimentos",oilRig:"Plataforma de petróleo",supplyBoundary:"Os marcadores indicam possíveis zonas de entrega, não uma caixa ativa no momento.",grade:"Nível"},
  "ru-RU":{camp:"Вражеские лагеря",note:"Коллекционные записки",supplyDrop:"Возможные зоны сброса припасов",oilRig:"Нефтяная платформа",supplyBoundary:"Маркеры показывают возможные зоны сброса, а не активный в данный момент ящик.",grade:"Уровень"},
  "id-ID":{camp:"Kamp musuh",note:"Catatan koleksi",supplyDrop:"Kemungkinan zona pasokan",oilRig:"Anjungan minyak",supplyBoundary:"Penanda menunjukkan kemungkinan zona pasokan, bukan peti yang sedang aktif.",grade:"Tingkat"},
  "es-419":{camp:"Campamentos enemigos",note:"Notas coleccionables",supplyDrop:"Posibles zonas de suministros",oilRig:"Plataforma petrolera",supplyBoundary:"Los marcadores indican posibles zonas de entrega, no una caja activa en este momento.",grade:"Nivel"},
  "th-TH":{camp:"ค่ายศัตรู",note:"บันทึกสะสม",supplyDrop:"จุดที่อาจมีการส่งเสบียง",oilRig:"แท่นขุดเจาะน้ำมัน",supplyBoundary:"เครื่องหมายเสบียงแสดงจุดที่อาจมีการส่งของ ไม่ใช่กล่องที่กำลังใช้งานอยู่ในขณะนี้",grade:"ระดับ"},
  "tr-TR":{camp:"Düşman kampları",note:"Toplanabilir notlar",supplyDrop:"Olası ikmal bırakma bölgeleri",oilRig:"Petrol platformu",supplyBoundary:"İkmal işaretleri o anda etkin bir sandığı değil, olası bırakma bölgelerini gösterir.",grade:"Seviye"},
  "vi-VN":{camp:"Trại địch",note:"Ghi chú sưu tầm",supplyDrop:"Khu vực có thể thả tiếp tế",oilRig:"Giàn khoan dầu",supplyBoundary:"Dấu tiếp tế cho biết khu vực có thể thả hàng, không phải thùng đang xuất hiện.",grade:"Cấp"},
  "pl-PL":{camp:"Obozy wrogów",note:"Notatki do zebrania",supplyDrop:"Możliwe strefy zrzutu zaopatrzenia",oilRig:"Platforma wiertnicza",supplyBoundary:"Znaczniki pokazują możliwe strefy zrzutu, a nie aktualnie aktywną skrzynię.",grade:"Poziom"}
};
