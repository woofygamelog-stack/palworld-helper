import type {ThemeMode} from "./theme";

export const localePreservedSearchKeys=["layers","dungeon","world","pal","npc","travel","kind","category","type","level","power","condition","attack","defend","q","variant","difficulty","element","preset","roles","limit","night"] as const;

export function preservedLocaleSearch(search:string){
  const source=new URLSearchParams(search),preserved=new URLSearchParams();
  for(const key of localePreservedSearchKeys){
    const value=source.get(key);
    if(value!==null)preserved.set(key,value);
  }
  return preserved.toString();
}

export function themeModeFromChoice(value:string|undefined):ThemeMode{
  return value==="light"||value==="dark"?value:"system";
}

export function shouldOpenGlobalSearchShortcut({key,ctrlKey=false,metaKey=false,targetTagName=""}:{key:string;ctrlKey?:boolean;metaKey?:boolean;targetTagName?:string}){
  return key==="/"&&!ctrlKey&&!metaKey&&!/^(INPUT|TEXTAREA|SELECT)$/.test(targetTagName.toUpperCase());
}

export function globalSearchFocusIndex({key,currentIndex,resultCount}:{key:string;currentIndex:number;resultCount:number}){
  if(!resultCount)return -1;
  if(key==="Home")return 0;
  if(key==="End")return resultCount-1;
  if(key==="ArrowDown")return currentIndex<0?0:Math.min(currentIndex+1,resultCount-1);
  if(key==="ArrowUp")return currentIndex<0?resultCount-1:currentIndex===0?-1:currentIndex-1;
  return currentIndex;
}

export function bindShellInteractions({
  document,
  onLocaleChange,
  syncTheme,
  applyTheme,
  ensureGlobalSearchData,
  renderGlobalSearch,
  navigate
}:{
  document:Document;
  onLocaleChange:(locale:string)=>void;
  syncTheme:()=>void;
  applyTheme:(mode:ThemeMode)=>void;
  ensureGlobalSearchData:()=>Promise<void>;
  renderGlobalSearch:(query:string)=>void;
  navigate:(href:string)=>void;
}){
  const cleanups:(()=>void)[]=[];
  const listen=(target:EventTarget,type:string,listener:EventListener)=>{
    target.addEventListener(type,listener);
    cleanups.push(()=>target.removeEventListener(type,listener));
  };
  const groups=()=>document.querySelectorAll<HTMLDetailsElement>("[data-shell-group]");
  groups().forEach(group=>listen(group,"toggle",(()=>{
    if(!group.open)return;
    groups().forEach(other=>{if(other!==group)other.open=false});
  }) as EventListener));
  listen(document,"pointerdown",(event=>{
    const target=event.target as Element|null;
    if(target?.closest("[data-shell-group]"))return;
    document.querySelectorAll<HTMLDetailsElement>("[data-shell-group][open]").forEach(group=>group.open=false);
  }) as EventListener);

  const localeSelect=document.querySelector<HTMLSelectElement>("#locale");
  if(localeSelect)listen(localeSelect,"change",(()=>onLocaleChange(localeSelect.value)) as EventListener);
  syncTheme();
  document.querySelectorAll<HTMLButtonElement>("[data-theme-choice]").forEach(button=>listen(button,"click",(()=>applyTheme(themeModeFromChoice(button.dataset.themeChoice))) as EventListener));

  const initialDialog=document.querySelector<HTMLDialogElement>("#global-search-dialog"),initialInput=document.querySelector<HTMLInputElement>("#global-search-input");
  const openSearch=async()=>{
    if(initialDialog&&!initialDialog.open)initialDialog.showModal();
    initialInput?.focus();
    await ensureGlobalSearchData();
    const activeDialog=document.querySelector<HTMLDialogElement>("#global-search-dialog"),activeInput=document.querySelector<HTMLInputElement>("#global-search-input");
    if(activeDialog&&!activeDialog.open)activeDialog.showModal();
    activeInput?.focus();
    if(activeInput?.value)renderGlobalSearch(activeInput.value);
  };
  document.querySelectorAll<HTMLButtonElement>("[data-open-search]").forEach(button=>listen(button,"click",(()=>{void openSearch()}) as EventListener));
  listen(document,"keydown",(event=>{
    const keyboardEvent=event as KeyboardEvent,target=keyboardEvent.target as HTMLElement|null;
    if(keyboardEvent.key==="Escape"){
      const openGroup=document.querySelector<HTMLDetailsElement>("[data-shell-group][open]");
      if(openGroup){
        keyboardEvent.preventDefault();
        openGroup.open=false;
        openGroup.querySelector<HTMLElement>("summary")?.focus();
        return;
      }
    }
    if(shouldOpenGlobalSearchShortcut({key:keyboardEvent.key,ctrlKey:keyboardEvent.ctrlKey,metaKey:keyboardEvent.metaKey,targetTagName:target?.tagName||""})){
      keyboardEvent.preventDefault();
      void openSearch();
    }
  }) as EventListener);
  if(initialInput){
    listen(initialInput,"input",(()=>renderGlobalSearch(initialInput.value)) as EventListener);
    listen(initialInput,"keydown",(event=>{
      const keyboardEvent=event as KeyboardEvent;
      if(keyboardEvent.key!=="ArrowDown"&&keyboardEvent.key!=="ArrowUp")return;
      const links=[...document.querySelectorAll<HTMLAnchorElement>("#global-search-results a[data-global-result]")],next=globalSearchFocusIndex({key:keyboardEvent.key,currentIndex:-1,resultCount:links.length});
      if(next<0)return;
      keyboardEvent.preventDefault();
      links[next]?.focus();
    }) as EventListener);
  }
  const clearSearch=document.querySelector<HTMLElement>("[data-clear-global-search]");
  if(clearSearch)listen(clearSearch,"click",(()=>{
    const input=document.querySelector<HTMLInputElement>("#global-search-input");
    if(!input)return;
    input.value="";
    renderGlobalSearch("");
    input.focus();
  }) as EventListener);
  const searchResults=document.querySelector<HTMLElement>("#global-search-results");
  if(searchResults)listen(searchResults,"keydown",(event=>{
    const keyboardEvent=event as KeyboardEvent,link=(keyboardEvent.target as Element|null)?.closest<HTMLAnchorElement>("a[data-global-result]");
    if(!link||!["ArrowDown","ArrowUp","Home","End"].includes(keyboardEvent.key))return;
    const links=[...searchResults.querySelectorAll<HTMLAnchorElement>("a[data-global-result]")],next=globalSearchFocusIndex({key:keyboardEvent.key,currentIndex:links.indexOf(link),resultCount:links.length});
    keyboardEvent.preventDefault();
    if(next<0)document.querySelector<HTMLInputElement>("#global-search-input")?.focus();else links[next]?.focus();
  }) as EventListener);
  if(searchResults)listen(searchResults,"click",(event=>{
    const link=(event.target as Element|null)?.closest<HTMLAnchorElement>("a[data-global-result]");
    if(!link)return;
    event.preventDefault();
    document.querySelector<HTMLDialogElement>("#global-search-dialog")?.close();
    navigate(link.href);
  }) as EventListener);
  const moreDialog=document.querySelector<HTMLDialogElement>("#more-dialog"),openMore=document.querySelector<HTMLElement>("[data-open-more]");
  if(openMore)listen(openMore,"click",(()=>{if(moreDialog&&!moreDialog.open)moreDialog.showModal()}) as EventListener);
  return ()=>cleanups.splice(0).forEach(cleanup=>cleanup());
}
