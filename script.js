import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, update, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// ELECTRON KÖPRÜSÜ (Titlebar Butonları İçin)
let ipcRenderer = null;
if (window.require) {
    ipcRenderer = window.require('electron').ipcRenderer;
    document.getElementById('win-min').addEventListener('click', () => ipcRenderer.send('window-minimize'));
    document.getElementById('win-close').addEventListener('click', () => ipcRenderer.send('window-close'));
}

// UYGULAMA SÜRÜMÜ
const APP_VERSION = "1.0.0";

const firebaseConfig = {
  apiKey: "AIzaSyBCpOgcfBCp30-G2uxOYQ0NXRAiywOoTGY",
  authDomain: "numarataj-arac-filo.firebaseapp.com",
  databaseURL: "https://numarataj-arac-filo-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "numarataj-arac-filo",
  storageBucket: "numarataj-arac-filo.firebasestorage.app"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

window.DB_DATA = { vehicles: [], users: [], missions: [], purposes: [], maints: [], config: {} };
let isLoggedIn = false;
let currentTab = 'dash';
let initialLoadCount = 0;
let systemVerified = false;

/* === GÜVENLİK ŞALTERİ & SÜRÜM KONTROLÜ === */
onValue(ref(db, 'config'), snap => { 
  const c = snap.val() || {}; 
  window.DB_DATA.config = c; 

  // 1. Şalter Kapalıysa Uygulamayı Kilitle
  if (c.isActive !== true) {
      showLockScreen('SİSTEM KAPATILDI', 'Yönetim paneli sistem yöneticisi tarafından geçici olarak erişime kapatılmıştır. Güvenlik kilidi aktiftir.');
      return;
  }
  // 2. Sürüm Kontrolü
  if (c.version && c.version !== APP_VERSION) {
      showLockScreen('GÜNCELLEME GEREKLİ', `Kullandığınız program sürümü (${APP_VERSION}) çok eski. Lütfen güncel sürümü (${c.version}) kurunuz.`);
      return;
  }

  // Şartlar sağlandıysa giriş ekranına geç
  if (!systemVerified) {
      systemVerified = true;
      document.getElementById('splash-screen').style.opacity = '0';
      setTimeout(() => {
          document.getElementById('splash-screen').classList.add('hidden');
          document.getElementById('admin-login-screen').classList.remove('hidden');
          document.getElementById('admin-login-screen').classList.add('flex');
          document.getElementById('al-pw').focus();
      }, 500);
  }

  applySub(); 
  if(initialLoadCount<5) checkInitialLoad(); else if(isLoggedIn&&currentTab==='settings') renderSettings(); 
});

/* VERİ DİNLEYİCİLERİ */
function checkInitialLoad() {
  initialLoadCount++;
}
onValue(ref(db, 'vehicles'), snap => { const d = snap.val()||{}; window.DB_DATA.vehicles = Object.keys(d).map(k=>({id:k,...d[k]})); if(initialLoadCount<5) checkInitialLoad(); else if(isLoggedIn) renderCurrent(); });
onValue(ref(db, 'users'), snap => { const d = snap.val()||{}; window.DB_DATA.users = Object.keys(d).map(k=>({id:k,...d[k]})); if(initialLoadCount<5) checkInitialLoad(); else if(isLoggedIn) renderCurrent(); });
onValue(ref(db, 'missions'), snap => { const d = snap.val()||{}; window.DB_DATA.missions = Object.keys(d).map(k=>({id:k,...d[k]})); if(initialLoadCount<5) checkInitialLoad(); else if(isLoggedIn) renderCurrent(); });
onValue(ref(db, 'maints'), snap => { const d = snap.val()||{}; window.DB_DATA.maints = Object.keys(d).map(k=>({id:k,...d[k]})); if(initialLoadCount<5) checkInitialLoad(); else if(isLoggedIn) renderCurrent(); });
onValue(ref(db, 'purposes'), snap => { window.DB_DATA.purposes = snap.val() || ["Saha Çalışması"]; if(initialLoadCount<5) checkInitialLoad(); else if(isLoggedIn) renderCurrent(); });

function showLockScreen(title, message) {
  document.getElementById('splash-screen').classList.add('hidden');
  document.getElementById('admin-login-screen').classList.add('hidden');
  document.getElementById('admin-login-screen').classList.remove('flex');
  document.getElementById('app').classList.add('hidden');
  
  const lock = document.getElementById('system-lock-screen');
  lock.classList.remove('hidden');
  lock.classList.add('flex');
  document.getElementById('sl-title').innerText = title;
  document.getElementById('sl-msg').innerText = message;
}

/* === YÖNETİCİ ŞİFRE GİRİŞİ === */
document.getElementById('form-admin-login').addEventListener('submit', (e) => {
    e.preventDefault();
    const pw = document.getElementById('al-pw').value;
    const cfg = window.DB_DATA.config;

    // Şifreyi direkt Firebase config içindeki adminPass verisiyle kıyaslar
    if (pw === cfg.adminPass) {
        document.getElementById('admin-login-screen').classList.add('hidden');
        document.getElementById('admin-login-screen').classList.remove('flex');
        document.getElementById('app').classList.remove('hidden');
        document.getElementById('app').classList.add('flex');
        isLoggedIn = true;
        switchAdminTab('dash');
        window.showToast('Güvenli giriş onaylandı.', 'success');
    } else {
        window.showToast('Girdiğiniz şifre hatalı.', 'error');
        document.getElementById('al-pw').value = '';
    }
});

/* ================= YARDIMCILAR ================= */
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const H=s=>{let h1=0xdeadbeef,h2=0x41c6ce57;for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);h1=Math.imul(h1^c,2654435761);h2=Math.imul(h2^c,1597334677)}h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);return(4294967296*(2097151&h2)+(h1>>>0)).toString(36)};
const hashPin=(p,salt)=>H('nmr|'+salt+'|'+p);
const normPlate=s=>String(s).toUpperCase().replace(/\s+/g,'');
const fmtPlate=s=>String(s).toUpperCase().trim().replace(/\s+/g,' ');
const num=v=>Number.isFinite(v)?v:0;
const nf=n=>num(n).toLocaleString('tr-TR');
const todayStr=()=>new Date().toISOString().slice(0,10);
const monthKey=iso=>{const d=new Date(iso);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')};
const idGen=()=>'_'+Math.random().toString(36).slice(2,11)+Date.now().toString(36).slice(-4);
const plateHtml=(p,c='scale-100 origin-left')=>`<div class="tr-plate ${c}"><div class="tr-plate-blue"><span class="text-white font-bold text-[9px] leading-none">TR</span></div><div class="tr-plate-text">${esc(p)}</div></div>`;
const Utils={dt:s=>{if(!s)return'--';const d=new Date(s);if(isNaN(d))return'--';return d.toLocaleDateString('tr-TR',{day:'2-digit',month:'2-digit',year:'numeric'})+' '+d.toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})},d:s=>{if(!s)return'--';const d=new Date(s);return isNaN(d)?'--':d.toLocaleDateString('tr-TR')},plate:plateHtml};

const vehicleById=id=>window.DB_DATA.vehicles.find(v=>v.id===id);
const userById=id=>window.DB_DATA.users.find(u=>u.id===id);

window.showToast=function(msg,type='info'){
 const c=document.getElementById('toast-container'),t=document.createElement('div');
 let col='#3b82f6',ic='fa-info-circle';
 if(type==='success'){col='#10b981';ic='fa-check-circle'}else if(type==='error'){col='#ef4444';ic='fa-triangle-exclamation'}else if(type==='warning'){col='#f59e0b';ic='fa-bell'}
 t.className='toast pop-in';t.style.borderColor=col;
 t.innerHTML=`<i class="fa-solid ${ic} text-2xl mr-4" style="color:${col}"></i><span>${esc(msg)}</span>`;
 c.appendChild(t);setTimeout(()=>{t.style.opacity='0';setTimeout(()=>t.remove(),300)},3800);
};

function maintCfg(){const c=window.DB_DATA.config;return{interval:c.maintInterval||10000,warn:c.maintWarn||1000,months:c.maintMonths===undefined?12:c.maintMonths}}
function updateClock(){const t=new Date().toLocaleString('tr-TR',{weekday:'long',day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'});document.querySelectorAll('.clock').forEach(e=>e.innerText=t)}
setInterval(updateClock,30000); updateClock();

/* TAB, DASHBOARD ve RENDER FONKSİYONLARI (Önceki kodun aynısıdır) */
const TITLES={dash:'Dashboard',records:'Görev Kayıtları',fleet:'Filo Yönetimi',users:'Personel Yönetimi',settings:'Ayarlar'};
window.switchAdminTab=function(tab){
 currentTab=tab;
 ['dash','records','fleet','users','settings'].forEach(t=>document.getElementById('admin-'+t).classList.toggle('hidden',t!==tab));
 ['dash','records','fleet','users','settings'].forEach(t=>document.getElementById('admin-'+t).classList.toggle('flex',t===tab && (t==='records' || t==='users')));
 document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
 document.getElementById('page-title').innerText=TITLES[tab];
 const m=document.getElementById('admin-main');m.scrollTop=0;
 const sec=document.getElementById('admin-'+tab);sec.classList.remove('pop-in');void sec.offsetWidth;sec.classList.add('pop-in');
 renderCurrent();
};
window.renderCurrent=function(){
 if(currentTab==='dash') renderDashboard();
 else if(currentTab==='fleet') renderFleet();
 else if(currentTab==='users') renderUsers();
 else if(currentTab==='records') initRecords();
 else renderSettings();
};
window.filterDashboard=function(type){document.getElementById('fleet-filter').value=type;switchAdminTab('fleet')};
window.populatePurposes=function(id){const s=document.getElementById(id);if(!s)return;s.innerHTML=window.DB_DATA.purposes.map(p=>`<option value="${esc(p)}">${esc(p)}</option>`).join('')};

function maintStatus(v){
 const c=maintCfg();
 if(v.lastMaintKm===undefined||v.lastMaintKm===null||v.lastMaintKm==='')return{missing:true};
 const nextKm=v.lastMaintKm+c.interval,remain=nextKm-v.km;
 let daysLeft=null;
 if(c.months>0&&v.lastMaintDate){const d=new Date(v.lastMaintDate+'T00:00:00');d.setMonth(d.getMonth()+c.months);daysLeft=Math.ceil((d-new Date())/864e5)}
 const k=remain<0?2:remain<=c.warn?1:0,t=daysLeft===null?0:daysLeft<0?2:daysLeft<=30?1:0;
 const lvl=Math.max(k,t);
 return{nextKm,remain,daysLeft,state:lvl===2?'over':lvl===1?'soon':'ok'};
}
function maintSummaryHTML(v){
 const s=maintStatus(v);
 if(s.missing)return'<span class="text-gray-400"><i class="fa-solid fa-triangle-exclamation mr-2"></i>Son bakım bilgisi yok.</span>';
 const col=s.state==='over'?'text-red-400':s.state==='soon'?'text-yellow-400':'text-green-400';
 return`<div class="grid sm:grid-cols-3 gap-5"><div><div class="text-[10px] text-yellow-500 uppercase font-bold tracking-widest mb-1">Kayıtlı Son Bakım</div><b class="text-white text-lg">${nf(v.lastMaintKm)} KM</b><div class="text-xs text-textmuted mt-1">${v.lastMaintDate?Utils.d(v.lastMaintDate+'T12:00:00'):'tarih yok'}</div></div><div><div class="text-[10px] text-yellow-500 uppercase font-bold tracking-widest mb-1">Gelecek Bakım</div><b class="text-white text-lg">${nf(s.nextKm)} KM</b></div><div><div class="text-[10px] text-yellow-500 uppercase font-bold tracking-widest mb-1">Kalan Durum</div><b class="text-lg ${col}">${s.remain<0?nf(-s.remain)+' KM gecikti':nf(s.remain)+' KM kaldı'}${s.daysLeft!==null?(s.daysLeft<0?' · Süre doldu':' · '+s.daysLeft+' gün'):''}</b></div></div>`;
}

function donut(items){
 const tot=items.reduce((s,i)=>s+i.v,0);
 if(!tot)return'<div class="text-center text-textmuted text-sm py-12">Bu ay görev kaydı yok.</div>';
 const PAL=['#3b82f6','#22c55e','#f59e0b','#a855f7','#ef4444','#06b6d4','#ec4899'];
 const C=2*Math.PI*54;let acc=0;
 const segs=items.map((it,i)=>{const len=C*it.v/tot;const s=`<circle r="54" cx="70" cy="70" fill="none" stroke="${PAL[i%PAL.length]}" stroke-width="18" stroke-dasharray="${len} ${C-len}" stroke-dashoffset="${-acc}" transform="rotate(-90 70 70)"/>`;acc+=len;return s}).join('');
 const leg=items.map((it,i)=>`<div class="flex items-center justify-between text-xs gap-2"><span class="flex items-center gap-2 min-w-0"><span class="w-3 h-3 rounded-full shrink-0" style="background:${PAL[i%PAL.length]}"></span><span class="truncate text-white font-bold">${esc(it.l)}</span></span><b class="text-gray-400">${it.v}</b></div>`).join('');
 return`<div class="flex flex-col items-center gap-6"><svg viewBox="0 0 140 140" class="w-48 h-48 drop-shadow-lg"><circle r="54" cx="70" cy="70" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="18"/>${segs}<text x="70" y="68" text-anchor="middle" fill="#fff" font-size="28" font-weight="900">${tot}</text><text x="70" y="88" text-anchor="middle" fill="#93a0c4" font-size="10" font-weight="700" letter-spacing="1">GÖREV</text></svg><div class="w-full space-y-2 bg-black/20 p-4 rounded-xl">${leg}</div></div>`;
}
function lineChart(pts){
 const W=360,Hh=210,pl=14,pr=14,pt=28,pb=30,max=Math.max(1,...pts.map(p=>p.v));
 if(pts.every(p=>p.v===0))return'<div class="text-center text-textmuted text-sm py-12">Henüz KM verisi yok.</div>';
 const step=(W-pl-pr)/(pts.length-1||1);
 const xy=pts.map((p,i)=>[+(pl+i*step).toFixed(1),+(pt+(Hh-pt-pb)*(1-p.v/max)).toFixed(1)]);
 const line=xy.map(p=>p.join(',')).join(' ');
 const area=`${pl},${Hh-pb} ${line} ${xy[xy.length-1][0]},${Hh-pb}`;
 const grid=[0,1,2,3].map(i=>{const y=pt+(Hh-pt-pb)*i/3;return`<line x1="${pl}" x2="${W-pr}" y1="${y}" y2="${y}" stroke="rgba(255,255,255,.07)" stroke-dasharray="4 4"/>`}).join('');
 const dots=xy.map((p,i)=>`<circle cx="${p[0]}" cy="${p[1]}" r="5" fill="#0f152e" stroke="#22c55e" stroke-width="3"/><text x="${p[0]}" y="${p[1]-12}" text-anchor="middle" fill="#fff" font-size="11" font-weight="800">${pts[i].v?nf(pts[i].v):''}</text><text x="${p[0]}" y="${Hh-6}" text-anchor="middle" fill="#93a0c4" font-size="11" font-weight="700">${esc(pts[i].l)}</text>`).join('');
 return`<svg viewBox="0 0 ${W} ${Hh}" class="w-full drop-shadow-md"><defs><linearGradient id="lg2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22c55e" stop-opacity=".4"/><stop offset="1" stop-color="#22c55e" stop-opacity="0"/></linearGradient></defs>${grid}<polygon points="${area}" fill="url(#lg2)"/><polyline points="${line}" fill="none" stroke="#22c55e" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>${dots}</svg>`;
}
function alertCard(color,icon,title,plateHtml,extra,btn){
 return`<div class="bg-${color}/10 border-l-4 border-${color} p-4 rounded-xl flex items-center justify-between gap-4 hover:bg-${color}/20 transition"><div class="flex-1"><div class="flex items-center gap-2 mb-2"><i class="fa-solid ${icon} text-${color} text-lg"></i><span class="font-extrabold text-sm text-${color} uppercase tracking-wider">${title}</span></div><div class="flex items-center gap-4">${plateHtml}<span class="text-sm font-bold text-gray-200">${extra}</span></div></div><div class="shrink-0 w-36">${btn||''}</div></div>`;
}

window.renderDashboard=function(){
 const vehicles = window.DB_DATA.vehicles.filter(v=>!v.isDeleted), missions = window.DB_DATA.missions, users = window.DB_DATA.users;
 document.getElementById('dash-tot-veh').innerText = vehicles.length; document.getElementById('dash-avl-veh').innerText = vehicles.filter(v=>v.status==='available').length;
 document.getElementById('dash-act-mis').innerText = vehicles.filter(v=>v.status==='busy').length; document.getElementById('dash-mnt-veh').innerText = vehicles.filter(v=>v.status==='maintenance').length;
 const now=new Date(),mk=monthKey(now.toISOString());
 const pc={};missions.filter(m=>monthKey(m.startTime)===mk).forEach(m=>{const k=m.purpose||'Belirtilmemiş';pc[k]=(pc[k]||0)+1});
 let pa=Object.keys(pc).map(l=>({l,v:pc[l]})).sort((a,b)=>b.v-a.v);
 if(pa.length>6){const rest=pa.slice(5).reduce((s,x)=>s+x.v,0);pa=pa.slice(0,5).concat([{l:'Diğerleri',v:rest}])}
 document.getElementById('ch-purpose').innerHTML=donut(pa);
 const done=missions.filter(m=>m.status==='completed'&&m.endTime);
 const pts=[];
 for(let i=5;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1),key=monthKey(d.toISOString());pts.push({l:d.toLocaleDateString('tr-TR',{month:'short'}),v:done.filter(m=>monthKey(m.endTime)===key).reduce((s,m)=>s+(m.endKm-m.startKm),0)});}
 document.getElementById('ch-monthly').innerHTML=lineChart(pts);
 const doneM=done.filter(m=>monthKey(m.endTime)===mk);
 const vk=vehicles.map(v=>({p:v.plate,v:doneM.filter(m=>m.vehicleId===v.id).reduce((s,m)=>s+(m.endKm-m.startKm),0)})).sort((a,b)=>b.v-a.v).slice(0,6);
 const vmax=Math.max(1,...vk.map(x=>x.v));
 document.getElementById('ch-vehicles').innerHTML=vk.length?vk.map(x=>`<div class="bg-black/20 p-3 rounded-lg"><div class="flex justify-between text-xs mb-2"><span class="font-extrabold font-mono text-white text-sm">${esc(x.p)}</span><span class="font-black ${x.v?'text-warning':'text-textmuted'} text-sm">${nf(x.v)} KM</span></div><div class="hbar bg-black/40"><div style="width:${x.v/vmax*100}%; background:linear-gradient(90deg,#f59e0b,#fbbf24)"></div></div></div>`).join(''):'<div class="text-center text-textmuted text-sm py-12">Kayıt yok.</div>';
 const st={};doneM.forEach(m=>{st[m.userId]=(st[m.userId]||0)+(m.endKm-m.startKm)});
 const td=Object.keys(st).map(id=>({id,km:st[id]})).sort((a,b)=>b.km-a.km).slice(0,4),dmax=td.length?td[0].km:1;
 document.getElementById('dash-top-drivers').innerHTML=td.length?td.map((x,i)=>{
   const u=users.find(u=>u.id===x.id)||{name:'?'};
   const colors = ['from-yellow-400 to-yellow-600', 'from-gray-300 to-gray-500', 'from-orange-400 to-orange-600', 'from-blue-400 to-blue-600'];
   return `<div class="bg-black/30 p-5 rounded-2xl border border-white/5 relative overflow-hidden group hover:bg-black/50 transition"><div class="absolute top-0 left-0 w-1 h-full bg-gradient-to-b ${colors[i]||colors[3]}"></div><div class="flex justify-between items-center mb-3"><span class="font-bold text-white text-sm truncate pr-2"><i class="fa-solid fa-medal mr-2 text-transparent bg-clip-text bg-gradient-to-b ${colors[i]||colors[3]}"></i>${esc(u.name)}</span><span class="font-black text-transparent bg-clip-text bg-gradient-to-r ${colors[i]||colors[3]} text-lg">${nf(x.km)}</span></div><div class="hbar bg-black/50 h-2"><div style="width:${x.km/dmax*100}%;" class="bg-gradient-to-r ${colors[i]||colors[3]}"></div></div></div>`;
 }).join('') : '<div class="col-span-full text-center text-textmuted py-4">Bu ay henüz kayıt yok.</div>';

 let html='',n=0;
 missions.filter(m=>m.status==='completed'&&m.returnNote&&m.noteResolved===false).forEach(m=>{
  const v=vehicles.find(v=>v.id===m.vehicleId);if(!v)return; const u=users.find(u=>u.id===m.userId)||{name:'?'};
  html+=`<div class="bg-red-900/20 border-l-4 border-red-500 p-5 rounded-xl flex flex-col gap-3"><div class="flex justify-between items-center"><span class="badge badge-danger text-[10px] px-2 py-1"><i class="fa-solid fa-wrench mr-1"></i>Şoför Şikayeti</span><span class="text-xs text-red-300/60 font-bold">${Utils.d(m.endTime)}</span></div><div class="flex items-center gap-4">${Utils.plate(v.plate,'scale-[.65] origin-left -my-2')}<span class="text-sm font-bold text-white"><i class="fa-solid fa-user-circle mr-1 text-gray-400"></i>${esc(u.name)}</span></div><p class="text-sm text-red-200 bg-red-950/40 p-3 rounded-lg border border-red-500/20">"${esc(m.returnNote)}"</p><button onclick="openResolveModal('${m.id}')" class="btn-3d btn-green w-full py-2.5 text-xs"><i class="fa-solid fa-check mr-2"></i>Sorunu Giderildi Olarak İşaretle</button></div>`;n++;
 });
 const missing=[];
 vehicles.forEach(v=>{
  const s=maintStatus(v),pl=Utils.plate(v.plate,'scale-[.7] origin-left');
  if(s.missing){missing.push(v);}
  else if(s.state==='over'){html+=alertCard('danger','fa-oil-can','Bakım Gecikti!',pl,'<span class="text-red-400 font-black">KM/Süre Geçti</span>',`<button onclick="openMaintForm('${v.id}')" class="btn-3d btn-yellow w-full py-2.5 text-xs">Bakım İşle</button>`);n++}
  else if(s.state==='soon'){html+=alertCard('warning','fa-oil-can','Bakım Yaklaştı',pl,`Kalan: <b class="text-white">${nf(s.remain)} KM</b>`,`<button onclick="openMaintForm('${v.id}')" class="btn-3d btn-yellow w-full py-2.5 text-xs">Bakım İşle</button>`);n++}
  if(v.ins){
   const exp=new Date(v.ins+'T23:59:59'),days=Math.ceil((exp-now)/864e5);
   const iBtn=`<button onclick="openInspForm('${v.id}')" class="btn-3d btn-green w-full py-2.5 text-xs">Yenilendi</button>`;
   if(exp<now){html+=alertCard('danger','fa-calendar-xmark','Muayene Geçmiş!',pl,'<span class="text-red-400 font-black">Süresi Doldu</span>',iBtn);n++}
   else if(days<=15){html+=alertCard('warning','fa-calendar-day','Muayene Yaklaştı',pl,`Son: <b class="text-white">${days} Gün</b>`,iBtn);n++}
  }
 });
 const act=missions.filter(m=>m.status==='active');
 act.forEach(m=>{
  const h=(now-new Date(m.startTime))/36e5;
  if(h>8){const v=vehicles.find(v=>v.id===m.vehicleId);html+=alertCard('danger','fa-clock','Araç Dönmedi',Utils.plate(v?v.plate:'?','scale-[.7] origin-left'),`Süre: <b class="text-red-400">${Math.floor(h)} saat</b>`,'<button onclick="switchAdminTab(\'records\')" class="btn-3d btn-red w-full py-2.5 text-xs">Kayıtlardan Kapat</button>');n++}
 });
 missing.forEach(v=>{html+=alertCard('gray-400','fa-circle-info','Bakım Bilgisi Eksik',Utils.plate(v.plate,'scale-[.7] origin-left'),'Kayıt yok',`<button onclick="openMaintForm('${v.id}')" class="btn-3d btn-gray w-full py-2.5 text-xs">Şimdi Gir</button>`);n++});
 document.getElementById('dash-alerts').innerHTML=n?html:'<div class="text-center text-textmuted text-sm mt-20 flex flex-col items-center"><i class="fa-solid fa-shield-check text-6xl text-success/50 mb-4"></i>Tüm sistemler sorunsuz.</div>';

 document.getElementById('dash-live-count').innerText=act.length+' Araç';
 document.getElementById('dash-live-table').innerHTML=act.length?act.map(m=>{
  const v=vehicles.find(v=>v.id===m.vehicleId)||{plate:'?'},u=users.find(u=>u.id===m.userId)||{name:'?'};
  return `<tr class="hover:bg-white/5 transition"><td class="w-36 py-3">${Utils.plate(v.plate,'scale-[.8] origin-left')}</td><td class="font-bold text-sm text-white">${esc(u.name)}</td><td><div class="text-xs font-bold text-mission bg-mission/10 inline-block px-2 py-1 rounded border border-mission/20">${new Date(m.startTime).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})}</div><div class="text-[10px] text-textmuted mt-1 uppercase tracking-wider">Çıkış: <b class="text-white">${nf(m.startKm)}</b></div></td><td class="text-sm"><div class="truncate max-w-[220px] font-bold text-gray-200">${esc(m.destination)}</div><div class="text-[10px] text-mission font-bold uppercase tracking-wider mt-0.5">${esc(m.purpose||'')}</div></td></tr>`}).join(''):'<tr><td colspan="4" class="text-center py-12 text-textmuted text-sm bg-black/10 rounded-xl">Şu an sahada olan araç bulunmuyor.</td></tr>';
};

window.renderFleet=function(){
 const f=document.getElementById('fleet-filter').value;let vs=window.DB_DATA.vehicles.filter(v=>!v.isDeleted);
 if(f!=='all')vs=vs.filter(v=>v.status===f);
 const missions=window.DB_DATA.missions,users=window.DB_DATA.users;
 document.getElementById('fleet-container').innerHTML=vs.map(v=>{
  let badge='<span class="badge badge-success px-3 py-1.5"><i class="fa-solid fa-square-parking mr-2"></i>Garajda</span>';
  if(v.status==='busy')badge='<span class="badge badge-mission animate-mission px-3 py-1.5"><i class="fa-solid fa-route mr-2"></i>Sahada</span>';
  if(v.status==='maintenance')badge='<span class="badge badge-warning px-3 py-1.5"><i class="fa-solid fa-wrench mr-2"></i>Sanayide</span>';
  const img=v.image?`<img src="${esc(v.image)}" alt="" class="w-full h-full object-cover opacity-80">`:'<div class="w-full h-full flex items-center justify-center bg-gray-900 text-white/10"><i class="fa-solid fa-car-side text-8xl"></i></div>';
  const vm=missions.filter(m=>m.vehicleId===v.id).sort((a,b)=>new Date(b.endTime||b.startTime)-new Date(a.endTime||a.startTime));
  let drv='<span class="text-textmuted italic">Hiç Kullanılmadı</span>',issue='';
  if(vm.length){const lu=users.find(u=>u.id===vm[0].userId);drv=v.status==='busy'?`<b class="text-mission"><i class="fa-solid fa-user-circle mr-1"></i>${esc(lu?lu.name:'?')}</b> (Şu an onda)`:`Son Kullanan: <span class="text-white">${esc(lu?lu.name:'?')}</span>`}
  const open=vm.filter(m=>m.status==='completed'&&m.returnNote&&m.noteResolved===false);
  if(open.length)issue=`<div class="bg-red-500/20 text-red-300 text-[11px] px-3 py-2 rounded-lg font-bold mt-3 truncate border border-red-500/30"><i class="fa-solid fa-triangle-exclamation mr-1"></i>Açık Şikayet (${open.length}): ${esc(open[0].returnNote)}</div>`;
  const ms=maintStatus(v);
  const mb=ms.missing?'<span class="text-[10px] font-bold text-gray-500 uppercase tracking-widest"><i class="fa-solid fa-circle-info mr-1"></i>Bakım Bilgisi Yok</span>':ms.state==='over'?'<span class="text-[10px] font-black text-red-400 uppercase tracking-widest"><i class="fa-solid fa-triangle-exclamation mr-1"></i>Bakım Gecikti</span>':ms.state==='soon'?'<span class="text-[10px] font-bold text-yellow-400 uppercase tracking-widest"><i class="fa-solid fa-clock mr-1"></i>Bakım Yaklaştı</span>':'<span class="text-[10px] font-bold text-green-400 uppercase tracking-widest"><i class="fa-solid fa-check mr-1"></i>Bakım Güncel</span>';
  return `<div class="glass overflow-hidden cursor-pointer flex flex-col hover:border-primary hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition transform hover:-translate-y-1 group" onclick="openVehicleDetail('${v.id}')"><div class="relative h-48 bg-black/60 border-b border-white/10 overflow-hidden"><div class="absolute top-3 right-3 z-10">${badge}</div>${img}<div class="absolute bottom-3 left-3 z-10 shadow-lg">${Utils.plate(v.plate,'scale-[.85] origin-bottom-left')}</div></div><div class="p-5 flex-1 flex flex-col"><div class="flex justify-between items-start mb-4"><div class="font-black text-white text-lg tracking-wide group-hover:text-blue-400 transition">${esc(v.model)}</div><div class="text-xs font-black text-white bg-blue-600/30 border border-blue-500/30 px-3 py-1.5 rounded-lg shadow-inner">${nf(v.km)} KM</div></div><div class="text-xs text-gray-400 mb-4">${drv}</div><div class="mt-auto">${mb}${issue}</div></div></div>`;
 }).join('')||'<div class="col-span-full text-center text-textmuted p-12 bg-black/20 rounded-2xl">Aradığınız kriterlerde araç bulunamadı.</div>';
};

window.renderUsers=function(){
 document.getElementById('users-table').innerHTML=window.DB_DATA.users.filter(u=>!u.isDeleted).map(u=>{
  const s=u.isActive===false?'<span class="badge badge-warning text-[10px]">Pasif (İzinde/Ayrıldı)</span>':'<span class="badge badge-success text-[10px]">Aktif Personel</span>';
  return `<tr class="hover:bg-white/5 border-b border-white/5 transition"><td class="font-extrabold text-white text-base py-4"><i class="fa-solid fa-user-tie text-blue-400 mr-3"></i>${esc(u.name)}</td><td class="text-sm text-gray-300 font-bold">${esc(u.sicil||'---')} <span class="text-textmuted font-normal mx-2">/</span> ${esc(u.phone||'---')}</td><td class="font-black text-primary text-lg text-center bg-blue-900/10">${esc(u.licenseClass||'-')}</td><td class="text-center">${s}</td><td class="text-center"><button onclick="openUserForm('${u.id}')" class="text-yellow-400 hover:text-white bg-yellow-500/10 hover:bg-yellow-500/30 transition p-3 rounded-xl mr-3" title="Düzenle"><i class="fa-solid fa-pen text-lg"></i></button><button onclick="deleteUser('${u.id}')" class="text-red-400 hover:text-white bg-red-500/10 hover:bg-red-500/30 transition p-3 rounded-xl" title="Sistemden Sil"><i class="fa-solid fa-trash text-lg"></i></button></td></tr>`}).join('')||'<tr><td colspan="5" class="text-center py-12 text-textmuted bg-black/20 rounded-2xl">Sistemde kayıtlı personel bulunamadı.</td></tr>';
};

window.initRecords=function(){
 const v=document.getElementById('rec-veh'),u=document.getElementById('rec-usr');
 const pv=v.value,pu=u.value;
 v.innerHTML='<option value="">Tüm Araçlar</option>'+window.DB_DATA.vehicles.map(x=>`<option value="${esc(x.id)}">${esc(x.plate)}${x.isDeleted?' (Silinmiş)':''}</option>`).join('');
 u.innerHTML='<option value="">Tüm Personel</option>'+window.DB_DATA.users.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}${x.isDeleted?' (Silinmiş)':''}</option>`).join('');
 v.value=pv;u.value=pu; renderRecords();
};
window.renderRecords=function(){
 const vid=document.getElementById('rec-veh').value,uid=document.getElementById('rec-usr').value,mo=document.getElementById('rec-month').value;
 let ms=window.DB_DATA.missions;
 if(vid)ms=ms.filter(m=>m.vehicleId===vid);if(uid)ms=ms.filter(m=>m.userId===uid);if(mo)ms=ms.filter(m=>monthKey(m.startTime)===mo);
 ms = vid?ms.sort((a,b)=>b.startKm-a.startKm):ms.sort((a,b)=>new Date(b.startTime)-new Date(a.startTime));
 const vs=window.DB_DATA.vehicles,us=window.DB_DATA.users;
 document.getElementById('records-table').innerHTML=ms.length?ms.map(m=>{
  const v=vs.find(x=>x.id===m.vehicleId)||{plate:'Bilinmiyor'},u=us.find(x=>x.id===m.userId)||{name:'Silinmiş'},a=m.status==='active';
  return `<tr class="hover:bg-white/5 border-b border-white/5 transition"><td class="text-center py-4">${a?'<span class="badge badge-mission text-[10px] animate-mission">Sahada</span>':'<span class="badge badge-success text-[10px]">Tamamlandı</span>'}</td><td class="font-extrabold text-white text-sm">${esc(u.name)}</td><td>${Utils.plate(v.plate,'scale-[.75] origin-left')}</td><td><div class="max-w-[220px] truncate text-white text-sm">${esc(m.destination)}</div><div class="text-[10px] text-mission font-bold uppercase tracking-wider mt-0.5">${esc(m.purpose||'')}</div>${m.returnNote?`<div class="text-[10px] font-bold text-red-400 mt-1 bg-red-500/10 inline-block px-1.5 py-0.5 rounded"><i class="fa-solid fa-triangle-exclamation mr-1"></i>${esc(m.returnNote)}</div>`:''}${m.closeNote?`<div class="text-[10px] text-textmuted italic mt-1 border-l-2 border-gray-500 pl-1">${esc(m.closeNote)}</div>`:''}</td><td class="bg-blue-500/5 px-4"><div class="text-[11px] font-bold text-blue-300 uppercase tracking-widest">${Utils.dt(m.startTime)}</div><div class="font-black text-blue-400 text-lg">${nf(m.startKm)}</div></td><td class="bg-green-500/5 px-4">${a?'<span class="text-xs text-gray-400 italic font-bold">Devam Ediyor...</span>':`<div class="text-[11px] font-bold text-green-300 uppercase tracking-widest">${Utils.dt(m.endTime)}</div><div class="font-black text-green-400 text-lg">${nf(m.endKm)}</div>`}</td><td class="text-center font-black text-yellow-500 text-xl">${a?'--':'+'+nf(m.endKm-m.startKm)}</td><td class="text-center"><button onclick="openRecordEdit('${m.id}')" class="text-yellow-400 hover:text-white bg-yellow-500/10 hover:bg-yellow-500/30 transition p-3 rounded-xl" title="${a?'Zorla Kapat':'KM Düzelt'}"><i class="fa-solid ${a?'fa-lock':'fa-pen'} text-lg"></i></button></td></tr>`}).join(''):'<tr><td colspan="8" class="text-center py-12 text-textmuted text-sm bg-black/20 rounded-xl">Filtrelere uygun kayıt bulunamadı.</td></tr>';
};
window.exportCSV=function(){
 const q=v=>{let s=String(v??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'};
 let csv='Durum;Plaka;Surucu;Guzergah;Amac;Not;Cikis_Tarihi;Donus_Tarihi;Cikis_KM;Donus_KM;Fark_KM\n';
 window.DB_DATA.missions.forEach(x=>{const v=window.DB_DATA.vehicles.find(y=>y.id===x.vehicleId)||{plate:''},u=window.DB_DATA.users.find(y=>y.id===x.userId)||{name:''};
  csv+=[x.status==='active'?'Gorevde':'Tamamlandi',v.plate,u.name,x.destination,x.purpose||'',x.returnNote||x.closeNote||'',x.startTime?new Date(x.startTime).toLocaleString('tr-TR'):'',x.endTime?new Date(x.endTime).toLocaleString('tr-TR'):'',x.startKm,x.endKm??'',x.endKm!==undefined?x.endKm-x.startKm:''].map(q).join(';')+'\n'});
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'}));a.download='Numarataj_Rapor_'+todayStr()+'.csv';a.click();
};

window.renderSettings=function(){
 document.getElementById('settings-purposes-list').innerHTML=window.DB_DATA.purposes.map((p,i)=>`<div class="flex justify-between items-center bg-black/40 p-4 rounded-xl border border-white/5"><span class="text-sm font-black text-white uppercase tracking-wider"><i class="fa-solid fa-tag text-primary mr-4 text-lg"></i>${esc(p)}</span><button onclick="deletePurpose(${i})" class="text-red-400 bg-red-500/10 hover:bg-red-500/30 transition p-2.5 rounded-lg"><i class="fa-solid fa-trash"></i></button></div>`).join('');
 const c=window.DB_DATA.config,mc=maintCfg();
 document.getElementById('cfg-org').value=c.org||'T.C. ANKARA BÜYÜKŞEHİR BELEDİYESİ';document.getElementById('cfg-sub').value=c.sub||'Numarataj Şube Müdürlüğü';document.getElementById('cfg-url').value=c.baseUrl||'https://buraktonoz.com/ays';
 document.getElementById('cfg-interval').value=String(mc.interval);document.getElementById('cfg-warn').value=String(mc.warn);document.getElementById('cfg-months').value=String(mc.months);
};
function applySub(){const s=window.DB_DATA.config.sub||'Numarataj Şube Müdürlüğü';document.querySelectorAll('#hdr-org').forEach(e=>e.innerText=s)}

/* ARAÇ FORMU KAYIT */
document.getElementById('vf-img-file').addEventListener('change',e=>{
 const file=e.target.files[0];if(!file)return;const r=new FileReader();
 r.onload=ev=>{const img=new Image();img.onload=()=>{
  const W=Math.min(600,img.width),c=document.createElement('canvas');c.width=W;c.height=Math.round(img.height*W/img.width);
  c.getContext('2d').drawImage(img,0,0,c.width,c.height);
  const b=c.toDataURL('image/jpeg',0.6); 
  document.getElementById('vf-img-base64').value=b;const p=document.getElementById('vf-img-preview');p.src=b;p.classList.remove('hidden');
  document.getElementById('vf-img-label').innerHTML='Fotoğrafı Değiştir';
 };img.onerror=()=>showToast('Görsel okunamadı.','error');img.src=ev.target.result};r.readAsDataURL(file);
});
document.getElementById('form-vehicle').addEventListener('submit', async e=>{
 e.preventDefault();
 const id=document.getElementById('vf-id').value,vs=window.DB_DATA.vehicles,g=k=>document.getElementById('vf-'+k).value;
 const plate=fmtPlate(g('plate'));
 if(vs.find(v=>!v.isDeleted&&v.id!==id&&normPlate(v.plate)===normPlate(plate)))return showToast('Hata: Bu plaka sistemde zaten kayıtlı!','error');
 const km=parseInt(g('km'))||0,lk=parseInt(g('lastkm')),ld=g('lastdate');
 if(!isNaN(lk)&&lk>km)return showToast('Hata: Son bakım KM\'si aracın güncel KM\'sinden büyük olamaz.','error');
 if(ld&&ld>todayStr())return showToast('Hata: Son bakım tarihi gelecek bir tarih olamaz.','error');
 const d={plate,model:g('model').trim(),vin:g('vin').toUpperCase().trim(),year:g('year'),color:g('color').trim(),fuel:g('fuel'),km,ins:g('ins'),lastMaintKm:isNaN(lk)?null:lk,lastMaintDate:ld||'',image:g('img-base64'),notes:g('notes').trim()};
 const newId=id?id:idGen();
 const isNew = !id;
 if(id){
  const v=vehicleById(id); if(v.status!=='busy') d.status=g('status'); Object.assign(d, {isDeleted: false}); 
 }else{
  d.id=newId; d.status='available'; d.isDeleted=false;
 }
 try {
  await set(ref(db, 'vehicles/' + newId), {...(id?vehicleById(id):{}), ...d});
  if(isNew && d.lastMaintKm!==null){
   const mlId = idGen();
   await set(ref(db, 'maints/' + mlId), {id:mlId,vehicleId:newId,kind:'bakim',type:'Sisteme Giriş Öncesi Bakım',date:d.lastMaintDate||todayStr(),km:d.lastMaintKm,note:'Araç envantere kaydedilirken girilen referans değer',created:new Date().toISOString()});
  }
  showToast(id?'Araç bilgileri başarıyla güncellendi.':'Yeni araç filoya eklendi.','success'); closeModal();
 } catch(err) { showToast('Veritabanı bağlantı hatası.','error'); }
});

/* PERSONEL FORMU KAYIT */
document.getElementById('form-user').addEventListener('submit', async e=>{
 e.preventDefault();
 const id=document.getElementById('uf-id').value,pin=document.getElementById('uf-pin').value;
 if((pin||!id)&&!/^\d{4}$/.test(pin))return showToast('PIN şifresi kesinlikle 4 haneli rakam olmalıdır.','error');
 const d={name:document.getElementById('uf-name').value.trim(),sicil:document.getElementById('uf-sicil').value.trim(),phone:document.getElementById('uf-phone').value.trim(),licenseClass:document.getElementById('uf-lic').value.trim()};
 const newId=id?id:idGen();
 if(id){ Object.assign(d, {isActive:document.getElementById('uf-active').value==='true', isDeleted:false}); if(pin) d.pinHash=hashPin(pin,id); }
 else{ d.id=newId; d.isActive=true; d.isDeleted=false; d.pinHash=hashPin(pin,newId); }
 try { await set(ref(db, 'users/'+newId), {...(id?userById(id):{}), ...d}); showToast('Personel bilgileri kaydedildi.','success');closeModal(); } catch(err) { showToast('Kayıt hatası.','error'); }
});
window.deleteUser=async function(id){
 if(activeMissionOfUser(id))return showToast('Hata: Bu personelin üzerinde şu an kapanmamış bir görev var. Önce görevi sonlandırın.','error');
 if(!confirm('DİKKAT: Personeli sistemden silmek istediğinize emin misiniz?'))return;
 try { await update(ref(db, 'users/'+id), {isDeleted:true}); showToast('Personel silindi.','success'); } catch(e) { showToast('Silinemedi','error');}
};

/* ELLE KAYIT FORMU */
document.getElementById('form-manual-mission').addEventListener('submit', async e=>{
 e.preventDefault();
 const uid=document.getElementById('mm-user').value,vid=document.getElementById('mm-vehicle').value;
 if(activeMissionOfUser(uid)) return showToast('Hata: Seçilen personel şu an sistemde aktif görevde.','error');
 if(activeMissionOfVehicle(vid)) return showToast('Hata: Seçilen araç şu an sistemde aktif görevde.','error');
 const skm=parseInt(document.getElementById('mm-start-km').value),ekm=parseInt(document.getElementById('mm-end-km').value);
 const st=new Date(document.getElementById('mm-start-time').value),en=new Date(document.getElementById('mm-end-time').value);
 if(ekm<skm)return showToast('Dönüş KM, çıkış KM değerinden küçük olamaz!','error');
 if(en<=st)return showToast('Dönüş tarihi, çıkış tarihinden sonra olmalıdır.','error');
 if(en>new Date())return showToast('Gelecek bir tarih için kayıt girilemez.','error');
 if(window.DB_DATA.missions.some(m=>m.vehicleId===vid&&new Date(m.startTime)<en&&(m.endTime?new Date(m.endTime):new Date())>st))return showToast('Çakışma Hatası: Seçilen araç için belirtilen saat aralığında zaten bir görev var.','error');
 if(ekm-skm>1500&&!confirm(nf(ekm-skm)+' km kullanıldığı girildi. Onaylıyor musunuz?'))return;
 const note=document.getElementById('mm-note').value.trim(); const newId=idGen(); const updates = {};
 updates['/missions/' + newId] = {id:newId,userId:uid,vehicleId:vid,startKm:skm,endKm:ekm,startTime:st.toISOString(),endTime:en.toISOString(),destination:document.getElementById('mm-dest').value.trim(),purpose:document.getElementById('mm-purpose').value,status:'completed',returnNote:note,noteResolved:note?false:true,manual:true};
 const v = vehicleById(vid); if(v && ekm > v.km) updates['/vehicles/' + vid + '/km'] = ekm;
 try { await update(ref(db), updates); showToast('Geçmiş kayıt başarıyla eklendi.','success'); closeModal(); } catch(err) { showToast('Veritabanına yazılamadı.','error'); }
});

/* KAYIT GÜNCELLE / ZORLA KAPAT FORMU */
document.getElementById('form-record').addEventListener('submit', async e=>{
 e.preventDefault();
 const id=document.getElementById('rf-id').value,mode=document.getElementById('rf-mode').value;
 const skm=parseInt(document.getElementById('rf-skm').value),ekm=parseInt(document.getElementById('rf-ekm').value);
 if(ekm<skm)return showToast('Dönüş KM çıkıştan küçük olamaz.','error');
 const m=window.DB_DATA.missions.find(m=>m.id===id);if(!m)return;
 if(ekm-skm>1500&&!confirm(nf(ekm-skm)+' km yazıldı. Onaylıyor musunuz?'))return;
 const updates = {};
 updates['/missions/'+id+'/startKm'] = skm; updates['/missions/'+id+'/endKm'] = ekm;
 if(mode==='close'){
  updates['/missions/'+id+'/status'] = 'completed'; updates['/missions/'+id+'/endTime'] = new Date().toISOString(); updates['/missions/'+id+'/noteResolved'] = true; updates['/missions/'+id+'/closeNote'] = 'Yönetici tarafından kapatıldı';
  const v = vehicleById(m.vehicleId); if(v && v.status === 'busy') updates['/vehicles/'+m.vehicleId+'/status'] = 'available';
 }
 try {
  await update(ref(db), updates);
  const v = vehicleById(m.vehicleId);
  if(v) {
   const allM = window.DB_DATA.missions.filter(x=>x.vehicleId===m.vehicleId && x.id!==id); allM.push({...m, endKm: ekm, startKm: skm}); 
   const maxK = Math.max(...allM.map(x=>x.endKm!==undefined?x.endKm:x.startKm), v.lastMaintKm||0);
   if(maxK !== v.km) await set(ref(db, '/vehicles/'+m.vehicleId+'/km'), maxK);
  }
  showToast(mode==='close'?'Görev zorla kapatıldı.':'Kayıt başarıyla güncellendi.','success'); closeModal();
 } catch (err) { showToast('Hata oluştu.','error'); }
});

/* MODAL: ARAZ GİDER / BAKIM GİR / MUAYENE GİR */
document.getElementById('form-resolve-note').addEventListener('submit', async e=>{
 e.preventDefault(); const mid = document.getElementById('rn-mid').value;
 try { await update(ref(db, 'missions/'+mid), {noteResolved:true, resolveNote:document.getElementById('rn-text').value.trim(), resolveDate:new Date().toISOString()}); showToast('Rapor başarıyla kaydedildi.','success');closeModal(); } catch(err) { showToast('Bağlantı hatası.','error'); }
});
document.getElementById('form-maint').addEventListener('submit', async e=>{
 e.preventDefault();
 const vid=document.getElementById('mt-vid').value,v=vehicleById(vid);if(!v)return;
 const date=document.getElementById('mt-date').value,km=parseInt(document.getElementById('mt-km').value),reset=document.getElementById('mt-reset').checked;
 if(!date||isNaN(km))return showToast('Tarih ve KM alanları zorunludur.','error');
 if(date>todayStr())return showToast('Gelecek tarihli bakım girilemez.','error');
 if(km>v.km)return showToast('Uyarı: Bakım KM değeri aracın güncel KM değerinden yüksek. Önce aracın KM\'sini güncelleyin.','error');
 const mId = idGen(); const updates = {};
 updates['/maints/'+mId] = {id:mId,vehicleId:vid,kind:'bakim',type:document.getElementById('mt-type').value,date,km,note:document.getElementById('mt-note').value.trim(),created:new Date().toISOString()};
 if(reset&&(v.lastMaintKm===undefined||v.lastMaintKm===null||km>=v.lastMaintKm)){ updates['/vehicles/'+vid+'/lastMaintKm'] = km; updates['/vehicles/'+vid+'/lastMaintDate'] = date; }
 try { await update(ref(db), updates); showToast('Bakım kaydı başarıyla oluşturuldu.','success'); closeModal(); } catch(err) { showToast('Hata.','error'); }
});
document.getElementById('form-insp').addEventListener('submit', async e=>{
 e.preventDefault();
 const vid=document.getElementById('mi-vid').value,v=vehicleById(vid);if(!v)return;
 const nd=document.getElementById('mi-date').value, note=document.getElementById('mi-note').value.trim();
 if(!nd||nd<todayStr())return showToast('Yeni bitiş tarihi bugünden geçmiş olamaz.','error');
 const mId=idGen(); const updates = {};
 updates['/maints/'+mId] = {id:mId,vehicleId:vid,kind:'muayene',type:'TÜVTÜRK Muayene Yenileme',date:todayStr(),km:v.km,note:'Yeni Bitiş: '+Utils.d(nd+'T12:00:00')+(note?' – '+note:''),created:new Date().toISOString()};
 updates['/vehicles/'+vid+'/ins'] = nd;
 try { await update(ref(db), updates); showToast('Muayene tarihi başarıyla güncellendi.','success'); closeModal(); } catch(err) { showToast('Hata.','error'); }
});

/* AYARLAR FORMLARI */
document.getElementById('form-maint-cfg').addEventListener('submit', async e=>{
 e.preventDefault(); try { await update(ref(db, 'config'), { maintInterval:parseInt(document.getElementById('cfg-interval').value), maintWarn:parseInt(document.getElementById('cfg-warn').value), maintMonths:parseInt(document.getElementById('cfg-months').value) }); showToast('Bakım periyot ayarları kaydedildi.','success'); } catch(e) { showToast('Kaydedilemedi.','error');}
});
document.getElementById('form-add-purpose').addEventListener('submit', async e=>{
 e.preventDefault();const inp=document.getElementById('new-purpose-name'),v=inp.value.trim();if(!v)return;
 const ps=window.DB_DATA.purposes;if(ps.some(p=>p.toLowerCase()===v.toLowerCase()))return showToast('Bu kategori listede zaten var.','warning');
 try { await set(ref(db, 'purposes'), [...ps, v]); inp.value=''; } catch(e) { showToast('Eklenemedi.','error');}
});
window.deletePurpose=async function(i){
 const ps=window.DB_DATA.purposes;if(ps.length<=1)return showToast('En az bir adet görev amacı kalmalıdır.','error');
 ps.splice(i,1); try { await set(ref(db, 'purposes'), ps); } catch(e) { showToast('Silinemedi','error'); }
};
document.getElementById('form-config').addEventListener('submit', async e=>{
 e.preventDefault();const url=document.getElementById('cfg-url').value.trim();
 if(url&&!/^https?:\/\//i.test(url))return showToast('Adres http:// veya https:// ile başlamalıdır.','error');
 try { await update(ref(db, 'config'), { org:document.getElementById('cfg-org').value.trim(), sub:document.getElementById('cfg-sub').value.trim(), baseUrl:url }); showToast('Kurum ve QR ayarları kaydedildi.','success'); } catch(e) { showToast('Hata.','error');}
});
