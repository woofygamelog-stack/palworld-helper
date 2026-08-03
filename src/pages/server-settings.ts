import type {Locale} from "../config.ts";
import {buildServerIni,officialServerSettings,parseServerIni} from "../data.ts";
import type {Messages} from "../i18n.ts";
import {formatUiCopy,type UiCopy} from "../ui-i18n.ts";

export function renderServerSettingsPage({
  locale,
  messages,
  copy,
  setMeta,
  hero,
  escape
}:{
  locale:Locale;
  messages:Messages;
  copy:UiCopy;
  setMeta:(title:string,description:string)=>void;
  hero:(title:string)=>string;
  escape:(value:string)=>string;
}){
  setMeta(messages.serverTitle,copy.serverNotice);
  const groupNames={management:copy.serverManagement,performance:copy.serverPerformance,features:copy.serverFeatures,balance:copy.serverBalance};
  const serverPlaceholders:Record<string,string>={ServerName:copy.serverNamePlaceholder,ServerDescription:copy.serverDescriptionPlaceholder,ServerPassword:copy.passwordRequiredPlaceholder,AdminPassword:copy.adminPasswordPlaceholder};
  const fields=(group:keyof typeof groupNames)=>officialServerSettings.filter(setting=>setting.group===group).map(setting=>{
    const value=setting.defaultValue;
    const attrs=`${setting.min!==undefined?` min="${setting.min}"`:""}${setting.max!==undefined?` max="${setting.max}"`:""}${setting.step!==undefined?` step="${setting.step}"`:setting.type==="number"?' step="any"':""}`;
    const placeholder=setting.placeholder?` placeholder="${escape(serverPlaceholders[setting.key]||setting.placeholder)}"`:"";
    if(setting.type==="boolean")return `<label class="server-setting check"><input name="${setting.key}" type="checkbox" data-server-key ${value===true?"checked":""}><span><strong>${setting.key}</strong></span></label>`;
    if(setting.type==="enum")return `<label class="server-setting"><strong>${setting.key}</strong><select name="${setting.key}" data-server-key><option value="">${messages.choose}</option>${setting.options?.map(option=>`<option value="${option}">${option}</option>`).join("")}</select></label>`;
    if((setting.type==="integer"||setting.type==="number")&&setting.min!==undefined&&setting.max!==undefined)return `<label class="server-setting server-range"><strong>${setting.key}</strong><span class="range-pair"><input type="range" min="${setting.min}" max="${setting.max}" step="${setting.step??(setting.type==="integer"?1:"any")}" value="${value??setting.min}" data-range-for="${setting.key}" aria-label="${setting.key}"><input name="${setting.key}" data-server-key type="number"${attrs}${placeholder} value="${value??""}"></span><small>${setting.min.toLocaleString(locale)} – ${setting.max.toLocaleString(locale)}</small></label>`;
    return `<label class="server-setting"><strong>${setting.key}</strong><input name="${setting.key}" data-server-key type="${setting.sensitive?"password":setting.type==="text"?"text":"number"}"${attrs}${placeholder} value="${value??""}"></label>`;
  }).join("");
  return `${hero(messages.serverTitle)}<section class="tool-layout server content-shell"><div><form class="panel server-form" id="server-form">${(Object.keys(groupNames) as (keyof typeof groupNames)[]).map(group=>`<fieldset><legend>${groupNames[group]}</legend><div class="server-setting-grid">${fields(group)}</div></fieldset>`).join("")}<button class="button primary">${messages.generate}</button></form><div class="panel server-import"><label>${copy.importExistingIni}<textarea id="ini-import" autocomplete="off" spellcheck="false"></textarea></label><button class="button" id="import-ini" type="button">${copy.importAndValidate}</button><div id="ini-warnings" class="notice" role="status" hidden></div></div></div><div class="panel output-panel"><textarea id="ini-output" aria-label="${copy.iniOutput}" readonly></textarea><p class="notice">${copy.serverNotice}</p><button class="button" id="copy-ini">${messages.copy}</button></div></section>`;
}

export function bindServerSettingsPage({
  document,
  copy,
  clipboard,
  trackEvent,
  trackOnce
}:{
  document:Document;
  copy:UiCopy;
  clipboard:Pick<Clipboard,"writeText">;
  trackEvent:(name:string,params:Record<string,string>)=>unknown;
  trackOnce:(key:string,name:string,params:Record<string,string>)=>unknown;
}){
  const form=document.querySelector<HTMLFormElement>("#server-form");
  const readServerForm=()=>{
    const values:Record<string,string|number|boolean>={};
    form?.querySelectorAll<HTMLInputElement|HTMLSelectElement>("[data-server-key]").forEach(input=>{
      if(input instanceof HTMLInputElement&&input.type==="checkbox"){
        if(input.checked)values[input.name]=true;
        else if(input.defaultChecked)values[input.name]=false;
      }else if(input.value!=="")values[input.name]=input.type==="number"?Number(input.value):input.value;
    });
    return values;
  };
  form?.addEventListener("submit",event=>{
    event.preventDefault();
    document.querySelector<HTMLTextAreaElement>("#ini-output")!.value=buildServerIni(readServerForm());
    trackOnce("tool:server","tool_use",{tool:"server_settings"});
  });
  form?.querySelectorAll<HTMLInputElement>("[data-range-for]").forEach(range=>{
    const number=form.elements.namedItem(range.dataset.rangeFor||"") as HTMLInputElement|null;
    if(!number)return;
    range.addEventListener("input",()=>number.value=range.value);
    number.addEventListener("input",()=>{if(number.value!=="")range.value=number.value});
  });
  document.querySelector("#import-ini")?.addEventListener("click",()=>{
    if(!form)return;
    const parsed=parseServerIni(document.querySelector<HTMLTextAreaElement>("#ini-import")?.value||""),warnings=document.querySelector<HTMLElement>("#ini-warnings")!;
    form.querySelectorAll<HTMLInputElement|HTMLSelectElement>("[data-server-key]").forEach(input=>{
      const value=parsed.values[input.name];
      if(input instanceof HTMLInputElement&&input.type==="checkbox")input.checked=value===true;
      else input.value=value===undefined?"":String(value);
    });
    warnings.hidden=parsed.warnings.length===0;
    warnings.textContent=parsed.warnings.map(warning=>formatUiCopy(copy[warning.code==="unsupportedKey"?"warningUnsupportedKey":warning.code==="boolean"?"warningBoolean":warning.code==="number"?"warningNumber":"warningRange"],{key:warning.key})).join(" ");
    document.querySelector<HTMLTextAreaElement>("#ini-output")!.value=buildServerIni(parsed.values);
  });
  document.querySelector("#copy-ini")?.addEventListener("click",()=>{
    void clipboard.writeText(document.querySelector<HTMLTextAreaElement>("#ini-output")!.value);
    trackEvent("tool_action",{tool:"server_settings",action:"copy"});
  });
}
