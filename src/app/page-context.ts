export type PageMetaOptions={indexable?:boolean};
export type ResolvedPageMeta={title:string;description:string};
export type MetadataNode={tag:"meta"|"link";attributes:Record<string,string>};

export type PageMetadataModel={
  locale:string;
  documentTitle:string;
  description:string;
  canonical:string;
  nodes:MetadataNode[];
  structuredData:unknown|null;
};

export function seoSummary(lead:string,facts:string[]=[]){
  return [lead.replace(/\s+/g," ").trim().slice(0,180),...facts.filter(Boolean)]
    .join(" · ")
    .replace(/\s+/g," ")
    .trim()
    .slice(0,300);
}

export function buildPageMetadata<Locale extends string>({
  locale,
  locales,
  defaultLocale,
  route,
  siteName,
  origin,
  resolved,
  indexable=true,
  localizePath,
  hreflang,
  structuredData=null,
}:{
  locale:Locale;
  locales:readonly Locale[];
  defaultLocale:Locale;
  route:string;
  siteName:string;
  origin:string;
  resolved:ResolvedPageMeta;
  indexable?:boolean;
  localizePath:(locale:Locale,path:string)=>string;
  hreflang:(locale:Locale)=>string;
  structuredData?:unknown|null;
}):PageMetadataModel{
  const documentTitle=`${resolved.title} · ${siteName}`;
  const description=seoSummary(resolved.description,[resolved.title]);
  const canonical=`${origin}${localizePath(locale,route)}`;
  const socialImage=`${origin}/og-image.png`;
  const nodes:MetadataNode[]=[
    {tag:"meta",attributes:{name:"description",content:description}},
    {tag:"link",attributes:{rel:"canonical",href:canonical}},
    {tag:"meta",attributes:{property:"og:type",content:"website"}},
    {tag:"meta",attributes:{property:"og:title",content:documentTitle}},
    {tag:"meta",attributes:{property:"og:description",content:description}},
    {tag:"meta",attributes:{property:"og:url",content:canonical}},
    {tag:"meta",attributes:{property:"og:image",content:socialImage}},
    {tag:"meta",attributes:{name:"twitter:card",content:"summary_large_image"}},
    {tag:"meta",attributes:{name:"twitter:title",content:documentTitle}},
    {tag:"meta",attributes:{name:"twitter:description",content:description}},
    {tag:"meta",attributes:{name:"twitter:image",content:socialImage}}
  ];
  if(!indexable){
    nodes.push({tag:"meta",attributes:{name:"robots",content:"noindex, follow"}});
    return {locale,documentTitle,description,canonical,nodes,structuredData:null};
  }
  for(const alternateLocale of locales){
    nodes.push({tag:"link",attributes:{rel:"alternate",hreflang:hreflang(alternateLocale),href:`${origin}${localizePath(alternateLocale,route)}`}});
  }
  nodes.push({tag:"link",attributes:{rel:"alternate",hreflang:"x-default",href:`${origin}${localizePath(defaultLocale,route)}`}});
  return {locale,documentTitle,description,canonical,nodes,structuredData};
}

export function applyPageMetadata(targetDocument:Document,model:PageMetadataModel){
  targetDocument.documentElement.lang=model.locale;
  targetDocument.title=model.documentTitle;
  targetDocument.querySelectorAll("[data-dynamic-meta],[data-route-structured-data]").forEach(node=>node.remove());
  for(const node of model.nodes){
    const element=targetDocument.createElement(node.tag);
    Object.entries(node.attributes).forEach(([name,value])=>element.setAttribute(name,value));
    element.setAttribute("data-dynamic-meta","true");
    targetDocument.head.append(element);
  }
  if(model.structuredData){
    const script=targetDocument.createElement("script");
    script.type="application/ld+json";
    script.dataset.routeStructuredData="true";
    script.textContent=JSON.stringify(model.structuredData).replace(/</g,"\\u003c");
    targetDocument.head.append(script);
  }
}

export function createPageContext<Locale extends string>({
  targetDocument,
  site,
  locales,
  defaultLocale,
  getLocale,
  getRoute,
  localizePath,
  hreflang,
  normalizePath=(path:string)=>path,
  resolveMeta,
  createStructuredData
}:{
  targetDocument:Document;
  site:{name:string;origin:string};
  locales:readonly Locale[];
  defaultLocale:Locale;
  getLocale:()=>Locale;
  getRoute:()=>string;
  localizePath:(locale:Locale,path:string)=>string;
  hreflang:(locale:Locale)=>string;
  normalizePath?:(path:string)=>string;
  resolveMeta:(title:string,description:string)=>ResolvedPageMeta;
  createStructuredData:(title:string,description:string,canonical:string)=>unknown|null;
}){
  const href=(path:string)=>localizePath(getLocale(),normalizePath(path));
  const setMeta=(title:string,description:string,options:PageMetaOptions={})=>{
    const locale=getLocale(),route=getRoute(),canonicalRoute=normalizePath(route),resolved=resolveMeta(title,description),indexable=options.indexable!==false;
    const canonical=`${site.origin}${localizePath(locale,canonicalRoute)}`;
    const structuredData=indexable?createStructuredData(resolved.title,seoSummary(resolved.description,[resolved.title]),canonical):null;
    const model=buildPageMetadata({locale,locales,defaultLocale,route:canonicalRoute,siteName:site.name,origin:site.origin,resolved,indexable,localizePath,hreflang,structuredData});
    applyPageMetadata(targetDocument,model);
  };
  return {href,setMeta};
}
