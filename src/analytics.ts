export type AnalyticsParams=Record<string,string|number|boolean>;
export type AnalyticsTarget={dataLayer?:unknown[];gtag?:(...args:unknown[])=>void};

export function installGtagQueue(target:AnalyticsTarget){
  target.dataLayer=target.dataLayer||[];
  target.gtag=function(){target.dataLayer!.push(arguments)};
}

export function createAnalyticsTracker(options:{
  consentGranted:()=>boolean;
  currentPath:()=>string;
  currentLocale:()=>string;
  sender:()=>AnalyticsTarget["gtag"];
}){
  const trackedInteractions=new Set<string>();
  let lastTrackedPage="";
  function trackEvent(name:string,params:AnalyticsParams={}){
    if(!options.consentGranted())return false;
    const sender=options.sender();
    if(!sender)return false;
    sender("event",name,params);
    return true;
  }
  function trackOnce(key:string,name:string,params:AnalyticsParams={}){
    if(trackedInteractions.has(key))return false;
    if(!trackEvent(name,params))return false;
    trackedInteractions.add(key);
    return true;
  }
  function trackPageView(){
    if(!options.consentGranted())return false;
    const pagePath=options.currentPath();
    if(pagePath===lastTrackedPage)return false;
    if(!trackEvent("page_view",{page_path:pagePath,locale:options.currentLocale()}))return false;
    lastTrackedPage=pagePath;
    return true;
  }
  return {trackEvent,trackOnce,trackPageView};
}
