import type {IconName} from "../icons";
import type {ThemeMode} from "./theme";

type ShellRouteMatch={readonly path:string;readonly exact?:boolean};
type ShellNavigationLeaf={readonly id:string;readonly path:string;readonly active:readonly ShellRouteMatch[];readonly icon?:IconName};
type ShellNavigationGroup=ShellNavigationLeaf&{readonly icon:IconName;readonly children:readonly ShellNavigationLeaf[]};
export type ShellNavigationItem=ShellNavigationLeaf|ShellNavigationGroup;

type ShellRenderCopy={
  primaryNavigation:string;
  more:string;
  language:string;
  theme:string;
  search:string;
  remove:string;
  globalSearch:string;
};

export function shellRouteIsActive(item:Pick<ShellNavigationLeaf,"active">,currentRoute:string){
  const current=currentRoute.replace(/^\//,"");
  return item.active.some(({path,exact=false})=>current===path||!exact&&current.startsWith(`${path}/`));
}

export function renderApplicationShell<Locale extends string>({
  siteName,
  locale,
  locales,
  localeLabels,
  currentRoute,
  navigation,
  mobilePrimaryIds,
  currentTheme,
  themeLabels,
  copy,
  href,
  label,
  renderIcon
}:{
  siteName:string;
  locale:Locale;
  locales:readonly Locale[];
  localeLabels:Record<Locale,string>;
  currentRoute:string;
  navigation:readonly ShellNavigationItem[];
  mobilePrimaryIds:readonly string[];
  currentTheme:ThemeMode;
  themeLabels:readonly [string,string,string];
  copy:ShellRenderCopy;
  href:(path:string)=>string;
  label:(item:{readonly id:string})=>string;
  renderIcon:(name:IconName,className?:string)=>string;
}){
  const active=(item:Pick<ShellNavigationLeaf,"active">)=>shellRouteIsActive(item,currentRoute);
  const isGroup=(item:ShellNavigationItem):item is ShellNavigationGroup=>"children" in item;
  const link=(item:ShellNavigationLeaf,compact=false)=>{
    const isActive=active(item);
    return `<a href="${href(`/${item.path}`)}" data-link class="${isActive?"active":""}" ${isActive?'aria-current="page"':""}>${compact&&item.icon?renderIcon(item.icon):""}<span>${label(item)}</span></a>`;
  };
  const desktopItem=(item:ShellNavigationItem)=>{
    if(!isGroup(item))return link(item);
    return `<details class="nav-group nav-group-${item.id}${active(item)?" active":""}" data-shell-group><summary><span>${label(item)}</span>${renderIcon("chevronDown","nav-chevron")}</summary><div class="nav-panel">${item.children.map(child=>link(child)).join("")}</div></details>`;
  };
  const moreItem=(item:ShellNavigationItem)=>{
    if(!isGroup(item))return `<div class="more-nav-direct">${link(item,true)}</div>`;
    return `<section class="more-nav-group${active(item)?" active":""}"><h2>${renderIcon(item.icon)}<span>${label(item)}</span></h2><div>${item.children.map(child=>link(child)).join("")}</div></section>`;
  };
  const mobilePrimary=mobilePrimaryIds.map(id=>navigation.find(item=>item.id===id)).filter((item):item is ShellNavigationItem=>Boolean(item));
  const [systemLabel,lightLabel,darkLabel]=themeLabels;
  const header=`<header class="site-header"><a class="brand" href="${href("/")}" data-link><span class="brand-mark"><img src="/favicon.svg" alt="" width="34" height="34"></span><span>${siteName}</span></a><nav class="primary-nav" aria-label="${copy.primaryNavigation}">${navigation.map(desktopItem).join("")}</nav><button class="header-search" type="button" data-open-search aria-haspopup="dialog">${renderIcon("search")}<span>${copy.globalSearch}</span><kbd>/</kbd></button><div class="header-actions"><select id="locale" aria-label="${copy.language}">${locales.map(candidate=>`<option value="${candidate}" ${candidate===locale?"selected":""}>${localeLabels[candidate]}</option>`).join("")}</select><details class="theme-menu"><summary class="icon-button" aria-label="${copy.theme}">${renderIcon(currentTheme==="light"?"sun":currentTheme==="dark"?"moon":"system")}</summary><div class="theme-options" role="group" aria-label="${copy.theme}">${([["system","system",systemLabel],["light","sun",lightLabel],["dark","moon",darkLabel]] as const).map(([mode,iconName,modeLabel])=>`<button type="button" data-theme-choice="${mode}" aria-pressed="${currentTheme===mode}">${renderIcon(iconName)}<span>${modeLabel}</span></button>`).join("")}</div></details></div></header>`;
  const mobile=`<nav class="mobile-nav" aria-label="${copy.primaryNavigation}">${mobilePrimary.map(item=>link(item,true)).join("")}<button type="button" data-open-search>${renderIcon("search")}<small>${copy.search}</small></button><button type="button" data-open-more aria-haspopup="dialog">${renderIcon("more")}<small>${copy.more}</small></button></nav>`;
  const dialogs=`<dialog id="global-search-dialog" class="shell-dialog"><form method="dialog"><button class="dialog-close" value="cancel" aria-label="${copy.remove}">${renderIcon("close")}</button><label for="global-search-input">${copy.globalSearch}</label><div class="global-search-field">${renderIcon("search")}<input id="global-search-input" type="search" autocomplete="off" placeholder="${copy.globalSearch}"><button type="button" data-clear-global-search aria-label="${copy.remove}">${renderIcon("close")}</button></div><p id="global-search-status" role="status"></p><div id="global-search-results" class="global-search-results"></div></form></dialog><dialog id="more-dialog" class="shell-dialog"><form method="dialog"><button class="dialog-close" value="cancel" aria-label="${copy.remove}">${renderIcon("close")}</button><strong class="dialog-title">${copy.more}</strong><nav class="more-nav" aria-label="${copy.primaryNavigation}">${navigation.map(moreItem).join("")}</nav></form></dialog>`;
  return {header,mobile,dialogs};
}
