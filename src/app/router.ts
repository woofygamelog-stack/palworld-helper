export function hasSupportedLocale(pathname:string,supportedLocales:readonly string[]):boolean{
  const segment=pathname.split("/").filter(Boolean)[0];
  return Boolean(segment&&supportedLocales.includes(segment));
}

export function routeFromPathname(pathname:string,supportedLocales:readonly string[]):string{
  const segments=pathname.split("/").filter(Boolean);
  if(!segments[0]||!supportedLocales.includes(segments[0]))return "/";
  return `/${segments.slice(1).join("/")}`.replace(/\/$/,"")||"/";
}

export function normalizedLocaleUrl(options:{
  pathname:string;
  search:string;
  hash:string;
  locale:string;
  supportedLocales:readonly string[];
  localizePath:(locale:string,path:string)=>string;
}):string|null{
  const {pathname,search,hash,locale,supportedLocales,localizePath}=options;
  return hasSupportedLocale(pathname,supportedLocales)?null:`${localizePath(locale,pathname)}${search}${hash}`;
}

export function navigateSpa(href:string,options:{history:Pick<History,"pushState">;render:()=>void;scrollToTop:()=>void}){
  options.history.pushState({},"",href);
  options.render();
  options.scrollToTop();
}

export function bindSpaLinks(root:ParentNode,navigate:(href:string)=>void,selector="a[data-link]"){
  root.querySelectorAll<HTMLAnchorElement>(selector).forEach(anchor=>anchor.onclick=event=>{event.preventDefault();navigate(anchor.href)});
}

export function bindDelegatedSpaLinks(root:Element,navigate:(href:string)=>void,selector="a[data-dynamic-link]"){
  root.addEventListener("click",event=>{
    const target=event.target as Element|null,anchor=target?.closest<HTMLAnchorElement>(selector);
    if(!anchor||!root.contains(anchor))return;
    event.preventDefault();
    navigate(anchor.href);
  });
}
