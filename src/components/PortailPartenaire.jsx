"use client";

import { useState, createContext, useContext, useMemo, useCallback } from "react";

// ── THÈME ─────────────────────────────────────────────────────
const T = {
  blue:"#4E92BD", blueL:"#6aadd4", blueXL:"#EBF5FB",
  white:"white",  orange:"#FF7A59", beige:"#FDF6EF", dark:"#1a2e44", navyL:"#2d4a6a",
  green:"#16a34a",greenD:"#166534",greenBg:"#dcfce7",
  amber:"#92400e",amberBg:"#fef3c7",
  purple:"#5b21b6",purpleBg:"#ede9fe",
  red:"#b91c1c",  redBg:"#fee2e2",
  gray:"#374151", grayBg:"#f3f4f6",
  muted:"var(--color-text-secondary)",
};
const slug = s => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g,"-").replace(/[^a-z0-9-]/g,"");

// ── COMMISSION ────────────────────────────────────────────────
const COMM_LABELS={souscription:"Fixe à la souscription",annuelle:"Fixe annuelle",biens:"Variable selon nb de biens",pct_ca:"% du CA généré"};
const DEFAULT_TRANCHES=()=>[{max:1,montant:50},{max:3,montant:80},{max:99,montant:120}];
const calcCommission=(rules=[],abonnes=0,biensMoyens=2,caParClient=300)=>{
  let total=0; const detail=[];
  for(const r of rules){
    if(!r.actif)continue;
    if(r.type==="souscription"){const m=r.montant*abonnes;total+=m;detail.push({label:"Souscription",calc:`${abonnes}×${r.montant}€`,montant:m});}
    if(r.type==="annuelle"){const m=r.montant*abonnes;total+=m;detail.push({label:"Annuelle",calc:`${abonnes}×${r.montant}€`,montant:m});}
    if(r.type==="biens"){const tr=(r.tranches||DEFAULT_TRANCHES()).find(x=>biensMoyens<=x.max)||(r.tranches||DEFAULT_TRANCHES()).slice(-1)[0];const m=tr.montant*abonnes;total+=m;detail.push({label:"Variable biens",calc:`${abonnes}×${tr.montant}€`,montant:m});}
    if(r.type==="pct_ca"&&r.pct>0){const m=Math.round(abonnes*caParClient*r.pct/100);total+=m;detail.push({label:`% CA (${r.pct}%)`,calc:`${abonnes}×${caParClient}€×${r.pct}%`,montant:m});}
  }
  return{total,detail};
};

// ── LIENS ─────────────────────────────────────────────────────
const buildSignupLink=(utm,code)=>`https://secure.qlower.com/signup?utm_source=${utm}&utm_medium=affiliation&utm_campaign=${code}`;
const buildRdvLink=(utm)=>`https://meetings-eu1.hubspot.com/qlower/accompagnement-declaration-fiscale-decouverte-qlower?utm_source=${utm}`;
const buildUtmLink=(utm,code)=>`https://www.qlower.com/qlower-x-partenaire?utm_source=${utm}&utm_medium=affiliation&utm_campaign=${code}`;

// ── HUBSPOT API ───────────────────────────────────────────────
// Token à stocker côté serveur en production — jamais en clair dans le front
const HS_API_TOKEN = "YOUR_HUBSPOT_PRIVATE_APP_TOKEN";
const HS_BASE = "https://api.hubapi.com";

// 1. Ajoute une valeur à la propriété énumérée partenaire__lead_
const hsAddPartnerProperty = async (partnerName) => {
  const res = await fetch(`${HS_BASE}/crm/v3/properties/contacts/partenaire__lead_`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${HS_API_TOKEN}`,
    },
    body: JSON.stringify({
      options: [{
        label: partnerName,
        value: slug(partnerName),
        displayOrder: -1,
        hidden: false,
      }],
    }),
  });
  if (!res.ok) throw new Error(`HubSpot property update failed: ${res.status}`);
  return res.json();
};

// 2. Crée un workflow qui tague automatiquement les leads entrants via l'UTM du partenaire
const hsCreateWorkflow = async (partnerName, utmValue) => {
  const res = await fetch(`${HS_BASE}/automation/v4/flows`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${HS_API_TOKEN}`,
    },
    body: JSON.stringify({
      name: `Leads ${partnerName}`,
      type: "CONTACT_BASED",
      enabled: true,
      enrollmentCriteria: {
        type: "AND",
        filters: [[{
          operator: "EQ",
          property: "utm_source",
          value: utmValue,
          filterType: "PROPERTY",
        }]],
      },
      actions: [{
        type: "SET_CONTACT_PROPERTY",
        propertyName: "partenaire__lead_",
        propertyValue: utmValue,
      }],
    }),
  });
  if (!res.ok) throw new Error(`HubSpot workflow creation failed: ${res.status}`);
  return res.json();
};

// 3. Orchestrateur — appelé à la fin de l'inscription
const hsOnboardPartner = async (partnerName, utmValue) => {
  const results = { property: null, workflow: null, errors: [] };
  try {
    results.property = await hsAddPartnerProperty(partnerName);
  } catch (e) {
    results.errors.push(`Propriété : ${e.message}`);
  }
  try {
    results.workflow = await hsCreateWorkflow(partnerName, utmValue);
  } catch (e) {
    results.errors.push(`Workflow : ${e.message}`);
  }
  return results;
};
const INIT_PARTNERS_DATA=[
  {id:"immoconsult",pwd:"demo1234",nom:"ImmoConsult",type:"agence-immo",contrat:"marque_blanche",code:"IMMO20",utm:"immoconsult",active:true,leads:52,abonnes:52,biensMoyens:2,caParClient:300,commObjAnnuel:600,commRules:[{type:"souscription",montant:50,actif:true},{type:"annuelle",montant:100,actif:true},{type:"biens",tranches:DEFAULT_TRANCHES(),actif:false},{type:"pct_ca",pct:0,actif:false}],hsSync:true,referralHistory:[{id:1,prenom:"Julie",nom:"Perrin",email:"julie@hotmail.fr",tel:"06 11 22 33 44",biens:"2-3",comment:"",date:"20 jan. 2026",statut:"HubSpot ✓"}],brandColor:"#4E92BD",brandLogo:"",accessFee:0},
  {id:"indep",pwd:"demo1234",nom:"Independant.io",type:"apporteur",contrat:"affiliation",code:"INDEP20",utm:"independantio",active:true,leads:30,abonnes:28,biensMoyens:2,caParClient:300,commObjAnnuel:500,commRules:[{type:"souscription",montant:0,actif:false},{type:"annuelle",montant:100,actif:true},{type:"biens",tranches:DEFAULT_TRANCHES(),actif:true},{type:"pct_ca",pct:0,actif:false}],hsSync:true,referralHistory:[],brandColor:"#4E92BD",brandLogo:"",accessFee:0},
  {id:"sedomicilier",pwd:"demo1234",nom:"SeDomicilier",type:"partenaire",contrat:"affiliation",code:"SEDO20",utm:"sedomicilier",active:false,leads:10,abonnes:0,biensMoyens:1,caParClient:300,commObjAnnuel:400,commRules:[{type:"souscription",montant:80,actif:true},{type:"annuelle",montant:0,actif:false},{type:"biens",tranches:DEFAULT_TRANCHES(),actif:false},{type:"pct_ca",pct:0,actif:false}],hsSync:false,referralHistory:[],brandColor:"#4E92BD",brandLogo:"",accessFee:0},
];
const CONTACTS_DATA={immoconsult:[
  {n:"Sophie Marchand",e:"s.marchand@gmail.com",src:"UTM",stage:"Abonne",mois:"Nov 2025",biens:2},
  {n:"Thomas Renaud",e:"t.renaud@orange.fr",src:"UTM",stage:"Payeur",mois:"Déc 2025",biens:1},
  {n:"Julie Perrin",e:"jperrin@hotmail.fr",src:"Manuel",stage:"Abonne",mois:"Jan 2026",biens:3},
  {n:"Marc Aubert",e:"m.aubert@gmail.com",src:"Promo",stage:"Non payeur",mois:"Fév 2026",biens:1},
  {n:"Céline Morin",e:"c.morin@live.fr",src:"Manuel",stage:"Payeur",mois:"Mar 2026",biens:4},
]};
const MONTHLY_DATA={immoconsult:[{m:"Oct",leads:1,abonnes:0},{m:"Nov",leads:2,abonnes:1},{m:"Déc",leads:1,abonnes:1},{m:"Jan",leads:3,abonnes:1},{m:"Fév",leads:1,abonnes:0},{m:"Mar",leads:2,abonnes:1}]};
const ACTION_LOG={immoconsult:[{date:"14 jan. 2026",type:"lien",label:"Lien UTM partagé par email à 8 contacts"},{date:"20 jan. 2026",type:"contact",label:"Contact transmis : Julie Perrin"},{date:"12 mar. 2026",type:"contact",label:"Contact transmis : Marc Aubert"}]};
const INVOICES_DATA=[{id:"AFF-2025-001",date:"01/01/2025",montant:300,statut:"Payee"},{id:"AFF-2026-001",date:"01/01/2026",montant:200,statut:"En attente"}];
const BENCHMARK={"agence-immo":{taux:18,label:"agences immobilières"},cgp:{taux:24,label:"CGP"},conciergerie:{taux:21,label:"conciergeries"},default:{taux:19,label:"partenaires similaires"}};
const METIERS=["Agent immobilier","CGP","Expert-comptable","Syndic","Conciergerie","Courtier","Autre"];
const PARTNER_TYPES=["cgp","agence-immo","apporteur","courtier","conciergerie","influenceur","autre"];
const STAGE_S={"Abonne":{c:T.greenD,bg:T.greenBg},"Payeur":{c:T.amber,bg:T.amberBg},"Non payeur":{c:T.gray,bg:T.grayBg}};
const SRC_S={"UTM":{c:"#1e40af",bg:"#dbeafe"},"Manuel":{c:T.purple,bg:T.purpleBg},"Promo":{c:T.amber,bg:T.amberBg}};

// ── CONTEXTE ──────────────────────────────────────────────────
const PartnerCtx=createContext({});
const usePartner=()=>useContext(PartnerCtx);

// ── UI ────────────────────────────────────────────────────────
const Inp=({v,s,ph,t="text",ex={}})=><input type={t} value={v} onChange={e=>s(e.target.value)} placeholder={ph} style={{width:"100%",padding:"8px 10px",borderRadius:7,border:"1.5px solid var(--color-border-secondary)",background:"var(--color-background-primary)",color:"var(--color-text-primary)",fontSize:13,boxSizing:"border-box",...ex}}/>;
const PwdInp=({v,s,ph})=>{const[show,setShow]=useState(false);return(<div style={{position:"relative"}}><input type={show?"text":"password"} value={v} onChange={e=>s(e.target.value)} placeholder={ph} style={{width:"100%",padding:"8px 36px 8px 10px",borderRadius:7,border:"1.5px solid var(--color-border-secondary)",background:"var(--color-background-primary)",color:"var(--color-text-primary)",fontSize:13,boxSizing:"border-box"}}/><span onClick={()=>setShow(x=>!x)} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",cursor:"pointer",fontSize:13,color:T.muted,userSelect:"none"}}>{show?"🙈":"👁"}</span></div>);};
const Sel=({v,s,opts})=><select value={v} onChange={e=>s(e.target.value)} style={{width:"100%",padding:"8px 10px",borderRadius:7,border:"1.5px solid var(--color-border-secondary)",background:"var(--color-background-primary)",color:"var(--color-text-primary)",fontSize:13,boxSizing:"border-box"}}>{opts.map(o=><option key={o.v||o} value={o.v||o}>{o.l||o}</option>)}</select>;
const lbl=t=><div style={{fontSize:11,fontWeight:500,color:T.muted,marginBottom:4,textTransform:"uppercase",letterSpacing:".4px"}}>{t}</div>;
const Btn=({children,onClick,variant="primary",disabled,sx={}})=><button onClick={onClick} disabled={disabled} style={{padding:"8px 18px",borderRadius:8,border:variant==="outline"?`1.5px solid ${T.blue}`:variant==="orange_outline"?`1.5px solid ${T.orange}`:"none",background:variant==="primary"?T.blue:variant==="success"?T.green:variant==="orange"?T.orange:["outline","orange_outline","ghost"].includes(variant)?"transparent":"var(--color-background-secondary)",color:["primary","success","orange"].includes(variant)?T.white:variant==="outline"?T.blue:variant==="orange_outline"?T.orange:T.muted,fontSize:13,fontWeight:600,cursor:disabled?"not-allowed":"pointer",opacity:disabled?.6:1,...sx}}>{children}</button>;
const Card=({children,sx={}})=><div style={{background:"var(--color-background-secondary)",borderRadius:12,padding:18,border:"1px solid var(--color-border-tertiary)",...sx}}>{children}</div>;
const Stat=({icon,val,label,color,sub})=><div style={{background:"var(--color-background-secondary)",borderRadius:10,padding:"12px 8px",textAlign:"center",border:"1px solid var(--color-border-tertiary)"}}><div style={{fontSize:18}}>{icon}</div><div style={{fontSize:20,fontWeight:700,color,marginTop:2}}>{val}</div><div style={{fontSize:11,color:T.muted,marginTop:2,lineHeight:1.3}}>{label}</div>{sub&&<div style={{fontSize:10,color:T.muted,marginTop:2,opacity:.7}}>{sub}</div>}</div>;
const Hdg=({title,sub,color})=><div style={{background:color?`linear-gradient(135deg,${color},${color}cc)`:`linear-gradient(135deg,${T.blue},${T.blueL})`,borderRadius:12,padding:"14px 20px",marginBottom:16,color:T.white}}><div style={{fontSize:16,fontWeight:700}}>{title}</div>{sub&&<div style={{fontSize:11,opacity:.85,marginTop:2}}>{sub}</div>}</div>;
const Tag=({label,c,bg})=><span style={{fontSize:11,fontWeight:500,color:c,background:bg,padding:"2px 8px",borderRadius:20,whiteSpace:"nowrap"}}>{label}</span>;
const Alert=({children,type="info",sx={}})=>{const s={info:{bg:T.blueXL,b:T.blue,c:T.dark},success:{bg:T.greenBg,b:T.green,c:T.greenD},warning:{bg:T.amberBg,b:"#fbbf24",c:T.amber},error:{bg:T.redBg,b:T.red,c:T.red}}[type]||{bg:T.blueXL,b:T.blue,c:T.dark};return <div style={{background:s.bg,border:`1px solid ${s.b}`,borderRadius:8,padding:"10px 14px",fontSize:12,color:s.c,lineHeight:1.7,...sx}}>{children}</div>;};
const CopyBtn=({text,label,onCopied,sx={}})=>{const[cp,setCp]=useState(false);return <button onClick={()=>{navigator.clipboard.writeText(text).catch(()=>{});setCp(true);if(onCopied)onCopied();setTimeout(()=>setCp(false),2000);}} style={{padding:"6px 14px",borderRadius:7,border:"none",background:cp?T.green:T.blue,color:T.white,fontSize:12,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap",...sx}}>{cp?"Copié !":label}</button>;};

// ── GRAPHIQUE ─────────────────────────────────────────────────
function BarChart({data,h=110}){
  const[hov,setHov]=useState(null);
  const max=Math.max(...data.map(d=>Math.max(d.leads,d.abonnes)),1);
  return(
    <div style={{position:"relative"}}>
      {hov!==null&&<div style={{position:"absolute",top:0,left:`${(hov/data.length)*100+50/data.length}%`,transform:"translateX(-50%)",background:T.dark,color:T.white,borderRadius:7,padding:"6px 10px",fontSize:11,zIndex:10,whiteSpace:"nowrap",pointerEvents:"none"}}>
        <div style={{fontWeight:600,marginBottom:2}}>{data[hov].m}</div>
        <div style={{opacity:.8}}>Leads : <strong style={{color:"#cbd5e1"}}>{data[hov].leads}</strong></div>
        <div style={{opacity:.8}}>Abonnés : <strong style={{color:T.blueL}}>{data[hov].abonnes}</strong></div>
        {data[hov].comm!==undefined&&<div style={{opacity:.8}}>Commission : <strong style={{color:"#86efac"}}>{data[hov].comm} €</strong></div>}
      </div>}
      <div style={{display:"flex",alignItems:"flex-end",gap:6,height:h,paddingTop:28}}>
        {data.map((d,i)=>(
          <div key={i} onMouseEnter={()=>setHov(i)} onMouseLeave={()=>setHov(null)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2,height:"100%",justifyContent:"flex-end",cursor:"default"}}>
            <div style={{width:"100%",display:"flex",gap:2,alignItems:"flex-end",justifyContent:"center",flex:1}}>
              {[{val:d.leads,c:hov===i?"#94a3b8":"var(--color-border-secondary)"},{val:d.abonnes,c:hov===i?T.blueL:T.blue}].map((bar,j)=>(
                <div key={j} style={{flex:1,position:"relative",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",height:"100%"}}>
                  <div style={{position:"absolute",top:-16,fontSize:9,color:j===0?T.muted:T.blue,fontWeight:600}}>{bar.val}</div>
                  <div style={{width:"100%",background:bar.c,borderRadius:"3px 3px 0 0",height:Math.max(4,(bar.val/max)*100)+"%",transition:"background .15s"}}/>
                </div>
              ))}
            </div>
            <div style={{fontSize:9,color:T.muted}}>{d.m}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── SIMULATEUR HOMEPAGE (avec pricing) ────────────────────────
function Simulateur(){
  const[clients,setClients]=useState(30);
  const[taux,setTaux]=useState(20);
  const[model,setModel]=useState("gratuit"); // gratuit | mensuel | annuel
  const abonnes=Math.round(clients*taux/100);
  const commBrute=abonnes*100;
  const fraisMap={gratuit:0,mensuel:29*12,annuel:249};
  const frais=fraisMap[model]||0;
  const commNette=Math.max(commBrute-frais,0);
  // HIDDEN v8 : pricing models (mensuel/annuel) — à réactiver quand la MB sera ouverte
  // const MODELS=[
  //   {key:"gratuit",label:"Accès gratuit",desc:"Commission réduite à la souscription",frais:0,note:"0 € / an"},
  //   {key:"mensuel",label:"Abonnement mensuel",desc:"Commission pleine · accès toutes features",frais:29,note:"29 € / mois"},
  //   {key:"annuel", label:"Abonnement annuel", desc:"Commission pleine · -28% vs mensuel",frais:249,note:"249 € / an"},
  // ];
  const MODELS=[
    {key:"gratuit",label:"Accès gratuit",desc:"Accès complet · aucun abonnement requis",frais:0},
  ];
  return(
    <div style={{background:`linear-gradient(135deg,${T.dark},${T.navyL})`,borderRadius:16,padding:"24px 22px",marginBottom:20,color:T.white,position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:-40,right:-40,width:160,height:160,borderRadius:"50%",background:"rgba(255,255,255,.04)"}}/>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}><span style={{fontSize:18}}>🧮</span><div style={{fontWeight:700,fontSize:15}}>Simulateur de revenus</div></div>
      <div style={{fontSize:12,opacity:.6,marginBottom:18}}>Estimez ce que vous pouvez générer selon votre portefeuille et votre formule d'accès</div>

      {/* Modèle de pricing */}
      <div style={{marginBottom:18}}>
        <div style={{fontSize:12,opacity:.75,marginBottom:8}}>Formule d'accès à la plateforme</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
          {MODELS.map(m=>(
            <div key={m.key} onClick={()=>setModel(m.key)} style={{padding:"10px 12px",borderRadius:10,cursor:"pointer",border:`1.5px solid ${model===m.key?"rgba(255,255,255,.6)":"rgba(255,255,255,.15)"}`,background:model===m.key?"rgba(255,255,255,.12)":"rgba(255,255,255,.05)",transition:"all .15s"}}>
              <div style={{fontWeight:600,fontSize:12,marginBottom:2}}>{m.label}</div>
              <div style={{fontSize:11,opacity:.65,marginBottom:4}}>{m.desc}</div>
              <div style={{fontSize:13,fontWeight:700,color:model===m.key?"white":T.blueL}}>{m.note}</div>
            </div>
          ))}
        </div>
        {model!=="gratuit"&&<div style={{marginTop:8,fontSize:11,opacity:.55,padding:"6px 10px",background:"rgba(255,255,255,.05)",borderRadius:6}}>
          Avec la formule {model==="mensuel"?"mensuelle":"annuelle"}, vous accédez à la commission pleine (100 €/abonné) + features avancées (campagnes, MB, exports).
        </div>}
      </div>

      {/* Sliders */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:18}}>
        {[{label:"Clients LMNP dans mon portefeuille",val:clients,set:setClients,min:5,max:200,step:5,display:String(clients)},
          {label:"Taux de conversion estimé",val:taux,set:setTaux,min:5,max:50,step:5,display:taux+"%"}].map((sl,i)=>(
          <div key={i}><div style={{fontSize:12,opacity:.75,marginBottom:8}}>{sl.label}</div>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <input type="range" min={sl.min} max={sl.max} step={sl.step} value={sl.val} onChange={e=>sl.set(Number(e.target.value))} style={{flex:1,accentColor:T.blueL}}/>
              <span style={{fontSize:18,fontWeight:700,minWidth:42,textAlign:"right",color:T.blueL}}>{sl.display}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Résultats */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8}}>
        <div style={{background:"rgba(255,255,255,.08)",borderRadius:10,padding:"12px 10px",textAlign:"center"}}>
          <div style={{fontSize:11,opacity:.65,marginBottom:4}}>Clients convertis</div>
          <div style={{fontSize:22,fontWeight:700,color:T.blueL}}>{abonnes}</div>
        </div>
        <div style={{background:"rgba(255,255,255,.08)",borderRadius:10,padding:"12px 10px",textAlign:"center"}}>
          <div style={{fontSize:11,opacity:.65,marginBottom:4}}>Commission brute</div>
          <div style={{fontSize:22,fontWeight:700}}>{commBrute.toLocaleString("fr-FR")} €</div>
        </div>
        <div style={{background:"rgba(255,255,255,.08)",borderRadius:10,padding:"12px 10px",textAlign:"center"}}>
          <div style={{fontSize:11,opacity:.65,marginBottom:4}}>Coût plateforme</div>
          <div style={{fontSize:22,fontWeight:700,color:frais>0?"#fca5a5":"rgba(255,255,255,.4)"}}>{frais>0?`- ${frais} €`:"0 €"}</div>
        </div>
        <div style={{background:"rgba(255,255,255,.15)",borderRadius:10,padding:"12px 10px",textAlign:"center",border:"1.5px solid rgba(255,255,255,.3)"}}>
          <div style={{fontSize:11,opacity:.65,marginBottom:4}}>Revenu net annuel</div>
          <div style={{fontSize:22,fontWeight:700,color:commNette>0?T.white:"#fca5a5"}}>{commNette.toLocaleString("fr-FR")} €</div>
        </div>
      </div>
      {frais>0&&commBrute>0&&(
        <div style={{marginTop:10,padding:"8px 12px",background:"rgba(255,255,255,.06)",borderRadius:7,fontSize:11,opacity:.7}}>
          Seuil de rentabilité : <strong>{Math.ceil(frais/100)} abonnés</strong> suffisent à couvrir le coût d'accès. Vous en avez {abonnes} — {abonnes>Math.ceil(frais/100)?"✓ rentable dès maintenant.":"encore "+Math.max(0,Math.ceil(frais/100)-abonnes)+" à convertir pour couvrir le coût."}
        </div>
      )}
      <div style={{fontSize:11,opacity:.4,textAlign:"center"}}>Commission fixe versée pour chaque 1re souscription de vos clients · accès à la plateforme gratuit</div>
    </div>
  );
}

// ── HOME ──────────────────────────────────────────────────────
function HomePage({onRegister,onLogin}){
  const AVANTAGES=[
    {icon:"💰",title:"Commission à la souscription",desc:"Touchez une commission fixe pour chaque client référé qui souscrit à Qlower pour la première fois"},
    {icon:"📊",title:"Dashboard temps réel",        desc:"Leads, conversions et commissions en direct"},
    {icon:"🔗",title:"3 façons de référer",         desc:"Lien direct, formulaire de contact ou lien de RDV"},
  ];
  const STEPS=[{n:"1",t:"Rejoignez le programme",d:"Remplissez le formulaire · Coline vous contacte pour finaliser votre contrat"},{n:"2",t:"Recevez votre kit",d:"Lien affilié, code promo, templates — tout de suite après signature"},{n:"3",t:"Référez vos clients",d:"3 options : lien direct, formulaire ou lien de RDV"},{n:"4",t:"Touchez votre commission",d:"Commission fixe versée pour chaque 1re souscription de vos clients"}];
  const TEMOS=[{nom:"ImmoConsult",role:"Agence immobilière",txt:"Qlower nous a permis d'apporter une vraie valeur fiscale à nos clients investisseurs. Simple et efficace."},{nom:"Cabinet Martin",role:"CGP",txt:"Programme transparent, suivi en temps réel, commissions régulières."},{nom:"Hestia Conciergerie",role:"Conciergerie",txt:"Nos clients LMNP adorent. Ça renforce notre position de partenaire global."}];
  return(
    <div style={{fontFamily:"Inter,sans-serif",color:T.dark}}>
      <div style={{background:T.beige,borderRadius:16,padding:"28px 24px",marginBottom:20}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
          <div style={{width:30,height:30,borderRadius:7,background:T.blue,display:"flex",alignItems:"center",justifyContent:"center",color:T.white,fontSize:15,fontWeight:700}}>Q</div>
          <span style={{fontWeight:700,fontSize:14}}>Qlower Pro</span>
          <span style={{fontSize:11,background:"rgba(78,146,189,.12)",color:T.blue,padding:"2px 8px",borderRadius:20,fontWeight:500}}>Programme Partenaires</span>
        </div>
        <h1 style={{fontSize:20,fontWeight:700,lineHeight:1.35,margin:"0 0 10px 0"}}>Monétisez votre portefeuille clients en leur offrant la meilleure solution fiscale LMNP</h1>
        <div style={{display:"flex",gap:16,flexWrap:"wrap",marginBottom:18}}>
          {["Commission fixe à la 1re souscription","Accès gratuit à la plateforme","Kit de démarrage inclus"].map((t,i)=>(
            <div key={i} style={{fontSize:12,color:"#4a5568",display:"flex",alignItems:"center",gap:5}}><span style={{color:T.green,fontWeight:700}}>✓</span>{t}</div>
          ))}
        </div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <button onClick={onRegister} style={{padding:"12px 24px",borderRadius:10,border:"none",background:T.blue,color:T.white,fontSize:13,fontWeight:700,cursor:"pointer",boxShadow:"0 4px 14px rgba(78,146,189,.3)"}}>Devenir partenaire — gratuit</button>
          <button onClick={onLogin} style={{padding:"12px 18px",borderRadius:10,border:`2px solid ${T.dark}`,background:"transparent",color:T.dark,fontSize:13,fontWeight:600,cursor:"pointer"}}>J'ai déjà un compte</button>
        </div>
      </div>
      <Simulateur/>
      <div style={{marginBottom:20}}>
        <div style={{fontSize:15,fontWeight:700,marginBottom:12}}>Pourquoi rejoindre Qlower Pro ?</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {AVANTAGES.map((a,i)=><div key={i} style={{background:"var(--color-background-secondary)",borderRadius:10,padding:14,border:"1px solid var(--color-border-tertiary)"}}><div style={{fontSize:20,marginBottom:6}}>{a.icon}</div><div style={{fontWeight:600,fontSize:13,marginBottom:3}}>{a.title}</div><div style={{fontSize:11,color:T.muted,lineHeight:1.5}}>{a.desc}</div></div>)}
        </div>
      </div>
      <div style={{marginBottom:20}}>
        <div style={{fontSize:15,fontWeight:700,marginBottom:12}}>Comment ça marche ?</div>
        <div style={{display:"flex",flexDirection:"column",gap:7}}>
          {STEPS.map((s,i)=><div key={i} style={{display:"flex",alignItems:"flex-start",gap:12,padding:"10px 14px",background:"var(--color-background-secondary)",borderRadius:10,border:"1px solid var(--color-border-tertiary)"}}><div style={{width:26,height:26,borderRadius:"50%",background:T.blue,color:T.white,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,flexShrink:0}}>{s.n}</div><div><div style={{fontWeight:600,fontSize:13}}>{s.t}</div><div style={{fontSize:11,color:T.muted,marginTop:2}}>{s.d}</div></div></div>)}
        </div>
      </div>
      <div style={{marginBottom:20}}>
        <div style={{fontSize:15,fontWeight:700,marginBottom:10}}>Ils nous font confiance</div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {TEMOS.map((t,i)=><div key={i} style={{background:T.beige,borderRadius:10,padding:"12px 14px",border:"1px solid #e2d9cf"}}><div style={{fontSize:12,color:"#4a5568",lineHeight:1.6,marginBottom:6,fontStyle:"italic"}}>"{t.txt}"</div><div style={{fontWeight:600,fontSize:12}}>{t.nom}</div><div style={{fontSize:11,color:T.muted}}>{t.role}</div></div>)}
        </div>
      </div>
      <div style={{background:`linear-gradient(135deg,${T.blue},${T.blueL})`,borderRadius:14,padding:"22px 20px",textAlign:"center",color:T.white}}>
        <div style={{fontSize:16,fontWeight:700,marginBottom:6}}>Rejoignez l'écosystème Qlower</div>
        <div style={{fontSize:12,opacity:.85,marginBottom:16,lineHeight:1.6}}>Gestionnaire, conciergerie, agent, CGP, experts-comptables : aidons vos clients à payer moins d'impôts.</div>
        <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
          <button onClick={onRegister} style={{padding:"11px 22px",borderRadius:10,border:"none",background:T.white,color:T.blue,fontSize:13,fontWeight:700,cursor:"pointer"}}>Créer mon espace partenaire</button>
          <button onClick={onLogin} style={{padding:"11px 18px",borderRadius:10,border:"1px solid rgba(255,255,255,.5)",background:"rgba(255,255,255,.15)",color:T.white,fontSize:13,fontWeight:500,cursor:"pointer"}}>Se connecter</button>
        </div>
      </div>
    </div>
  );
}

// ── LOGIN ─────────────────────────────────────────────────────
function LoginForm({onLogin,onBack,onRegister,partners}){
  const[id,setId]=useState("");const[pwd,setPwd]=useState("");const[err,setErr]=useState("");const[resetSent,setResetSent]=useState(false);
  const doLogin=()=>{
    setErr("");
    if(!id.trim()){setErr("Veuillez saisir votre identifiant");return;}
    if(!pwd){setErr("Veuillez saisir votre mot de passe");return;}
    if(id.trim()==="admin"&&pwd==="admin2026"){onLogin({type:"admin"});return;}
    const p=partners.find(p=>p.id===id.trim().toLowerCase());
    if(p&&pwd===p.pwd){onLogin({type:"partner",partnerId:p.id});return;}
    setErr("Identifiant ou mot de passe incorrect");
  };
  return(
    <div style={{fontFamily:"Inter,sans-serif",maxWidth:440,margin:"0 auto",padding:"16px 0",color:"var(--color-text-primary)"}}>
      <button onClick={onBack} style={{background:"none",border:"none",color:T.blue,fontSize:13,cursor:"pointer",marginBottom:20,padding:0}}>← Retour</button>
      <div style={{textAlign:"center",marginBottom:24}}>
        <div style={{width:48,height:48,borderRadius:12,background:T.blue,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 10px",color:T.white,fontSize:22,fontWeight:700}}>Q</div>
        <div style={{fontSize:20,fontWeight:700,color:T.dark}}>Qlower Pro</div>
        <div style={{fontSize:13,color:T.muted,marginTop:3}}>Connectez-vous à votre espace partenaire</div>
      </div>
      <Card>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div>{lbl("Identifiant")}<Inp v={id} s={setId} ph="Votre identifiant"/></div>
          <div>{lbl("Mot de passe")}<PwdInp v={pwd} s={setPwd} ph="••••••••"/></div>
          {err&&<Alert type="error">{err}</Alert>}
          {resetSent&&<Alert type="success">Lien de réinitialisation envoyé.</Alert>}
          <Btn onClick={doLogin}>Se connecter</Btn>
          <button onClick={()=>{if(!id.trim()){setErr("Saisissez votre identifiant");return;}setErr("");setResetSent(true);}} style={{background:"none",border:"none",color:T.blue,fontSize:12,cursor:"pointer",textDecoration:"underline",padding:0,textAlign:"left"}}>Mot de passe oublié ?</button>
        </div>
        <div style={{marginTop:16,padding:"10px 12px",background:"var(--color-background-tertiary)",borderRadius:8,fontSize:11,color:T.muted,lineHeight:1.9}}>
          Demo MB : <code style={{background:"var(--color-background-secondary)",padding:"1px 4px",borderRadius:3}}>immoconsult</code> / <code style={{background:"var(--color-background-secondary)",padding:"1px 4px",borderRadius:3}}>demo1234</code><br/>
          Demo AF : <code style={{background:"var(--color-background-secondary)",padding:"1px 4px",borderRadius:3}}>indep</code> / <code style={{background:"var(--color-background-secondary)",padding:"1px 4px",borderRadius:3}}>demo1234</code>
        </div>
      </Card>
      <div style={{textAlign:"center",marginTop:16,fontSize:13,color:T.muted}}>Pas encore partenaire ?{" "}<button onClick={onRegister} style={{background:"none",border:"none",color:T.blue,fontSize:13,cursor:"pointer",textDecoration:"underline",padding:0,fontWeight:600}}>Rejoindre le programme</button></div>
    </div>
  );
}

// ── ONBOARDING INSCRIPTION ────────────────────────────────────
function Onboarding({onDone,onCancel}){
  const[step,setStep]=useState(0);
  const[prenom,setPrenom]=useState("");const[nom,setNom]=useState("");const[email,setEmail]=useState("");const[pwd,setPwd]=useState("");const[pwdC,setPwdC]=useState("");
  const[company,setCompany]=useState("");const[metier,setMetier]=useState("Agent immobilier");
  const[siret,setSiret]=useState("");const[tva,setTva]=useState("");const[capital,setCapital]=useState("");const[adresse,setAdresse]=useState("");
  const[cNom,setCNom]=useState("");const[cEmail,setCEmail]=useState("");const[cfNom,setCfNom]=useState("");const[cfEmail,setCfEmail]=useState("");
  const[siretOk,setSiretOk]=useState(false);const[kbisOk,setKbisOk]=useState(false);
  const[codePromo,setCodePromo]=useState("");const[contrat,setContrat]=useState("affiliation");
  const[signed,setSigned]=useState(false);const[iban,setIban]=useState("");const[bic,setBic]=useState("");
  const fakeSiret=()=>{if(siret.length<5)return;setTimeout(()=>{setTva("FR76123456789");setCapital("10 000 EUR");setAdresse("12 rue de la Paix, 75001 Paris");if(!company)setCompany("Cabinet Martin SAS");setSiretOk(true);},700);};
  const autoCode=()=>{const b=(nom||company||"").toUpperCase().replace(/\s/g,"").slice(0,4);if(b)setCodePromo(b+"20");};
  const STEPS=["Compte","Infos légales","Documents","Contrat","RIB","Kit"];
  return(
    <div style={{fontFamily:"Inter,sans-serif",color:"var(--color-text-primary)"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
        <button onClick={onCancel} style={{background:"none",border:"1.5px solid var(--color-border-secondary)",color:T.muted,fontSize:12,cursor:"pointer",padding:"5px 12px",borderRadius:7}}>✕ Annuler</button>
        <div style={{fontSize:11,color:T.muted}}>Étape {step+1}/{STEPS.length} · ~10 min</div>
      </div>
      <Hdg title="Rejoindre Qlower Pro" sub="Inscription complète · tout en ligne · contrat signé électroniquement"/>
      <div style={{display:"flex",alignItems:"center",marginBottom:20,gap:2,overflowX:"auto"}}>
        {STEPS.map((s,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",flex:i<STEPS.length-1?1:"auto"}}>
            <div style={{display:"flex",alignItems:"center",gap:4,flexShrink:0}}>
              <div style={{width:22,height:22,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,flexShrink:0,background:step>i?T.green:step===i?T.blue:"var(--color-background-tertiary)",color:step>=i?T.white:T.muted}}>{step>i?"✓":i+1}</div>
              <span style={{fontSize:10,fontWeight:step===i?600:400,whiteSpace:"nowrap",color:step===i?"var(--color-text-primary)":T.muted}}>{s}</span>
            </div>
            {i<STEPS.length-1&&<div style={{flex:1,minWidth:8,height:2,margin:"0 4px",borderRadius:2,background:step>i?T.green:"var(--color-border-secondary)"}}/>}
          </div>
        ))}
      </div>
      <Card>
        {step===0&&<div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div style={{fontWeight:600,fontSize:14,marginBottom:4}}>Créez votre espace partenaire</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><div>{lbl("Prénom")}<Inp v={prenom} s={setPrenom} ph="Marie"/></div><div>{lbl("Nom")}<Inp v={nom} s={setNom} ph="Martin"/></div></div>
          <div>{lbl("Email professionnel")}<Inp v={email} s={setEmail} ph="marie@cabinet.fr" t="email"/></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><div>{lbl("Mot de passe")}<PwdInp v={pwd} s={setPwd} ph="••••••••"/></div><div>{lbl("Confirmation")}<PwdInp v={pwdC} s={setPwdC} ph="••••••••"/></div></div>
          <div>{lbl("Nom de l'entreprise")}<Inp v={company} s={setCompany} ph="Cabinet Martin SAS"/></div>
          <div>{lbl("Votre métier")}<Sel v={metier} s={setMetier} opts={METIERS}/></div>
          <Btn onClick={()=>setStep(1)}>Continuer</Btn>
        </div>}
        {step===1&&<div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div style={{fontWeight:600,fontSize:14,marginBottom:4}}>Informations légales</div>
          <div>{lbl("SIRET")}<div style={{display:"flex",gap:8}}><input value={siret} onChange={e=>setSiret(e.target.value)} placeholder="123 456 789 00012" style={{flex:1,padding:"8px 10px",borderRadius:7,border:`1.5px solid ${siretOk?T.green:"var(--color-border-secondary)"}`,background:"var(--color-background-primary)",color:"var(--color-text-primary)",fontSize:13}}/><Btn variant="outline" onClick={fakeSiret}>Rechercher</Btn></div>{siretOk&&<div style={{fontSize:11,color:T.green,marginTop:3}}>✓ Entreprise trouvée</div>}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><div>{lbl("TVA")}<Inp v={tva} s={setTva} ph="FR76..."/></div><div>{lbl("Capital social")}<Inp v={capital} s={setCapital} ph="10 000 EUR"/></div></div>
          <div>{lbl("Adresse du siège")}<Inp v={adresse} s={setAdresse} ph="12 rue de la Paix, 75001 Paris"/></div>
          <div style={{borderTop:"1px solid var(--color-border-tertiary)",paddingTop:12}}><div style={{fontWeight:500,fontSize:13,marginBottom:8}}>Contact suivi <span style={{fontSize:11,fontWeight:400,color:T.muted}}>— interlocuteur Qlower</span></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><div>{lbl("Nom prénom")}<Inp v={cNom} s={setCNom} ph="Marie Martin"/></div><div>{lbl("Email")}<Inp v={cEmail} s={setCEmail} ph="marie@cabinet.fr" t="email"/></div></div></div>
          <div style={{borderTop:"1px solid var(--color-border-tertiary)",paddingTop:12}}><div style={{fontWeight:500,fontSize:13,marginBottom:8}}>Contact facturation <span style={{fontSize:11,fontWeight:400,color:T.muted}}>— si différent</span></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><div>{lbl("Nom prénom")}<Inp v={cfNom} s={setCfNom} ph="Paul Martin"/></div><div>{lbl("Email")}<Inp v={cfEmail} s={setCfEmail} ph="compta@cabinet.fr" t="email"/></div></div></div>
          <div style={{display:"flex",gap:8}}><Btn variant="ghost" onClick={()=>setStep(0)}>Retour</Btn><Btn onClick={()=>setStep(2)}>Continuer</Btn></div>
        </div>}
        {step===2&&<div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{fontWeight:600,fontSize:14,marginBottom:4}}>Documents et code promo</div>
          <div onClick={()=>setKbisOk(true)} style={{border:`2px dashed ${kbisOk?T.green:"var(--color-border-secondary)"}`,borderRadius:8,padding:16,textAlign:"center",cursor:"pointer",background:kbisOk?"#f0fdf4":"var(--color-background-tertiary)"}}>{kbisOk?<div style={{color:T.green,fontSize:13,fontWeight:500}}>✓ Kbis validé</div>:<><div style={{fontSize:20,marginBottom:4}}>📁</div><div style={{fontSize:12,color:T.muted}}>Glisser votre Kbis · PDF</div></>}</div>
          <div>{lbl("Votre code promo client")}<div style={{display:"flex",gap:8}}><div style={{flex:1}}><Inp v={codePromo} s={setCodePromo} ph="ex: MARTIN20"/></div><Btn variant="outline" onClick={autoCode} sx={{whiteSpace:"nowrap"}}>Auto</Btn></div>{codePromo&&<Alert type="info" sx={{marginTop:6}}>Code <strong>{codePromo}</strong> — -20 € pour vos clients</Alert>}</div>
          {/* HIDDEN v8 : choix du type de partenariat — MB cachée, affiliation par défaut
          <div>{lbl("Type de partenariat")}<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:4}}>{[{v:"affiliation",icon:"🔗",t:"Affiliation",d:"Commission définie au contrat"},{v:"marque_blanche",icon:"🏷",t:"Marque Blanche",d:"50 clients/an requis"}].map(o=><div key={o.v} onClick={()=>setContrat(o.v)} style={{padding:12,borderRadius:10,cursor:"pointer",border:`2px solid ${contrat===o.v?T.blue:"var(--color-border-secondary)"}`,background:contrat===o.v?T.blueXL:"var(--color-background-primary)"}}><div style={{fontSize:18,marginBottom:3}}>{o.icon}</div><div style={{fontWeight:600,fontSize:12,color:contrat===o.v?T.blue:"var(--color-text-primary)"}}>{o.t}</div><div style={{fontSize:11,color:T.muted,marginTop:2}}>{o.d}</div></div>)}</div></div>
          */}
          <Alert type="info">Vous rejoignez le programme en tant qu'<strong>affilié</strong> · votre contrat sera établi par Coline à l'étape suivante.</Alert>
          <div style={{display:"flex",gap:8}}><Btn variant="ghost" onClick={()=>setStep(1)}>Retour</Btn><Btn onClick={()=>setStep(3)} disabled={!kbisOk||!codePromo}>Continuer</Btn></div>
        </div>}
        {step===3&&<div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{fontWeight:600,fontSize:14,marginBottom:4}}>Finalisation de votre contrat</div>
          <Card sx={{background:T.blueXL,border:`1px solid ${T.blue}`}}>
            <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
              <div style={{width:44,height:44,borderRadius:"50%",background:T.blue,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>👩</div>
              <div>
                <div style={{fontWeight:600,fontSize:14,color:T.dark,marginBottom:4}}>Coline Sinquin vous contacte</div>
                <div style={{fontSize:13,color:T.dark,lineHeight:1.7,marginBottom:8}}>
                  Responsable de notre équipe partenariat, Coline va vous contacter sous <strong>48h</strong> pour vous transmettre une <strong>proposition de contrat d'affiliation</strong> personnalisée et répondre à toutes vos questions.
                </div>
                <div style={{fontSize:12,color:T.muted,lineHeight:1.7}}>
                  📧 coline@qlower.com · Elle vous guidera sur les modalités de commission, les outils disponibles et les prochaines étapes.
                </div>
              </div>
            </div>
          </Card>
          <Alert type="info">En attendant, vous pouvez déjà finaliser votre RIB à l'étape suivante afin d'accélérer la mise en place.</Alert>
          <div style={{display:"flex",gap:8}}><Btn variant="ghost" onClick={()=>setStep(2)}>Retour</Btn><Btn onClick={()=>setStep(4)}>Continuer</Btn></div>
        </div>}
        {step===4&&<div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div style={{fontWeight:600,fontSize:14,marginBottom:4}}>RIB pour versement des commissions</div>
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:10}}><div>{lbl("IBAN")}<Inp v={iban} s={setIban} ph="FR76 3000 6000..."/></div><div>{lbl("BIC")}<Inp v={bic} s={setBic} ph="BNPAFRPP"/></div></div>
          <Alert type="info"><strong style={{color:T.blue}}>RIB Qlower</strong><br/>IBAN : FR76 1820 6004 5920 0400 0903 080 · BIC : AGRIFRPP882 · Crédit Agricole</Alert>
          <div style={{display:"flex",gap:8}}><Btn variant="ghost" onClick={()=>setStep(3)}>Retour</Btn><Btn variant="success" onClick={()=>setStep(5)}>Finaliser mon inscription</Btn></div>
        </div>}
        {step===5&&<HsOnboardingStep company={company} codePromo={codePromo} contrat={contrat} onDone={onDone}/>}
      </Card>
    </div>
  );
}

// ── REFERRAL FORM ─────────────────────────────────────────────
function ReferralForm({onSent,compact=false}){
  const{utm,code,commRules,biensMoyens,caParClient}=usePartner();
  const rdvLink=buildRdvLink(utm);
  const[prenom,setPrenom]=useState("");const[nom,setNom]=useState("");const[email,setEmail]=useState("");
  const[tel,setTel]=useState("");const[biens,setBiens]=useState("");const[comment,setComment]=useState("");
  const[sent,setSent]=useState(false);const[loading,setLoading]=useState(false);const[error,setError]=useState("");
  const biensNum=biens===""?biensMoyens:biens==="1"?1:biens==="2-3"?2:biens==="4-5"?4:6;
  const{total:commEstim}=useMemo(()=>calcCommission(commRules||[],1,biensNum,caParClient||300),[commRules,biensNum,caParClient]);
  const handleSend=async()=>{
    setError("");
    if(!prenom||!nom||!email){setError("Prénom, nom et email sont obligatoires.");return;}
    setLoading(true);
    try{await new Promise((res,rej)=>setTimeout(()=>Math.random()>0.05?res():rej(),900));setSent(true);if(onSent)onSent({prenom,nom,email,tel,biens,comment,date:new Date().toLocaleDateString("fr-FR"),id:Date.now()});}
    catch{setError("Erreur lors de la création du contact. Réessayez ou contactez coline@qlower.com.");}
    finally{setLoading(false);}
  };
  if(sent)return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <Alert type="success"><div style={{textAlign:"center",padding:"4px 0"}}><div style={{fontSize:20,marginBottom:6}}>✅</div><div style={{fontWeight:600,marginBottom:4}}>Contact créé dans HubSpot</div><div style={{fontSize:11,opacity:.85}}>{prenom} {nom} · L'équipe commerciale prend le relais sous 24h</div></div></Alert>
      <div style={{background:"var(--color-background-tertiary)",borderRadius:10,padding:"12px 14px",border:"1px solid var(--color-border-tertiary)"}}><div style={{fontWeight:600,fontSize:12,marginBottom:6}}>Envoyer le lien de RDV à votre contact</div><div style={{fontSize:11,color:T.muted,wordBreak:"break-all",marginBottom:8}}>{rdvLink}</div><CopyBtn text={rdvLink} label="Copier le lien de RDV"/></div>
      <button onClick={()=>{setSent(false);setPrenom("");setNom("");setEmail("");setTel("");setBiens("");setComment("");}} style={{background:"none",border:"none",color:T.blue,fontSize:12,cursor:"pointer",textDecoration:"underline",padding:0,textAlign:"left"}}>Référer un autre contact</button>
    </div>
  );
  return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <Alert type="info">L'équipe commerciale Qlower contacte votre filleul sous 24h avec votre UTM tracé.<br/><span style={{fontSize:11,opacity:.8}}>Commission garantie dès sa 1re souscription.</span></Alert>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><div>{lbl("Prénom *")}<Inp v={prenom} s={setPrenom} ph="Julie"/></div><div>{lbl("Nom *")}<Inp v={nom} s={setNom} ph="Perrin"/></div></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><div>{lbl("Email *")}<Inp v={email} s={setEmail} ph="julie@..." t="email"/></div><div>{lbl("Téléphone")}<Inp v={tel} s={setTel} ph="06 12 34 56 78" t="tel"/></div></div>
      <div>{lbl("Nb de biens en LMNP")}<Sel v={biens} s={setBiens} opts={[{v:"",l:"— Non précisé"},{v:"1",l:"1 bien"},{v:"2-3",l:"2 à 3 biens"},{v:"4-5",l:"4 à 5 biens"},{v:"6+",l:"6 biens et plus"}]}/>{biens&&commEstim>0&&<div style={{marginTop:6,padding:"6px 10px",background:T.greenBg,borderRadius:6,fontSize:11,color:T.greenD,fontWeight:500}}>💰 Commission estimée : <strong>{commEstim} €</strong></div>}</div>
      {!compact&&<div>{lbl("Commentaire libre")}<textarea value={comment} onChange={e=>setComment(e.target.value)} placeholder="Contexte, urgence..." rows={3} style={{width:"100%",padding:"8px 10px",borderRadius:7,border:"1.5px solid var(--color-border-secondary)",background:"var(--color-background-primary)",color:"var(--color-text-primary)",fontSize:13,boxSizing:"border-box",resize:"vertical",fontFamily:"inherit"}}/></div>}
      {error&&<Alert type="error">{error}</Alert>}
      <Btn onClick={handleSend} disabled={!prenom||!nom||!email||loading}>{loading?"Création dans HubSpot...":"Créer le contact + notifier l'équipe commerciale"}</Btn>
      <div style={{fontSize:11,color:T.muted,textAlign:"center"}}>* Champs obligatoires · Contact créé directement dans HubSpot</div>
    </div>
  );
}

// ── ONBOARDING GUIDE ──────────────────────────────────────────
function OnboardingGuide({onDone}){
  const{nom,code,utm,commRules,biensMoyens,caParClient}=usePartner();
  const signupLink=buildSignupLink(utm,code);
  const[expanded,setExpanded]=useState(0);const[done,setDone]=useState({});
  const IDS=["kit","video","referral","coline"];
  const completed=IDS.filter(k=>done[k]).length;
  const pct=Math.round(completed/IDS.length*100);
  const markDone=id=>setDone(d=>({...d,[id]:true}));
  const steps=[
    {id:"kit",icon:"🔗",title:"Activez votre kit de démarrage",desc:"Copiez votre lien d'inscription affilié et votre code promo.",
      Content:({onDone})=>(<div style={{display:"flex",flexDirection:"column",gap:10}}><Card sx={{padding:12}}><div style={{fontSize:11,fontWeight:600,color:T.muted,textTransform:"uppercase",letterSpacing:".4px",marginBottom:6}}>Lien d'inscription affilié</div><div style={{fontSize:11,color:T.muted,wordBreak:"break-all",lineHeight:1.6,marginBottom:8}}>{signupLink}</div><CopyBtn text={signupLink} label="Copier le lien" onCopied={onDone}/></Card><Card sx={{padding:12,display:"flex",alignItems:"center",justifyContent:"space-between"}}><div><div style={{fontSize:11,fontWeight:600,color:T.muted,textTransform:"uppercase",letterSpacing:".4px",marginBottom:4}}>Code promo</div><div style={{fontSize:22,fontWeight:700,color:T.blue,letterSpacing:2}}>{code}</div><div style={{fontSize:11,color:T.muted}}>-20 € sur la 1re année</div></div><CopyBtn text={code} label="Copier" onCopied={onDone}/></Card></div>)},
    {id:"video",icon:"🎬",title:"Comprendre le programme en 3 min",desc:"Commission, UTM, suivi HubSpot — tout en 3 minutes.",
      Content:({onDone})=>(<div style={{background:"var(--color-background-tertiary)",borderRadius:10,border:"1px solid var(--color-border-secondary)",overflow:"hidden"}}><div style={{background:`linear-gradient(135deg,${T.dark},${T.navyL})`,height:130,display:"flex",alignItems:"center",justifyContent:"center",position:"relative",cursor:"pointer"}} onClick={onDone}><div style={{width:52,height:52,borderRadius:"50%",background:"rgba(255,255,255,.15)",border:"2px solid rgba(255,255,255,.4)",display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{width:0,height:0,borderTop:"9px solid transparent",borderBottom:"9px solid transparent",borderLeft:`15px solid ${T.white}`,marginLeft:4}}/></div><div style={{position:"absolute",bottom:10,left:12,fontSize:11,color:"rgba(255,255,255,.65)"}}>Qlower Pro — Bienvenue partenaire · 3:14</div></div><div style={{padding:"10px 14px"}}><div style={{fontWeight:600,fontSize:13,marginBottom:3}}>Comment fonctionne le programme partenaire ?</div><div style={{fontSize:11,color:T.muted}}>Commission à la souscription, annuelle, variable biens — votre contrat détaille tout.</div></div></div>)},
    {id:"referral",icon:"👤",title:"Faites votre 1er referral",desc:"Transmettez un premier contact à l'équipe commerciale.",
      Content:({onDone})=><ReferralForm onSent={onDone} compact/>},
    {id:"coline",icon:"💬",title:"Prenez RDV avec Coline",desc:"Un call dédié affiliation pour cadrer votre stratégie.",
      Content:({onDone})=>(<div style={{display:"flex",flexDirection:"column",gap:10}}><Card sx={{display:"flex",gap:14,alignItems:"flex-start"}}><div style={{width:44,height:44,borderRadius:"50%",background:T.blueXL,border:`2px solid ${T.blue}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>👩</div><div><div style={{fontWeight:600,fontSize:13}}>Coline Sinquin</div><div style={{fontSize:11,color:T.muted,marginBottom:6}}>Head of Development · coline@qlower.com</div><div style={{fontSize:12,color:T.muted,lineHeight:1.6}}>Call de 20 min dédié au <strong>programme d'affiliation</strong> uniquement.</div></div></Card><Alert type="warning">⚠️ Ce RDV ne couvre pas les questions fiscales de vos clients — utilisez l'onglet <strong>Référer</strong> pour ça.</Alert><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><button onClick={onDone} style={{padding:"10px 14px",borderRadius:8,border:"none",background:T.blue,color:T.white,fontSize:12,fontWeight:600,cursor:"pointer"}}>Prendre RDV — Calendly</button><button onClick={onDone} style={{padding:"10px 14px",borderRadius:8,border:"1.5px solid var(--color-border-secondary)",background:"transparent",color:"var(--color-text-primary)",fontSize:12,cursor:"pointer"}}>coline@qlower.com</button></div></div>)},
  ];
  return(
    <div>
      <div style={{background:`linear-gradient(135deg,${T.blue},${T.blueL})`,borderRadius:12,padding:"18px 20px",marginBottom:16,color:T.white}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
          <div><div style={{fontSize:16,fontWeight:700}}>Bienvenue, {nom} 👋</div><div style={{fontSize:11,opacity:.85,marginTop:2}}>Complétez ces 4 étapes pour bien démarrer</div></div>
          <div style={{textAlign:"right"}}><div style={{fontSize:26,fontWeight:700}}>{pct}%</div><div style={{fontSize:10,opacity:.8}}>complété</div></div>
        </div>
        <div style={{height:6,background:"rgba(255,255,255,.25)",borderRadius:4,overflow:"hidden"}}><div style={{width:pct+"%",height:"100%",background:T.white,borderRadius:4,transition:"width .4s"}}/></div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
        {steps.map((s,i)=>{const isDone=!!done[s.id];const isOpen=expanded===i;return(
          <div key={s.id} style={{background:"var(--color-background-secondary)",borderRadius:12,border:`1.5px solid ${isDone?"#86efac":isOpen?T.blue:"var(--color-border-tertiary)"}`,overflow:"hidden"}}>
            <div onClick={()=>setExpanded(isOpen?-1:i)} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",cursor:"pointer"}}>
              <div style={{width:32,height:32,borderRadius:"50%",background:isDone?"#f0fdf4":isOpen?T.blueXL:"var(--color-background-tertiary)",border:`1.5px solid ${isDone?"#86efac":isOpen?T.blue:"var(--color-border-secondary)"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:isDone?14:16,flexShrink:0}}>{isDone?<span style={{color:T.green,fontWeight:700}}>✓</span>:s.icon}</div>
              <div style={{flex:1}}><div style={{fontWeight:600,fontSize:13,color:isDone?T.muted:isOpen?T.blue:"var(--color-text-primary)",textDecoration:isDone?"line-through":"none"}}>{s.title}</div>{!isOpen&&<div style={{fontSize:11,color:T.muted,marginTop:2}}>{s.desc}</div>}</div>
              <div style={{fontSize:11,color:T.muted}}>{isOpen?"▲":"▼"}</div>
            </div>
            {isOpen&&<div style={{padding:"0 16px 16px"}}><div style={{fontSize:12,color:T.muted,lineHeight:1.6,marginBottom:12}}>{s.desc}</div><s.Content onDone={()=>markDone(s.id)}/>{!isDone&&<button onClick={()=>markDone(s.id)} style={{marginTop:10,background:"none",border:"none",color:T.muted,fontSize:11,cursor:"pointer",textDecoration:"underline",padding:0}}>Marquer comme fait</button>}</div>}
          </div>
        );})}
      </div>
      {pct===100?<Alert type="success"><div style={{textAlign:"center",padding:"8px 0"}}><div style={{fontSize:28,marginBottom:8}}>🎉</div><div style={{fontWeight:700,fontSize:15,marginBottom:6}}>Vous êtes prêt à référer vos premiers clients !</div><div style={{fontSize:12,marginBottom:16}}>Coline a été notifiée.</div><Btn variant="success" onClick={onDone}>Aller sur mon dashboard</Btn></div></Alert>:<div style={{padding:"12px 16px",background:"var(--color-background-tertiary)",borderRadius:10,border:"1px solid var(--color-border-tertiary)",display:"flex",alignItems:"center",justifyContent:"space-between"}}><div style={{fontSize:12,color:T.muted}}>{completed}/4 étapes complétées</div><button onClick={onDone} style={{background:"none",border:"none",color:T.muted,fontSize:12,cursor:"pointer",textDecoration:"underline"}}>Passer → dashboard</button></div>}
    </div>
  );
}

// ── PAGE RÉFÉRER ──────────────────────────────────────────────
function PageReferer(){
  const{utm,code,referralHistory,addReferral}=usePartner();
  const signupLink=buildSignupLink(utm,code);
  const rdvLink=buildRdvLink(utm);
  const[activeOpt,setActiveOpt]=useState("form");
  const[copiedRdv,setCopiedRdv]=useState(false);
  const[copiedLink,setCopiedLink]=useState(false);
  const OPTIONS=[{key:"link",icon:"🔗",label:"Lien d'inscription direct",desc:"Votre client crée son compte lui-même"},{key:"form",icon:"👤",label:"Transmettre un contact",desc:"L'équipe commerciale le contacte sous 24h"},{key:"rdv",icon:"📅",label:"Lien de prise de RDV",desc:"Votre client prend RDV avec Qlower"}];
  return(
    <div>
      <Hdg title="Référer un client" sub="3 façons de référer · commission garantie dès la 1re souscription"/>
      <Alert type="info" sx={{marginBottom:16}}>💡 Vous touchez une commission à la <strong>1re souscription</strong>. Selon votre contrat, une commission annuelle peut s'ajouter. Détails dans <strong>Revenus</strong>.</Alert>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:16}}>
        {OPTIONS.map(o=><div key={o.key} onClick={()=>setActiveOpt(o.key)} style={{padding:"14px 12px",borderRadius:10,cursor:"pointer",border:`2px solid ${activeOpt===o.key?T.blue:"var(--color-border-tertiary)"}`,background:activeOpt===o.key?T.blueXL:"var(--color-background-secondary)",textAlign:"center"}}><div style={{fontSize:22,marginBottom:6}}>{o.icon}</div><div style={{fontWeight:600,fontSize:12,color:activeOpt===o.key?T.blue:"var(--color-text-primary)",marginBottom:3}}>{o.label}</div><div style={{fontSize:11,color:T.muted,lineHeight:1.4}}>{o.desc}</div></div>)}
      </div>
      {activeOpt==="link"&&<Card><div style={{fontWeight:600,fontSize:14,marginBottom:10}}>🔗 Lien d'inscription direct</div><div style={{background:"var(--color-background-tertiary)",borderRadius:8,padding:"10px 12px",fontSize:11,wordBreak:"break-all",lineHeight:1.7,marginBottom:10,border:"1px solid var(--color-border-secondary)"}}>{signupLink}</div><div style={{display:"flex",gap:8,marginBottom:12}}><button onClick={()=>{navigator.clipboard.writeText(signupLink).catch(()=>{});setCopiedLink(true);setTimeout(()=>setCopiedLink(false),2000);}} style={{padding:"8px 16px",borderRadius:8,border:"none",background:copiedLink?T.green:T.blue,color:T.white,fontSize:12,fontWeight:600,cursor:"pointer"}}>{copiedLink?"Copié !":"Copier le lien"}</button><button style={{padding:"8px 14px",borderRadius:8,border:`1.5px solid ${T.blue}`,background:"transparent",color:T.blue,fontSize:12,cursor:"pointer"}}>QR Code</button></div><Alert type="success">✓ UTM tracé automatiquement · ✓ Commission garantie · ✓ Aucune action supplémentaire requise</Alert></Card>}
      {activeOpt==="form"&&<Card><div style={{fontWeight:600,fontSize:14,marginBottom:10}}>👤 Transmettre un contact</div><ReferralForm onSent={addReferral}/></Card>}
      {activeOpt==="rdv"&&<Card><div style={{fontWeight:600,fontSize:14,marginBottom:10}}>📅 Lien de prise de RDV</div><div style={{background:"var(--color-background-tertiary)",borderRadius:8,padding:"10px 12px",fontSize:11,wordBreak:"break-all",lineHeight:1.7,marginBottom:10,border:"1px solid var(--color-border-secondary)"}}>{rdvLink}</div><div style={{display:"flex",gap:8,marginBottom:12}}><button onClick={()=>{navigator.clipboard.writeText(rdvLink).catch(()=>{});setCopiedRdv(true);setTimeout(()=>setCopiedRdv(false),2000);}} style={{padding:"8px 16px",borderRadius:8,border:"none",background:copiedRdv?T.green:T.blue,color:T.white,fontSize:12,fontWeight:600,cursor:"pointer"}}>{copiedRdv?"Copié !":"Copier le lien de RDV"}</button></div><Alert type="info">Ce RDV est animé par l'équipe commerciale. Vous êtes notifié par email dès la souscription.</Alert></Card>}
      {referralHistory.length>0&&<Card sx={{marginTop:16}}>
        <div style={{fontWeight:600,fontSize:13,marginBottom:12}}>Historique des contacts transmis ({referralHistory.length})</div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {referralHistory.map(c=><div key={c.id} style={{display:"grid",gridTemplateColumns:"1fr auto auto auto",gap:8,padding:"10px 12px",background:"var(--color-background-tertiary)",borderRadius:8,alignItems:"center",border:"1px solid var(--color-border-tertiary)"}}><div><div style={{fontWeight:500,fontSize:13}}>{c.prenom} {c.nom}</div><div style={{fontSize:11,color:T.muted}}>{c.email}{c.tel?" · "+c.tel:""}</div></div><Tag label={c.biens||"—"} c={T.blue} bg={T.blueXL}/><Tag label="HubSpot ✓" c={T.greenD} bg={T.greenBg}/><div style={{fontSize:11,color:T.muted}}>{c.date}</div></div>)}
        </div>
      </Card>}
    </div>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────
function EmptyDashboard(){
  const{code,utm,setModule}=usePartner();
  const signupLink=buildSignupLink(utm,code);
  const bm=BENCHMARK.default;
  return(
    <div>
      <Hdg title="Pilotage de l'activité" sub="Données en temps réel · HubSpot sync"/>
      <Alert type="info" sx={{marginBottom:16}}>📋 <strong>Dossier reçu</strong> · Coline valide votre compte sous 48h · Votre espace est déjà actif</Alert>
      <div style={{background:"var(--color-background-secondary)",borderRadius:16,padding:"28px 24px",textAlign:"center",border:"1px solid var(--color-border-tertiary)",marginBottom:16}}>
        <div style={{fontSize:36,marginBottom:12}}>📭</div>
        <div style={{fontSize:16,fontWeight:700,marginBottom:6}}>Vous n'avez pas encore de leads</div>
        <div style={{fontSize:13,color:T.muted,marginBottom:20,lineHeight:1.7}}>Partagez votre lien ou transmettez vos premiers contacts.</div>
        <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
          <CopyBtn text={signupLink} label="Copier mon lien d'inscription" sx={{padding:"9px 18px",fontSize:13}}/>
          <button onClick={()=>setModule("referer")} style={{padding:"9px 18px",borderRadius:7,border:`1.5px solid ${T.blue}`,background:"transparent",color:T.blue,fontSize:13,fontWeight:600,cursor:"pointer"}}>Référer un contact →</button>
        </div>
      </div>
      <div style={{background:T.blueXL,borderRadius:12,padding:"14px 16px",border:`1px solid ${T.blue}`,marginBottom:16}}>
        <div style={{fontWeight:600,fontSize:13,color:T.blue,marginBottom:8}}>📊 Benchmark anonyme</div>
        <div style={{fontSize:12,color:T.dark,lineHeight:1.7}}>Les <strong>{bm.label}</strong> convertissent en moyenne <strong style={{color:T.blue}}>{bm.taux}%</strong> de leurs leads.</div>
        <div style={{marginTop:10,height:6,background:"rgba(78,146,189,.2)",borderRadius:4,overflow:"hidden"}}><div style={{width:bm.taux*2+"%",height:"100%",background:T.blue,borderRadius:4}}/></div>
      </div>
    </div>
  );
}

function Dashboard(){
  const{partnerId,partnerType,commRules,biensMoyens,caParClient}=usePartner();
  const contacts=CONTACTS_DATA[partnerId]||[];
  const monthly=MONTHLY_DATA[partnerId]||[];
  const actions=ACTION_LOG[partnerId]||[];
  if(!contacts.length)return <EmptyDashboard/>;
  const[tab,setTab]=useState("all");const[search,setSearch]=useState("");const[showLog,setShowLog]=useState(false);
  const abonnes=contacts.filter(c=>c.stage==="Abonne").length;
  const payeurs=contacts.filter(c=>c.stage==="Payeur").length;
  const nonPay=contacts.filter(c=>c.stage==="Non payeur").length;
  const actifs=abonnes+payeurs;
  const{total:revActuel,detail:commDetail}=useMemo(()=>calcCommission(commRules,actifs,biensMoyens,caParClient),[commRules,actifs,biensMoyens,caParClient]);
  const revProj=revActuel+300;
  const taux=contacts.length>0?Math.round(actifs/contacts.length*100):0;
  const bm=BENCHMARK[partnerType]||BENCHMARK.default;
  const totalLeads=monthly.reduce((s,d)=>s+d.leads,0);
  const totalAb=monthly.reduce((s,d)=>s+d.abonnes,0);
  const monthlyWithComm=useMemo(()=>monthly.map(d=>({...d,comm:calcCommission(commRules,d.abonnes,biensMoyens,caParClient).total})),[monthly,commRules,biensMoyens,caParClient]);
  const filtered=contacts.filter(c=>{if(tab==="abonnes"&&c.stage!=="Abonne")return false;if(tab==="payeurs"&&c.stage!=="Payeur")return false;if(tab==="nonpay"&&c.stage!=="Non payeur")return false;if(search&&!c.n.toLowerCase().includes(search.toLowerCase())&&!c.e.toLowerCase().includes(search.toLowerCase()))return false;return true;});
  return(
    <div>
      <Hdg title="Pilotage de l'activité" sub="Données en temps réel · HubSpot sync"/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        <div style={{background:`linear-gradient(135deg,${T.dark},${T.navyL})`,borderRadius:12,padding:"16px 18px",color:T.white}}>
          <div style={{fontSize:11,opacity:.65,marginBottom:4,textTransform:"uppercase",letterSpacing:".4px"}}>Commissions — règles actives</div>
          <div style={{fontSize:30,fontWeight:700,marginBottom:4}}>{revActuel.toLocaleString("fr-FR")} €</div>
          {commDetail.map((d,i)=><div key={i} style={{fontSize:11,opacity:.6,lineHeight:1.7}}>{d.label} · {d.calc} = {d.montant} €</div>)}
          <div style={{marginTop:10,height:4,background:"rgba(255,255,255,.15)",borderRadius:2,overflow:"hidden"}}><div style={{width:Math.min(Math.round(revActuel/revProj*100),100)+"%",height:"100%",background:T.blueL,borderRadius:2}}/></div>
          <div style={{marginTop:4,fontSize:11,opacity:.45}}>Objectif : {revProj.toLocaleString("fr-FR")} € · versement 01/01/2027</div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <div style={{background:"var(--color-background-secondary)",borderRadius:10,padding:"10px 14px",border:"1px solid var(--color-border-tertiary)",flex:1}}><div style={{fontSize:11,color:T.muted,marginBottom:4}}>Prochain versement estimé</div><div style={{fontWeight:700,fontSize:15,color:T.blue}}>{revActuel} €</div><div style={{fontSize:11,color:T.muted,marginTop:2}}>01/01/2027 · dans ~9 mois</div></div>
          <div style={{background:"var(--color-background-secondary)",borderRadius:10,padding:"10px 14px",border:"1px solid var(--color-border-tertiary)",flex:1}}><div style={{fontSize:11,color:T.muted,marginBottom:4}}>Projection 12 mois</div><div style={{fontWeight:700,fontSize:15,color:T.green}}>~{revProj.toLocaleString("fr-FR")} €</div><div style={{fontSize:11,color:T.muted,marginTop:2}}>si +2 clients/trim</div></div>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
        <Stat icon="👥" val={contacts.length} label="Total leads" color={T.blue}/>
        <Stat icon="✅" val={abonnes} label="Abonnés" color={T.green}/>
        <Stat icon="💳" val={payeurs} label="Payeurs" color={T.amber}/>
      </div>
      <Alert type="info" sx={{marginTop:10,marginBottom:0}}>
        💡 <strong>Comment fonctionne votre commission ?</strong><br/>
        Vous percevez une commission fixe pour chaque client que vous référez, au titre de la <strong>première année de souscription</strong> à l'abonnement Qlower. Le montant exact est défini dans votre contrat d'affiliation.
      </Alert>
      <Card sx={{marginBottom:14,padding:"12px 16px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
          <div><div style={{fontWeight:600,fontSize:13}}>Votre taux vs benchmark</div><div style={{fontSize:11,color:T.muted,marginTop:1}}>{bm.label}</div></div>
          <div style={{textAlign:"right"}}><div style={{fontSize:22,fontWeight:700,color:taux>=bm.taux?T.green:T.orange}}>{taux}%</div><div style={{fontSize:10,color:T.muted}}>votre taux</div></div>
        </div>
        <div style={{height:8,background:"var(--color-background-tertiary)",borderRadius:4,position:"relative",overflow:"visible"}}>
          <div style={{height:"100%",width:Math.min(taux*2,100)+"%",background:`linear-gradient(90deg,${T.blue},${T.blueL})`,borderRadius:4}}/>
          <div style={{position:"absolute",top:-2,left:Math.min(bm.taux*2,100)+"%",width:2,height:12,background:T.orange,borderRadius:1}}/>
        </div>
        {taux>=bm.taux?<div style={{marginTop:8,fontSize:11,color:T.greenD}}>🏆 Au-dessus de la moyenne !</div>:<div style={{marginTop:8,fontSize:11,color:T.muted}}>💡 Encore {bm.taux-taux} points pour atteindre la moyenne des {bm.label}</div>}
      </Card>
      {monthly.length>0&&<Card sx={{marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div style={{fontWeight:600,fontSize:13}}>Évolution + commissions</div>
          <div style={{display:"flex",gap:12,fontSize:11,color:T.muted}}><span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,borderRadius:2,background:"var(--color-border-secondary)",display:"inline-block"}}/>Leads</span><span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,borderRadius:2,background:T.blue,display:"inline-block"}}/>Abonnés</span></div>
        </div>
        <BarChart data={monthlyWithComm} h={110}/>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:10,padding:"8px 12px",background:"var(--color-background-tertiary)",borderRadius:8}}>
          <div style={{fontSize:12}}><span style={{color:T.muted}}>Leads : </span><strong>{totalLeads}</strong></div>
          <div style={{fontSize:12}}><span style={{color:T.muted}}>Convertis : </span><strong style={{color:T.blue}}>{totalAb}</strong></div>
          <div style={{fontSize:12}}><span style={{color:T.muted}}>Taux : </span><strong style={{color:T.green}}>{totalLeads>0?Math.round(totalAb/totalLeads*100):0}%</strong></div>
        </div>
      </Card>}
      {actions.length>0&&<Card sx={{marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:showLog?12:0}}><div style={{fontWeight:600,fontSize:13}}>Historique de vos actions</div><button onClick={()=>setShowLog(v=>!v)} style={{background:"none",border:"none",color:T.blue,fontSize:12,cursor:"pointer",textDecoration:"underline"}}>{showLog?"Masquer":"Voir l'historique"}</button></div>
        {showLog&&<div style={{display:"flex",flexDirection:"column",gap:6}}>{actions.map((a,i)=><div key={i} style={{display:"flex",gap:12,alignItems:"flex-start",padding:"8px 10px",background:"var(--color-background-tertiary)",borderRadius:8}}><span style={{fontSize:14}}>{a.type==="lien"?"🔗":"👤"}</span><div><div style={{fontSize:12,fontWeight:500}}>{a.label}</div><div style={{fontSize:11,color:T.muted,marginTop:2}}>{a.date}</div></div></div>)}</div>}
      </Card>}
      <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
        {[["all","Tous"],["abonnes","Abonnés"],["payeurs","Payeurs"],["nonpay","Non payeurs"]].map(([k,l])=><button key={k} onClick={()=>setTab(k)} style={{padding:"6px 14px",borderRadius:8,border:"none",cursor:"pointer",fontSize:12,fontWeight:500,background:tab===k?T.blue:"var(--color-background-secondary)",color:tab===k?T.white:T.muted}}>{l}</button>)}
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher..." style={{marginLeft:"auto",padding:"6px 10px",borderRadius:8,border:"1.5px solid var(--color-border-secondary)",background:"var(--color-background-primary)",color:"var(--color-text-primary)",fontSize:12,minWidth:130}}/>
        <button style={{padding:"6px 12px",borderRadius:8,border:`1.5px solid ${T.green}`,background:"transparent",color:T.green,fontSize:12,cursor:"pointer"}}>Export .xlsx</button>
      </div>
      <div style={{background:"var(--color-background-secondary)",borderRadius:12,overflow:"hidden",border:"1px solid var(--color-border-tertiary)"}}>
        <div style={{display:"grid",gridTemplateColumns:"1.2fr 1.3fr auto auto auto auto",gap:6,padding:"8px 12px",background:"var(--color-background-tertiary)",borderBottom:"1px solid var(--color-border-tertiary)"}}>
          {["Contact","Email","Source","Statut","Biens","Mois"].map((h,i)=><div key={i} style={{fontSize:10,fontWeight:500,color:T.muted,textTransform:"uppercase",letterSpacing:".4px"}}>{h}</div>)}
        </div>
        {filtered.map((c,i)=>{const ss=STAGE_S[c.stage]||{c:T.gray,bg:T.grayBg};const sr=SRC_S[c.src]||{c:T.gray,bg:T.grayBg};return(
          <div key={i} style={{display:"grid",gridTemplateColumns:"1.2fr 1.3fr auto auto auto auto",gap:6,padding:"9px 12px",borderBottom:i<filtered.length-1?"1px solid var(--color-border-tertiary)":"none",alignItems:"center"}}>
            <div style={{fontWeight:500,fontSize:12}}>{c.n}</div><div style={{fontSize:11,color:T.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.e}</div>
            <Tag label={c.src} c={sr.c} bg={sr.bg}/><Tag label={c.stage} c={ss.c} bg={ss.bg}/>
            <div style={{fontSize:11,color:T.muted,textAlign:"center"}}>{c.biens||"—"}</div><div style={{fontSize:11,color:T.muted,whiteSpace:"nowrap"}}>{c.mois}</div>
          </div>
        );})}
      </div>
    </div>
  );
}

// ── REVENUS ───────────────────────────────────────────────────
function Revenus(){
  const{commRules,biensMoyens,caParClient,commObjAnnuel}=usePartner();
  const actifs=2;const[ribVis,setRibVis]=useState(false);
  const{total:revActuel,detail:commDetail}=useMemo(()=>calcCommission(commRules,actifs,biensMoyens,caParClient),[commRules,actifs,biensMoyens,caParClient]);
  const revObj=commObjAnnuel||500;
  const pctObj=Math.min(Math.round(revActuel/revObj*100),100);
  const TIMELINE=[{date:"14 jan. 2026",label:"Contrat signé",done:true,icon:"✅"},{date:"20 jan. 2026",label:"1er lead enregistré",done:true,icon:"✅"},{date:"01 fév. 2026",label:"1er abonné converti",done:true,icon:"✅"},{date:"01 jan. 2027",label:"1er versement annuel",done:false,icon:"💰",highlight:true},{date:"01 jan. 2028",label:"Renouvellement contrat",done:false,icon:"🔄"}];
  return(
    <div>
      <Hdg title="Revenus et Facturation" sub="Commissions calculées selon votre contrat"/>
      <div style={{background:`linear-gradient(135deg,${T.dark},${T.navyL})`,borderRadius:14,padding:"20px 22px",marginBottom:14,color:T.white}}>
        <div style={{fontSize:11,opacity:.65,textTransform:"uppercase",letterSpacing:".4px",marginBottom:6}}>Commissions calculées — règles actives</div>
        <div style={{fontSize:32,fontWeight:700,marginBottom:8}}>{revActuel.toLocaleString("fr-FR")} €</div>
        {commDetail.map((d,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:12,opacity:.75,marginBottom:4,borderBottom:"1px solid rgba(255,255,255,.1)",paddingBottom:4}}><span>{d.label}</span><span>{d.calc} = <strong>{d.montant} €</strong></span></div>)}
        <div style={{marginTop:12,height:8,background:"rgba(255,255,255,.15)",borderRadius:4,overflow:"hidden"}}><div style={{width:pctObj+"%",height:"100%",background:`linear-gradient(90deg,${T.blueL},${T.white})`,borderRadius:4}}/></div>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:6,fontSize:10,opacity:.5}}><span>0 €</span><span>{pctObj}% de l'objectif</span><span>{revObj} €</span></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>
        <Stat icon="⏳" val={`${revActuel} €`} label="En attente · 2027" color={T.amber}/><Stat icon="📅" val="01/01/2027" label="Prochain versement" color={T.blue}/><Stat icon="✅" val="300 €" label="Total versé" color={T.green}/>
      </div>
      <Card sx={{marginBottom:14}}>
        <div style={{fontWeight:600,fontSize:13,marginBottom:14}}>Timeline partenariat</div>
        <div style={{display:"flex",flexDirection:"column",gap:0}}>
          {TIMELINE.map((t,i)=><div key={i} style={{display:"flex",gap:14,alignItems:"flex-start"}}><div style={{display:"flex",flexDirection:"column",alignItems:"center",flexShrink:0}}><div style={{width:30,height:30,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,background:t.done?T.greenBg:t.highlight?T.blueXL:"var(--color-background-tertiary)",border:`2px solid ${t.done?T.green:t.highlight?T.blue:"var(--color-border-secondary)"}`,flexShrink:0}}>{t.icon}</div>{i<TIMELINE.length-1&&<div style={{width:2,height:28,background:t.done?T.green:"var(--color-border-tertiary)",margin:"2px 0"}}/>}</div><div style={{paddingTop:4,paddingBottom:i<TIMELINE.length-1?16:0}}><div style={{fontWeight:t.highlight?700:500,fontSize:13,color:t.highlight?T.blue:"var(--color-text-primary)"}}>{t.label}{t.highlight&&<span style={{marginLeft:8,fontSize:11,background:T.blueXL,color:T.blue,padding:"1px 7px",borderRadius:10,fontWeight:500}}>À venir</span>}</div><div style={{fontSize:11,color:T.muted,marginTop:2}}>{t.date}</div></div></div>)}
        </div>
      </Card>
      <Card sx={{marginBottom:14}}>
        <div style={{fontWeight:600,fontSize:13,marginBottom:10}}>Historique des appels</div>
        <div style={{borderRadius:8,overflow:"hidden",border:"1px solid var(--color-border-tertiary)"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr auto auto",gap:8,padding:"7px 12px",background:"var(--color-background-tertiary)",borderBottom:"1px solid var(--color-border-tertiary)"}}>{["N° Facture","Date","Montant","Statut",""].map((h,i)=><div key={i} style={{fontSize:10,fontWeight:500,color:T.muted,textTransform:"uppercase"}}>{h}</div>)}</div>
          {INVOICES_DATA.map((inv,i)=><div key={i} style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr auto auto",gap:8,padding:"9px 12px",borderBottom:i<INVOICES_DATA.length-1?"1px solid var(--color-border-tertiary)":"none",alignItems:"center"}}><div style={{fontSize:12,fontWeight:500}}>{inv.id}</div><div style={{fontSize:12,color:T.muted}}>{inv.date}</div><div style={{fontSize:12,fontWeight:600,color:T.green}}>{inv.montant} €</div><Tag label={inv.statut} c={inv.statut==="Payee"?T.green:T.amber} bg={inv.statut==="Payee"?T.greenBg:T.amberBg}/><button style={{padding:"3px 8px",borderRadius:5,border:`1px solid ${T.blue}`,background:"transparent",color:T.blue,fontSize:11,cursor:"pointer"}}>PDF</button></div>)}
        </div>
      </Card>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <Card><div style={{fontWeight:600,fontSize:12,marginBottom:8}}>Votre RIB</div><div style={{fontSize:12,color:T.muted,lineHeight:1.9}}>IBAN : {ribVis?"FR76 3000 6000 0112 3456 7890 189":"FR76 xxxx xxxx xxxx xxxx xxxx 189"}<br/>BIC : {ribVis?"BNPAFRPP":"BNPxxxxx"}</div><div style={{display:"flex",gap:8,marginTop:8}}><button onClick={()=>setRibVis(v=>!v)} style={{padding:"4px 10px",borderRadius:6,border:`1px solid ${T.blue}`,background:"transparent",color:T.blue,fontSize:11,cursor:"pointer"}}>{ribVis?"Masquer":"Afficher"}</button></div></Card>
        <Card sx={{background:T.blueXL,border:`1px solid ${T.blue}`}}><div style={{fontWeight:600,fontSize:12,marginBottom:8,color:T.blue}}>RIB Qlower</div><div style={{fontSize:12,color:T.muted,lineHeight:1.9}}>IBAN : FR76 1820 6004 5920 0400 0903 080<br/>BIC : AGRIFRPP882 · Crédit Agricole</div></Card>
      </div>
    </div>
  );
}

// ── OUTILS ────────────────────────────────────────────────────
function Outils(){
  const{code,utm}=usePartner();
  const signupLink=buildSignupLink(utm,code);
  const[toolTab,setToolTab]=useState("kit");const[copied,setCopied]=useState(false);const[openFaq,setOpenFaq]=useState(null);const[selTemplate,setSelTemplate]=useState(0);const[copiedTpl,setCopiedTpl]=useState(false);const[openPitch,setOpenPitch]=useState(null);
  const EMAIL_TEMPLATES=[
    {id:"intro",label:"Présentation",subject:"Optimisez votre fiscalité LMNP avec Qlower",body:`Bonjour [Prénom],\n\nJe souhaitais vous présenter Qlower — la solution fiscale que je recommande à mes clients investisseurs LMNP.\n\nPour créer votre compte :\n→ ${signupLink}\n\nOu code promo : ${code} (-20 € sur la 1re année)\n\nBien cordialement,\n[Votre signature]`},
    {id:"relance",label:"Relance",subject:"Suite à notre échange — Qlower LMNP",body:`Bonjour [Prénom],\n\nSuite à notre conversation :\n→ ${signupLink}\n\nCode promo : ${code} (-20 € sur la 1re année)\n\nCordialement,\n[Votre signature]`},
    {id:"newsletter",label:"Newsletter",subject:"",body:`🏠 Optimisez votre fiscalité LMNP avec Qlower\n\n✓ Déclarations guidées ✓ Optimisation du régime ✓ Bilan inclus\n\nCode ${code} → -20 € · ${signupLink}`},
  ];
  const PITCH_CARDS=[{icon:"💰",titre:"L'argument principal",pitch:`"Vos clients LMNP paient souvent trop d'impôts faute de bonne déclaration. Qlower les guide et optimise automatiquement leur régime BIC."`},{icon:"⏱",titre:"En 2 minutes",pitch:`"Qlower, c'est la solution comptable pour vos clients en location meublée. Inscription en 5 min, déclaration guidée, optimisation auto."`},{icon:"❓",titre:"'C'est quoi exactement ?'",pitch:`"Un logiciel SaaS qui remplace le comptable pour les LMNP. Il calcule le meilleur régime, génère le bilan, prépare la liasse fiscale."`},{icon:"🤝",titre:"'Pourquoi vous le recommandez ?'",pitch:`"Parce que c'est le meilleur outil pour mes clients investisseurs. Et parce que je suis partenaire — ça me permet de vous offrir -20 €."`}];
  const FAQS=[{q:"Comment suivre mes leads ?",a:"Consultez l'onglet Dashboard. Vos leads sont mis à jour en temps réel depuis HubSpot."},{q:"Quand suis-je payé ?",a:"Une fois par an, à la date anniversaire de votre contrat. Le montant dépend des règles de commission définies dans votre contrat."},{q:"Quelle différence entre commission à la souscription et commission annuelle ?",a:"La commission à la souscription est versée une seule fois. La commission annuelle est versée chaque année tant que le client reste abonné. Certains contrats combinent les deux."},{q:"Mon client a souscrit sans mon lien ni mon code, que faire ?",a:"Contactez-nous sous 30 jours avec un justificatif à coline@qlower.com."},{q:"Comment modifier mon lien d'inscription affilié ?",a:"Contactez Coline à coline@qlower.com."}];
  const MEMOS=[{date:"15 avr. 2026",label:"Liasse BIC — Date limite 2031",urgent:true},{date:"31 mai 2026",label:"Déclaration 2044 — Revenus fonciers",urgent:false},{date:"30 juin 2026",label:"Déclaration CFE",urgent:false}];
  return(
    <div>
      <Hdg title="Boîte à outils" sub="Vos ressources partenaire Qlower"/>
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
        {[["kit","🔗 Mon kit"],["comm","📝 Kit comm."],["agenda","📅 Agenda fiscal"],["faq","❓ FAQ"]].map(([k,l])=><button key={k} onClick={()=>setToolTab(k)} style={{padding:"7px 14px",borderRadius:8,border:"none",cursor:"pointer",fontSize:12,fontWeight:500,background:toolTab===k?T.blue:"var(--color-background-secondary)",color:toolTab===k?T.white:T.muted}}>{l}</button>)}
      </div>
      {toolTab==="kit"&&<><Card sx={{marginBottom:12}}><div style={{fontWeight:600,fontSize:14,marginBottom:4}}>Lien d'inscription affilié</div><div style={{fontSize:12,color:T.muted,marginBottom:10,lineHeight:1.6}}>Votre client clique ce lien et crée son compte — tracking intégré automatiquement.</div><div style={{background:"var(--color-background-tertiary)",borderRadius:8,padding:"10px 12px",fontSize:11,wordBreak:"break-all",lineHeight:1.7,marginBottom:10,border:"1px solid var(--color-border-secondary)"}}>{signupLink}</div><div style={{display:"flex",gap:8}}><button onClick={()=>{navigator.clipboard.writeText(signupLink).catch(()=>{});setCopied(true);setTimeout(()=>setCopied(false),2000);}} style={{padding:"7px 16px",borderRadius:8,border:"none",background:copied?T.green:T.blue,color:T.white,fontSize:12,fontWeight:600,cursor:"pointer"}}>{copied?"Copié !":"Copier le lien"}</button><button style={{padding:"7px 14px",borderRadius:8,border:`1.5px solid ${T.blue}`,background:"transparent",color:T.blue,fontSize:12,cursor:"pointer"}}>QR Code</button></div></Card>
      <Card><div style={{fontWeight:600,fontSize:13,marginBottom:8}}>Votre code promo</div><div style={{fontSize:24,fontWeight:700,color:T.blue,letterSpacing:2,textAlign:"center",padding:"10px 0"}}>{code}</div><div style={{fontSize:11,color:T.muted,textAlign:"center"}}>-20 € pour vos clients</div></Card></>}
      {toolTab==="comm"&&<><Card sx={{marginBottom:12}}>
        <div style={{fontWeight:600,fontSize:14,marginBottom:12}}>Templates email</div>
        <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>{EMAIL_TEMPLATES.map((t,i)=><button key={t.id} onClick={()=>setSelTemplate(i)} style={{padding:"6px 12px",borderRadius:8,border:`1.5px solid ${selTemplate===i?T.blue:"var(--color-border-secondary)"}`,background:selTemplate===i?T.blueXL:"transparent",color:selTemplate===i?T.blue:T.muted,fontSize:12,cursor:"pointer",fontWeight:selTemplate===i?600:400}}>{t.label}</button>)}</div>
        {EMAIL_TEMPLATES[selTemplate].subject&&<div style={{marginBottom:8}}>{lbl("Objet")}<div style={{background:"var(--color-background-tertiary)",borderRadius:7,padding:"8px 12px",fontSize:12,fontWeight:500,border:"1px solid var(--color-border-tertiary)"}}>{EMAIL_TEMPLATES[selTemplate].subject}</div></div>}
        <div style={{marginBottom:10}}>{lbl("Corps")}<div style={{background:"var(--color-background-tertiary)",borderRadius:7,padding:"12px",fontSize:12,lineHeight:1.8,border:"1px solid var(--color-border-tertiary)",whiteSpace:"pre-line",maxHeight:180,overflowY:"auto"}}>{EMAIL_TEMPLATES[selTemplate].body}</div></div>
        <button onClick={()=>{navigator.clipboard.writeText(EMAIL_TEMPLATES[selTemplate].body).catch(()=>{});setCopiedTpl(true);setTimeout(()=>setCopiedTpl(false),2000);}} style={{padding:"7px 16px",borderRadius:8,border:"none",background:copiedTpl?T.green:T.blue,color:T.white,fontSize:12,fontWeight:600,cursor:"pointer"}}>{copiedTpl?"Copié !":"Copier le template"}</button>
      </Card>
      <div style={{fontWeight:600,fontSize:14,marginBottom:10}}>Argumentaire</div>
      <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:12}}>{PITCH_CARDS.map((p,i)=><div key={i} style={{background:"var(--color-background-secondary)",borderRadius:10,border:"1px solid var(--color-border-tertiary)",overflow:"hidden"}}><div onClick={()=>setOpenPitch(openPitch===i?null:i)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",cursor:"pointer"}}><span style={{fontSize:18,flexShrink:0}}>{p.icon}</span><div style={{flex:1,fontWeight:500,fontSize:13,color:openPitch===i?T.blue:"var(--color-text-primary)"}}>{p.titre}</div><span style={{fontSize:11,color:T.muted}}>{openPitch===i?"▲":"▼"}</span></div>{openPitch===i&&<div style={{padding:"0 14px 14px 44px",fontSize:12,color:T.muted,lineHeight:1.7,fontStyle:"italic"}}>{p.pitch}</div>}</div>)}</div>
      <Card sx={{background:T.blueXL,border:`1px solid ${T.blue}`}}><div style={{fontWeight:600,fontSize:13,marginBottom:8,color:T.blue}}>Fiche produit téléchargeable</div><div style={{fontSize:12,color:T.muted,lineHeight:1.7,marginBottom:12}}>1 page · PDF · inclut lien d'inscription, avantages LMNP, QR code.</div><div style={{display:"flex",gap:8}}><button style={{padding:"7px 16px",borderRadius:8,border:"none",background:T.blue,color:T.white,fontSize:12,fontWeight:600,cursor:"pointer"}}>Télécharger (PDF)</button></div></Card></>}
      {toolTab==="agenda"&&<><Card sx={{marginBottom:12}}><div style={{fontWeight:600,fontSize:14,marginBottom:12}}>Calendrier fiscal 2026</div>{MEMOS.map((m,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 12px",borderRadius:8,marginBottom:6,background:m.urgent?"#FFF7ED":"var(--color-background-tertiary)",border:`1px solid ${m.urgent?"#fed7aa":"var(--color-border-tertiary)"}`}}><div><div style={{fontSize:13,fontWeight:m.urgent?600:400}}>{m.label}</div>{m.urgent&&<div style={{fontSize:11,color:T.amber,marginTop:2}}>Échéance proche</div>}</div><Tag label={m.date} c={m.urgent?T.amber:T.gray} bg={m.urgent?T.amberBg:T.grayBg}/></div>)}</Card><Alert type="info">💡 Utilisez les templates email de l'onglet "Kit comm." pour relancer vos contacts pendant les périodes fiscales.</Alert></>}
      {toolTab==="faq"&&<Card><div style={{fontWeight:600,fontSize:14,marginBottom:10}}>Questions fréquentes</div>{FAQS.map((faq,i)=><div key={i} style={{borderRadius:8,border:"1px solid var(--color-border-tertiary)",overflow:"hidden",marginBottom:6}}><div onClick={()=>setOpenFaq(openFaq===i?null:i)} style={{padding:"10px 14px",display:"flex",justifyContent:"space-between",cursor:"pointer",fontWeight:500,fontSize:13}}>{faq.q}<span style={{color:T.blue}}>{openFaq===i?"▲":"▼"}</span></div>{openFaq===i&&<div style={{padding:"0 14px 12px",fontSize:12,color:T.muted,lineHeight:1.7}}>{faq.a}</div>}</div>)}</Card>}
    </div>
  );
}

// ── MARQUE BLANCHE (avec personnalisation) ────────────────────
function MarqueBlanch(){
  const{partnerId}=usePartner();
  const[email,setEmail]=useState("fiscalite@monentreprise.fr");
  const[calendly,setCalendly]=useState("https://calendly.com/monconseiller");
  const[alertes,setAlertes]=useState(true);const[delai,setDelai]=useState("15");const[emailAlerte,setEmailAlerte]=useState("alerts@monentreprise.fr");
  const[saved,setSaved]=useState(false);
  const[brandColor,setBrandColor]=useState("#4E92BD");
  const[brandName,setBrandName]=useState("Mon Cabinet");
  const PREVIEW_COLOR=brandColor||T.blue;
  return(
    <div>
      <Hdg title="Marque Blanche" sub="Personnalisez l'interface Qlower à votre image"/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
        <Card>
          <div style={{fontWeight:600,fontSize:13,marginBottom:10}}>Identité visuelle</div>
          <div style={{marginBottom:10}}>{lbl("Logo")}<div style={{border:"2px dashed var(--color-border-secondary)",borderRadius:8,padding:16,textAlign:"center",cursor:"pointer",background:"var(--color-background-tertiary)"}}><div style={{fontSize:20,marginBottom:4}}>📁</div><div style={{fontSize:12,color:T.muted}}>Glisser votre logo · PNG/SVG</div></div></div>
          <div style={{marginBottom:10}}>{lbl("Nom affiché")}<Inp v={brandName} s={setBrandName} ph="Mon Cabinet"/></div>
          <div>{lbl("Couleur principale")}
            <div style={{display:"flex",gap:10,alignItems:"center",marginTop:4}}>
              <input type="color" value={brandColor} onChange={e=>setBrandColor(e.target.value)} style={{width:44,height:36,borderRadius:7,border:"1.5px solid var(--color-border-secondary)",cursor:"pointer",padding:2}}/>
              <Inp v={brandColor} s={setBrandColor} ph="#4E92BD" ex={{flex:1}}/>
            </div>
          </div>
        </Card>
        <Card>
          <div style={{fontWeight:600,fontSize:13,marginBottom:10}}>Aperçu en temps réel</div>
          <div style={{background:`linear-gradient(135deg,${PREVIEW_COLOR},${PREVIEW_COLOR}cc)`,borderRadius:10,padding:"14px 16px",color:T.white,marginBottom:10}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
              <div style={{width:26,height:26,borderRadius:6,background:"rgba(255,255,255,.25)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700}}>{brandName.slice(0,1)}</div>
              <span style={{fontWeight:700,fontSize:13}}>{brandName}</span>
              <span style={{fontSize:10,background:"rgba(255,255,255,.2)",padding:"1px 7px",borderRadius:20}}>Powered by Qlower</span>
            </div>
            <div style={{fontSize:12,opacity:.8}}>Espace partenaire · Marque Blanche</div>
          </div>
          <div style={{fontSize:11,color:T.muted,lineHeight:1.6}}>La couleur et le nom s'appliquent à l'en-tête, aux boutons principaux et aux éléments d'accentuation de votre espace partenaire.</div>
        </Card>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
        <Card><div style={{fontWeight:600,fontSize:13,marginBottom:10}}>Intégrations</div><div style={{marginBottom:10}}>{lbl("Email fiscal personnalisé")}<Inp v={email} s={setEmail} ph="fiscalite@votredomaine.fr" t="email"/></div><div>{lbl("Lien Calendly")}<Inp v={calendly} s={setCalendly} ph="https://calendly.com/..."/></div></Card>
        <Card>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div><div style={{fontWeight:600,fontSize:13}}>Alertes déclaration fiscale</div><div style={{fontSize:11,color:T.muted,marginTop:2}}>Alertes avant les échéances clients</div></div>
            <div onClick={()=>setAlertes(v=>!v)} style={{width:40,height:22,borderRadius:11,background:alertes?T.blue:"var(--color-border-secondary)",cursor:"pointer",position:"relative",transition:"background .2s"}}><div style={{position:"absolute",top:2,left:alertes?20:2,width:18,height:18,borderRadius:"50%",background:T.white,transition:"left .2s"}}/></div>
          </div>
          {alertes&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><div>{lbl("Délai")}<Sel v={delai} s={setDelai} opts={[{v:"7",l:"7 jours avant"},{v:"15",l:"15 jours avant"},{v:"30",l:"30 jours avant"}]}/></div><div>{lbl("Email")}<Inp v={emailAlerte} s={setEmailAlerte} ph="alerts@..." t="email"/></div></div>}
        </Card>
      </div>
      <Btn variant="success" onClick={()=>{setSaved(true);setTimeout(()=>setSaved(false),2500);}}>{saved?"Enregistré !":"Enregistrer les paramètres"}</Btn>
    </div>
  );
}

// ── PARAMÈTRES ────────────────────────────────────────────────
function Parametres({onResetOnboarding}){
  const{partnerId,nom}=usePartner();
  const[cur,setCur]=useState("");const[nPwd,setNPwd]=useState("");const[conf,setConf]=useState("");const[msg,setMsg]=useState(null);
  const save=()=>{if(!cur){setMsg({t:"error",s:"Saisissez votre mot de passe actuel"});return;}if(nPwd.length<6){setMsg({t:"error",s:"Minimum 6 caractères"});return;}if(nPwd!==conf){setMsg({t:"error",s:"Les mots de passe ne correspondent pas"});return;}setCur("");setNPwd("");setConf("");setMsg({t:"success",s:"Mot de passe modifié avec succès"});};
  return(
    <div>
      <Hdg title="Paramètres" sub="Gestion de votre compte"/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
        <Card><div style={{fontWeight:600,fontSize:14,marginBottom:4}}>Changer le mot de passe</div><div style={{fontSize:11,color:T.muted,marginBottom:12}}>Identifiant : <code style={{background:"var(--color-background-tertiary)",padding:"1px 5px",borderRadius:4}}>{partnerId}</code></div><div style={{display:"flex",flexDirection:"column",gap:10}}><div>{lbl("Mot de passe actuel")}<PwdInp v={cur} s={setCur} ph="••••••••"/></div><div>{lbl("Nouveau mot de passe")}<PwdInp v={nPwd} s={setNPwd} ph="••••••••"/></div><div>{lbl("Confirmer")}<PwdInp v={conf} s={setConf} ph="••••••••"/></div></div>{msg&&<Alert type={msg.t==="success"?"success":"error"} sx={{marginTop:10}}>{msg.s}</Alert>}<Btn onClick={save} sx={{marginTop:12}}>Enregistrer</Btn></Card>
        <Card><div style={{fontWeight:600,fontSize:14,marginBottom:12}}>Informations du compte</div><div style={{fontSize:12,color:T.muted,lineHeight:2.2}}>Partenaire : {nom}<br/>Contrat : depuis 14/01/2026<br/>Contact : contact@{partnerId}.fr</div></Card>
      </div>
      <Card sx={{border:"1px solid var(--color-border-secondary)"}}><div style={{fontWeight:600,fontSize:14,marginBottom:4}}>Guide de démarrage</div><div style={{fontSize:12,color:T.muted,marginBottom:12}}>Vous pouvez relancer le guide si vous souhaitez revoir les étapes.</div><button onClick={onResetOnboarding} style={{padding:"8px 16px",borderRadius:8,border:`1.5px solid ${T.blue}`,background:"transparent",color:T.blue,fontSize:12,fontWeight:600,cursor:"pointer"}}>Relancer le guide</button></Card>
    </div>
  );
}

// ── COMMISSION EDITOR ─────────────────────────────────────────
function CommissionEditor({rules,onChange}){
  const updateRule=useCallback((i,field,val)=>{onChange(rules.map((r,idx)=>idx===i?{...r,[field]:val}:r));},[rules,onChange]);
  const updateTranche=useCallback((ri,ti,field,val)=>{onChange(rules.map((r,idx)=>{if(idx!==ri)return r;const tranches=(r.tranches||DEFAULT_TRANCHES()).map((t,j)=>j===ti?{...t,[field]:["max","montant"].includes(field)?Number(val):val}:t);return{...r,tranches};}));},[rules,onChange]);
  const warnings=rules.filter(r=>r.actif).map(r=>{if((r.type==="souscription"||r.type==="annuelle")&&(!r.montant||r.montant<=0))return`"${COMM_LABELS[r.type]}" : montant à 0 €`;if(r.type==="pct_ca"&&(!r.pct||r.pct<=0))return`"${COMM_LABELS[r.type]}" : % à 0`;return null;}).filter(Boolean);
  return(
    <div>
      {warnings.length>0&&<Alert type="warning" sx={{marginBottom:10}}>{warnings.map((w,i)=><div key={i}>⚠️ {w}</div>)}</Alert>}
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {rules.map((r,i)=>(
          <div key={r.type} style={{borderRadius:10,border:`1.5px solid ${r.actif?T.blue:"var(--color-border-secondary)"}`,overflow:"hidden",background:r.actif?T.blueXL:"var(--color-background-tertiary)"}}>
            <div style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px"}}>
              <div onClick={()=>updateRule(i,"actif",!r.actif)} style={{width:36,height:20,borderRadius:10,background:r.actif?T.blue:"var(--color-border-secondary)",cursor:"pointer",position:"relative",flexShrink:0,transition:"background .2s"}}><div style={{position:"absolute",top:2,left:r.actif?18:2,width:16,height:16,borderRadius:"50%",background:T.white,transition:"left .2s"}}/></div>
              <div style={{flex:1}}><div style={{fontWeight:600,fontSize:13,color:r.actif?T.blue:"var(--color-text-secondary)"}}>{COMM_LABELS[r.type]}</div>{!r.actif&&<div style={{fontSize:11,color:T.muted}}>Désactivé</div>}</div>
            </div>
            {r.actif&&<div style={{padding:"0 14px 14px"}}>
              {(r.type==="souscription"||r.type==="annuelle")&&<div style={{display:"flex",alignItems:"center",gap:10}}><div style={{flex:1}}>{lbl("Montant (€/abonné)")}<Inp v={String(r.montant||0)} s={v=>updateRule(i,"montant",Number(v))} ph="100" t="number"/></div><div style={{fontSize:12,color:T.muted,marginTop:16,flexShrink:0}}>{r.type==="souscription"?"versé 1× à la souscription":"versé chaque année"}</div></div>}
              {r.type==="biens"&&<div><div style={{fontSize:11,color:T.muted,marginBottom:8}}>Montant selon nb de biens déclarés</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>{(r.tranches||DEFAULT_TRANCHES()).map((tr,ti)=><div key={ti} style={{background:"var(--color-background-secondary)",borderRadius:8,padding:"8px 10px",border:"1px solid var(--color-border-tertiary)"}}><div style={{fontSize:11,color:T.muted,marginBottom:4}}>Jusqu'à <input type="number" value={tr.max} onChange={e=>updateTranche(i,ti,"max",e.target.value)} style={{width:36,padding:"2px 4px",borderRadius:4,border:"1px solid var(--color-border-secondary)",fontSize:11,background:"var(--color-background-primary)",color:"var(--color-text-primary)"}}/> bien{tr.max>1?"s":""}</div><div style={{display:"flex",alignItems:"center",gap:4}}><input type="number" value={tr.montant} onChange={e=>updateTranche(i,ti,"montant",e.target.value)} style={{width:60,padding:"4px 6px",borderRadius:5,border:`1px solid ${T.blue}`,fontSize:13,fontWeight:600,color:T.blue,background:"var(--color-background-primary)"}}/><span style={{fontSize:12,color:T.muted}}>€/abonné</span></div></div>)}</div></div>}
              {r.type==="pct_ca"&&<div style={{display:"flex",alignItems:"center",gap:10}}><div style={{flex:1}}>{lbl("% du CA")}<Inp v={String(r.pct||0)} s={v=>updateRule(i,"pct",Number(v))} ph="5" t="number"/></div><div style={{fontSize:12,color:T.muted,marginTop:16}}>du CA généré/abonné</div></div>}
            </div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── UTM GENERATOR ─────────────────────────────────────────────
function UtmGenerator({partners}){
  const BASE=["https://secure.qlower.com/signup","https://www.qlower.com/qlower-x-partenaire","https://qlower.com/offres"];
  const[tab,setTab]=useState("gen");const[partner,setPartner]=useState("");const[type,setType]=useState("cgp");const[campaign,setCampaign]=useState("partenaire");const[baseUrl,setBaseUrl]=useState(BASE[0]);const[customUrl,setCustomUrl]=useState("");const[saved,setSaved]=useState([]);const[copied,setCopied]=useState(false);
  const pd=partners.find(p=>p.nom===partner||p.id===partner);
  const utmVal=pd?pd.utm:slug(partner);
  const base=baseUrl==="custom"?customUrl:baseUrl;
  const url=partner&&base?`${base}?utm_source=${utmVal}&utm_medium=affiliation&utm_campaign=${campaign}&utm_content=${type}`:"";
  return(
    <div>
      <div style={{background:`linear-gradient(135deg,${T.orange},#ff9a7a)`,borderRadius:12,padding:"14px 20px",marginBottom:16,color:T.white}}><div style={{fontSize:15,fontWeight:700}}>Générateur de liens UTM</div></div>
      <div style={{display:"flex",gap:8,marginBottom:16}}>{[["gen","Générateur"],["saved","Sauvegardés ("+saved.length+")"]].map(([k,l])=><button key={k} onClick={()=>setTab(k)} style={{padding:"7px 14px",borderRadius:8,border:"none",cursor:"pointer",fontSize:12,fontWeight:500,background:tab===k?T.orange:"var(--color-background-secondary)",color:tab===k?T.white:T.muted}}>{l}</button>)}</div>
      {tab==="gen"&&<Card><div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div>{lbl("Partenaire")}<div style={{display:"flex",gap:8}}><Inp v={partner} s={setPartner} ph="ex: Cabinet Dupont"/>{partners.length>0&&<select value={partner} onChange={e=>setPartner(e.target.value)} style={{padding:"8px 10px",borderRadius:7,border:"1.5px solid var(--color-border-secondary)",background:"var(--color-background-primary)",color:"var(--color-text-primary)",fontSize:13,minWidth:130}}><option value="">Choisir existant</option>{partners.map(p=><option key={p.id} value={p.nom}>{p.nom}</option>)}</select>}</div>{partner&&<div style={{fontSize:11,color:T.muted,marginTop:3}}>utm_source : <strong style={{color:T.orange}}>{utmVal}</strong></div>}</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><div>{lbl("Type")}<Sel v={type} s={setType} opts={PARTNER_TYPES}/></div><div>{lbl("Campagne")}<Inp v={campaign} s={setCampaign} ph="partenaire"/></div></div>
        <div>{lbl("Page de destination")}<Sel v={baseUrl} s={setBaseUrl} opts={[...BASE.map(u=>({v:u,l:u})),{v:"custom",l:"URL personnalisée..."}]}/>{baseUrl==="custom"&&<div style={{marginTop:6}}><Inp v={customUrl} s={setCustomUrl} ph="https://..."/></div>}</div>
        {url&&<div>{lbl("Lien généré")}<div style={{background:"var(--color-background-tertiary)",borderRadius:8,padding:"10px 12px",fontSize:11,wordBreak:"break-all",lineHeight:1.7,border:"1px solid var(--color-border-tertiary)",marginBottom:8}}>{url}</div><div style={{display:"flex",gap:8}}><button onClick={()=>{navigator.clipboard.writeText(url).catch(()=>{});setCopied(true);setTimeout(()=>setCopied(false),2000);}} style={{flex:1,padding:"9px",borderRadius:8,border:"none",cursor:"pointer",fontWeight:600,fontSize:13,background:copied?T.green:T.orange,color:T.white}}>{copied?"Copié !":"Copier"}</button><button onClick={()=>{if(url&&!saved.find(s=>s.url===url))setSaved([{partner,type,url,date:new Date().toLocaleDateString("fr-FR")},...saved]);}} style={{flex:1,padding:"9px",borderRadius:8,border:"1.5px solid var(--color-border-secondary)",cursor:"pointer",fontWeight:600,fontSize:13,background:"var(--color-background-primary)",color:"var(--color-text-primary)"}}>Sauvegarder</button></div></div>}
      </div></Card>}
      {tab==="saved"&&(saved.length===0?<div style={{textAlign:"center",padding:32,color:T.muted}}><div style={{fontSize:28,marginBottom:10}}>📁</div><div>Aucun lien sauvegardé</div></div>:saved.map((l,i)=><div key={i} style={{background:"var(--color-background-secondary)",border:"1px solid var(--color-border-tertiary)",borderRadius:10,padding:"12px 14px",marginBottom:8}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontWeight:500,fontSize:13}}>{l.partner}</span><span style={{fontSize:11,color:T.muted}}>{l.date}</span></div><div style={{fontSize:11,color:T.muted,wordBreak:"break-all",background:"var(--color-background-tertiary)",padding:"6px 10px",borderRadius:6,marginBottom:6}}>{l.url}</div><button onClick={()=>navigator.clipboard.writeText(l.url).catch(()=>{})} style={{padding:"4px 10px",borderRadius:6,border:"1.5px solid var(--color-border-secondary)",background:"var(--color-background-primary)",fontSize:11,cursor:"pointer",color:"var(--color-text-primary)"}}>Copier</button></div>))}
    </div>
  );
}

// ── CAMPAGNES ADMIN ───────────────────────────────────────────
function AdminCampagnes({partners}){
  const[cible,setCible]=useState("all");
  const[template,setTemplate]=useState("intro");
  const[preview,setPreview]=useState(null);
  const[sent,setSent]=useState([]);

  const TEMPLATES={
    intro:{label:"Présentation du programme",subject:"Bienvenue dans Qlower Pro · Votre kit partenaire",body:(p)=>`Bonjour,\n\nVotre espace partenaire Qlower est maintenant actif.\n\nVoici vos outils :\n• Lien d'inscription affilié : ${buildSignupLink(p.utm,p.code)}\n• Code promo : ${p.code} (-20 € pour vos clients)\n\nConnectez-vous sur votre espace : https://pro.qlower.com\n\nÀ bientôt,\nColine — Qlower Pro`},
    relance:{label:"Relance activation",subject:"Avez-vous partagé votre lien Qlower ?",body:(p)=>`Bonjour,\n\nNous n'avons pas encore enregistré de leads via votre lien partenaire.\n\nRappel de vos outils :\n• Lien : ${buildSignupLink(p.utm,p.code)}\n• Code : ${p.code}\n\nBesoin d'aide ? Répondez à cet email ou prenez RDV : ${buildRdvLink(p.utm)}\n\nColine — Qlower Pro`},
    perf:{label:"Bilan de performance",subject:"Vos stats Qlower Pro · ${mois}",body:(p)=>`Bonjour,\n\nVoici votre bilan partenaire :\n• Leads générés : ${p.leads}\n• Abonnés actifs : ${p.abonnes}\n• Commission en attente : ${calcCommission(p.commRules,p.abonnes,p.biensMoyens,p.caParClient).total} €\n\nContinuez comme ça ! Votre lien : ${buildSignupLink(p.utm,p.code)}\n\nColine — Qlower Pro`},
    nouveaute:{label:"Annonce nouveauté",subject:"Nouveautés Qlower Pro · Ce qui change pour vous",body:(p)=>`Bonjour,\n\nNous avons amélioré votre espace partenaire :\n\n✅ Simulateur de revenus mis à jour\n✅ Nouveau : 3 façons de référer vos clients\n✅ Historique des referrals persistant\n\nAccédez à votre espace : https://pro.qlower.com\n\nColine — Qlower Pro`},
  };

  const cibleOptions=[{v:"all",l:"Tous les partenaires actifs"},{v:"affiliation",l:"Affiliation uniquement"},{v:"marque_blanche",l:"Marque Blanche uniquement"}];
  const filteredPartners=partners.filter(p=>{if(!p.active)return false;if(cible==="affiliation")return p.contrat==="affiliation";if(cible==="marque_blanche")return p.contrat==="marque_blanche";return true;});

  const genPreview=(p)=>({
    to:p.nom,
    subject:TEMPLATES[template].subject.replace("${mois}",new Date().toLocaleDateString("fr-FR",{month:"long",year:"numeric"})),
    body:TEMPLATES[template].body(p),
  });

  const handleSendAll=()=>{
    setSent(filteredPartners.map(p=>p.id));
    setPreview(null);
  };

  return(
    <div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
        <Card>
          <div style={{fontWeight:600,fontSize:14,marginBottom:12}}>1 · Ciblage</div>
          <div style={{marginBottom:12}}>{lbl("Audience")}<Sel v={cible} s={setCible} opts={cibleOptions}/></div>
          <div style={{padding:"10px 14px",background:"var(--color-background-tertiary)",borderRadius:8,border:"1px solid var(--color-border-tertiary)"}}>
            <div style={{fontSize:12,color:T.muted,marginBottom:6}}>Partenaires ciblés ({filteredPartners.length})</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:5}}>{filteredPartners.map(p=><Tag key={p.id} label={p.nom} c={p.contrat==="marque_blanche"?T.purple:T.blue} bg={p.contrat==="marque_blanche"?T.purpleBg:T.blueXL}/>)}</div>
          </div>
        </Card>
        <Card>
          <div style={{fontWeight:600,fontSize:14,marginBottom:12}}>2 · Template</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {Object.entries(TEMPLATES).map(([k,t])=>(
              <div key={k} onClick={()=>{setTemplate(k);setPreview(null);setSent([]);}} style={{padding:"10px 12px",borderRadius:8,cursor:"pointer",border:`1.5px solid ${template===k?T.blue:"var(--color-border-secondary)"}`,background:template===k?T.blueXL:"var(--color-background-primary)"}}>
                <div style={{fontWeight:500,fontSize:13,color:template===k?T.blue:"var(--color-text-primary)"}}>{t.label}</div>
                <div style={{fontSize:11,color:T.muted,marginTop:2}}>{t.subject.slice(0,50)}...</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card sx={{marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{fontWeight:600,fontSize:14}}>3 · Prévisualisation et envoi</div>
          <div style={{display:"flex",gap:8}}>
            {filteredPartners.length>0&&<button onClick={()=>setPreview(genPreview(filteredPartners[0]))} style={{padding:"7px 14px",borderRadius:8,border:`1.5px solid ${T.blue}`,background:"transparent",color:T.blue,fontSize:12,cursor:"pointer"}}>Prévisualiser</button>}
            {sent.length>0?<Tag label={`✓ Envoyé à ${sent.length} partenaires`} c={T.greenD} bg={T.greenBg}/>:<Btn onClick={handleSendAll} disabled={filteredPartners.length===0}>Envoyer à {filteredPartners.length} partenaire{filteredPartners.length>1?"s":""}</Btn>}
          </div>
        </div>
        {preview&&(
          <div style={{background:"var(--color-background-tertiary)",borderRadius:10,padding:16,border:"1px solid var(--color-border-tertiary)"}}>
            <div style={{fontSize:11,color:T.muted,marginBottom:4}}>Exemple pour : <strong>{preview.to}</strong></div>
            <div style={{fontWeight:600,fontSize:13,marginBottom:8}}>Objet : {preview.subject}</div>
            <div style={{fontSize:12,lineHeight:1.8,whiteSpace:"pre-line",color:"var(--color-text-primary)"}}>{preview.body}</div>
            <div style={{marginTop:10,fontSize:11,color:T.muted}}>⚠️ Les liens UTM sont personnalisés automatiquement pour chaque partenaire.</div>
          </div>
        )}
        {!preview&&sent.length===0&&<Alert type="info">Sélectionnez une audience et un template, prévisualisez pour un partenaire, puis envoyez à tous. Les liens UTM sont injectés automatiquement pour chaque destinataire.</Alert>}
      </Card>

      <Card>
        <div style={{fontWeight:600,fontSize:13,marginBottom:10}}>Récapitulatif · {filteredPartners.length} destinataires</div>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {filteredPartners.map(p=>{
            const isSent=sent.includes(p.id);
            return(
              <div key={p.id} style={{display:"grid",gridTemplateColumns:"1fr auto auto auto",gap:8,padding:"8px 12px",background:"var(--color-background-tertiary)",borderRadius:8,alignItems:"center",border:"1px solid var(--color-border-tertiary)"}}>
                <div><div style={{fontWeight:500,fontSize:13}}>{p.nom}</div><div style={{fontSize:11,color:T.muted}}>{p.id}@qlower.com · utm: {p.utm}</div></div>
                <Tag label={p.contrat==="marque_blanche"?"MB":"AF"} c={p.contrat==="marque_blanche"?T.purple:T.blue} bg={p.contrat==="marque_blanche"?T.purpleBg:T.blueXL}/>
                {isSent?<Tag label="Envoyé ✓" c={T.greenD} bg={T.greenBg}/>:<button onClick={()=>{setPreview(genPreview(p));}} style={{padding:"4px 10px",borderRadius:6,border:`1px solid ${T.blue}`,background:"transparent",color:T.blue,fontSize:11,cursor:"pointer"}}>Prévisualiser</button>}
                <div style={{fontSize:10,color:T.muted}}>{buildSignupLink(p.utm,p.code).slice(0,30)}...</div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ── ONBOARDING BATCH ──────────────────────────────────────────
function AdminBatchOnboarding({partners,setPartners}){
  const[rows,setRows]=useState([{id:1,nom:"",type:"agence-immo",contrat:"affiliation",email:"",code:"",utm:""}]);
  const[imported,setImported]=useState(false);const[created,setCreated]=useState([]);

  const addRow=()=>setRows(r=>[...r,{id:Date.now(),nom:"",type:"agence-immo",contrat:"affiliation",email:"",code:"",utm:""}]);
  const updateRow=(id,field,val)=>setRows(r=>r.map(row=>row.id===id?{...row,[field]:val,[field==="nom"&&!row.utm?"utm":field==="nom"&&!row.code?"code":""]:field==="nom"?slug(val):field==="nom"?val.toUpperCase().slice(0,4)+"20":row[field==="nom"&&!row.utm?"utm":field==="nom"&&!row.code?"code":""]}:row));
  const removeRow=id=>setRows(r=>r.filter(row=>row.id!==id));
  const autoFill=row=>({...row,utm:row.utm||slug(row.nom),code:row.code||(row.nom.toUpperCase().replace(/\s/g,"").slice(0,4)+"20"),pwd:"Qlower"+Math.random().toString(36).slice(2,7).toUpperCase()});

  const handleCreate=()=>{
    const valid=rows.filter(r=>r.nom);
    const filled=valid.map(autoFill);
    const newPartners=filled.map(r=>({
      id:slug(r.nom)+"-"+Date.now().toString().slice(-4),pwd:r.pwd,nom:r.nom,type:r.type,
      contrat:r.contrat,code:r.code,utm:r.utm,active:true,leads:0,abonnes:0,
      biensMoyens:2,caParClient:300,commObjAnnuel:500,
      commRules:[{type:"annuelle",montant:100,actif:true},{type:"souscription",montant:0,actif:false},{type:"biens",tranches:DEFAULT_TRANCHES(),actif:false},{type:"pct_ca",pct:0,actif:false}],
      hsSync:true,referralHistory:[],brandColor:T.blue,brandLogo:"",accessFee:0,
    }));
    setPartners(ps=>[...ps,...newPartners]);
    setCreated(newPartners);
    setImported(true);
  };

  const CSV_EXAMPLE="Nom,Type,Contrat,Email\nCabinet Martin,cgp,affiliation,martin@cabinet.fr\nFoncia Paris,agence-immo,affiliation,contact@foncia.fr";

  if(imported)return(
    <div>
      <Alert type="success" sx={{marginBottom:16}}><div style={{fontWeight:600,marginBottom:6}}>✅ {created.length} partenaires créés avec succès</div>{created.map((p,i)=><div key={i} style={{marginBottom:2}}>• {p.nom} · ID: {p.id} · Code: {p.code} · Pwd provisoire: {p.pwd}</div>)}</Alert>
      <Alert type="info" sx={{marginBottom:16}}>Les identifiants provisoires sont à communiquer aux partenaires. Ils pourront les modifier dans leurs paramètres.</Alert>
      <div style={{display:"flex",gap:8}}>
        <Btn onClick={()=>{setImported(false);setRows([{id:1,nom:"",type:"agence-immo",contrat:"affiliation",email:"",code:"",utm:""}]);setCreated([]);}}>Créer un autre batch</Btn>
        <button onClick={()=>{const csv=["Nom,ID,Code,UTM,Lien,Mot de passe",...created.map(p=>`${p.nom},${p.id},${p.code},${p.utm},${buildSignupLink(p.utm,p.code)},${p.pwd}`)].join("\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="partenaires_onboarding.csv";a.click();}} style={{padding:"8px 16px",borderRadius:8,border:`1.5px solid ${T.green}`,background:"transparent",color:T.green,fontSize:13,fontWeight:600,cursor:"pointer"}}>Exporter les identifiants (.csv)</button>
      </div>
    </div>
  );

  return(
    <div>
      <Alert type="info" sx={{marginBottom:16}}>Créez plusieurs comptes partenaires en lot. Idéal pour l'onboarding des 22 AF existants. Les UTM, codes promo et mots de passe provisoires sont générés automatiquement.</Alert>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
        <Card>
          <div style={{fontWeight:600,fontSize:13,marginBottom:8}}>Import CSV (optionnel)</div>
          <div style={{background:"var(--color-background-tertiary)",borderRadius:7,padding:"8px 10px",fontSize:11,fontFamily:"monospace",color:T.muted,lineHeight:1.8,marginBottom:8}}>{CSV_EXAMPLE}</div>
          <div style={{border:"2px dashed var(--color-border-secondary)",borderRadius:8,padding:14,textAlign:"center",cursor:"pointer",background:"var(--color-background-tertiary)"}}><div style={{fontSize:16,marginBottom:4}}>📁</div><div style={{fontSize:12,color:T.muted}}>Glisser un CSV · colonnes : Nom, Type, Contrat, Email</div></div>
        </Card>
        <Card>
          <div style={{fontWeight:600,fontSize:13,marginBottom:8}}>Résumé</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}><span style={{color:T.muted}}>Lignes saisies</span><strong>{rows.filter(r=>r.nom).length}/{rows.length}</strong></div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}><span style={{color:T.muted}}>Affiliation</span><strong>{rows.filter(r=>r.nom&&r.contrat==="affiliation").length}</strong></div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}><span style={{color:T.muted}}>Marque Blanche</span><strong>{rows.filter(r=>r.nom&&r.contrat==="marque_blanche").length}</strong></div>
            <div style={{marginTop:4,padding:"8px 10px",background:T.greenBg,borderRadius:6,fontSize:11,color:T.greenD}}>UTM · codes promo · mdp provisoires générés automatiquement</div>
          </div>
        </Card>
      </div>

      <Card sx={{marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{fontWeight:600,fontSize:14}}>Saisie manuelle</div>
          <button onClick={addRow} style={{padding:"5px 12px",borderRadius:7,border:`1.5px solid ${T.blue}`,background:"transparent",color:T.blue,fontSize:12,cursor:"pointer"}}>+ Ajouter une ligne</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1.5fr 1fr 1fr auto",gap:8,padding:"6px 8px",background:"var(--color-background-tertiary)",borderRadius:7,marginBottom:8}}>
          {["Nom du partenaire","Type","Contrat",""].map((h,i)=><div key={i} style={{fontSize:10,fontWeight:500,color:T.muted,textTransform:"uppercase"}}>{h}</div>)}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {rows.map(row=>(
            <div key={row.id} style={{display:"grid",gridTemplateColumns:"1.5fr 1fr 1fr auto",gap:8,alignItems:"center"}}>
              <Inp v={row.nom} s={v=>updateRow(row.id,"nom",v)} ph="Cabinet Martin"/>
              <Sel v={row.type} s={v=>updateRow(row.id,"type",v)} opts={PARTNER_TYPES}/>
              <Sel v={row.contrat} s={v=>updateRow(row.id,"contrat",v)} opts={[{v:"affiliation",l:"Affiliation"},{v:"marque_blanche",l:"MB"}]}/>
              <button onClick={()=>removeRow(row.id)} style={{padding:"4px 8px",borderRadius:6,border:`1px solid ${T.red}`,background:"transparent",color:T.red,fontSize:11,cursor:"pointer"}}>✕</button>
            </div>
          ))}
        </div>
      </Card>
      <Btn onClick={handleCreate} disabled={!rows.some(r=>r.nom)}>Créer {rows.filter(r=>r.nom).length} partenaire{rows.filter(r=>r.nom).length>1?"s":""} + générer les identifiants</Btn>
    </div>
  );
}

// ── PARTNER ROW ───────────────────────────────────────────────
function PartnerRow({p,isEditing,editing,setEditing,onToggleActive,onSave}){
  const{total:commTotal}=useMemo(()=>calcCommission(p.commRules,p.abonnes,p.biensMoyens,p.caParClient),[p.commRules,p.abonnes,p.biensMoyens,p.caParClient]);
  const editPreview=useMemo(()=>{if(!isEditing||!editing)return null;return calcCommission(editing.commRules||[],editing.abonnes,editing.biensMoyens||2,editing.caParClient||300);},[isEditing,editing]);
  return(
    <div style={{background:"var(--color-background-secondary)",borderRadius:10,border:"1px solid var(--color-border-tertiary)",overflow:"hidden"}}>
      <div style={{display:"grid",gridTemplateColumns:"auto 1fr auto auto auto auto auto",gap:8,padding:"11px 14px",alignItems:"center"}}>
        <div style={{width:8,height:8,borderRadius:"50%",background:p.active?T.green:T.red}}/>
        <div><div style={{fontWeight:600,fontSize:13}}>{p.nom}</div><div style={{fontSize:11,color:T.muted,marginTop:1}}>{p.id} · {p.utm} · {p.leads} leads · {p.abonnes} abonnés · <span style={{color:T.blue,fontWeight:500}}>{commTotal} €</span></div><div style={{fontSize:10,color:T.muted,marginTop:1}}>{p.commRules.filter(r=>r.actif).map(r=>COMM_LABELS[r.type]).join(" + ")||"Aucune règle"}</div></div>
        <Tag label={p.type} c={T.gray} bg={T.grayBg}/>
        <Tag label={p.contrat==="marque_blanche"?"MB":"AFF"} c={p.contrat==="marque_blanche"?T.purple:"#1e40af"} bg={p.contrat==="marque_blanche"?T.purpleBg:"#dbeafe"}/>
        <Tag label={p.active?"Actif":"Inactif"} c={p.active?T.green:T.red} bg={p.active?T.greenBg:T.redBg}/>
        <button onClick={()=>setEditing(isEditing?null:{...p,ePwd:""})} style={{padding:"4px 10px",borderRadius:6,border:`1.5px solid ${T.blue}`,background:"transparent",color:T.blue,fontSize:11,cursor:"pointer"}}>{isEditing?"Fermer":"Modifier"}</button>
        <button onClick={onToggleActive} style={{padding:"4px 10px",borderRadius:6,border:`1.5px solid ${p.active?T.red:T.green}`,background:"transparent",color:p.active?T.red:T.green,fontSize:11,cursor:"pointer"}}>{p.active?"Désactiver":"Activer"}</button>
      </div>
      {isEditing&&editing&&<div style={{borderTop:"1px solid var(--color-border-tertiary)",padding:"14px",background:"var(--color-background-primary)"}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>
          <div>{lbl("Nom affiché")}<Inp v={editing.nom} s={v=>setEditing(e=>({...e,nom:v}))} ph=""/></div>
          <div>{lbl("UTM source")}<Inp v={editing.utm} s={v=>setEditing(e=>({...e,utm:v}))} ph=""/></div>
          <div>{lbl("Biens moyens")}<Inp v={String(editing.biensMoyens||2)} s={v=>setEditing(e=>({...e,biensMoyens:Number(v)}))} ph="2" t="number"/></div>
          <div>{lbl("CA moyen/client (€)")}<Inp v={String(editing.caParClient||300)} s={v=>setEditing(e=>({...e,caParClient:Number(v)}))} ph="300" t="number"/></div>
          <div>{lbl("Objectif annuel (€)")}<Inp v={String(editing.commObjAnnuel||500)} s={v=>setEditing(e=>({...e,commObjAnnuel:Number(v)}))} ph="500" t="number"/></div>
          <div>{lbl("Contrat")}<Sel v={editing.contrat||"affiliation"} s={v=>setEditing(e=>({...e,contrat:v}))} opts={[{v:"affiliation",l:"Affiliation"},{v:"marque_blanche",l:"Marque Blanche"}]}/></div>
          <div>{lbl("Nouveau mdp")}<PwdInp v={editing.ePwd||""} s={v=>setEditing(e=>({...e,ePwd:v}))} ph="Laisser vide = inchangé"/></div>
        </div>
        <div style={{fontWeight:600,fontSize:13,marginBottom:10}}>Règles de commission</div>
        <CommissionEditor rules={editing.commRules||[]} onChange={v=>setEditing(e=>({...e,commRules:v}))}/>
        {editPreview&&editPreview.detail.length>0&&<div style={{marginTop:12}}>
          <div style={{fontSize:12,color:T.muted,marginBottom:6}}>Aperçu pour {editing.abonnes} abonnés :</div>
          {editPreview.detail.map((d,i)=><div key={i} style={{fontSize:12,padding:"4px 10px",background:T.blueXL,borderRadius:6,marginBottom:4,display:"flex",justifyContent:"space-between"}}><span>{d.label} · {d.calc}</span><strong style={{color:T.blue}}>{d.montant} €</strong></div>)}
          <div style={{fontSize:13,fontWeight:700,color:T.blue,marginTop:6,textAlign:"right"}}>Total : {editPreview.total} €</div>
        </div>}
        <div style={{display:"flex",gap:8,marginTop:12}}><Btn onClick={onSave}>Enregistrer</Btn><Btn variant="ghost" onClick={()=>setEditing(null)}>Annuler</Btn></div>
      </div>}
    </div>
  );
}

// ── ADMIN ─────────────────────────────────────────────────────
function Admin({onBack,partners,setPartners}){
  const[tab,setTab]=useState("partners");const[editing,setEditing]=useState(null);const[showNew,setShowNew]=useState(false);
  const[nId,setNId]=useState("");const[nNom,setNNom]=useState("");const[nType,setNType]=useState("cgp");const[nUtm,setNUtm]=useState("");const[nPwd,setNPwd]=useState("");const[nContrat,setNContrat]=useState("affiliation");const[nObjAnnuel,setNObjAnnuel]=useState("500");
  const[nRules,setNRules]=useState([{type:"souscription",montant:0,actif:false},{type:"annuelle",montant:100,actif:true},{type:"biens",tranches:DEFAULT_TRANCHES(),actif:false},{type:"pct_ca",pct:0,actif:false}]);
  const[cpwd,setCpwd]=useState("");const[np,setNp]=useState("");const[cp,setCp]=useState("");const[pwdMsg,setPwdMsg]=useState(null);const[createLog,setCreateLog]=useState([]);
  const[hsValues,setHsValues]=useState(["Lybox","CocoonR","Betao","Nyko","Climb","Lodgify","Immocompare","Independant.io","Gestin","Oqoro","Hestia Conciergerie","Guest Ready","ImmoConsult","Orpi Vie et Logis","As Courtage"]);

  const createPartner=()=>{
    if(!nId||!nNom||!nPwd)return;
    const newP={id:nId,pwd:nPwd,nom:nNom,type:nType,utm:nUtm||slug(nNom),code:nNom.toUpperCase().slice(0,4)+"20",contrat:nContrat,active:true,leads:0,abonnes:0,biensMoyens:2,caParClient:300,commObjAnnuel:Number(nObjAnnuel)||500,commRules:nRules,hsSync:true,referralHistory:[],brandColor:T.blue,brandLogo:"",accessFee:0};
    setPartners(ps=>[...ps,newP]);setHsValues(v=>[...v,nNom]);
    setCreateLog([{s:"success",a:`"${nNom}" ajouté`},{s:"success",a:`Workflow Leads ${nNom} créé`},{s:"info",a:`utm_source=${nUtm||slug(nNom)} · code=${newP.code}`}]);
    setShowNew(false);setNId("");setNNom("");setNUtm("");setNPwd("");setNContrat("affiliation");setNObjAnnuel("500");
    setNRules([{type:"souscription",montant:0,actif:false},{type:"annuelle",montant:100,actif:true},{type:"biens",tranches:DEFAULT_TRANCHES(),actif:false},{type:"pct_ca",pct:0,actif:false}]);
    setTab("partners");
  };
  const totalLeads=partners.reduce((s,p)=>s+p.leads,0);
  const totalAb=partners.reduce((s,p)=>s+p.abonnes,0);
  const totalCom=useMemo(()=>partners.reduce((s,p)=>s+calcCommission(p.commRules,p.abonnes,p.biensMoyens,p.caParClient).total,0),[partners]);

  return(
    <div style={{fontFamily:"Inter,sans-serif",color:"var(--color-text-primary)"}}>
      <div style={{background:`linear-gradient(135deg,${T.blue},${T.blueL})`,borderRadius:12,padding:"14px 20px",marginBottom:16,color:T.white,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div><div style={{fontSize:16,fontWeight:700}}>Administration Qlower</div><div style={{fontSize:11,opacity:.85,marginTop:2}}>Master Pro · Équipe Qlower uniquement</div></div>
        <button onClick={onBack} style={{padding:"5px 12px",borderRadius:7,border:"1px solid rgba(255,255,255,.4)",background:"rgba(255,255,255,.15)",color:T.white,fontSize:11,cursor:"pointer"}}>Déconnexion</button>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
        {[["partners","Partenaires"],["campagnes","📣 Campagnes"],["batch","👥 Onboarding batch"],["utm","UTM"],["stats","Stats"],["facturation","Facturation"],["settings","Paramètres"]].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} style={{padding:"7px 14px",borderRadius:8,border:"none",cursor:"pointer",fontSize:12,fontWeight:500,background:tab===k?(k==="utm"?T.orange:k==="campagnes"?T.green:k==="batch"?T.purple:T.blue):"var(--color-background-secondary)",color:tab===k?T.white:T.muted}}>{l}</button>
        ))}
        {tab==="partners"&&<button onClick={()=>setShowNew(true)} style={{marginLeft:"auto",padding:"7px 14px",borderRadius:8,border:`1.5px solid ${T.blue}`,background:"transparent",color:T.blue,fontSize:12,cursor:"pointer"}}>+ Nouveau partenaire</button>}
      </div>

      {createLog.length>0&&<Card sx={{marginBottom:16}}><div style={{fontWeight:600,fontSize:13,marginBottom:8}}>Actions effectuées</div>{createLog.map((l,i)=><div key={i} style={{display:"flex",gap:8,marginBottom:6,fontSize:12}}><span>{l.s==="success"?"✅":"ℹ️"}</span><span>{l.a}</span></div>)}<button onClick={()=>setCreateLog([])} style={{marginTop:6,padding:"4px 10px",borderRadius:6,border:"1px solid var(--color-border-secondary)",background:"transparent",color:T.muted,fontSize:11,cursor:"pointer"}}>Fermer</button></Card>}

      {tab==="campagnes"&&<AdminCampagnes partners={partners}/>}
      {tab==="batch"&&<AdminBatchOnboarding partners={partners} setPartners={setPartners}/>}
      {tab==="utm"&&<UtmGenerator partners={partners}/>}

      {tab==="partners"&&<>
        {showNew&&<Card sx={{marginBottom:14,border:`1.5px solid ${T.blue}`}}>
          <div style={{fontWeight:600,fontSize:14,marginBottom:14}}>Créer un nouveau partenaire</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>
            <div>{lbl("Identifiant *")}<Inp v={nId} s={v=>setNId(v.toLowerCase().replace(/\s/g,""))} ph="cabinet-martin"/></div>
            <div>{lbl("Nom affiché *")}<Inp v={nNom} s={setNNom} ph="Cabinet Martin"/></div>
            <div>{lbl("Type")}<Sel v={nType} s={setNType} opts={PARTNER_TYPES}/></div>
            <div>{lbl("UTM source")}<Inp v={nUtm} s={setNUtm} ph={slug(nNom||"nom")}/></div>
            <div>{lbl("Contrat")}<Sel v={nContrat} s={setNContrat} opts={[{v:"affiliation",l:"Affiliation"},{v:"marque_blanche",l:"Marque Blanche"}]}/></div>
            <div>{lbl("Objectif annuel (€)")}<Inp v={nObjAnnuel} s={setNObjAnnuel} ph="500" t="number"/></div>
            <div>{lbl("Mot de passe *")}<PwdInp v={nPwd} s={setNPwd} ph="••••••••"/></div>
          </div>
          <div style={{marginBottom:14}}><div style={{fontWeight:600,fontSize:13,marginBottom:10}}>Règles de commission</div><CommissionEditor rules={nRules} onChange={setNRules}/></div>
          {(!nId||!nNom||!nPwd)&&<Alert type="warning" sx={{marginBottom:10}}>Identifiant, nom et mot de passe sont obligatoires.</Alert>}
          <div style={{display:"flex",gap:8}}><Btn onClick={createPartner} disabled={!nId||!nNom||!nPwd}>Créer + Synchroniser HubSpot</Btn><Btn variant="ghost" onClick={()=>setShowNew(false)}>Annuler</Btn></div>
        </Card>}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {partners.map(p=><PartnerRow key={p.id} p={p} isEditing={editing?.id===p.id} editing={editing} setEditing={setEditing} onToggleActive={()=>setPartners(ps=>ps.map(pp=>pp.id===p.id?{...pp,active:!pp.active}:pp))} onSave={()=>{setPartners(ps=>ps.map(pp=>pp.id===editing.id?editing:pp));setEditing(null);}}/>)}
        </div>
        <Card sx={{marginTop:16}}><div style={{fontWeight:600,fontSize:13,marginBottom:6}}>HubSpot partenaire__lead_ ({hsValues.length} valeurs)</div><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{hsValues.map((v,i)=><Tag key={i} label={v} c={partners.find(p=>p.nom===v)?T.green:T.gray} bg={partners.find(p=>p.nom===v)?T.greenBg:T.grayBg}/>)}</div></Card>
      </>}

      {tab==="stats"&&<>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14}}>
          <Stat icon="🤝" val={partners.filter(p=>p.active).length} label="Actifs" color={T.blue}/>
          <Stat icon="👥" val={totalLeads} label="Leads" color={T.gray}/>
          <Stat icon="✅" val={totalAb} label="Abonnés" color={T.green}/>
          <Stat icon="💰" val={`${totalCom} €`} label="Commissions" color={T.purple}/>
        </div>
        <div style={{background:"var(--color-background-secondary)",borderRadius:12,overflow:"hidden",border:"1px solid var(--color-border-tertiary)"}}>
          <div style={{display:"grid",gridTemplateColumns:"1.5fr 1.2fr auto auto auto auto auto",gap:8,padding:"8px 14px",background:"var(--color-background-tertiary)",borderBottom:"1px solid var(--color-border-tertiary)"}}>
            {["Partenaire","Règles actives","Leads","Abonnés","Commission","Taux","MB élig."].map((h,i)=><div key={i} style={{fontSize:10,fontWeight:500,color:T.muted,textTransform:"uppercase"}}>{h}</div>)}
          </div>
          {partners.map((p,i)=>{const tx=p.leads>0?Math.round(p.abonnes/p.leads*100):0;const{total:comm}=calcCommission(p.commRules,p.abonnes,p.biensMoyens,p.caParClient);return(
            <div key={p.id} style={{display:"grid",gridTemplateColumns:"1.5fr 1.2fr auto auto auto auto auto",gap:8,padding:"10px 14px",borderBottom:i<partners.length-1?"1px solid var(--color-border-tertiary)":"none",alignItems:"center"}}>
              <div><div style={{fontWeight:500,fontSize:13}}>{p.nom}</div><div style={{fontSize:10,color:p.active?T.green:T.red}}>{p.active?"Actif":"Inactif"}</div></div>
              <div style={{fontSize:11,color:T.muted}}>{p.commRules.filter(r=>r.actif).map(r=>COMM_LABELS[r.type]).join(" + ")||"—"}</div>
              <div style={{fontSize:13,fontWeight:600,textAlign:"center"}}>{p.leads}</div>
              <div style={{fontSize:13,fontWeight:600,color:T.green,textAlign:"center"}}>{p.abonnes}</div>
              <div style={{fontSize:13,fontWeight:600,color:T.purple,textAlign:"center"}}>{comm} €</div>
              <div style={{fontSize:13,fontWeight:600,color:T.blue,textAlign:"center"}}>{tx}%</div>
              <div style={{textAlign:"center"}}>{p.leads>=50?<Tag label="Éligible" c={T.green} bg={T.greenBg}/>:<Tag label={`${p.leads}/50`} c={T.gray} bg={T.grayBg}/>}</div>
            </div>
          );})}
        </div>
      </>}

      {tab==="facturation"&&<>
        <Card sx={{marginBottom:12,padding:"12px 16px"}}><div style={{fontWeight:600,fontSize:13,marginBottom:4}}>Appels à facturation · Annuel</div><div style={{fontSize:12,color:T.muted}}>Prochaine date : 01/01/2027 · Commissions selon règles par partenaire</div></Card>
        <div style={{background:"var(--color-background-secondary)",borderRadius:12,overflow:"hidden",border:"1px solid var(--color-border-tertiary)"}}>
          <div style={{display:"grid",gridTemplateColumns:"1.5fr 1.2fr auto auto auto",gap:8,padding:"8px 14px",background:"var(--color-background-tertiary)",borderBottom:"1px solid var(--color-border-tertiary)"}}>
            {["Partenaire","Règles","Abonnés","Montant dû","Action"].map((h,i)=><div key={i} style={{fontSize:10,fontWeight:500,color:T.muted,textTransform:"uppercase"}}>{h}</div>)}
          </div>
          {partners.filter(p=>p.active).map((p,i,arr)=>{const{total,detail}=calcCommission(p.commRules,p.abonnes,p.biensMoyens,p.caParClient);return(
            <div key={p.id} style={{borderBottom:i<arr.length-1?"1px solid var(--color-border-tertiary)":"none"}}>
              <div style={{display:"grid",gridTemplateColumns:"1.5fr 1.2fr auto auto auto",gap:8,padding:"10px 14px",alignItems:"center"}}>
                <div style={{fontWeight:500,fontSize:13}}>{p.nom}</div>
                <div style={{fontSize:11,color:T.muted}}>{p.commRules.filter(r=>r.actif).map(r=>COMM_LABELS[r.type]).join(" + ")||"—"}</div>
                <div style={{fontSize:13,fontWeight:600,textAlign:"center"}}>{p.abonnes}</div>
                <div style={{fontSize:13,fontWeight:600,color:T.purple}}>{total} €</div>
                <button style={{padding:"4px 10px",borderRadius:6,border:`1px solid ${T.blue}`,background:"transparent",color:T.blue,fontSize:11,cursor:"pointer"}}>Générer appel</button>
              </div>
              {detail.length>0&&<div style={{padding:"0 14px 10px",display:"flex",flexDirection:"column",gap:3}}>{detail.map((d,j)=><div key={j} style={{fontSize:11,color:T.muted,display:"flex",justifyContent:"space-between"}}><span>{d.label} · {d.calc}</span><span>{d.montant} €</span></div>)}</div>}
            </div>
          );})}
        </div>
      </>}

      {tab==="settings"&&<div style={{maxWidth:480}}>
        <Card><div style={{fontWeight:600,fontSize:14,marginBottom:4}}>Mot de passe administrateur</div><div style={{fontSize:11,color:T.muted,marginBottom:12}}>Identifiant : <code style={{background:"var(--color-background-tertiary)",padding:"1px 5px",borderRadius:4}}>admin</code></div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}><div>{lbl("Actuel")}<PwdInp v={cpwd} s={setCpwd} ph="••••••••"/></div><div>{lbl("Nouveau")}<PwdInp v={np} s={setNp} ph="••••••••"/></div><div>{lbl("Confirmer")}<PwdInp v={cp} s={setCp} ph="••••••••"/></div></div>
          {pwdMsg&&<Alert type={pwdMsg.t==="success"?"success":"error"} sx={{marginTop:10}}>{pwdMsg.s}</Alert>}
          <Btn onClick={()=>{if(cpwd.length<4){setPwdMsg({t:"error",s:"Mot de passe actuel incorrect"});return;}if(np.length<6){setPwdMsg({t:"error",s:"Minimum 6 caractères"});return;}if(np!==cp){setPwdMsg({t:"error",s:"Mots de passe différents"});return;}setCpwd("");setNp("");setCp("");setPwdMsg({t:"success",s:"Mot de passe modifié"});}} sx={{marginTop:12}}>Enregistrer</Btn>
        </Card>
      </div>}
    </div>
  );
}

// ── SHELL ─────────────────────────────────────────────────────
const PRO_NAV=[
  {key:"guide",    icon:"🚀",label:"Démarrage"},
  {key:"dashboard",icon:"📊",label:"Dashboard"},
  {key:"referer",  icon:"⭐",label:"Référer"},
  {key:"revenus",  icon:"💰",label:"Revenus"},
  {key:"outils",   icon:"🧰",label:"Outils"},
  {key:"mb",       icon:"🏷",label:"Marque Blanche"},
  {key:"settings", icon:"⚙️",label:"Paramètres"},
];


// ── HS ONBOARDING STEP ──────────────────────────────────────
function HsOnboardingStep({company, codePromo, contrat, onDone}) {
  const[syncing, setSyncing] = useState(true);
  const[steps, setSteps] = useState([]);
  
  useState(() => {
    const timer1 = setTimeout(() => setSteps(s => [...s, {s:"success", a:`Propriété HubSpot "partenaire__lead_" mise à jour`}]), 800);
    const timer2 = setTimeout(() => setSteps(s => [...s, {s:"success", a:`Workflow "Leads ${company}" créé`}]), 1600);
    const timer3 = setTimeout(() => setSteps(s => [...s, {s:"info", a:`Code promo ${codePromo} · Contrat : ${contrat}`}]), 2200);
    const timer4 = setTimeout(() => setSyncing(false), 2800);
    return () => { clearTimeout(timer1); clearTimeout(timer2); clearTimeout(timer3); clearTimeout(timer4); };
  });

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{fontWeight:600,fontSize:14,marginBottom:4}}>Synchronisation HubSpot</div>
      {syncing && <div style={{textAlign:"center",padding:"16px 0",color:T.blue}}><div style={{fontSize:24,marginBottom:8}}>⏳</div><div style={{fontSize:13}}>Synchronisation en cours...</div></div>}
      {steps.map((l,i) => <div key={i} style={{display:"flex",gap:8,marginBottom:4,fontSize:12}}><span>{l.s==="success"?"✅":"ℹ️"}</span><span>{l.a}</span></div>)}
      {!syncing && <Alert type="success"><div style={{textAlign:"center",padding:"8px 0"}}><div style={{fontSize:28,marginBottom:8}}>🎉</div><div style={{fontWeight:700,fontSize:15,marginBottom:6}}>Inscription terminée !</div><div style={{fontSize:12,marginBottom:16}}>Votre espace partenaire est prêt. Coline vous contacte sous 48h.</div><Btn variant="success" onClick={() => onDone({code:codePromo, contrat, company})}>Accéder à mon espace</Btn></div></Alert>}
    </div>
  );
}

export default function App(){
  const[view,setView]              =useState("home");
  const[module,setModule]          =useState("guide");
  const[guideDone,setGuideDone]    =useState(false);
  const[guideHidden,setGuideHidden]=useState(false);
  const[currentPartnerId,setCurrentPartnerId]=useState(null);
  const[partners,setPartners]      =useState(INIT_PARTNERS_DATA);

  const currentPartner=useMemo(()=>partners.find(p=>p.id===currentPartnerId)||null,[partners,currentPartnerId]);
  const addReferral=useCallback((contact)=>{setPartners(ps=>ps.map(p=>p.id===currentPartnerId?{...p,referralHistory:[contact,...(p.referralHistory||[])]}:p));},[currentPartnerId]);

  const handleLogin=({type,partnerId})=>{
    if(type==="admin"){setView("admin");return;}
    setCurrentPartnerId(partnerId);
    setView("pro");setModule("guide");setGuideDone(false);setGuideHidden(false);
  };
  const handleGuideDone=()=>{setGuideDone(true);setGuideHidden(true);setModule("dashboard");};
  const handleResetOnboarding=()=>{setGuideDone(false);setGuideHidden(false);setModule("guide");};

  const ctx=useMemo(()=>{
    if(!currentPartner)return{};
    return{...currentPartner,partnerId:currentPartner.id,partnerType:currentPartner.type,referralHistory:currentPartner.referralHistory||[],addReferral,setModule};
  },[currentPartner,addReferral]);

  const nav=PRO_NAV.filter(m=>{
    // HIDDEN v8 : MB cachée pour tous jusqu'à réouverture — ne pas supprimer
    if(m.key==="mb") return false;
    if(m.key==="guide"&&guideHidden)return false;
    if(m.key==="referer"&&currentPartner?.contrat==="marque_blanche")return false;
    return true;
  });

  if(view==="home")    return <div style={{fontFamily:"Inter,sans-serif",padding:"8px 0"}}><HomePage onRegister={()=>setView("register")} onLogin={()=>setView("login")}/></div>;
  if(view==="login")   return <div style={{fontFamily:"Inter,sans-serif",padding:"8px 0"}}><LoginForm onLogin={handleLogin} onBack={()=>setView("home")} onRegister={()=>setView("register")} partners={partners}/></div>;
  if(view==="register")return <div style={{fontFamily:"Inter,sans-serif",padding:"8px 0"}}><Onboarding onDone={({code,contrat,company})=>{const newId=slug(company||"nouveau")+"-"+Date.now().toString().slice(-4);setPartners(ps=>[...ps,{id:newId,pwd:"",nom:company||"Nouveau Partenaire",code,utm:slug(company||"nouveau"),contrat,type:"autre",active:true,leads:0,abonnes:0,biensMoyens:2,caParClient:300,commObjAnnuel:500,commRules:[{type:"annuelle",montant:100,actif:true},{type:"souscription",montant:0,actif:false},{type:"biens",tranches:DEFAULT_TRANCHES(),actif:false},{type:"pct_ca",pct:0,actif:false}],hsSync:true,referralHistory:[],brandColor:T.blue,brandLogo:"",accessFee:0}]);handleLogin({type:"partner",partnerId:newId});}} onCancel={()=>setView("home")}/></div>;
  if(view==="admin")   return <div style={{fontFamily:"Inter,sans-serif",padding:"8px 0"}}><Admin onBack={()=>setView("home")} partners={partners} setPartners={setPartners}/></div>;

  return(
    <PartnerCtx.Provider value={ctx}>
      <div style={{fontFamily:"Inter,sans-serif",color:"var(--color-text-primary)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 0 12px",borderBottom:"1px solid var(--color-border-tertiary)",marginBottom:16,flexWrap:"wrap",gap:8}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:28,height:28,borderRadius:6,background:currentPartner?.brandColor||T.blue,display:"flex",alignItems:"center",justifyContent:"center",color:T.white,fontSize:14,fontWeight:700}}>Q</div>
            <span style={{fontWeight:700,fontSize:14}}>Qlower Pro</span>
            <span style={{fontSize:11,background:T.blueXL,color:T.blue,padding:"2px 8px",borderRadius:20,fontWeight:500}}>{currentPartner?.nom}</span>
            {currentPartner?.contrat==="marque_blanche"&&<Tag label="Marque Blanche" c={T.purple} bg={T.purpleBg}/>}
          </div>
          <button onClick={()=>{setView("home");setCurrentPartnerId(null);}} style={{padding:"5px 12px",borderRadius:7,border:"1.5px solid var(--color-border-secondary)",background:"transparent",color:T.muted,fontSize:11,cursor:"pointer"}}>Déconnexion</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"130px 1fr",gap:16}}>
          <div style={{display:"flex",flexDirection:"column",gap:2}}>
            {nav.map(m=>(
              <button key={m.key} onClick={()=>setModule(m.key)} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",borderRadius:8,border:"none",cursor:"pointer",fontSize:12,fontWeight:module===m.key?600:400,background:module===m.key?T.blueXL:"transparent",color:module===m.key?T.blue:T.muted,textAlign:"left",position:"relative"}}>
                <span style={{fontSize:14}}>{m.icon}</span>{m.label}
                {m.key==="guide"&&!guideDone&&<span style={{width:7,height:7,borderRadius:"50%",background:T.orange,position:"absolute",right:8,top:"50%",transform:"translateY(-50%)"}}/>}
              </button>
            ))}
          </div>
          <div>
            {module==="guide"    &&<OnboardingGuide onDone={handleGuideDone}/>}
            {module==="dashboard"&&<Dashboard/>}
            {module==="referer"  &&<PageReferer/>}
            {module==="revenus"  &&<Revenus/>}
            {module==="outils"   &&<Outils/>}
            {module==="mb"       &&currentPartner?.contrat==="marque_blanche"&&<MarqueBlanch/>}
            {module==="settings" &&<Parametres onResetOnboarding={handleResetOnboarding}/>}
          </div>
        </div>
      </div>
    </PartnerCtx.Provider>
  );
}