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
  const adsenseEnabled=productionRelease&&config.adsenseEnabled&&cmpConfigured&&/^ca-pub-\d+$/.test(config.adsenseClient)&&/^\d+$/.test(config.adsenseContentSlot);
  const cmpEnabled=analyticsEnabled||adsenseEnabled||consentTestMode&&cmpConfigured&&/^ca-pub-\d+$/.test(config.adsenseClient);
  return {productionRelease,analyticsEnabled,adsenseEnabled,cmpEnabled,consentTestMode,privacyControlsAvailable:cmpEnabled};
}

export type GoogleConsentTarget=AnalyticsTarget&{
  gtag_enable_tcf_support?:boolean;
  googlefc?:{callbackQueue?:unknown[];showRevocationMessage?:()=>void};
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

export function openGooglePrivacyChoices(target:GoogleConsentTarget,enabled=false){
  if(!enabled)return false;
  const googlefc=target.googlefc=target.googlefc||{};
  googlefc.callbackQueue=googlefc.callbackQueue||[];
  googlefc.callbackQueue.push(googlefc.showRevocationMessage||(()=>target.googlefc?.showRevocationMessage?.()));
  return true;
}
