export type AnalyticsParams=Record<string,string|number|boolean>;
export type AnalyticsTarget={dataLayer?:unknown[];gtag?:(...args:unknown[])=>void};

export function installGtagQueue(target:AnalyticsTarget){
  target.dataLayer=target.dataLayer||[];
  target.gtag=function(){target.dataLayer!.push(arguments)};
}

export function createAnalyticsTracker(options:{
  collectionEnabled:()=>boolean;
  sender:()=>AnalyticsTarget["gtag"];
}){
  const trackedInteractions=new Set<string>();
  function trackEvent(name:string,params:AnalyticsParams={}){
    if(!options.collectionEnabled())return false;
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
  return {trackEvent,trackOnce};
}
