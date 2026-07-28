import type { Locale } from "./config";

export const itemCategoryProvenance = "gpt" as const;
export const itemCategoryFieldLabels: Record<Locale,string> = {
  "en-US":"Category","zh-CN":"分类","zh-TW":"分類","ja-JP":"カテゴリ","fr-FR":"Catégorie","it-IT":"Categoria","de-DE":"Kategorie","es-ES":"Categoría","pt-BR":"Categoria","ru-RU":"Категория","ko-KR":"분류","id-ID":"Kategori","es-419":"Categoría","th-TH":"หมวดหมู่","tr-TR":"Kategori","vi-VN":"Danh mục","pl-PL":"Kategoria"
};
const labels = {
  Accessory:["Accessory","饰品","飾品","アクセサリー","Accessoire","Accessorio","Accessoire","Accesorio","Acessório","Аксессуар","장신구","Aksesori","Accesorio","เครื่องประดับ","Aksesuar","Phụ kiện","Akcesorium"],
  Ammo:["Ammunition","弹药","彈藥","弾薬","Munitions","Munizioni","Munition","Munición","Munição","Боеприпасы","탄약","Amunisi","Munición","กระสุน","Mühimmat","Đạn dược","Amunicja"],
  Armor:["Armor","防具","防具","防具","Armure","Armatura","Rüstung","Armadura","Armadura","Броня","방어구","Zirah","Armadura","ชุดเกราะ","Zırh","Giáp","Pancerz"],
  Blueprint:["Schematic","设计图","設計圖","設計図","Plan","Progetto","Bauplan","Plano","Projeto","Чертёж","설계도","Skema","Plano","พิมพ์เขียว","Şema","Bản thiết kế","Schemat"],
  CaptureItemModifier:["Capture aid","捕捉辅助道具","捕捉輔助道具","捕獲補助アイテム","Aide à la capture","Ausilio di cattura","Fanghilfe","Ayuda de captura","Auxílio de captura","Средство поимки","포획 보조 도구","Alat bantu penangkapan","Ayuda de captura","อุปกรณ์ช่วยจับ","Yakalama yardımcısı","Vật phẩm hỗ trợ bắt","Pomoc w chwytaniu"],
  Consume:["Consumable","消耗品","消耗品","消耗品","Consommable","Consumabile","Verbrauchsgegenstand","Consumible","Consumível","Расходуемый предмет","소모품","Barang konsumsi","Consumible","ไอเทมใช้แล้วหมดไป","Tüketilebilir","Vật phẩm tiêu hao","Przedmiot użytkowy"],
  Essential:["Key item","重要道具","重要道具","大事なもの","Objet clé","Oggetto chiave","Schlüsselgegenstand","Objeto clave","Item-chave","Ключевой предмет","중요 아이템","Item penting","Objeto clave","ไอเทมสำคัญ","Anahtar eşya","Vật phẩm quan trọng","Kluczowy przedmiot"],
  Food:["Food","食物","食物","食料","Nourriture","Cibo","Nahrung","Comida","Comida","Еда","음식","Makanan","Comida","อาหาร","Yiyecek","Thức ăn","Żywność"],
  Glider:["Glider","滑翔伞","滑翔傘","グライダー","Planeur","Aliante","Gleiter","Planeador","Planador","Планер","글라이더","Glider","Planeador","เครื่องร่อน","Planör","Tàu lượn","Lotnia"],
  Material:["Material","材料","材料","素材","Matériau","Materiale","Material","Material","Material","Материал","재료","Material","Material","วัตถุดิบ","Malzeme","Nguyên liệu","Materiał"],
  SpecialWeapon:["Special weapon","特殊武器","特殊武器","特殊武器","Arme spéciale","Arma speciale","Spezialwaffe","Arma especial","Arma especial","Особое оружие","특수 무기","Senjata khusus","Arma especial","อาวุธพิเศษ","Özel silah","Vũ khí đặc biệt","Broń specjalna"],
  Weapon:["Weapon","武器","武器","武器","Arme","Arma","Waffe","Arma","Arma","Оружие","무기","Senjata","Arma","อาวุธ","Silah","Vũ khí","Broń"]
} as const;
const localeIndex: Record<Locale,number> = {"en-US":0,"zh-CN":1,"zh-TW":2,"ja-JP":3,"fr-FR":4,"it-IT":5,"de-DE":6,"es-ES":7,"pt-BR":8,"ru-RU":9,"ko-KR":10,"id-ID":11,"es-419":12,"th-TH":13,"tr-TR":14,"vi-VN":15,"pl-PL":16};
export type ItemCategory = keyof typeof labels;
export const itemCategories = Object.keys(labels) as ItemCategory[];
export function itemCategoryLabel(category:string,locale:Locale):string {
  return category in labels ? labels[category as ItemCategory][localeIndex[locale]] : itemCategoryFieldLabels[locale];
}
