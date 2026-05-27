const MESES = ["","Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const COLORS = ["#e91e8c","#9c27b0","#00bcd4","#64b5f6","#ffb74d","#a5d6a7","#f48fb1","#ce93d8","#80cbc4","#ffcc80","#ef9a9a","#b39ddb"];

function R(n){var v=+n||0;var s=v<0?"-":"";return s+"R$ "+Math.abs(v).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2);}
function getDefaultMonth(){return{receitas:[],fixas:[],variaveis:[],extras:[]};}

function calcMes(store,mes,orcamento,aportes,cardDue){
  var d=store[mes]||getDefaultMonth();
  var tRec=d.receitas.reduce(function(a,x){return a+(+x.val||0);},0);
  var tFix=d.fixas.reduce(function(a,x){return a+(+x.pago||+x.plan||0);},0);
  var tVar=d.variaveis.reduce(function(a,x){return a+(+x.gasto||0);},0);
  var tExt=d.extras.reduce(function(a,x){return a+(+x.val||0);},0);
  var tApt=(aportes||[]).filter(function(a){return +a.mes===+mes;}).reduce(function(s,a){return s+(+a.val||0);},0);
  var tCard=+cardDue||0;
  var tDesp=tFix+tVar+tExt+tApt+tCard;
  var saldo=tRec-tDesp;
  var orc=+orcamento||0;
  // pct: só calcula se há orçamento definido E há despesas
  var pct=(orc>0&&tDesp>0)?(tDesp/orc)*100:0;
  var pendentes=[].concat(d.fixas,d.variaveis,d.extras).filter(function(x){return x.status==="pendente";}).length;
  return{tRec:tRec,tFix:tFix,tVar:tVar,tExt:tExt,tApt:tApt,tCard:tCard,tDesp:tDesp,saldo:saldo,orc:orc,pct:pct,pendentes:pendentes,d:d};
}

function getStatus(calc,theme){
  var tRec=calc.tRec,tDesp=calc.tDesp,saldo=calc.saldo,pct=calc.pct,pend=calc.pendentes;
  var imgs=theme.imgs;
  var alerts=[];
  if(pend>0) alerts.push("⚠️ "+pend+" lançamento(s) pendente(s)");
  if(pct>100) alerts.push("🚨 Orçamento estourado em "+Math.round(pct-100)+"%");
  if(saldo<0) alerts.push("🔴 Saldo negativo: "+R(saldo));

  // Sem dados → health = 0, barra zerada
  if(tRec===0&&tDesp===0){
    return{level:"empty",imgKey:imgs.empty,title:imgs.titleEmpty,sub:imgs.subEmpty,health:0,pctDisplay:0,alerts:[]};
  }

  // ── SAÚDE FINANCEIRA: cálculo contínuo (0–100) ──
  // Base: taxa de poupança (saldo / receita), normalizada para 0..100
  //   saldo = receita inteira (sem despesa) → 100
  //   saldo = 0 (receita = despesa)        → 50
  //   saldo = -receita (despesa = 2×rec.)   → 0
  // Sem receita: saúde = 0 (só tem despesa).
  var savingsRate;
  if(tRec>0){
    savingsRate=Math.max(-1,Math.min(1,saldo/tRec));
  }else{
    savingsRate=-1;
  }
  var h=50+savingsRate*50;
  // Penalidade extra se estourou o orçamento
  if(calc.orc>0&&pct>100){
    h-=Math.min(15,(pct-100)*0.3);
  }
  h=Math.max(0,Math.min(100,h));

  if(saldo>=0&&pct<=75){
    return{level:"great",imgKey:imgs.great,title:imgs.titleGreat,sub:imgs.subGreat+" ("+Math.round(pct)+"% usado)",health:h,pctDisplay:Math.round(pct),alerts:alerts};
  }
  if(saldo>=0&&pct<=100){
    return{level:"ok",imgKey:imgs.ok,title:imgs.titleOk,sub:imgs.subOk+" ("+Math.round(pct)+"% usado)",health:h,pctDisplay:Math.round(pct),alerts:alerts};
  }
  if(saldo>=0){
    var over=pct-100;
    return{level:"warn",imgKey:imgs.warn,title:imgs.titleWarn,sub:imgs.subWarn+" (+"+Math.round(over)+"% acima)",health:h,pctDisplay:Math.round(pct),alerts:alerts};
  }
  // Saldo negativo
  return{level:"bad",imgKey:imgs.bad,title:imgs.titleBad,sub:imgs.subBad+" (déficit "+R(Math.abs(saldo))+")",health:h,pctDisplay:Math.round(pct)||0,alerts:alerts};
}

function getCatBreakdown(d,aportes,mes,tCard){
  var map={};
  [].concat(
    d.fixas.map(function(x){return{cat:x.cat,val:+x.pago||+x.plan};}),
    d.variaveis.map(function(x){return{cat:x.cat,val:+x.gasto};}),
    d.extras.map(function(x){return{cat:"Extra",val:+x.val};})
  ).forEach(function(x){if(x.val>0)map[x.cat]=(map[x.cat]||0)+x.val;});
  if(aportes&&mes!=null){
    var tApt=aportes.filter(function(a){return +a.mes===+mes;}).reduce(function(s,a){return s+(+a.val||0);},0);
    if(tApt>0)map["🎯 Metas"]=(map["🎯 Metas"]||0)+tApt;
  }
  if(+tCard>0)map["💳 Cartões"]=(map["💳 Cartões"]||0)+(+tCard);
  return Object.entries(map).sort(function(a,b){return b[1]-a[1];}).map(function(e){return{label:e[0],val:e[1]};});
}

function saveData(store,metas,cartoes,parcelas,config){
  try{
    localStorage.setItem("mpf_store",JSON.stringify(store));
    localStorage.setItem("mpf_metas",JSON.stringify(metas));
    localStorage.setItem("mpf_cartoes",JSON.stringify(cartoes));
    localStorage.setItem("mpf_parcelas",JSON.stringify(parcelas));
    localStorage.setItem("mpf_config",JSON.stringify(config));
  }catch(e){}
}
function loadData(){
  try{
    return{
      store:JSON.parse(localStorage.getItem("mpf_store")||"{}"),
      metas:JSON.parse(localStorage.getItem("mpf_metas")||"[]"),
      cartoes:JSON.parse(localStorage.getItem("mpf_cartoes")||"[]"),
      parcelas:JSON.parse(localStorage.getItem("mpf_parcelas")||"[]"),
      config:JSON.parse(localStorage.getItem("mpf_config")||"null"),
    };
  }catch(e){return{store:{},metas:[],cartoes:[],parcelas:[],config:null};}
}
