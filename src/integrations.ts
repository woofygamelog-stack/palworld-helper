import {installGtagQueue,type AnalyticsTarget} from "./analytics.ts";

export const googleConsentRegions=[
  "AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE",
  "IS","LI","NO","GB","CH"
] as const;

export type IntegrationConfig={
  isProductionBuild:boolean;
  releaseStage:string;
  analyticsEnabled:boolean;
  analyticsId:string;
  adsenseEnabled:boolean;
  adsenseClient:string;
  adsenseContentSlot:string;
  googleCmp:string;
  consentTestMode:boolean;
};

export type IntegrationState={
  productionRelease:boolean;
  analyticsEnabled:boolean;
  adsenseEnabled:boolean;
  cmpEnabled:boolean;
  consentTestMode:boolean;
  privacyControlsAvailable:boolean;
};

export function resolveIntegrationState(config:IntegrationConfig):IntegrationState{
  const productionRelease=config.isProductionBuild&&config.releaseStage==="production";
  const consentTestMode=!config.isProductionBuild&&config.consentTestMode;
  const cmpConfigured=config.googleCmp==="google-privacy-messaging";
  const analyticsEnabled=productionRelease&&config.analyticsEnabled&&cmpConfigured&&/^G-[A-Z0-9]+$/.test(config.analyticsId);
  const adsenseEnabled=productionRelease&&config.adsenseEnabled&&cmpConfigured&&/^ca-pub-\d+$/.test(config.adsenseClient);
  const cmpEnabled=analyticsEnabled||adsenseEnabled||consentTestMode&&cmpConfigured&&/^ca-pub-\d+$/.test(config.adsenseClient);
  return {productionRelease,analyticsEnabled,adsenseEnabled,cmpEnabled,consentTestMode,privacyControlsAvailable:cmpEnabled};
}

export type GoogleConsentModeStatus={
  adStoragePurposeConsentStatus:number;
  adUserDataPurposeConsentStatus:number;
  adPersonalizationPurposeConsentStatus:number;
  analyticsStoragePurposeConsentStatus:number;
};

export const googleConsentModePurposeStatus={unknown:0,granted:1,denied:2,notApplicable:3,notConfigured:4} as const;
const permittedConsentModeStatuses=new Set<number>([
  googleConsentModePurposeStatus.granted,
  googleConsentModePurposeStatus.notApplicable
]);

export function mayLoadAds(status:GoogleConsentModeStatus){
  return permittedConsentModeStatuses.has(status.adStoragePurposeConsentStatus);
}

export function queueAnalyticsInitialization(target:GoogleConsentTarget,analyticsId:string){
  if(!/^G-[A-Z0-9]+$/.test(analyticsId))return false;
  installGtagQueue(target);
  target.gtag!("js",new Date());
  target.gtag!("config",analyticsId,{send_page_view:true,allow_google_signals:false,allow_ad_personalization_signals:false});
  return true;
}

type GoogleCallbackQueueEntry=Record<string,()=>void>|(()=>void);
type GoogleCallbackQueue={push:(entry:GoogleCallbackQueueEntry)=>number};
type GoogleFc={
  callbackQueue?:GoogleCallbackQueue|GoogleCallbackQueueEntry[];
  showRevocationMessage?:()=>void;
  getGoogleConsentModeValues?:()=>GoogleConsentModeStatus;
};

export type GoogleConsentTarget=AnalyticsTarget&{
  gtag_enable_tcf_support?:boolean;
  googlefc?:GoogleFc;
  adsbygoogle?:Record<string,unknown>[];
};

export function installRegionalConsentMode(target:GoogleConsentTarget){
  installGtagQueue(target);
  target.gtag_enable_tcf_support=true;
  target.gtag!("consent","default",{
    ad_storage:"denied",
    analytics_storage:"denied",
    ad_user_data:"denied",
    ad_personalization:"denied",
    wait_for_update:500,
    region:[...googleConsentRegions]
  });
  target.gtag!("consent","default",{
    ad_storage:"granted",
    analytics_storage:"granted",
    ad_user_data:"granted",
    ad_personalization:"granted"
  });
  target.gtag!("set","ads_data_redaction",true);
}

export function queueGoogleConsentModeReady(target:GoogleConsentTarget,callback:(status:GoogleConsentModeStatus)=>void){
  const googlefc=target.googlefc=target.googlefc||{};
  googlefc.callbackQueue=googlefc.callbackQueue||[];
  googlefc.callbackQueue.push({CONSENT_MODE_DATA_READY:()=>{
    const status=googlefc.getGoogleConsentModeValues?.();
    if(status)callback(status);
  }});
}

export function openGooglePrivacyChoices(target:GoogleConsentTarget,enabled=false){
  if(!enabled)return false;
  const googlefc=target.googlefc=target.googlefc||{};
  googlefc.callbackQueue=googlefc.callbackQueue||[];
  googlefc.callbackQueue.push({CONSENT_API_READY:()=>googlefc.showRevocationMessage?.()});
  return true;
}
