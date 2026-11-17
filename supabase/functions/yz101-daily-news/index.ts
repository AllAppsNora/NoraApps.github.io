import {summarizeToday} from './summary.ts';
// YZ101 RSS aggregator: only feed-provided metadata and short excerpts unless a license explicitly permits reuse.
const sources=[
 {name:"Webrazzi",url:"https://webrazzi.com/feed/",host:"webrazzi.com",rank:0},
 {name:"Webtekno",url:"https://www.webtekno.com/rss.xml",host:"webtekno.com",rank:0},
 {name:"Technopat",url:"https://www.technopat.net/feed/",host:"technopat.net",rank:1},
 {name:"ShiftDelete",url:"https://shiftdelete.net/feed",host:"shiftdelete.net",rank:2},
 {name:"DonanımHaber",url:"https://www.donanimhaber.com/rss/tum/",host:"donanimhaber.com",rank:2}
];
const decode=(s:string)=>s.replace(/&(?:amp|lt|gt|quot|apos|nbsp);/g,x=>({"&amp;":"&","&lt;":"<","&gt;":">","&quot;":'"',"&apos;":"'","&nbsp;":" "}[x]||x)).replace(/&#(x[0-9a-f]+|\d+);/gi,(_,x)=>{const n=x[0].toLowerCase()==="x"?parseInt(x.slice(1),16):Number(x);return n>0&&n<=0x10ffff?String.fromCodePoint(n):""});
const clean=(s:string)=>decode(s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim());
const field=(s:string,name:string)=>{const pattern=new RegExp("<"+name+"(?:\\s[^>]*)?>([\\s\\S]*?)<\\/"+name+">","i");return clean(s.match(pattern)?.[1]||"")};
const raw=(s:string,name:string)=>{const pattern=new RegExp("<"+name+"(?:\\s[^>]*)?>([\\s\\S]*?)<\\/"+name+">","i");return s.match(pattern)?.[1]||""};
const ai=/yapay zek[aâ]|chatgpt|openai|anthropic|gemini|claude|makine öğren|llm|agentic ai|copilot|deepseek|grok|nvidia.*yapay/i;
async function rpc(action:string,data:unknown={},endpoint="yz101_news_sync"){const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");if(!key)throw Error("Missing service key");const r=await fetch(Deno.env.get("SUPABASE_URL")+"/rest/v1/rpc/"+endpoint,{method:"POST",headers:{apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({p_action:action,p_data:data})});if(!r.ok)throw Error("Database sync "+r.status);return r.json()}
Deno.serve(async(req)=>{
 if(req.method!=="POST")return new Response("POST required",{status:405});
 try{
 const claim=await rpc("claim");if(!claim.run)return Response.json({status:"not_due",summary:await summarizeToday((a,d)=>rpc(a,d,"yz101_news_summary"))});
 const items:any[]=[],errors:string[]=[];let healthy=0;
 await Promise.all(sources.map(async source=>{
  try{
   const r=await fetch(source.url,{signal:AbortSignal.timeout(15000),headers:{"User-Agent":"NoraApps-YZ101 RSS Reader/1.0"}});
   if(!r.ok)throw Error("HTTP "+r.status);
   const xml=await r.text();if(xml.length>3000000||!/<rss[\s>]/i.test(xml))throw Error("Invalid RSS");
   healthy++;
   for(const match of xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)){
    const item=match[1],title=field(item,"title"),description=field(item,"description"),content=field(item,"content:encoded"),url=field(item,"link");
    const published=Date.parse(field(item,"pubDate"));if(!Number.isFinite(published)||published>Date.now()||published<Date.now()-48*3600000)continue;
    if(!ai.test(title+" "+description.slice(0,500)))continue;
    let link:URL;try{link=new URL(url)}catch{continue}
    if(link.protocol!=="https:"||link.hostname.replace(/^www\./,"")!==source.host)continue;
    const license=field(item,"creativeCommons:license")||field(item,"cc:license")||field(item,"license");
    const reusable=/creativecommons\.org\/licenses\/(by|by-sa)\//i.test(license)||/creativecommons\.org\/publicdomain\/(zero|mark)\//i.test(license);
    const full=reusable?(content||description):"";
    // Unlicensed material is never mirrored in full; use only a short RSS excerpt.
    const excerpt=description.slice(0,300).trim();
    if(title.length<12||excerpt.length<35)continue;
    items.push({title,source_text:content||description,summary:excerpt,full_text:full.slice(0,25000),license:reusable?license:"",url:link.href,source:source.name,published_at:new Date(published).toISOString(),rank:source.rank,length:reusable?full.length:excerpt.length});
   }
  }catch(e){errors.push(source.name+": "+String(e).slice(0,120))}
 }));
 items.sort((a,b)=>a.rank-b.rank||b.length-a.length||Date.parse(b.published_at)-Date.parse(a.published_at));
 const result=await rpc("finish",{items:items.slice(0,40).map(({source_text,...item})=>item),healthy,errors});
 const summary=await summarizeToday((a,d)=>rpc(a,d,"yz101_news_summary"),items);
 return Response.json({...result,healthy,candidates:items.length,errors,summary});
 }catch(e){console.error("YZ101 RSS error",String(e));return Response.json({error:"News sync failed"},{status:500})}
});
