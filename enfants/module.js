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
    var gf=groupFactor(r,kids);
    gf.bad.forEach(function(b){warn.push(r.titre+' ('+slot.split('-').slice(0,1)+') ne convient pas aux '+b.age.label+' ('+b.n+' enfant'+(b.n>1?'s':'')+').')});
    r.ing.forEach(function(i){var k=nk(i[0]);names[k]=names[k]||i[0];tot[k]=(tot[k]||0)+i[1]*gf.f});
  });
  var lignes=Object.keys(tot).sort().map(function(k){return{n:names[k],g:tot[k]}});
  return{lignes:lignes,avertissements:warn};
}

/* ---------- interface ---------- */
var AGE_UI={'0-6':['🍼','#ffe0ea','#ff9fbd'],'6-8':['🥄','#d6f2e4','#7fd3a6'],'8-10':['🥕','#ffe6c7','#ffb866'],'10-12':['🍌','#fff3b8','#ffd93d'],'12-36':['🍝','#dcebff','#7db7ff']};
var TYPE_UI={'plat':['🍽️','#ffb866'],'dessert':['🍓','#ff9fbd'],'goûter':['🍪','#ffd93d']};
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
'.pe ol{padding-left:22px}';

function mount(root,opts){
  opts=opts||{};
  var KEY=opts.storageKey||'petite-enfance-v1';
  var st={tab:'recettes',age:'6-8',sans:[],q:'',kids:{},menu:{},custom:[],form:false};
  try{var s=JSON.parse(localStorage.getItem(KEY)||'null');if(s&&typeof s==='object'){st.age=s.age||st.age;st.kids=s.kids||{};st.menu=s.menu||{};st.custom=Array.isArray(s.custom)?s.custom:[]}}catch(e){}
  var save=function(){try{localStorage.setItem(KEY,JSON.stringify({age:st.age,kids:st.kids,menu:st.menu,custom:st.custom}))}catch(e){}};
  var recs=function(){return D.recettes.concat(st.custom)};
  var JOURS=[['lun','Lundi'],['mar','Mardi'],['mer','Mercredi'],['jeu','Jeudi'],['ven','Vendredi']];
  var REPAS=[['dej','Déjeuner',['plat']],['des','Dessert',['dessert']],['gou','Goûter',['goûter','dessert']]];

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
  function tabRecettes(){
    var age=ageOf(st.age),h='<div class="chips" role="group" aria-label="Âge">'+D.ages.map(function(a){var u=AGE_UI[a.id]||['','#eee','#ccc'];return'<button class="chip" style="--c1:'+u[1]+';--c2:'+u[2]+'" data-act="age" data-id="'+a.id+'" aria-pressed="'+(a.id===st.age)+'">'+u[0]+' '+esc(a.label)+'</button>'}).join('')+'</div>';
    if(!age.facteur)return h+'<div class="card"><h3>🍼 '+esc(age.label)+'</h3><p>'+esc(age.texture)+'</p></div>';
    h+='<p class="hint">Sans (exclure) :</p><div class="chips">'+D.allergenes.map(function(a){return'<button class="chip no" data-act="sans" data-id="'+a.id+'" aria-pressed="'+(st.sans.indexOf(a.id)>=0)+'">'+esc(a.label)+'</button>'}).join('')+'</div>'+
      '<input type="text" id="pe-q" placeholder="Rechercher une recette" value="'+esc(st.q)+'" aria-label="Rechercher une recette">'+
      '<div class="meta"><button class="btn sec" data-act="form">'+(st.form?'Fermer le formulaire':'＋ Ajouter ma recette')+'</button></div>'+(st.form?formHtml():'');
    var q=nk(st.q),list=recs().filter(function(r){
      if(r.min>age.min)return false;
      if(alertsFor(r,age).length)return false;
      var al=allergensOf(r);if(st.sans.some(function(s){return al.indexOf(s)>=0}))return false;
      return !q||nk(r.titre).indexOf(q)>=0||r.ing.some(function(i){return nk(i[0]).indexOf(q)>=0});
    });
    return h+'<p class="hint">'+list.length+' recette'+(list.length>1?'s':'')+' adaptée'+(list.length>1?'s':'')+' à '+esc(age.label)+'.</p>'+list.map(recipeCard).join('');
  }
  function formHtml(){
    return '<div class="card"><h3>Ma recette</h3><label>Titre<input type="text" id="pf-t"></label><div class="grid"><label>À partir de (mois)<input type="number" id="pf-m" value="12" min="4" max="36"></label>'+
      '<label>Type<select id="pf-ty"><option>plat</option><option>dessert</option><option>goûter</option></select></label></div>'+
      '<label>Ingrédients pour une portion de 12-36 mois (une ligne chacun, ex. « 100 g carotte »)<textarea id="pf-i" rows="5"></textarea></label>'+
      '<label>Étapes (une par ligne)<textarea id="pf-e" rows="4"></textarea></label><p id="pf-msg" class="al-msg" role="alert"></p><button class="btn" data-act="save-form">Enregistrer</button></div>';
  }
  function tabPortions(){
    var h='<h2>Enfants par tranche d\'âge</h2><p class="hint">Sert à calculer les quantités pour votre groupe (recettes et liste de courses).</p><div class="grid">'+
      D.ages.filter(function(a){return a.facteur}).map(function(a){return'<label>'+esc(a.label)+'<input type="number" min="0" max="200" data-kids="'+a.id+'" value="'+(Number(st.kids[a.id])||0)+'"></label>'}).join('')+'</div>'+
      '<h2>Composition indicative d\'un repas</h2><table><tr><th>Âge</th><th>Légumes</th><th>Féculents</th><th>Viande, poisson, œuf</th><th>Fruit</th></tr>'+
      D.portions.map(function(p){return'<tr><td>'+esc(ageOf(p.age).label)+'</td><td>'+esc(p.legumes)+'</td><td>'+esc(p.feculents)+'</td><td>'+esc(p.viande)+'</td><td>'+esc(p.fruit)+'</td></tr>'}).join('')+'</table>'+
      '<p class="hint">Valeurs indicatives, à ajuster selon votre protocole. Les quantités des recettes sont calculées pour 12-36 mois puis réduites (6-8 mois : ×0,5 ; 8-10 : ×0,6 ; 10-12 : ×0,7).</p>';
    return h;
  }
  function tabMenus(){
    var all=recs(),byId={};all.forEach(function(r){byId[r.id]=r});
    var h='<h2>Menus de la semaine</h2><p class="hint">Choisissez une recette par repas. Les quantités tiennent compte des enfants saisis dans l\'onglet Portions.</p>';
    JOURS.forEach(function(j){
      h+='<div class="card"><h3>'+j[1]+'</h3><div class="grid">'+REPAS.map(function(m){
        var key=j[0]+'-'+m[0],opts=all.filter(function(r){return m[2].indexOf(r.type)>=0});
        return'<label>'+m[1]+'<select data-slot="'+key+'"><option value="">—</option>'+opts.map(function(r){return'<option value="'+esc(r.id)+'"'+(st.menu[key]===r.id?' selected':'')+'>'+esc(r.titre)+' (dès '+r.min+' m)</option>'}).join('')+'</select></label>';
      }).join('')+'</div></div>';
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
    root.innerHTML='<div class="pe"><h2 class="hello">🧸 Petite enfance, 0 à 3 ans</h2><div class="warn">'+esc(D.avertissement)+'</div><div class="tabs" role="tablist">'+
      tabs.map(function(t){return'<button class="tab" role="tab" data-act="tab" data-id="'+t[0]+'" aria-pressed="'+(st.tab===t[0])+'">'+t[1]+'</button>'}).join('')+'</div>'+body+'</div>';
    if(focus){var q=root.querySelector('#pe-q');if(q){q.focus();q.setSelectionRange(pos,pos)}}
  }
  root.addEventListener('click',function(e){
    var b=e.target.closest&&e.target.closest('[data-act]');if(!b)return;var a=b.dataset.act,id=b.dataset.id;
    if(a==='tab')st.tab=id;
    else if(a==='age'){st.age=id;save()}
    else if(a==='sans'){var i=st.sans.indexOf(id);if(i<0)st.sans.push(id);else st.sans.splice(i,1)}
    else if(a==='form')st.form=!st.form;
    else if(a==='del'){if(!confirm('Supprimer cette recette ?'))return;st.custom=st.custom.filter(function(r){return r.id!==id});Object.keys(st.menu).forEach(function(k){if(st.menu[k]===id)delete st.menu[k]});save()}
    else if(a==='save-form'){
      var t=root.querySelector('#pf-t').value.trim(),m=Math.max(4,Math.min(36,parseInt(root.querySelector('#pf-m').value,10)||12)),
          lines=root.querySelector('#pf-i').value.split('\n').map(function(x){return x.trim()}).filter(Boolean);
      if(!t||!lines.length){root.querySelector('#pf-msg').textContent='Indiquez un titre et au moins un ingrédient.';return}
      st.custom.push({id:'perso'+Date.now(),perso:1,titre:t,min:m,type:root.querySelector('#pf-ty').value,ing:lines.map(parseLine),etapes:root.querySelector('#pf-e').value.split('\n').map(function(x){return x.trim()}).filter(Boolean)});
      st.form=false;save();
    }
    else if(a==='copy'){
      var sh=shopping(st.menu,recs(),st.kids),txt=sh.lignes.map(function(l){return'- '+l.n+(l.g?' : '+fmtG(l.g):'')}).join('\n');
      var done=function(ok){var el=root.querySelector('#pe-copied');if(el)el.textContent=ok?'Liste copiée.':'Copie impossible : sélectionnez la liste à la main.'};
      if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(txt).then(function(){done(true)},function(){done(false)});else done(false);
      return;
    }
    render();
  });
  root.addEventListener('input',function(e){
    if(e.target.id==='pe-q'){st.q=e.target.value;render()}
    else if(e.target.dataset&&e.target.dataset.kids){st.kids[e.target.dataset.kids]=Math.max(0,parseInt(e.target.value,10)||0);save()}
  });
  root.addEventListener('change',function(e){
    if(e.target.dataset&&e.target.dataset.slot){var k=e.target.dataset.slot;if(e.target.value)st.menu[k]=e.target.value;else delete st.menu[k];save();render()}
  });
  if(typeof document!=='undefined'&&!document.getElementById('pe-css')){var s=document.createElement('style');s.id='pe-css';s.textContent=CSS;document.head.appendChild(s)}
  render();
  return{state:st,render:render};
}
g.PetiteEnfance={mount:mount,nk:nk,allergensOf:allergensOf,alertsFor:alertsFor,parseLine:parseLine,groupFactor:groupFactor,shopping:shopping,data:D};
})(typeof window!=='undefined'?window:globalThis);
