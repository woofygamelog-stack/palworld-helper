import {readFile,readdir} from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";

export const approvedAnalyticsId="G-FF7N186M72";
export const approvedAdsenseClient="ca-pub-1986785092914105";
export const approvedAdsTxt="google.com, pub-1986785092914105, DIRECT, f08c47fec0942fa0";

export function productionIntegrationErrors(env=process.env){
  const errors=[];
  if(env.VITE_RELEASE_STAGE!=="production")errors.push("VITE_RELEASE_STAGE must be production");
  if(env.VITE_ENABLE_ANALYTICS!=="true")errors.push("VITE_ENABLE_ANALYTICS must remain true");
  if(env.VITE_GA_ID!==approvedAnalyticsId)errors.push(`VITE_GA_ID must be ${approvedAnalyticsId}`);
  if(env.VITE_ENABLE_ADSENSE!=="true")errors.push("VITE_ENABLE_ADSENSE must remain true");
  if(env.VITE_ADSENSE_CLIENT!==approvedAdsenseClient)errors.push(`VITE_ADSENSE_CLIENT must be ${approvedAdsenseClient}`);
  if(env.VITE_ADSENSE_CONTENT_SLOT&&!/^\d+$/.test(env.VITE_ADSENSE_CONTENT_SLOT))errors.push("VITE_ADSENSE_CONTENT_SLOT must be empty for Auto ads or contain an approved numeric site slot");
  if(env.VITE_GOOGLE_CMP!=="google-privacy-messaging")errors.push("VITE_GOOGLE_CMP must be google-privacy-messaging");
  return errors;
}

async function collectJavaScript(directory,files=[]){
  for(const entry of await readdir(directory,{withFileTypes:true})){
    const target=path.join(directory,entry.name);
    if(entry.isDirectory())await collectJavaScript(target,files);
    else if(entry.name.endsWith(".js"))files.push(target);
  }
  return files;
}

export async function auditProductionIntegrations({root=process.cwd(),env=process.env}={}){
  const errors=productionIntegrationErrors(env);
  if(errors.length)throw new Error(`Production integration audit failed: ${errors.join("; ")}`);
  const dist=path.join(root,"dist"),[index,adsTxt,jsFiles,mainSource]=await Promise.all([
    readFile(path.join(dist,"index.html"),"utf8"),
    readFile(path.join(dist,"ads.txt"),"utf8"),
    collectJavaScript(path.join(dist,"assets")),
    readFile(path.join(root,"src","main.ts"),"utf8")
  ]);
  const bundle=(await Promise.all(jsFiles.map(file=>readFile(file,"utf8")))).join("\n");
  const slot=env.VITE_ADSENSE_CONTENT_SLOT||"";
  if(!index.includes(`name="google-adsense-account" content="${approvedAdsenseClient}"`))throw new Error("Production integration audit failed: AdSense account meta tag is missing");
  if(adsTxt.trim()!==approvedAdsTxt)throw new Error("Production integration audit failed: ads.txt does not match the approved publisher");
  if(!bundle.includes(approvedAnalyticsId)||!bundle.includes(`https://www.googletagmanager.com/gtag/js?id=`))throw new Error("Production integration audit failed: Analytics ID or loader is missing");
  if(!bundle.includes(approvedAdsenseClient)||!bundle.includes(`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=`))throw new Error("Production integration audit failed: AdSense publisher or Auto ads loader is missing");
  if(slot&&!bundle.includes(slot))throw new Error("Production integration audit failed: configured AdSense site slot is missing");
  if(!bundle.includes("CONSENT_MODE_DATA_READY")||!bundle.includes("getGoogleConsentModeValues"))throw new Error("Production integration audit failed: regional Google CMP gating is missing");
  const consentDefaults=mainSource.indexOf("installRegionalConsentMode(win);"),analyticsStart=mainSource.indexOf("initializeAnalytics();"),cmpGate=mainSource.indexOf("queueConsentModeGate(win);");
  if(consentDefaults<0||analyticsStart<0||cmpGate<0||!(consentDefaults<analyticsStart&&analyticsStart<cmpGate))throw new Error("Production integration audit failed: Advanced Consent Mode must start Analytics after regional defaults without waiting for the CMP callback");
  if(/analyticsCollectionAllowed|mayLoadAnalytics/.test(mainSource))throw new Error("Production integration audit failed: obsolete Analytics consent callback gate remains");
  if(/trackPageView/.test(mainSource)||!bundle.includes("send_page_view")||!bundle.includes("allow_google_signals"))throw new Error("Production integration audit failed: GA Enhanced Measurement must own SPA page views without an app-managed duplicate sender");
  if(bundle.includes("data-palworld-cmp")||bundle.includes("data-palworld-ga")||bundle.includes("palworldCmp")||bundle.includes("palworldGa"))throw new Error("Production integration audit failed: Google vendor loaders must not contain custom tracking attributes");
  if(bundle.includes("pw-consent"))throw new Error("Production integration audit failed: obsolete global consent storage returned");
  const analyticsIds=new Set(bundle.match(/G-[A-Z0-9]{6,}/g)||[]),publisherIds=new Set(bundle.match(/ca-pub-\d+/g)||[]);
  if(analyticsIds.size!==1||!analyticsIds.has(approvedAnalyticsId))throw new Error(`Production integration audit failed: unexpected Analytics IDs: ${[...analyticsIds].join(", ")}`);
  if(publisherIds.size!==1||!publisherIds.has(approvedAdsenseClient))throw new Error(`Production integration audit failed: unexpected AdSense publishers: ${[...publisherIds].join(", ")}`);
  for(const required of ["fundingchoicesmessages.google.com/i/pub-1986785092914105?ers=1","google-ad-blocking-measurement-loader","googlefcPresent"]){
    if(!bundle.includes(required))throw new Error(`Production integration audit failed: missing ad-blocking measurement value ${required}`);
  }
  console.log(`Production integrations verified: Analytics ${approvedAnalyticsId}, AdSense ${approvedAdsenseClient}, ${slot?`slot ${slot}`:"Auto ads"}, Google Privacy & messaging, ad-blocking measurement (recovery message unpublished; Offerwall disabled).`);
}

if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)await auditProductionIntegrations();
