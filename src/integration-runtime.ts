import {installRegionalConsentMode,mayLoadAds,queueAnalyticsInitialization,queueGoogleConsentModeReady,type GoogleConsentTarget,type IntegrationState} from "./integrations.ts";

export const manualAdSlotSelector="ins.adsbygoogle.ad-slot[data-ad-client][data-ad-slot]";

type AdSlot={
  hasAttribute:(name:string)=>boolean;
  setAttribute:(name:string,value:string)=>void;
};

type AdSlotRoot={querySelectorAll:(selector:string)=>Iterable<AdSlot>};

export function claimManualAdSlot(root:AdSlotRoot){
  for(const slot of root.querySelectorAll(manualAdSlotSelector)){
    if(slot.hasAttribute("data-ad-requested")||slot.hasAttribute("data-adsbygoogle-status"))continue;
    slot.setAttribute("data-ad-requested","true");
    return slot;
  }
}

export function requestManualAd(target:GoogleConsentTarget,root:AdSlotRoot){
  const slot=claimManualAdSlot(root);
  if(!slot)return false;
  (target.adsbygoogle=target.adsbygoogle||[]).push({});
  return true;
}

type RuntimeSite={
  origin:string;
  analyticsId:string;
  adsenseClient:string;
};

export function createIntegrationRuntime({target,document,origin,site,state}:{
  target:Window&GoogleConsentTarget;
  document:Document;
  origin:string;
  site:RuntimeSite;
  state:IntegrationState;
}){
  let adRequestsAllowed=false;

  const initializeAnalytics=()=>{
    const loaderUrl=`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(site.analyticsId)}`;
    if(!state.analyticsEnabled||[...document.scripts].some(script=>script.src===loaderUrl))return;
    if(!queueAnalyticsInitialization(target,site.analyticsId))return;
    const script=document.createElement("script");script.async=true;script.src=loaderUrl;document.head.append(script);
  };

  const requestEligibleAd=()=>state.adsenseEnabled&&adRequestsAllowed&&requestManualAd(target,document);

  const applyConsentModeStatus=()=>{
    const status=target.googlefc?.getGoogleConsentModeValues?.();
    if(!status){adRequestsAllowed=false;return}
    adRequestsAllowed=state.adsenseEnabled&&mayLoadAds(status);
    if(adRequestsAllowed)requestEligibleAd();
  };

  const queueConsentModeGate=()=>queueGoogleConsentModeReady(target,applyConsentModeStatus);

  const initializeAdBlockingMeasurement=()=>{
    if(!state.adsenseEnabled||origin!==site.origin)return;
    if(!document.querySelector('iframe[name="googlefcPresent"]')){
      const iframe=document.createElement("iframe");iframe.name="googlefcPresent";iframe.hidden=true;iframe.style.cssText="width:0;height:0;border:0;position:absolute;left:-1000px;top:-1000px";document.body.append(iframe);
    }
    const loaderUrl="https://fundingchoicesmessages.google.com/i/pub-1986785092914105?ers=1";
    if(![...document.scripts].some(script=>script.src===loaderUrl)){
      const script=document.createElement("script");script.id="google-ad-blocking-measurement-loader";script.async=true;script.src=loaderUrl;document.head.append(script);
    }
  };

  const initialize=()=>{
    if(!state.cmpEnabled)return;
    installRegionalConsentMode(target);
    initializeAnalytics();
    queueConsentModeGate();
    const loaderUrl=`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(site.adsenseClient)}`;
    if(![...document.scripts].some(script=>script.src===loaderUrl)){
      const script=document.createElement("script");script.async=true;script.crossOrigin="anonymous";script.src=loaderUrl;document.head.append(script);
    }
    initializeAdBlockingMeasurement();
  };

  return {
    initialize,
    requestEligibleAd,
    revokeAdRequests:()=>{adRequestsAllowed=false},
    queueConsentModeGate,
  };
}
