/* Petite enfance 0-3 ans : logique + interface (JavaScript simple, sans dépendance).
   Intégration : <div id="pe"></div> + data.js + module.js, puis PetiteEnfance.mount(document.getElementById('pe'),{storageKey:'...'}).
   La logique pure (allergènes, alertes, portions, liste de courses) est exposée sans interface : PetiteEnfance.allergensOf(...) etc. */
(function(g){
'use strict';
var D=g.PE_DATA;
var nk=function(s){return String(s==null?'':s).toLowerCase().replace(/œ/g,'oe').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,' ').trim()};
var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
var ageOf=function(id){return D.ages.filter(function(a){return a.id===id})[0]};
var fmtG=function(x){x=Math.round(x*10)/10;return(x%1?String(x).replace('.',','):String(x))+' g'};

/* ---------- logique pure ---------- */
function allergensOf(r){ // ids des allergènes présents (détection par mots-clés)
  var found={};
  r.ing.forEach(function(i){var n=nk(i[0]);D.allergenes.forEach(function(a){if(a.re.test(n))found[a.id]=1})});
  return Object.keys(found);
}
function alertsFor(r,age){ // alertes d'âge pour une tranche (s'applique si un enfant de la tranche est plus jeune que maxMois)
  var out=[];
  if(r.min>age.min)out.push('Recette prévue à partir de '+r.min+' mois.');
  r.ing.forEach(function(i){
    var n=nk(i[0]);
    D.interdits.forEach(function(x){
      if(age.min<x.maxMois&&x.re.test(n)&&!(x.sauf&&x.sauf.test(n))&&out.indexOf(x.msg)<0)out.push(x.msg);
    });
  });
  return out;
}
function parseLine(l){ // « 100 g carotte », « 2 cl d'huile », « sel » → [nom, grammes]
  var m=String(l).trim().match(/^(\d+(?:[.,]\d+)?)\s*(kg|g|ml|cl|l)?\s*(?:de |d['’])?(.+)$/i);
  if(!m)return[String(l).trim(),0];
  var q=parseFloat(m[1].replace(',','.')),u=(m[2]||'g').toLowerCase();
  if(u==='kg'||u==='l')q*=1000;else if(u==='cl')q*=10;
  return[m[3].trim(),q];
}
var VPO=/\b(poulet|dinde|boeuf|veau|porc|jambon|lardons?|saumon|thon|cabillaud|colin|poisson|crevettes?|oeufs?|steak|agneau|saucisses?)\b/;
function hasVPO(r){return r.ing.some(function(i){return VPO.test(nk(i[0]))})} // viande, poisson ou œuf
function groupFactor(r,kids){ // somme(nb enfants × facteur) des tranches auxquelles la recette convient ; + enfants non concernés
  var f=0,bad=[];
  D.ages.forEach(function(a){
    var n=Number(kids[a.id])||0;if(!n||!a.facteur)return;
    if(r.min<=a.min&&!alertsFor(r,a).length)f+=n*a.facteur;else bad.push({age:a,n:n});
  });
  return{f:f,bad:bad};
}
function shopping(menu,recs,kids){ // {lignes:[{n,g}], avertissements:[...]}
  var tot={},names={},warn=[],byId={};
  recs.forEach(function(r){byId[r.id]=r});
  Object.keys(menu).forEach(function(slot){
    var r=byId[menu[slot]];if(!r)return;
    if(/-(din|pdj)$/.test(slot))return; // le petit-déjeuner et le dîner sont proposés aux parents : pas servi à la crèche, pas dans la liste de courses
    var gf=groupFactor(r,kids);
    gf.bad.forEach(function(b){warn.push(r.titre+' ('+slot.split('-').slice(0,1)+') ne convient pas aux '+b.age.label+' ('+b.n+' enfant'+(b.n>1?'s':'')+').')});
    r.ing.forEach(function(i){var k=nk(i[0]);names[k]=names[k]||i[0];tot[k]=(tot[k]||0)+i[1]*gf.f});
  });
  var lignes=Object.keys(tot).sort().map(function(k){return{n:names[k],g:tot[k]}});
  return{lignes:lignes,avertissements:warn};
}

/* ---------- interface ---------- */
var AGE_UI={'0-6':['🍼','#ffe0ea','#ff9fbd'],'6-8':['🥄','#d6f2e4','#7fd3a6'],'8-10':['🥕','#ffe6c7','#ffb866'],'10-12':['🍌','#fff3b8','#ffd93d'],'12-18':['🍝','#dcebff','#7db7ff'],'18-24':['🥦','#e3dcff','#a590ff'],'24-36':['🍗','#ffdcf0','#ff8fcf']};
var TYPE_UI={'plat':['🍽️','#ffb866'],'dîner':['🌙','#a99af0'],'dessert':['🍓','#ff9fbd'],'goûter':['🍪','#ffd93d'],'petit-déjeuner':['☀️','#ffcf8a']};
var CSS='.pe{font:17px/1.5 ui-rounded,"SF Pro Rounded","Nunito","Quicksand",system-ui,sans-serif;color:#4a3b52;max-width:980px;margin:0 auto;padding:14px}'+
'.pe h2{margin:.2em 0 .4em;font-size:1.35rem;color:#7a4fb3}.pe h3{margin:.2em 0;font-size:1.1rem;color:#5b3f8c}.pe .hello{font-size:1.6rem;color:#ff7a59;margin:.1em 0 .3em}'+
'.pe .warn{background:#fff6cf;border:2px dashed #ffd93d;border-radius:18px;padding:10px 14px;font-size:.88rem;margin:8px 0}.pe .tabs,.pe .chips{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}'+
'.pe button,.pe select,.pe input,.pe textarea{font:inherit;min-height:40px}'+
'.pe .tab{border:2px solid #e3d4f5;background:#f5ecff;color:#5b3f8c;border-radius:999px;padding:8px 18px;cursor:pointer;font-weight:700}.pe .tab[aria-pressed=true]{background:#9b6fe0;border-color:#7a4fb3;color:#fff}'+
'.pe .chip{border:2px solid transparent;background:var(--c1,#eee);color:#4a3b52;border-radius:999px;padding:7px 16px;cursor:pointer;font-weight:600}.pe .chip[aria-pressed=true]{background:var(--c2,#ccc);border-color:#5b3f8c;font-weight:800}'+
'.pe .chip.no{--c1:#fff;border-color:#f3c6c0}.pe .chip.no[aria-pressed=true]{background:#ff7a70;border-color:#c9362b;color:#fff}'+
'.pe .card{background:#fff;border:2px solid #f0e6ff;border-left:8px solid var(--bd,#c9a8f0);border-radius:22px;padding:14px 16px;margin:12px 0;box-shadow:0 3px 0 #f0e6ff}.pe .meta{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}'+
'.pe .tag{font-size:.82rem;background:#e6f7ee;color:#2d6b4a;border-radius:999px;padding:3px 12px;font-weight:600}.pe .tag.al{background:#ffe3df;color:#a02e22}.pe .tag.ty{background:#fff0d0;color:#8a5a00}.pe .al-msg{color:#b3261e;font-size:.9rem;margin:4px 0}'+
'.pe ul.ing{margin:8px 0;padding-left:20px}.pe .hint{color:#7d6e89;font-size:.88rem}.pe .btn{border:2px solid #ff7a59;background:#ff7a59;color:#fff;border-radius:999px;padding:8px 20px;cursor:pointer;font-weight:700}.pe .btn.sec{background:#fff;color:#ff7a59}'+
'.pe .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}.pe table{border-collapse:collapse;width:100%}.pe td,.pe th{border-bottom:2px dotted #e3d4f5;padding:7px;text-align:left;font-size:.93rem}'+
'.pe input[type=number]{width:84px}.pe textarea,.pe input[type=text],.pe select{width:100%;box-sizing:border-box;border:2px solid #e3d4f5;border-radius:14px;padding:6px 10px;background:#fffdf8}.pe label{font-weight:600;color:#5b3f8c}'+
'.pe ol{padding-left:22px}'+
'.pe .warn .wb{display:none}@media(max-width:600px){.pe .warn{padding:6px 12px;font-size:.8rem;margin:6px 0}.pe .warn .wb{display:block;width:100%;min-height:32px;border:0;background:none;text-align:left;font-weight:700;color:#7a5a00;padding:0;cursor:pointer}.pe .warn .wl{display:none;margin-top:4px}.pe .warn.open .wl{display:block}.pe .hello{font-size:1.3rem}.pe .chip{padding:5px 12px}.pe .tab{padding:6px 14px}}'+
'.pe .tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin:10px 0}'+
'.pe .tile{display:flex;flex-direction:column;align-items:flex-start;gap:4px;text-align:left;min-height:118px;padding:10px 12px;background:#fff;border:2px solid #f0e6ff;border-top:6px solid var(--bd,#c9a8f0);border-radius:18px;box-shadow:0 3px 0 #f0e6ff;cursor:pointer;color:#4a3b52;font:inherit}'+
'.pe .tile:hover,.pe .tile:focus-visible{border-color:var(--bd,#c9a8f0);transform:translateY(-1px)}.pe .tile .ico{font-size:1.9rem;line-height:1}'+
'.pe .tile .tt{font-weight:700;font-size:.93rem;line-height:1.25;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}'+
'.pe .tile .sub{margin-top:auto;font-size:.78rem;color:#7d6e89}.pe .tile .sub b{color:#a02e22;font-weight:700}'+
'.pe .modal{position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;padding:12px}.pe .modal .back{position:absolute;inset:0;background:rgba(60,40,80,.55)}'+
'.pe .modal .sheet{position:relative;background:#fffdf8;border-radius:24px;max-width:560px;width:100%;max-height:88vh;overflow:auto;padding:6px 16px 16px;box-shadow:0 10px 40px rgba(0,0,0,.35)}'+
'.pe .modal .sheet .card{border-left-width:2px;box-shadow:none;margin:6px 0}.pe .modal .close{position:sticky;top:0;float:right;margin:8px 0 0 8px;border:2px solid #e3d4f5;background:#fff;border-radius:999px;padding:6px 14px;cursor:pointer;font-weight:700;color:#5b3f8c;z-index:1}';

function menuText(menu,recs){ // menu de la semaine à transmettre aux parents
  var byId={};recs.forEach(function(r){byId[r.id]=r});
  var J=[['lun','Lundi'],['mar','Mardi'],['mer','Mercredi'],['jeu','Jeudi'],['ven','Vendredi']],R=[['pdj','Petit-déjeuner conseillé à la maison'],['dej','Déjeuner'],['des','Dessert'],['gou','Goûter'],['din','Dîner conseillé à la maison']];
  var out=['Menu de la semaine'];
  J.forEach(function(j){
    var l=R.map(function(m){var r=byId[menu[j[0]+'-'+m[0]]];return r?'  '+m[1]+' : '+r.titre:''}).filter(Boolean);
    if(l.length){out.push('');out.push(j[1]);out=out.concat(l)}
  });
  return out.length>1?out.join('\n'):'';
}
function mount(root,opts){
  opts=opts||{};
  var KEY=opts.storageKey||'petite-enfance-v1';
  var st={tab:'recettes',age:'6-8',sans:[],q:'',kids:{},menu:{},custom:[],form:false,type:'',open:null,warnOpen:false,rev:0,sync:''};
  var apply=function(s){ // reprend un état lu (local ou distant), en tolérant les anciens formats
    if(!s||typeof s!=='object')return;
    st.age=s.age||st.age;st.kids=s.kids||{};
    if(st.age==='12-36')st.age='12-18';
    if(st.kids['12-36']!=null){st.kids['24-36']=(Number(st.kids['24-36'])||0)+(Number(st.kids['12-36'])||0);delete st.kids['12-36']}
    if(!ageOf(st.age))st.age='6-8';
    st.menu=s.menu||{};st.custom=Array.isArray(s.custom)?s.custom:[];st.rev=Number(s.rev)||0;
  };
  try{apply(JSON.parse(localStorage.getItem(KEY)||'null'))}catch(e){}
  var snap=function(){return{age:st.age,kids:st.kids,menu:st.menu,custom:st.custom,rev:st.rev}};
  var sync=opts.sync&&typeof opts.sync.load==='function'&&typeof opts.sync.save==='function'?opts.sync:null,timer=0;
  var setSync=function(t){st.sync=t;var el=root.querySelector&&root.querySelector('#pe-sync');if(el)el.textContent=t};
  var push=function(){ // envoi différé : une seule écriture après une série de modifications
    if(!sync)return;clearTimeout(timer);
    timer=setTimeout(function(){setSync('☁ Enregistrement…');Promise.resolve(sync.save(snap())).then(function(){setSync('☁ Sauvegardé')},function(){setSync('☁ Hors connexion : sauvegardé sur cet appareil')})},800);
  };
  var save=function(){st.rev=Date.now();try{localStorage.setItem(KEY,JSON.stringify(snap()))}catch(e){}push()};
  var recs=function(){return D.recettes.concat(st.custom)};
  var JOURS=[['lun','Lundi'],['mar','Mardi'],['mer','Mercredi'],['jeu','Jeudi'],['ven','Vendredi']];
  var REPAS=[['pdj','Petit-déjeuner (suggestion aux parents)',['petit-déjeuner']],['dej','Déjeuner',['plat']],['des','Dessert',['dessert']],['gou','Goûter',['goûter','dessert']],['din','Dîner (suggestion aux parents)',['dîner','plat']]];

  function recipeCard(r){
    var age=ageOf(st.age),al=allergensOf(r),alerts=alertsFor(r,age),n=Number(st.kids[age.id])||0;
    var tu=TYPE_UI[r.type]||['','#c9a8f0'];
    return '<article class="card" style="--bd:'+tu[1]+'"><h3>'+tu[0]+' '+esc(r.titre)+'</h3><div class="meta"><span class="tag">dès '+r.min+' mois</span><span class="tag ty">'+esc(r.type)+'</span>'+
      (r.perso?'<span class="tag">ma recette</span>':'')+al.map(function(id){return'<span class="tag al">'+esc(D.allergenes.filter(function(a){return a.id===id})[0].label)+'</span>'}).join('')+'</div>'+
      alerts.map(function(m){return'<p class="al-msg">⚠ '+esc(m)+'</p>'}).join('')+
      '<ul class="ing">'+r.ing.map(function(i){var g=i[1]*age.facteur;return'<li>'+esc(i[0])+' : '+(i[1]?'≈ '+fmtG(g)+(n?' <span class="hint">('+fmtG(g*n)+' pour '+n+' enfant'+(n>1?'s':'')+')</span>':''):'<span class="hint">à doser</span>')+'</li>'}).join('')+'</ul>'+
      '<ol>'+(r.etapes||[]).map(function(e){return'<li>'+esc(e)+'</li>'}).join('')+'</ol>'+
      '<p class="hint">Texture à cet âge : '+esc(age.texture)+'</p>'+
      (r.perso?'<button class="btn sec" data-act="del" data-id="'+esc(r.id)+'">Supprimer</button>':'')+'</article>';
  }
  function tile(r){
    var age=ageOf(st.age),al=allergensOf(r),tu=TYPE_UI[r.type]||['','#c9a8f0'];
    return'<button class="tile" style="--bd:'+tu[1]+'" data-act="open" data-id="'+esc(r.id)+'"><span class="ico" aria-hidden="true">'+tu[0]+'</span><span class="tt">'+esc(r.titre)+'</span><span class="sub">dès '+r.min+' mois'+(al.length?' · <b>'+al.length+' allergène'+(al.length>1?'s':'')+'</b>':'')+(r.perso?' · ma recette':'')+'</span></button>';
  }
  function tabRecettes(){
    var age=ageOf(st.age),h='<div class="chips" role="group" aria-label="Âge">'+D.ages.map(function(a){var u=AGE_UI[a.id]||['','#eee','#ccc'];return'<button class="chip" style="--c1:'+u[1]+';--c2:'+u[2]+'" data-act="age" data-id="'+a.id+'" aria-pressed="'+(a.id===st.age)+'">'+u[0]+' '+esc(a.label)+'</button>'}).join('')+'</div>';
    if(!age.facteur)return h+'<div class="card"><h3>🍼 '+esc(age.label)+'</h3><p>'+esc(age.texture)+'</p></div>';
    h+='<div class="meta"><button class="btn sec" data-act="sans-toggle" aria-expanded="'+(!!st.sansOpen)+'">Sans allergène'+(st.sans.length?' ('+st.sans.length+' choisi'+(st.sans.length>1?'s':'')+')':'')+(st.sansOpen?' ▲':' ▼')+'</button></div>'+(st.sansOpen||st.sans.length?'<div class="chips">':'<div hidden>')+(st.sansOpen?D.allergenes.map(function(a){return'<button class="chip no" data-act="sans" data-id="'+a.id+'" aria-pressed="'+(st.sans.indexOf(a.id)>=0)+'">'+esc(a.label)+'</button>'}).join(''):st.sans.map(function(id){return'<button class="chip no" data-act="sans" data-id="'+id+'" aria-pressed="true">'+esc(D.allergenes.filter(function(a){return a.id===id})[0].label)+'</button>'}).join(''))+'</div>'+
      '<input type="text" id="pe-q" placeholder="Rechercher une recette" value="'+esc(st.q)+'" aria-label="Rechercher une recette">'+
      '<div class="meta"><button class="btn sec" data-act="form">'+(st.form?'Fermer le formulaire':'＋ Ajouter ma recette')+'</button></div>'+(st.form?formHtml():'');
    var q=nk(st.q),base=recs().filter(function(r){
      if(r.min>age.min)return false;
      if(alertsFor(r,age).length)return false;
      var al=allergensOf(r);if(st.sans.some(function(s){return al.indexOf(s)>=0}))return false;
      return !q||nk(r.titre).indexOf(q)>=0||r.ing.some(function(i){return nk(i[0]).indexOf(q)>=0});
    });
    var TYPES=['petit-déjeuner','plat','dessert','goûter','dîner'],cnt={};base.forEach(function(r){cnt[r.type]=(cnt[r.type]||0)+1});
    var list=st.type?base.filter(function(r){return r.type===st.type}):base;
    h+='<div class="chips" role="group" aria-label="Type de repas"><button class="chip" data-act="type" data-id="" aria-pressed="'+(!st.type)+'">Tous ('+base.length+')</button>'+TYPES.filter(function(t){return cnt[t]}).map(function(t){var u=TYPE_UI[t]||['',''];return'<button class="chip" style="--c2:'+u[1]+'" data-act="type" data-id="'+t+'" aria-pressed="'+(st.type===t)+'">'+u[0]+' '+esc(t)+' ('+cnt[t]+')</button>'}).join('')+'</div>';
    var opened=st.open&&recs().filter(function(r){return r.id===st.open})[0];
    return h+'<p class="hint">'+list.length+' recette'+(list.length>1?'s':'')+' adaptée'+(list.length>1?'s':'')+' à '+esc(age.label)+'. Touchez une recette pour la lire.</p><div class="tiles">'+list.map(tile).join('')+'</div>'+
      (opened?'<div class="modal" role="dialog" aria-modal="true" aria-label="'+esc(opened.titre)+'"><div class="back" data-act="close"></div><div class="sheet"><button class="close" data-act="close" aria-label="Fermer">✕ Fermer</button>'+recipeCard(opened)+'</div></div>':'');
  }
  function formHtml(){
    return '<div class="card"><h3>Ma recette</h3><label>Titre<input type="text" id="pf-t"></label><div class="grid"><label>À partir de (mois)<input type="number" id="pf-m" value="12" min="4" max="36"></label>'+
      '<label>Type<select id="pf-ty"><option>plat</option><option>dessert</option><option>goûter</option><option>petit-déjeuner</option><option>dîner</option></select></label></div>'+
      '<label>Ingrédients pour une portion de 24-36 mois (une ligne chacun, ex. « 100 g carotte »)<textarea id="pf-i" rows="5"></textarea></label>'+
      '<label>Étapes (une par ligne)<textarea id="pf-e" rows="4"></textarea></label><p id="pf-msg" class="al-msg" role="alert"></p><button class="btn" data-act="save-form">Enregistrer</button></div>';
  }
  function tabPortions(){
    var h='<h2>Enfants par tranche d\'âge</h2><p class="hint">Sert à calculer les quantités pour votre groupe (recettes et liste de courses).</p><div class="grid">'+
      D.ages.filter(function(a){return a.facteur}).map(function(a){return'<label>'+esc(a.label)+'<input type="number" min="0" max="200" data-kids="'+a.id+'" value="'+(Number(st.kids[a.id])||0)+'"></label>'}).join('')+'</div>'+
      '<h2>Composition indicative d\'un repas</h2><table><tr><th>Âge</th><th>Légumes</th><th>Féculents</th><th>Viande, poisson, œuf</th><th>Fruit</th></tr>'+
      D.portions.map(function(p){return'<tr><td>'+esc(ageOf(p.age).label)+'</td><td>'+esc(p.legumes)+'</td><td>'+esc(p.feculents)+'</td><td>'+esc(p.viande)+'</td><td>'+esc(p.fruit)+'</td></tr>'}).join('')+'</table>'+
      '<p class="hint">Valeurs indicatives, à ajuster selon votre protocole. Les quantités des recettes sont calculées pour 24-36 mois puis réduites (6-8 mois : ×0,5 ; 8-10 : ×0,6 ; 10-12 : ×0,7 ; 12-18 : ×0,8 ; 18-24 : ×0,9).</p>';
    return h;
  }
  function tabMenus(){
    var all=recs(),byId={};all.forEach(function(r){byId[r.id]=r});
    var h='<h2>Menus de la semaine</h2><p class="hint">Choisissez une recette par repas. Les quantités tiennent compte des enfants saisis dans l\'onglet Portions.</p>';
    h+='<p><button class="btn" data-act="copy-menu">📋 Copier le menu pour les parents</button> <span class="hint" id="pe-copied2"></span></p><p class="hint">Le petit-déjeuner et le dîner sont des suggestions pour les parents : ils ne sont pas comptés dans la liste de courses.</p>';
    JOURS.forEach(function(j){
      h+='<div class="card"><h3>'+j[1]+'</h3><div class="grid">'+REPAS.map(function(m){
        var key=j[0]+'-'+m[0],opts=all.filter(function(r){return m[2].indexOf(r.type)>=0});
        if(m[0]==='din')opts.sort(function(a,b){return(b.type==='dîner')-(a.type==='dîner')});
        return'<label>'+m[1]+'<select data-slot="'+key+'"><option value="">—</option>'+opts.map(function(r){return'<option value="'+esc(r.id)+'"'+(st.menu[key]===r.id?' selected':'')+'>'+(m[0]==='din'&&!hasVPO(r)?'🌱 ':'')+esc(r.titre)+' (dès '+r.min+' m)</option>'}).join('')+'</select></label>';
      }).join('')+'</div>';
      var L=byId[st.menu[j[0]+'-dej']],Dn=byId[st.menu[j[0]+'-din']];
      if(L&&hasVPO(L))h+=Dn&&hasVPO(Dn)?'<p class="al-msg">⚠ Viande, poisson ou œuf au déjeuner et au dîner : conseillez plutôt un dîner sans (🌱).</p>':'<p class="hint">Le déjeuner contient viande, poisson ou œuf : le soir, conseillez de préférence un dîner sans (🌱).</p>';
      h+='</div>';
    });
    var sh=shopping(st.menu,all,st.kids),al={};
    Object.keys(st.menu).forEach(function(k){var r=byId[st.menu[k]];if(r)allergensOf(r).forEach(function(a){al[a]=1})});
    h+=(sh.avertissements.length?'<div class="warn">'+sh.avertissements.map(function(w){return'<div>⚠ '+esc(w)+'</div>'}).join('')+'</div>':'');
    h+=Object.keys(al).length?'<p><b>Allergènes de la semaine :</b> '+Object.keys(al).map(function(id){return esc(D.allergenes.filter(function(a){return a.id===id})[0].label)}).join(', ')+'</p>':'';
    h+='<h2>Liste de courses</h2>'+(sh.lignes.length?'<table>'+sh.lignes.map(function(l){return'<tr><td>'+esc(l.n)+'</td><td>'+(l.g?esc(fmtG(l.g)):'à doser')+'</td></tr>'}).join('')+'</table><p><button class="btn sec" data-act="copy">Copier la liste</button> <span class="hint" id="pe-copied"></span></p>':'<p class="hint">Aucun menu choisi, ou aucun enfant saisi.</p>');
    return h;
  }
  function tabRegles(){
    return D.regles.map(function(r){return'<div class="card"><h3>'+esc(r.titre)+'</h3><ul>'+r.items.map(function(i){return'<li>'+esc(i)+'</li>'}).join('')+'</ul></div>'}).join('')+
      '<div class="card"><h3>À éviter selon l\'âge</h3><ul>'+D.interdits.map(function(x){return'<li>'+esc(x.msg)+'</li>'}).join('')+'</ul></div>';
  }
  function render(){
    var tabs=[['recettes','🥣 Recettes'],['portions','⚖️ Portions'],['menus','🗓️ Menus'],['regles','📌 Règles']];
    var body=st.tab==='recettes'?tabRecettes():st.tab==='portions'?tabPortions():st.tab==='menus'?tabMenus():tabRegles();
    var focus=document.activeElement&&document.activeElement.id==='pe-q',pos=focus?document.activeElement.selectionStart:0;
    root.innerHTML='<div class="pe"><h2 class="hello">🧸 Petite enfance, 0 à 3 ans</h2><div class="warn'+(st.warnOpen?' open':'')+'"><button class="wb" data-act="warn" aria-expanded="'+st.warnOpen+'">⚠ Contenu non validé médicalement · '+(st.warnOpen?'Masquer ▲':'Lire ▼')+'</button><span class="wl">'+esc(D.avertissement)+'</span></div>'+(sync?'<p class="hint" id="pe-sync" style="margin:2px 0">'+esc(st.sync)+'</p>':'')+'<div class="tabs" role="tablist">'+
      tabs.map(function(t){return'<button class="tab" role="tab" data-act="tab" data-id="'+t[0]+'" aria-pressed="'+(st.tab===t[0])+'">'+t[1]+'</button>'}).join('')+'</div>'+body+'</div>';
    if(focus){var q=root.querySelector('#pe-q');if(q){q.focus();q.setSelectionRange(pos,pos)}}
  }
  root.addEventListener('click',function(e){
    var b=e.target.closest&&e.target.closest('[data-act]');if(!b)return;var a=b.dataset.act,id=b.dataset.id;
    if(a==='tab'){st.tab=id;st.open=null}
    else if(a==='open')st.open=id;
    else if(a==='close')st.open=null;
    else if(a==='warn')st.warnOpen=!st.warnOpen;
    else if(a==='type')st.type=id;
    else if(a==='age'){st.age=id;st.open=null;save()}
    else if(a==='sans'){var i=st.sans.indexOf(id);if(i<0)st.sans.push(id);else st.sans.splice(i,1)}
    else if(a==='sans-toggle')st.sansOpen=!st.sansOpen;
    else if(a==='form')st.form=!st.form;
    else if(a==='del'){if(!confirm('Supprimer cette recette ?'))return;st.custom=st.custom.filter(function(r){return r.id!==id});st.open=null;Object.keys(st.menu).forEach(function(k){if(st.menu[k]===id)delete st.menu[k]});save()}
    else if(a==='save-form'){
      var t=root.querySelector('#pf-t').value.trim(),m=Math.max(4,Math.min(36,parseInt(root.querySelector('#pf-m').value,10)||12)),
          lines=root.querySelector('#pf-i').value.split('\n').map(function(x){return x.trim()}).filter(Boolean);
      if(!t||!lines.length){root.querySelector('#pf-msg').textContent='Indiquez un titre et au moins un ingrédient.';return}
      st.custom.push({id:'perso'+Date.now(),perso:1,titre:t,min:m,type:root.querySelector('#pf-ty').value,ing:lines.map(parseLine),etapes:root.querySelector('#pf-e').value.split('\n').map(function(x){return x.trim()}).filter(Boolean)});
      st.form=false;save();
    }
    else if(a==='copy-menu'){
      var mt=menuText(st.menu,recs()),d2=function(ok){var el=root.querySelector('#pe-copied2');if(el)el.textContent=!mt?'Aucun menu choisi.':ok?'Menu copié.':'Copie impossible : recopiez le menu à la main.'};
      if(mt&&navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(mt).then(function(){d2(true)},function(){d2(false)});else d2(false);
      return;
    }
    else if(a==='copy'){
      var sh=shopping(st.menu,recs(),st.kids),txt=sh.lignes.map(function(l){return'- '+l.n+(l.g?' : '+fmtG(l.g):'')}).join('\n');
      var done=function(ok){var el=root.querySelector('#pe-copied');if(el)el.textContent=ok?'Liste copiée.':'Copie impossible : sélectionnez la liste à la main.'};
      if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(txt).then(function(){done(true)},function(){done(false)});else done(false);
      return;
    }
    render();
  });
  if(typeof document!=='undefined')document.addEventListener('keydown',function(e){if(e.key==='Escape'&&st.open){st.open=null;render()}});
  root.addEventListener('input',function(e){
    if(e.target.id==='pe-q'){st.q=e.target.value;render()}
    else if(e.target.dataset&&e.target.dataset.kids){st.kids[e.target.dataset.kids]=Math.max(0,parseInt(e.target.value,10)||0);save()}
  });
  root.addEventListener('change',function(e){
    if(e.target.dataset&&e.target.dataset.slot){var k=e.target.dataset.slot;if(e.target.value)st.menu[k]=e.target.value;else delete st.menu[k];save();render()}
  });
  if(typeof document!=='undefined'&&!document.getElementById('pe-css')){var s=document.createElement('style');s.id='pe-css';s.textContent=CSS;document.head.appendChild(s)}
  render();
  if(sync){ // au démarrage : on garde l'état le plus récent (celui de l'appareil ou celui du compte)
    setSync('☁ Synchronisation…');
    Promise.resolve(sync.load()).then(function(r){
      if(r===false){setSync('☁ Non connecté : données gardées sur cet appareil. Connectez-vous dans Le Panier pour les sauvegarder.');return}
      if(r&&r.data&&Number(r.data.rev||r.rev)>st.rev){apply(Object.assign({},r.data,{rev:r.data.rev||r.rev}));try{localStorage.setItem(KEY,JSON.stringify(snap()))}catch(e){}render();setSync('☁ Sauvegardé')}
      else if(st.rev||st.custom.length||Object.keys(st.menu).length||Object.keys(st.kids).length){if(!st.rev)st.rev=Date.now();push()}
      else setSync('☁ Sauvegardé');
    },function(){setSync('☁ Hors connexion : données gardées sur cet appareil')});
  }
  return{state:st,render:render};
}
g.PetiteEnfance={hasVPO:hasVPO,mount:mount,nk:nk,allergensOf:allergensOf,alertsFor:alertsFor,parseLine:parseLine,groupFactor:groupFactor,shopping:shopping,menuText:menuText,data:D};
})(typeof window!=='undefined'?window:globalThis);
