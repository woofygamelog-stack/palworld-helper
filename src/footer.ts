import {site,type Locale} from "./config.ts";
import {footerCopy} from "./footer-i18n.ts";

const esc=(value:string)=>value.replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[char]!);

export function renderFooter(locale:Locale,description:string){
  const copy=footerCopy[locale];
  return `<footer><div class="footer-brand"><strong>${esc(site.name)}</strong><p>${esc(description)}</p></div><nav class="footer-utility" aria-label="${esc(copy.utilityNavigation)}"><a href="/${locale}/privacy" data-link>${esc(copy.privacy)}</a><a href="${esc(site.hubUrl)}" target="_blank" rel="noopener noreferrer">${esc(copy.hub)}</a><a href="${esc(site.contactUrl)}" target="_blank" rel="noopener noreferrer" data-footer-contact>${esc(copy.contact)}</a></nav></footer>`;
}
