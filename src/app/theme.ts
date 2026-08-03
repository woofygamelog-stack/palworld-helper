export type ThemeMode="system"|"light"|"dark";
export type ThemeIconName="system"|"sun"|"moon";

export function readThemePreference(storage:Pick<Storage,"getItem">):ThemeMode{
  const value=storage.getItem("pw-theme");
  return value==="light"||value==="dark"?value:"system";
}

export function themeIconName(mode:ThemeMode):ThemeIconName{
  return mode==="light"?"sun":mode==="dark"?"moon":"system";
}

export function effectiveTheme(mode:ThemeMode,prefersDark:boolean):"light"|"dark"{
  return mode==="dark"||mode==="system"&&prefersDark?"dark":"light";
}

type ThemeControllerOptions={
  document:Document;
  storage:Pick<Storage,"getItem"|"setItem"|"removeItem">;
  matchMedia:(query:string)=>MediaQueryList;
  renderIcon:(name:ThemeIconName)=>string;
  track:(mode:ThemeMode)=>void;
};

export function createThemeController(options:ThemeControllerOptions){
  const {document,storage,matchMedia,renderIcon,track}=options;
  const colorScheme=matchMedia("(prefers-color-scheme: dark)");
  const sync=(mode=readThemePreference(storage))=>{
    document.documentElement.dataset.theme=mode;
    const effective=effectiveTheme(mode,colorScheme.matches);
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute("content",effective==="dark"?"#071a31":"#edf7f5");
    const trigger=document.querySelector<HTMLElement>(".theme-menu summary");
    if(trigger)trigger.innerHTML=renderIcon(themeIconName(mode));
    document.querySelectorAll<HTMLButtonElement>("[data-theme-choice]").forEach(button=>button.setAttribute("aria-pressed",String(button.dataset.themeChoice===mode)));
  };
  const apply=(mode:ThemeMode)=>{
    if(mode==="system")storage.removeItem("pw-theme");else storage.setItem("pw-theme",mode);
    sync(mode);
    track(mode);
  };
  const handleSystemChange=()=>{if(readThemePreference(storage)==="system")sync("system")};
  colorScheme.addEventListener("change",handleSystemChange);
  sync();
  return {apply,sync,destroy:()=>colorScheme.removeEventListener("change",handleSystemChange)};
}
