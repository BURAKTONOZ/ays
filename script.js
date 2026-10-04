import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, update, set } from "firebase/database";

// Electron API Bağlantısı (preload.js üzerinden güvenli)
if (window.electronAPI) {
    document.getElementById('win-min')?.addEventListener('click', window.electronAPI.minimize);
    document.getElementById('win-max')?.addEventListener('click', window.electronAPI.maximize);
    document.getElementById('win-close')?.addEventListener('click', window.electronAPI.close);
}

const firebaseConfig = {
  apiKey: "AIzaSyBCpOgcfBCp30-G2uxOYQ0NXRAiywOoTGY",
  authDomain: "numarataj-arac-filo.firebaseapp.com",
  databaseURL: "https://numarataj-arac-filo-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "numarataj-arac-filo"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

window.DB_DATA = { vehicles: [], users: [], missions: [], purposes: [], config: {} };
let currentTab = 'dash';

// Yerel Saat Çözümü (UTC Hatasını Düzeltir)
const getLocalIsoDate = () => new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];

// Çevrimiçi / Çevrimdışı Bağlantı Kontrolü
onValue(ref(db, '.info/connected'), (snap) => {
    const el = document.getElementById('conn-status');
    if(el) {
        if (snap.val() === true) {
            el.innerHTML = '<span class="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span><span class="text-[10px] font-bold text-green-400 uppercase">Canlı Bağlantı</span>';
        } else {
            el.innerHTML = '<span class="w-2 h-2 rounded-full bg-red-500"></span><span class="text-[10px] font-bold text-red-500 uppercase">Bağlantı Koptu</span>';
        }
    }
});

// Performans Optimizasyonu: Verileri Ayrı Ayrı Dinle (Köke bağlanmak programı dondurur)
onValue(ref(db, 'config'), snap => { 
    const c = snap.val() || {}; 
    window.DB_DATA.config = c;
    if(c.isActive === false) document.getElementById('system-lock-screen').classList.replace('hidden', 'flex');
});
onValue(ref(db, 'vehicles'), snap => { const d = snap.val()||{}; window.DB_DATA.vehicles = Object.keys(d).map(k=>({id:k,...d[k]})); window.renderCurrent(); });
onValue(ref(db, 'users'), snap => { const d = snap.val()||{}; window.DB_DATA.users = Object.keys(d).map(k=>({id:k,...d[k]})); window.renderCurrent(); });
onValue(ref(db, 'missions'), snap => { const d = snap.val()||{}; window.DB_DATA.missions = Object.keys(d).map(k=>({id:k,...d[k]})); window.renderCurrent(); });

// Şifre Giriş Mantığı (Hash kontrolü ile güvenlik)
document.getElementById('form-admin-login')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const pw = document.getElementById('al-pw').value.trim();
    // Güvenlik: Admin şifresi düz metin saklanmamalıdır. (Örn: H() fonksiyonu ile şifrelenmiş hali kontrol edilir)
    // Demo için basit kontrol:
    if (pw === (window.DB_DATA.config.adminPass || "5555")) {
        document.getElementById('admin-login-screen').classList.replace('flex', 'hidden');
        document.getElementById('app').classList.remove('hidden');
        window.switchAdminTab('dash');
    } else {
        alert("Hatalı Şifre!");
    }
});

/* EKSİK FONKSİYONLARIN EKLENMESİ */
window.openVehicleForm = function(id = null) {
    document.getElementById('form-vehicle').reset();
    document.getElementById('vf-id').value = id || '';
    document.getElementById('vf-status-box').classList.toggle('hidden', !id);
    document.getElementById('vf-title').innerText = id ? 'Araç Düzenle' : 'Yeni Araç';
    if(id) {
        const v = window.DB_DATA.vehicles.find(x => x.id === id);
        if(v) {
            ['plate','model','vin','year','color','fuel','km','ins','notes'].forEach(k => {
                if(document.getElementById('vf-'+k)) document.getElementById('vf-'+k).value = v[k] || '';
            });
        }
    }
    openModal('modal-vehicle-form');
};

window.openManualMissionForm = function() {
    document.getElementById('form-manual-mission').reset();
    const uSel = document.getElementById('mm-user');
    const vSel = document.getElementById('mm-vehicle');
    uSel.innerHTML = '<option value="">Personel Seçin</option>' + window.DB_DATA.users.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
    vSel.innerHTML = '<option value="">Araç Seçin</option>' + window.DB_DATA.vehicles.map(v => `<option value="${v.id}">${v.plate}</option>`).join('');
    openModal('modal-manual-mission');
};

window.updateManualVehicleKm = function() {
    const vid = document.getElementById('mm-vehicle').value;
    const v = window.DB_DATA.vehicles.find(x => x.id === vid);
    if(v) document.getElementById('mm-start-km').value = v.km;
};

window.openUserForm = function(id = null) {
    document.getElementById('form-user').reset();
    document.getElementById('uf-id').value = id || '';
    document.getElementById('uf-status-box').classList.toggle('hidden', !id);
    if(id) {
        const u = window.DB_DATA.users.find(x => x.id === id);
        if(u) {
            ['name','sicil','phone','lic'].forEach(k => {
                if(document.getElementById('uf-'+k)) document.getElementById('uf-'+k).value = u[k] || '';
            });
        }
    }
    openModal('modal-user-form');
};

window.openRecordEdit = function(id) {
    const m = window.DB_DATA.missions.find(x => x.id === id);
    if(!m) return;
    document.getElementById('rf-id').value = id;
    document.getElementById('rf-mode').value = (m.status === 'active') ? 'close' : 'edit';
    document.getElementById('rf-skm').value = m.startKm;
    document.getElementById('rf-ekm').value = m.endKm || '';
    openModal('modal-record-edit');
};

// Modal Kontrolleri Modifiye Edildi (Arka plan flex center eklendi)
window.openModal = function(id) {
    const overlay = document.getElementById('modal-overlay');
    overlay.classList.remove('hidden');
    overlay.classList.add('flex'); // Merkezleme için Flex eklendi
    setTimeout(() => overlay.classList.remove('opacity-0'), 10);
    document.querySelectorAll('.glass-modal').forEach(m => m.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
};

window.closeModal = function() {
    const overlay = document.getElementById('modal-overlay');
    overlay.classList.add('opacity-0');
    setTimeout(() => {
        overlay.classList.remove('flex');
        overlay.classList.add('hidden');
        document.querySelectorAll('.glass-modal').forEach(m => m.classList.add('hidden'));
    }, 300);
};
document.querySelectorAll('.modal-close').forEach(btn => btn.addEventListener('click', window.closeModal));

// Sekme Geçişi
window.switchAdminTab = function(tab) {
    currentTab = tab;
    ['dash','records','fleet','users','settings'].forEach(t => {
        document.getElementById('admin-'+t)?.classList.toggle('hidden', t !== tab);
    });
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
    window.renderCurrent();
};

window.renderCurrent = function() {
    // Render fonksiyonlarınız burada çağrılır.
    console.log(currentTab + " render edildi.");
};
