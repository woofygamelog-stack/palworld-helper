import type {Locale} from "../config.ts";
import type {Messages} from "../i18n.ts";
import {formatServerCopy,serverCopy} from "../server-i18n.ts";
import {buildServerIni,parseServerIni,serverDefaultValues,serverSettingsDiff,supportedServerSettings,validateServerSettings,type ServerIniWarning,type ServerSettingDefinition,type ServerSettingsValues} from "../server-settings.ts";
import type {UiCopy} from "../ui-i18n.ts";

const displayValue=(value:unknown)=>Array.isArray(value)?value.join(", "):value===""?'""':String(value);

export function renderServerSettingsPage({locale,messages,copy,setMeta,hero,escape}:{locale:Locale;messages:Messages;copy:UiCopy;setMeta:(title:string,description:string)=>void;hero:(title:string)=>string;escape:(value:string)=>string}){
  setMeta(messages.serverTitle,copy.serverNotice);
  const words=serverCopy[locale],groupNames={management:copy.serverManagement,performance:copy.serverPerformance,features:copy.serverFeatures,balance:copy.serverBalance};
  const placeholders:Record<string,string>={ServerName:copy.serverNamePlaceholder,ServerDescription:copy.serverDescriptionPlaceholder,ServerPassword:copy.passwordRequiredPlaceholder,AdminPassword:copy.adminPasswordPlaceholder};
  const field=(setting:ServerSettingDefinition)=>{
    const value=setting.defaultValue,scope=setting.basic?"basic":"advanced",hidden=setting.basic?"":" hidden",attrs=`${setting.min!==undefined?` min="${setting.min}"`:""}${setting.max!==undefined?` max="${setting.max}"`:""}${setting.step!==undefined?` step="${setting.step}"`:setting.type==="number"?' step="any"':""}`,placeholder=placeholders[setting.key]||setting.placeholder||"",hint=formatServerCopy(words.defaultValue,{value:displayValue(value)}),common=`name="${setting.key}" data-server-key data-server-type="${setting.type}" aria-describedby="server-hint-${setting.key}"`;
    let control:string;
    if(setting.type==="boolean")control=`<select ${common}><option value="True" ${value===true?"selected":""}>True</option><option value="False" ${value===false?"selected":""}>False</option></select>`;
    else if(setting.type==="enum")control=`<select ${common}>${setting.options?.map(option=>`<option value="${option}" ${value===option?"selected":""}>${option}</option>`).join("")}</select>`;
    else control=`<input ${common} type="${setting.sensitive?"password":setting.type==="integer"||setting.type==="number"?"number":"text"}"${attrs}${placeholder?` placeholder="${escape(placeholder)}"`:""} value="${escape(Array.isArray(value)?value.join(","):String(value??""))}">`;
    const range=setting.min!==undefined||setting.max!==undefined?` · ${setting.min??"−∞"}–${setting.max??"∞"}`:"",options=setting.options?.length?` · ${setting.options.join(", ")}`:"";
    return `<label class="server-setting" data-server-scope="${scope}"${hidden}><strong>${setting.key}</strong>${control}<small id="server-hint-${setting.key}">${escape(hint)}${escape(range)}${escape(options)}</small></label>`;
  };
  const groups=(Object.keys(groupNames) as (keyof typeof groupNames)[]).map(group=>{const settings=supportedServerSettings.filter(setting=>setting.group===group);return `<fieldset data-server-group="${group}" ${settings.some(setting=>setting.basic)?"":"hidden"}><legend>${groupNames[group]}</legend><div class="server-setting-grid">${settings.map(field).join("")}</div></fieldset>`}).join("");
  return `${hero(messages.serverTitle)}<section class="tool-layout server content-shell"><div><form class="panel server-form" id="server-form"><div class="server-toolbar"><div class="segmented" role="group"><button type="button" data-server-mode="basic" aria-pressed="true">${words.basicMode}</button><button type="button" data-server-mode="advanced" aria-pressed="false">${words.advancedMode}</button></div><button class="button" id="reset-server-defaults" type="button">${words.resetDefaults}</button></div>${groups}<button class="button primary" type="submit">${messages.generate}</button></form><section class="panel server-summary" aria-live="polite"><h2>${words.changedSettings.replace("{count}","0")}</h2><div id="server-diff"></div><div id="ini-warnings" class="server-validation" role="status"></div></section><div class="panel server-import"><label>${copy.importExistingIni}<textarea id="ini-import" autocomplete="off" spellcheck="false"></textarea></label><label class="button file-button">${words.importFile}<input id="ini-file" type="file" accept=".ini,text/plain"></label><button class="button" id="import-ini" type="button">${copy.importAndValidate}</button></div><section class="panel server-install"><h2>${words.windowsHeading}</h2><p>${words.installIntro}</p><code>Pal/Saved/Config/WindowsServer/PalWorldSettings.ini</code><h2>${words.linuxHeading}</h2><p>${words.installIntro}</p><code>Pal/Saved/Config/LinuxServer/PalWorldSettings.ini</code><p>${words.backupFirst}</p><p>${words.restartServer}</p></section></div><div class="panel output-panel"><textarea id="ini-output" aria-label="${copy.iniOutput}" readonly></textarea><p class="notice">${copy.serverNotice}</p><div class="button-row"><button class="button" id="copy-ini" type="button">${messages.copy}</button><button class="button" id="download-ini" type="button">${words.downloadIni}</button></div></div></section>`;
}

export function bindServerSettingsPage({document,locale,clipboard,trackEvent,trackOnce}:{document:Document;locale:Locale;clipboard:Pick<Clipboard,"writeText">;trackEvent:(name:string,params:Record<string,string>)=>unknown;trackOnce:(key:string,name:string,params:Record<string,string>)=>unknown}){
  const words=serverCopy[locale],form=document.querySelector<HTMLFormElement>("#server-form"),output=document.querySelector<HTMLTextAreaElement>("#ini-output"),warningsRoot=document.querySelector<HTMLElement>("#ini-warnings"),diffRoot=document.querySelector<HTMLElement>("#server-diff");
  let importedWarnings:ServerIniWarning[]=[];
  const escape=(value:string)=>value.replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]!));
  const inputs=()=>[...(form?.querySelectorAll<HTMLInputElement|HTMLSelectElement>("[data-server-key]")||[])];
  const readServerForm=():ServerSettingsValues=>{
    const values:ServerSettingsValues={};
    for(const input of inputs()){
      const type=input.dataset.serverType;
      if(type==="boolean")values[input.name]=input.value==="True";
      else if(type==="integer"||type==="number"){if(input.value!=="")values[input.name]=Number(input.value)}
      else if(type==="list")values[input.name]=input.value.split(",").map(value=>value.trim()).filter(Boolean);
      else values[input.name]=input.value;
    }
    return values;
  };
  const warningText=(item:ServerIniWarning)=>{
    const template=item.code==="unsupportedKey"?words.warningUnsupported:item.code==="deprecatedKey"?words.warningDeprecated:item.code==="duplicateKey"?words.warningDuplicate:item.code==="missingHeader"?words.warningMissingHeader:item.code==="dependency"?words.warningDependency:item.code==="security"?words.warningSecurity:item.code==="performance"?words.warningPerformance:words.warningInvalid;
    return formatServerCopy(template,{key:item.key,related:item.relatedKey||item.key});
  };
  const refresh=()=>{
    const values=readServerForm(),diff=serverSettingsDiff(values),validation=[...importedWarnings,...validateServerSettings(values)];
    if(diffRoot){diffRoot.previousElementSibling!.textContent=formatServerCopy(words.changedSettings,{count:diff.length});diffRoot.innerHTML=diff.length?`<ul>${diff.map(item=>`<li><code>${escape(item.key)}</code></li>`).join("")}</ul>`:`<p>${words.noChanges}</p>`}
    if(warningsRoot){warningsRoot.innerHTML=`<h3>${formatServerCopy(words.validationSummary,{count:validation.length})}</h3>${validation.length?`<ul>${validation.map(item=>`<li class="${item.severity}">${escape(warningText(item))}</li>`).join("")}</ul>`:`<p>${words.noWarnings}</p>`}`}
    return values;
  };
  const applyValues=(values:ServerSettingsValues)=>{for(const input of inputs()){const value=values[input.name]??serverDefaultValues[input.name];input.value=Array.isArray(value)?value.join(","):typeof value==="boolean"?(value?"True":"False"):String(value??"")}};
  const generate=()=>{const values=refresh();if(output)output.value=buildServerIni(values);return values};
  form?.addEventListener("submit",event=>{event.preventDefault();generate();trackOnce("tool:server","tool_use",{tool:"server_settings"})});
  form?.addEventListener("input",()=>{importedWarnings=[];refresh()});
  form?.addEventListener("change",()=>{importedWarnings=[];refresh()});
  document.querySelectorAll<HTMLButtonElement>("[data-server-mode]").forEach(button=>button.addEventListener("click",()=>{
    const advanced=button.dataset.serverMode==="advanced";
    document.querySelectorAll<HTMLElement>("[data-server-scope=advanced]").forEach(field=>field.hidden=!advanced);
    document.querySelectorAll<HTMLElement>("[data-server-group]").forEach(group=>group.hidden=![...group.querySelectorAll<HTMLElement>("[data-server-scope]")].some(field=>!field.hidden));
    document.querySelectorAll<HTMLButtonElement>("[data-server-mode]").forEach(candidate=>candidate.setAttribute("aria-pressed",String(candidate===button)));
  }));
  document.querySelector("#reset-server-defaults")?.addEventListener("click",()=>{importedWarnings=[];applyValues(serverDefaultValues);generate();inputs()[0]?.focus()});
  const importText=(text:string)=>{const parsed=parseServerIni(text);importedWarnings=parsed.warnings.filter(item=>!["dependency","security","performance"].includes(item.code));applyValues({...serverDefaultValues,...parsed.values});if(output)output.value=buildServerIni(readServerForm());refresh()};
  document.querySelector("#import-ini")?.addEventListener("click",()=>importText(document.querySelector<HTMLTextAreaElement>("#ini-import")?.value||""));
  document.querySelector<HTMLInputElement>("#ini-file")?.addEventListener("change",event=>{const file=(event.currentTarget as HTMLInputElement).files?.[0];if(file)void file.text().then(text=>{const input=document.querySelector<HTMLTextAreaElement>("#ini-import");if(input)input.value=text;importText(text)})});
  document.querySelector("#copy-ini")?.addEventListener("click",()=>{void clipboard.writeText(output?.value||"");trackEvent("tool_action",{tool:"server_settings",action:"copy"})});
  document.querySelector("#download-ini")?.addEventListener("click",()=>{const target=document.defaultView;if(!target)return;const url=target.URL.createObjectURL(new Blob([output?.value||""],{type:"text/plain;charset=utf-8"})),anchor=document.createElement("a");anchor.href=url;anchor.download="PalWorldSettings.ini";anchor.click();target.URL.revokeObjectURL(url);trackEvent("tool_action",{tool:"server_settings",action:"download"})});
  generate();
}
