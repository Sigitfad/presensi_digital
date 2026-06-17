/**
 * app.js v2.3 — Presensi SDN Karangpawitan 1
 * Fix: sidebar foto sinkron, scan popup foto, pengampu kelas nav
 */

async function loadLayout(activePage, pageTitle) {
  const identitasPromise = (async()=>{
    try {
      const c=sessionStorage.getItem('_id');
      if(c) return {cached:true, data:JSON.parse(c)};
    } catch(e){}
    try {
      const ri=await fetch('/api/identitas'), di=await ri.json();
      if(di.success && di.data){ try{sessionStorage.setItem('_id',JSON.stringify(di.data));}catch(e){} return {cached:false, data:di.data}; }
    } catch(e){}
    return {cached:false, data:{ nama_sekolah:'SDN Karangpawitan 1', logo:'' }};
  })();

  const [sessionRes, ident, taRes] = await Promise.all([
    fetch('/api/session').then(r=>r.json()).catch(()=>{window.location.href='/login';return null;}),
    identitasPromise,
    fetch('/api/tahun-ajaran/aktif').then(r=>r.json()).catch(()=>({success:false}))
  ]);
  if(!sessionRes||!sessionRes.loggedIn){ window.location.href='/login'; return; }
  const session=sessionRes;
  const identitas = ident.data;
  const tahunAjaranAktif = taRes?.success ? taRes.data : null;

  const role        = session.role || 'operator';
  const isOperator  = role === 'operator';
  const pengampu    = session.pengampuKelas || 'Semua';
  const bidangKeahlian = session.bidangKeahlian || '';
  const fotoUser    = session.foto || '';

  const ROLE_LABEL = {operator:'Operator',guru:'Guru',kepala_sekolah:'Kepala Sekolah',penjaga_sekolah:'Penjaga Sekolah',guru_bidang:'Guru Bidang'};
  const ROLE_COLOR = {operator:'#2563EB',guru:'#059669',kepala_sekolah:'#7C3AED',penjaga_sekolah:'#D97706',guru_bidang:'#0891B2'};

  const logoHTML = identitas.logo
    ? `<img src="${identitas.logo}" style="width:36px;height:36px;border-radius:8px;object-fit:cover;" alt="Logo">`
    : `<i class="bi bi-mortarboard-fill"></i>`;

  // ── Sidebar user avatar (foto atau inisial) ──
  const userIni = session.nama.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
  const sidebarAvatar = fotoUser
    ? `<img src="${fotoUser}" style="width:34px;height:34px;border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,0.4);" alt="foto" onerror="this.outerHTML='<div style=\\'width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:white;\\'>${userIni}</div>'">`
    : `<div style="width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:white;">${userIni}</div>`;

  // ── Subtitle kelas untuk non-operator ──
  const kelasSubtitle = !isOperator && pengampu !== 'Semua'
    ? `<div style="font-size:10px;background:rgba(255,255,255,0.2);padding:1px 8px;border-radius:10px;margin-top:3px;color:rgba(255,255,255,0.9);font-weight:600;">Pengampu ${pengampu}</div>`
    : '';

  // ── Nav items ──
  const navGroups = [
    { label:'Menu Utama', items:[
      { page:'dashboard', icon:'bi-speedometer2',  label:'Dashboard',       href:'/pages/dashboard' },
    ]},
    { label:'Presensi', items:[
      { page:'scan',    icon:'bi-credit-card-2-front',  label:'ABSENSI RFID',          href:'/pages/scan' },
      { page:'riwayat', icon:'bi-clock-history', label:'Riwayat Presensi', href:'/pages/riwayat' },
      { page:'rekap',   icon:'bi-bar-chart-fill',label:'Rekap Presensi',   href:'/pages/rekap' },
      ...(isOperator ? [
        { page:'broadcast', icon:'bi-whatsapp', label:'Broadcast WhatsApp', href:'/pages/broadcast' },
      ] : []),
    ]},
    { label:'Manajemen', items:[
      ...(isOperator || ['guru','kepala_sekolah','guru_bidang'].includes(role) ? [
        { page:'siswa',  icon:'bi-people-fill',    label:'Data Siswa', href:'/pages/siswa' },
      ] : []),
      ...(isOperator ? [
        { page:'users',  icon:'bi-person-gear',    label:'Data GTK', href:'/pages/users' },
        { page:'alumni',   icon:'bi-mortarboard',      label:'Data Lulusan',  href:'/pages/alumni' },
        { page:'pindahan', icon:'bi-arrow-right-circle', label:'Data Pindahan', href:'/pages/pindahan' },
      ] : []),
    ]},
    { label:'Pengaturan', items:[
      ...(isOperator ? [
        { page:'settings',   icon:'bi-gear-fill',      label:'Pengaturan',    href:'/pages/settings' },
        { page:'hari-libur', icon:'bi-calendar2-week', label:'Kalender',      href:'/pages/hari-libur' },
        { page:'actlog',     icon:'bi-journal-text',   label:'Log Aktivitas', href:'/pages/actlog' },
        { page:'backup',     icon:'bi-cloud-arrow-up', label:'Backup DB',     href:'/pages/backup' },
      ] : []),
    ]},
  ];

  let navHTML = '';
  const COLLAPSE_KEY = 'navCollapse';
  let collapseState = {};
  try { collapseState = JSON.parse(localStorage.getItem(COLLAPSE_KEY)) || {}; } catch(e){}
  navGroups.forEach(g => {
    if (!g.items.length) return;
    const key = g.label;
    const isMenu = key === 'Menu Utama';
    if(isMenu){
      g.items.forEach(n => {
        navHTML += '<div class="nav-item"><a href="'+n.href+'" class="nav-link'+(activePage===n.page?' active':'')+'" title="'+n.label+'"><i class="bi '+n.icon+' nav-icon"></i><span class="nav-text">'+n.label+'</span></a></div>';
      });
      return;
    }
    const hasToggle = g.items.length > 1;
    const isCollapsed = hasToggle && collapseState[key] === true;
    const chevIcon = isCollapsed?'down':'up';
    navHTML += '<div class="nav-group"><div class="nav-label" data-group="'+key+'" style="'+(hasToggle?'cursor:pointer;':'')+'display:flex;align-items:center;justify-content:space-between;"><span>'+g.label+'</span>'+(hasToggle?'<i class="bi bi-chevron-'+chevIcon+'" style="font-size:10px;transition:transform 0.2s;"></i>':'')+'</div><div class="nav-items" style="display:'+(isCollapsed?'none':'block')+';">';
    g.items.forEach(n => {
      navHTML += '<div class="nav-item"><a href="'+n.href+'" class="nav-link'+(activePage===n.page?' active':'')+'" title="'+n.label+'"><i class="bi '+n.icon+' nav-icon"></i><span class="nav-text">'+n.label+'</span></a></div>';
    });
    navHTML += '</div></div>';
  });

  document.body.insertAdjacentHTML('afterbegin', `
    <nav id="sidebar">
      <a href="/pages/dashboard" class="sidebar-brand">
        <div class="brand-icon">${logoHTML}</div>
        <div class="brand-text">
          <div class="brand-name">${identitas.nama_sekolah || 'SDN Karangpawitan 1'}</div>
          <div class="brand-sub">Presensi Digital ${tahunAjaranAktif ? `<span style="font-size:9px;background:rgba(255,255,255,0.2);padding:1px 6px;border-radius:8px;margin-left:4px;">${tahunAjaranAktif.nama}</span>` : ''}</div>
        </div>
      </a>
      <div class="sidebar-nav">${navHTML}</div>
      <div class="sidebar-footer">
        <div class="sidebar-user">
          ${sidebarAvatar}
          <div class="user-info">
            <div class="user-name">${session.nama}</div>
            <div style="display:flex;flex-direction:column;gap:2px;">
              <div class="user-role-badge" style="font-size:10px;font-weight:700;color:white;background:${ROLE_COLOR[role]||'#2563EB'};padding:1px 8px;border-radius:10px;display:inline-block;">${role==='guru_bidang'&&bidangKeahlian?bidangKeahlian:(ROLE_LABEL[role]||role)}</div>
              ${kelasSubtitle}
            </div>
          </div>
        </div>
      </div>
    </nav>
    <div id="overlay"></div>
    <div id="main-content">
      <header id="topbar">
        <button id="toggle-sidebar" title="Toggle Sidebar"><i class="bi bi-list"></i></button>
        <div class="topbar-title">${pageTitle}</div>
        <div class="topbar-clock" id="realtime-clock">--</div>
        <div class="topbar-actions">
          <a href="#" class="btn-logout" onclick="konfirmasiLogout(event)">
            <i class="bi bi-box-arrow-right"></i>
            <span class="d-none d-sm-inline">Logout</span>
          </a>
        </div>
      </header>
  `);

  const sidebar = document.getElementById('sidebar');
  const mc      = document.getElementById('main-content');
  const overlay = document.getElementById('overlay');
  const isMobile= () => window.innerWidth <= 768;

  document.getElementById('toggle-sidebar').addEventListener('click', () => {
    if(isMobile()){ sidebar.classList.toggle('mobile-open'); overlay.classList.toggle('show'); }
    else { sidebar.classList.toggle('collapsed'); mc.classList.toggle('expanded');
      localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed')); }
  });
  overlay.addEventListener('click', () => { sidebar.classList.remove('mobile-open'); overlay.classList.remove('show'); });
  if(localStorage.getItem('sidebarCollapsed')==='true' && !isMobile()){
    sidebar.classList.add('collapsed'); mc.classList.add('expanded');
  }

  document.querySelectorAll('.nav-label[data-group]').forEach(el => {
    el.addEventListener('click', () => {
      const key = el.dataset.group;
      const items = el.nextElementSibling;
      if(!items || !items.classList.contains('nav-items')) return;
      const isHidden = items.style.display === 'none';
      items.style.display = isHidden ? 'block' : 'none';
      const chevron = el.querySelector('.bi');
      if(chevron) chevron.className = `bi bi-chevron-${isHidden ? 'up' : 'down'}`;
      let state = {};
      try { state = JSON.parse(localStorage.getItem('navCollapse')) || {}; } catch(e){}
      state[key] = !isHidden;
      localStorage.setItem('navCollapse', JSON.stringify(state));
    });
  });

  const pc = document.getElementById('page-content');
  if(pc) mc.appendChild(pc);

  const footer = document.createElement('footer');
  footer.style.cssText = 'text-align:center;padding:14px 24px;font-size:12px;color:#94A3B8;border-top:1px solid rgba(0,0,0,0.05);background:white;margin-top:auto;';
  footer.innerHTML = `&copy; ${new Date().getFullYear()} ${identitas.nama_sekolah||'SDN Karangpawitan 1'} &mdash; Sistem Presensi Digital`;
  mc.appendChild(footer);

  function tick(){
    const el=document.getElementById('realtime-clock'); if(!el) return;
    const now=new Date();
    const D=['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
    const B=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    const h=String(now.getHours()).padStart(2,'0'), m=String(now.getMinutes()).padStart(2,'0'), s=String(now.getSeconds()).padStart(2,'0');
    el.textContent=`${D[now.getDay()]}, ${now.getDate()} ${B[now.getMonth()]} ${now.getFullYear()} — ${h}:${m}:${s}`;
  }
  tick(); setInterval(tick, 1000);
  window._session = session;
}

// ── DEBOUNCE ──
function debounce(fn, ms=300){ let t; return (...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms);}; }

// ── AJAX ──
async function fetchAPI(url, method='GET', data=null){
  const opts = { method };
  if(data instanceof FormData){ opts.body=data; }
  else if(data){ opts.headers={'Content-Type':'application/json'}; opts.body=JSON.stringify(data); }
  try {
    const res = await fetch(url, opts);
    if(res.status===401){ window.location.href='/login'; return null; }
    return res.json();
  } catch(e){ showToast('Koneksi error','error'); return null; }
}

// ── TOAST ──
function showToast(msg, type='success'){
  if(!document.getElementById('_swalAnim')){
    const s=document.createElement('style'); s.id='_swalAnim';
    s.textContent='.sa-in{animation:_saIn .25s ease forwards}.sa-out{animation:_saOut .25s ease forwards}@keyframes _saIn{from{opacity:0;transform:translateY(-16px) scale(.95)}to{opacity:1;transform:translateY(0) scale(1)}}@keyframes _saOut{from{opacity:1;transform:translateY(0) scale(1)}to{opacity:0;transform:translateY(-16px) scale(.95)}}';
    document.head.appendChild(s);
  }
  Swal.fire({
    toast:true, position:'center', showConfirmButton:false, timer:3500, timerProgressBar:false,
    icon:type, title:msg, padding:'12px 16px',
    hideClass:{popup:'sa-out'}
  });
}

// ── MODAL ──
function openModal(id){ const el=document.getElementById(id); if(el&&!el.classList.contains('show')) new bootstrap.Modal(el).show(); }
function closeModal(id){ const el=document.getElementById(id); if(el){ const m=bootstrap.Modal.getInstance(el); if(m) m.hide();   }
}

// ── TAHUN AJARAN OPTIONS ──
async function loadTAOptions(selId){
  const r=await fetchAPI('/api/tahun-ajaran/');
  if(!r?.data) return;
  const sel=document.getElementById(selId);if(!sel) return;
  sel.innerHTML='<option value="">Semua</option>'+r.data.map(ta=>`<option value="${ta.id}">${ta.nama}</option>`).join('');
}

// ── LOGOUT MODAL ──
function konfirmasiLogout(e){
  e.preventDefault();
  if(!document.getElementById('_mLogout')){
    const d=document.createElement('div');
    d.innerHTML=`<div class="modal fade" id="_mLogout" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered modal-sm">
        <div class="modal-content" style="border-radius:14px;border:none;box-shadow:0 10px 40px rgba(0,0,0,0.15);">
          <div class="modal-body p-4 text-center">
            <div style="width:56px;height:56px;background:#FEE2E2;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;">
              <i class="bi bi-box-arrow-right" style="font-size:26px;color:#DC2626;"></i>
            </div>
            <h6 style="font-family:'Plus Jakarta Sans',sans-serif;font-weight:700;color:#1E293B;margin-bottom:6px;">Yakin ingin logout?</h6>
            <p style="font-size:13px;color:#64748B;margin-bottom:20px;">Sesi Anda akan diakhiri.</p>
            <div class="d-flex gap-2 justify-content-center">
              <button class="btn btn-light" style="border-radius:8px;font-weight:600;font-size:13px;padding:8px 20px;" data-bs-dismiss="modal">Batal</button>
              <button class="btn btn-danger" style="border-radius:8px;font-weight:600;font-size:13px;padding:8px 20px;" onclick="window.location.href='/logout'">Logout</button>
            </div>
          </div>
        </div>
      </div>
    </div>`;
    document.body.appendChild(d);
  }
  openModal('_mLogout');
}

// ── KONFIRMASI MODAL ──
function konfirmasiHapus(judul, pesan, callback, btnLabel = 'Hapus', btnClass = 'btn-danger'){
  const old=document.getElementById('_mHapus'); if(old) old.remove();
  const isDanger = btnClass && btnClass.includes('btn-danger');
  const d=document.createElement('div');
  d.innerHTML=`<div class="modal fade" id="_mHapus" tabindex="-1">
    <div class="modal-dialog modal-dialog-centered modal-sm">
      <div class="modal-content" style="border-radius:14px;border:none;box-shadow:0 10px 40px rgba(0,0,0,0.15);">
        <div class="modal-body p-4 text-center">
          <h6 style="font-family:'Plus Jakarta Sans',sans-serif;font-weight:700;color:#1E293B;margin-bottom:6px;">${judul}</h6>
          <p style="font-size:13px;color:#64748B;margin-bottom:20px;">${pesan}</p>
          <div class="d-flex gap-2 justify-content-center">
            <button class="btn" style="border-radius:8px;font-weight:600;font-size:13px;padding:8px 20px;background:#1E293B;border:none;color:#fff;transition:all 0.2s;" data-bs-dismiss="modal" onmouseover="this.style.background='#334155';this.style.boxShadow='0 4px 12px rgba(30,41,59,0.3)';this.style.transform='translateY(-1px)';" onmouseout="this.style.background='#1E293B';this.style.boxShadow='none';this.style.transform='';">Batal</button>
            <button class="${btnClass}" id="_hapusOk" style="border-radius:8px;font-weight:600;font-size:13px;padding:8px 20px;${isDanger?'background:#DC2626;border:none;color:#fff;box-shadow:0 2px 6px rgba(220,38,38,0.3);':''}" onmouseover="this.style.background='#B91C1C';this.style.boxShadow='0 4px 12px rgba(220,38,38,0.4)';this.style.transform='translateY(-1px)';" onmouseout="this.style.background='#DC2626';this.style.boxShadow='0 2px 6px rgba(220,38,38,0.3)';this.style.transform='';">${btnLabel}</button>
          </div>
        </div>
      </div>
    </div>
  </div>`;
  document.body.appendChild(d);
  const bsModal = new bootstrap.Modal(document.getElementById('_mHapus'));
  bsModal.show();
  document.getElementById('_hapusOk').onclick = () => { bsModal.hide(); callback(); };
}

// ══════════════════════════════════════════════════════════════
// CROPPER LINKEDIN-STYLE
// ══════════════════════════════════════════════════════════════
let _cropperState = { img:null,scale:1,offsetX:0,offsetY:0,imgW:0,imgH:0,cropSize:0,canvasSize:0,areaH:0,onConfirm:null,minScale:1,maxScale:5 };

function showCropper(file, onConfirm){
  const existing = document.getElementById('_cropModal');
  if(existing) existing.remove();

  const wrapper = document.createElement('div');
  wrapper.id = '_cropModal';
  wrapper.innerHTML = `
  <style>
    #_cropOverlay{position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:99999;display:flex;align-items:center;justify-content:center;animation:_fi 0.2s ease;}
    @keyframes _fi{from{opacity:0}to{opacity:1}}
    #_cropBox{background:white;border-radius:16px;width:min(520px,96vw);box-shadow:0 20px 60px rgba(0,0,0,0.4);overflow:hidden;}
    #_cropHeader{padding:16px 20px;border-bottom:1px solid #E2E8F0;display:flex;align-items:center;justify-content:space-between;}
    #_cropHeader h5{font-family:'Plus Jakarta Sans',sans-serif;font-weight:700;font-size:16px;color:#1E293B;margin:0;}
    #_cropArea{background:#1E293B;position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden;height:360px;}
    #_cropCanvas{cursor:grab;touch-action:none;display:block;}
    #_cropCanvas:active{cursor:grabbing;}
    #_cropGuide{position:absolute;border:2px solid rgba(255,255,255,0.8);border-radius:50%;pointer-events:none;box-shadow:0 0 0 9999px rgba(0,0,0,0.5);}
    #_cropControls{padding:14px 20px;border-top:1px solid #E2E8F0;}
    #_zoomSlider{width:100%;accent-color:#2563EB;height:4px;cursor:pointer;}
    #_cropFooter{padding:14px 20px;border-top:1px solid #E2E8F0;display:flex;justify-content:flex-end;gap:10px;}
    #_cropBtnCancel{padding:8px 20px;border:1.5px solid #E2E8F0;border-radius:8px;background:white;font-weight:600;font-size:13px;cursor:pointer;color:#64748B;}
    #_cropBtnCancel:hover{background:#F1F5F9;}
    #_cropBtnOk{padding:8px 24px;border:none;border-radius:8px;background:linear-gradient(135deg,#2563EB,#1D4ED8);color:white;font-weight:700;font-size:13px;cursor:pointer;}
    #_cropBtnOk:hover{box-shadow:0 4px 14px rgba(37,99,235,0.4);}
  </style>
  <div id="_cropOverlay">
    <div id="_cropBox">
      <div id="_cropHeader">
        <h5><i class="bi bi-crop" style="margin-right:8px;color:#2563EB;"></i>Sesuaikan Foto Profil</h5>
        <button onclick="document.getElementById('_cropModal').remove()" style="background:none;border:none;font-size:22px;color:#94A3B8;cursor:pointer;line-height:1;">&times;</button>
      </div>
      <div id="_cropArea">
        <canvas id="_cropCanvas"></canvas>
        <div id="_cropGuide"></div>
      </div>
      <div id="_cropControls">
        <div style="display:flex;align-items:center;gap:10px;">
          <i class="bi bi-zoom-out" style="color:#64748B;font-size:16px;"></i>
          <input type="range" id="_zoomSlider" min="10" max="500" step="1" value="100">
          <i class="bi bi-zoom-in" style="color:#64748B;font-size:16px;"></i>
        </div>
        <div id="_zoomLabel" style="text-align:center;font-size:11.5px;color:#94A3B8;margin-top:6px;">Geser foto untuk menyesuaikan &bull; Scroll untuk zoom</div>
      </div>
      <div id="_cropFooter">
        <button id="_cropBtnCancel" onclick="document.getElementById('_cropModal').remove()">Batal</button>
        <button id="_cropBtnOk"><i class="bi bi-check-lg" style="margin-right:4px;"></i>Terapkan</button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(wrapper);

  const cs    = _cropperState;
  const cvs   = document.getElementById('_cropCanvas');
  const ctx   = cvs.getContext('2d');
  const guide = document.getElementById('_cropGuide');
  const areaW = document.getElementById('_cropArea').offsetWidth || 520;
  const areaH = 360;
  const CROP  = Math.min(areaW, areaH) * 0.7;
  cvs.width=areaW; cvs.height=areaH;
  guide.style.cssText=`width:${CROP}px;height:${CROP}px;left:${(areaW-CROP)/2}px;top:${(areaH-CROP)/2}px;`;
  cs.canvasSize=areaW; cs.cropSize=CROP; cs.areaH=areaH; cs.onConfirm=onConfirm;
  cs.offsetX=0; cs.offsetY=0;

  const slider = document.getElementById('_zoomSlider');
  const zoomLabel = document.getElementById('_zoomLabel');

  function syncSlider(){
    const pct = Math.round((cs.scale / cs.maxScale) * 500);
    slider.value = Math.min(500, Math.max(10, pct));
    zoomLabel.textContent = `${Math.round((cs.scale / cs.minScale) * 100)}%`;
  }

  function clampOffset(){
    const dw = cs.imgW * cs.scale;
    const dh = cs.imgH * cs.scale;
    const maxOffX = Math.max(0, (dw - CROP) / 2);
    const maxOffY = Math.max(0, (dh - CROP) / 2);
    cs.offsetX = Math.max(-maxOffX, Math.min(maxOffX, cs.offsetX));
    cs.offsetY = Math.max(-maxOffY, Math.min(maxOffY, cs.offsetY));
  }

  const img=new Image();
  img.onload=()=>{
    cs.img=img; cs.imgW=img.width; cs.imgH=img.height;
    const fitScale = Math.max(CROP/img.width, CROP/img.height) * 1.1;
    cs.minScale = fitScale * 0.5;
    cs.maxScale = fitScale * 5;
    cs.scale = fitScale;
    syncSlider();
    drawCrop();
  };
  const reader=new FileReader(); reader.onload=e=>{img.src=e.target.result;}; reader.readAsDataURL(file);

  function drawCrop(){
    const {img,scale,offsetX,offsetY,imgW,imgH,cropSize,canvasSize,areaH}=cs;
    if(!img) return;
    ctx.clearRect(0,0,cvs.width,cvs.height);
    ctx.fillStyle='#1E293B'; ctx.fillRect(0,0,cvs.width,cvs.height);
    const dw=imgW*scale,dh=imgH*scale;
    const cx=canvasSize/2+offsetX,cy=areaH/2+offsetY;
    ctx.drawImage(img,cx-dw/2,cy-dh/2,dw,dh);
  }

  let lastX=0,lastY=0,isDrag=false;
  cvs.addEventListener('mousedown',e=>{isDrag=true;lastX=e.clientX;lastY=e.clientY;});
  document.addEventListener('mousemove',e=>{
    if(!isDrag) return;
    cs.offsetX+=(e.clientX-lastX); cs.offsetY+=(e.clientY-lastY);
    lastX=e.clientX; lastY=e.clientY;
    clampOffset(); drawCrop();
  });
  document.addEventListener('mouseup',()=>{isDrag=false;});
  cvs.addEventListener('touchstart',e=>{isDrag=true;lastX=e.touches[0].clientX;lastY=e.touches[0].clientY;},{passive:true});
  cvs.addEventListener('touchmove',e=>{
    if(!isDrag) return;
    cs.offsetX+=(e.touches[0].clientX-lastX); cs.offsetY+=(e.touches[0].clientY-lastY);
    lastX=e.touches[0].clientX; lastY=e.touches[0].clientY;
    clampOffset(); drawCrop();
  },{passive:true});
  cvs.addEventListener('touchend',()=>{isDrag=false;});

  slider.addEventListener('input', e => {
    const pct = parseInt(e.target.value);
    cs.scale = (pct / 500) * cs.maxScale;
    cs.scale = Math.max(cs.minScale, Math.min(cs.maxScale, cs.scale));
    clampOffset();
    zoomLabel.textContent = `${Math.round((cs.scale / cs.minScale) * 100)}%`;
    drawCrop();
  });

  cvs.addEventListener('wheel', e => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.06 : 0.94;
    cs.scale = Math.max(cs.minScale, Math.min(cs.maxScale, cs.scale * factor));
    syncSlider();
    clampOffset();
    drawCrop();
  }, {passive:false});

  document.getElementById('_cropBtnOk').onclick=()=>{
    const {img,scale,offsetX,offsetY,imgW,imgH,cropSize,canvasSize,areaH}=cs;
    const outSize=300;
    const out=document.createElement('canvas');
    out.width=outSize; out.height=outSize;
    const octx=out.getContext('2d');
    octx.beginPath(); octx.arc(outSize/2,outSize/2,outSize/2,0,Math.PI*2); octx.closePath(); octx.clip();
    const cx=canvasSize/2+offsetX,cy=areaH/2+offsetY;
    const dw=imgW*scale,dh=imgH*scale;
    const cropLeft=canvasSize/2-cropSize/2,cropTop=areaH/2-cropSize/2;
    const imgX=cx-dw/2-cropLeft,imgY=cy-dh/2-cropTop;
    const scaleOut=outSize/cropSize;
    octx.drawImage(img,imgX*scaleOut,imgY*scaleOut,dw*scaleOut,dh*scaleOut);
    out.toBlob(blob=>{ document.getElementById('_cropModal').remove(); if(cs.onConfirm) cs.onConfirm(blob,URL.createObjectURL(blob)); },'image/png');
  };
}

// ══════════════════════════════════════════════════════════════
// DIALOG FOTO PROFIL — fix double open
// ══════════════════════════════════════════════════════════════
let _fotoDialogOpen = false;

function showFotoDialog(opts){
  if(_fotoDialogOpen) return;
  _fotoDialogOpen = true;
  const old=document.getElementById('_mFoto'); if(old) old.remove();
  const hasPhoto = opts.fotoSrc && opts.fotoSrc !== '';
  const avatarHTML = hasPhoto
    ? `<img src="${opts.fotoSrc}" style="width:190px;height:190px;border-radius:50%;object-fit:cover;border:4px solid #E2E8F0;display:block;margin:0 auto;">`
    : `<div style="width:190px;height:190px;border-radius:50%;background:linear-gradient(135deg,#DBEAFE,#EDE9FE);display:flex;align-items:center;justify-content:center;margin:0 auto;border:4px solid #E2E8F0;"><i class="bi bi-person-fill" style="font-size:76px;color:#2563EB;"></i></div>`;
  const btnsHTML = opts.noButtons ? '' : `<div style="display:flex;justify-content:space-around;padding:8px 16px 24px;gap:4px;">
    <button id="_btnGantiFoto" style="flex:1;display:flex;flex-direction:column;align-items:center;gap:8px;background:none;border:none;cursor:pointer;color:#374151;font-size:12.5px;font-weight:600;padding:12px 8px;border-radius:12px;transition:background 0.2s;" onmouseover="this.style.background='#F1F5F9'" onmouseout="this.style.background='none'">
      <i class="bi bi-images" style="font-size:26px;color:#374151;"></i>Ganti Foto
    </button>
    <button id="_btnHapusFoto" style="flex:1;display:flex;flex-direction:column;align-items:center;gap:8px;background:none;border:none;cursor:pointer;color:#374151;font-size:12.5px;font-weight:600;padding:12px 8px;border-radius:12px;transition:background 0.2s;${!hasPhoto?'opacity:0.35;pointer-events:none;':''}" onmouseover="this.style.background='#F1F5F9'" onmouseout="this.style.background='none'">
      <i class="bi bi-image" style="font-size:26px;"></i>Hapus Foto
    </button>
    <button id="_btnUnduhFoto" style="flex:1;display:flex;flex-direction:column;align-items:center;gap:8px;background:none;border:none;cursor:pointer;color:#374151;font-size:12.5px;font-weight:600;padding:12px 8px;border-radius:12px;transition:background 0.2s;${!hasPhoto?'opacity:0.35;pointer-events:none;':''}" onmouseover="this.style.background='#F1F5F9'" onmouseout="this.style.background='none'">
      <i class="bi bi-download" style="font-size:26px;"></i>
      <span style="font-size:11px;text-align:center;">Unduh Foto<br>Saat Ini</span>
    </button>
  </div>`;
  const d=document.createElement('div');
  d.innerHTML=`<div class="modal fade" id="_mFoto" tabindex="-1">
    <div class="modal-dialog modal-dialog-centered" style="max-width:380px;">
      <div class="modal-content" style="border-radius:20px;border:none;box-shadow:0 20px 60px rgba(0,0,0,0.2);">
        <div class="modal-header" style="border:none;padding:20px 24px 10px;position:relative;">
          <h5 style="font-family:'Plus Jakarta Sans',sans-serif;font-weight:700;color:#1E293B;margin:0;font-size:18px;">Foto Profil</h5>
          <button type="button" data-bs-dismiss="modal" style="background:none;border:none;font-size:22px;color:#94A3B8;cursor:pointer;position:absolute;right:20px;top:14px;line-height:1;">&times;</button>
        </div>
        <hr style="margin:0 24px;opacity:0.1;">
        <div class="modal-body" style="padding:24px 24px 16px;">${avatarHTML}</div>
        ${btnsHTML}
        <input type="file" id="_fotoFileHidden" accept="image/*" style="display:none;">
      </div>
    </div>
  </div>`;
  document.body.appendChild(d);
  const modalEl=document.getElementById('_mFoto');
  modalEl.style.zIndex='100000';
  const bsModal=new bootstrap.Modal(modalEl,{backdrop:true,keyboard:true});
  modalEl.addEventListener('hidden.bs.modal',()=>{ _fotoDialogOpen=false; },{once:true});
  bsModal.show();

  if(!opts.noButtons){
    document.getElementById('_btnGantiFoto').onclick=()=>{
      const inp=document.getElementById('_fotoFileHidden');
      inp.value='';
      inp.onchange=function(){
        const file=this.files[0]; if(!file) return;
        bsModal.hide();
        modalEl.addEventListener('hidden.bs.modal',()=>{
          showCropper(file,(blob,url)=>{ if(opts.onGanti) opts.onGanti(blob,url); });
        },{once:true});
      };
      inp.click();
    };

    document.getElementById('_btnHapusFoto').onclick=()=>{
      bsModal.hide();
      modalEl.addEventListener('hidden.bs.modal',()=>{ if(opts.onHapus) opts.onHapus(); },{once:true});
    };

    document.getElementById('_btnUnduhFoto').onclick=()=>{
      if(!opts.fotoSrc) return;
      const W=113,H=151;
      const cvs=document.createElement('canvas'); cvs.width=W; cvs.height=H;
      const ctx=cvs.getContext('2d');
      const img=new Image(); img.crossOrigin='Anonymous';
      img.onload=()=>{
        const ir=img.width/img.height,cr=W/H;
        let sx=0,sy=0,sw=img.width,sh=img.height;
        if(ir>cr){sw=img.height*cr;sx=(img.width-sw)/2;}
        else{sh=img.width/cr;sy=(img.height-sh)/2;}
        ctx.drawImage(img,sx,sy,sw,sh,0,0,W,H);
        const a=document.createElement('a'); a.download='foto_profil_30x40mm.png'; a.href=cvs.toDataURL('image/png',1.0); a.click();
        showToast('Foto diunduh (30×40mm)','success');
      };
    img.onerror=()=>{
      fetch(opts.fotoSrc).then(r=>r.blob()).then(blob=>{
        const url=URL.createObjectURL(blob); const img2=new Image();
        img2.onload=()=>{
          const ir=img2.width/img2.height,cr=W/H;
          let sx=0,sy=0,sw=img2.width,sh=img2.height;
          if(ir>cr){sw=img2.height*cr;sx=(img2.width-sw)/2;} else{sh=img2.width/cr;sy=(img2.height-sh)/2;}
          ctx.drawImage(img2,sx,sy,sw,sh,0,0,W,H);
          const a=document.createElement('a'); a.download='foto_profil_30x40mm.png'; a.href=cvs.toDataURL('image/png',1.0); a.click();
          URL.revokeObjectURL(url); showToast('Foto diunduh (30×40mm)','success');
        }; img2.src=url;
      });
    };
    img.src=opts.fotoSrc;
  };
  }
}

function viewFotoDialog(fotoSrc){
  if(_fotoDialogOpen) return;
  _fotoDialogOpen = true;
  const old=document.getElementById('_mFoto'); if(old) old.remove();
  const avatarHTML = fotoSrc
    ? `<img src="${fotoSrc}" style="width:190px;height:190px;border-radius:50%;object-fit:cover;border:4px solid #E2E8F0;display:block;margin:0 auto;">`
    : `<div style="width:190px;height:190px;border-radius:50%;background:linear-gradient(135deg,#DBEAFE,#EDE9FE);display:flex;align-items:center;justify-content:center;margin:0 auto;border:4px solid #E2E8F0;"><i class="bi bi-person-fill" style="font-size:76px;color:#2563EB;"></i></div>`;
  const d=document.createElement('div');
  d.innerHTML=`<div class="modal fade" id="_mFoto" tabindex="-1">
    <div class="modal-dialog modal-dialog-centered" style="max-width:380px;">
      <div class="modal-content" style="border-radius:20px;border:none;box-shadow:0 20px 60px rgba(0,0,0,0.2);">
        <div class="modal-header" style="border:none;padding:20px 24px 10px;position:relative;">
          <h5 style="font-family:'Plus Jakarta Sans',sans-serif;font-weight:700;color:#1E293B;margin:0;font-size:18px;">Foto</h5>
          <button type="button" data-bs-dismiss="modal" style="background:none;border:none;font-size:22px;color:#94A3B8;cursor:pointer;position:absolute;right:20px;top:14px;line-height:1;">&times;</button>
        </div>
        <hr style="margin:0 24px;opacity:0.1;">
        <div class="modal-body" style="padding:24px;">${avatarHTML}</div>
      </div>
    </div>
  </div>`;
  document.body.appendChild(d);
  const modalEl=document.getElementById('_mFoto');
  modalEl.style.zIndex='100000';
  const bsModal=new bootstrap.Modal(modalEl,{backdrop:true,keyboard:true});
  modalEl.addEventListener('hidden.bs.modal',()=>{ _fotoDialogOpen=false; },{once:true});
  bsModal.show();
}

// ── KELAS OPTIONS ──
async function loadKelasOptions(selectId, includeAll = true) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  try {
    const res = await fetch('/api/kelas');
    const json = await res.json();
    const kelas = json.data || [];
    let html = includeAll ? '<option value="">Semua Kelas</option>' : '<option value="">Pilih Kelas</option>';
    kelas.forEach(k => { html += `<option value="Kelas ${k.nama}">Kelas ${k.nama}</option>`; });
    sel.innerHTML = html;
  } catch(e) {
    sel.innerHTML = '<option value="">Gagal memuat kelas</option>';
  }
}

// ── PAGINATION UI ──
window._pgS=new Map();
window._pgC=function(id,v){
  const s=_pgS.get(id); if(!s)return;
  let p; if(v==='p')p=s.currentPage-1; else if(v==='n')p=s.currentPage+1; else p=parseInt(v);
  if(p>=1&&p<=s.totalPages) s.onPageChange(p);
};
window._pgZ=function(id,sz){const s=_pgS.get(id); if(s) s.onSizeChange(sz);};
function buildPaginationUI(containerId, state) {
  const el=document.getElementById(containerId);
  if(!el)return; const s=state;
  el.style.display='flex'; _pgS.set(containerId,s);
  const cp=s.currentPage,tp=s.totalPages,_k=containerId;
  let h='<div class="d-flex justify-content-between align-items-center flex-wrap gap-2 w-100">';
  if(tp>1){
    h+='<div class="d-flex align-items-center gap-1">';
    h+='<button class="btn btn-sm px-2" style="background:white;border:1.5px solid #E2E8F0;border-radius:8px;color:#475569;font-weight:600;transition:all 0.15s;padding:4px 9px;font-size:12px;line-height:1.5;"'+(cp<=1?' disabled':'')+' onclick="_pgC(\''+_k+'\',\'p\')">&lt;</button>';
    const pgs=[];
    if(tp<=7){for(let i=1;i<=tp;i++)pgs.push(i);}
    else{pgs.push(1);if(cp>4)pgs.push('...');let a=Math.max(2,cp-1),b2=Math.min(tp-1,cp+1);for(let i=a;i<=b2;i++)pgs.push(i);if(cp<tp-3)pgs.push('...');pgs.push(tp);}
    pgs.forEach(p=>{
      if(p==='...')h+='<span class="mx-1" style="color:#94A3B8;font-weight:700;font-size:12px;">...</span>';
      else h+='<button class="btn btn-sm" style="background:'+(p===cp?'#2563EB':'white')+';color:'+(p===cp?'white':'#475569')+';border:1.5px solid '+(p===cp?'#2563EB':'#E2E8F0')+';border-radius:8px;font-weight:'+(p===cp?'700':'600')+';transition:all 0.15s;padding:4px 10px;font-size:12px;line-height:1.5;box-shadow:'+(p===cp?'0 2px 8px rgba(37,99,235,0.25)':'none')+';" onmouseover="this.style.background=\''+(p===cp?'#2563EB':'#F1F5F9')+'\';this.style.transform=\'translateY(-1px)\';this.style.boxShadow=\'0 2px 6px rgba(0,0,0,0.08)\';" onmouseout="this.style.background=\''+(p===cp?'#2563EB':'white')+'\';this.style.transform=\'\';this.style.boxShadow=\''+(p===cp?'0 2px 8px rgba(37,99,235,0.25)':'none')+'\';" onclick="_pgC(\''+_k+'\',\''+p+'\')">'+p+'</button>';
    });
    h+='<button class="btn btn-sm px-2" style="background:white;border:1.5px solid #E2E8F0;border-radius:8px;color:#475569;font-weight:600;transition:all 0.15s;padding:4px 9px;font-size:12px;line-height:1.5;"'+(cp>=tp?' disabled':'')+' onclick="_pgC(\''+_k+'\',\'n\')">&gt;</button>';
    h+='</div>';
  }
  h+='<div class="d-flex align-items-center gap-2">';
  h+='<span style="font-size:12px;color:#64748B;font-weight:600;white-space:nowrap;">Tampil:</span>';
  h+='<select class="form-select form-select-sm" style="width:auto;border-radius:8px;font-size:12px;padding:4px 28px 4px 10px;border:1.5px solid #E2E8F0;background:white;font-weight:600;color:#1E293B;cursor:pointer;" onchange="_pgZ(\''+_k+'\',parseInt(this.value))">';
  (s.sizes||[5,10,15,20,25,50]).forEach(sz=>{
    h+='<option value="'+sz+'"'+(sz===s.currentSize?' selected':'')+'>'+sz+'/halaman</option>';
  });
  h+='</select>';
  h+='</div></div>'; el.innerHTML=h;
}

// ── EXPORT CSV ──
function exportCSV(data,filename){
  if(!data||!data.length){showToast('Tidak ada data','warning');return;}
  const h=Object.keys(data[0]);
  const rows=data.map(r=>h.map(k=>`"${(r[k]||'').toString().replace(/"/g,'""')}"`).join(','));
  const csv=[h.join(','),...rows].join('\n');
  const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=filename; a.click();
  URL.revokeObjectURL(url);
  showToast('CSV berhasil diekspor!','success');
}

// ── EXPORT DENGAN PROGRESS LOADING ──
async function downloadWithProgress(url, filename, total, label) {
  const labelText = label || 'data';
  const msg = total
    ? `Mengekspor ${total} ${labelText}...`
    : 'Menyiapkan file...';

  Swal.fire({
    title: 'Export Data',
    html: `<div style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:8px 0;">
      <div class="spinner-border text-primary" role="status" style="width:2.5rem;height:2.5rem;"></div>
      <div style="font-size:14px;color:#475569;">${msg}</div>
      ${total ? '<div style="font-size:12px;color:#94A3B8;">Mohon tunggu, file sedang disiapkan...</div>' : ''}
    </div>`,
    allowOutsideClick: false,
    showConfirmButton: false,
    width: '340px',
    padding: '16px',
    customClass: { popup: 'swal-kecil' }
  });

  try {
    const res = await fetch(url);
    if (!res.ok) {
      let errMsg = 'Gagal mengunduh file';
      try { const j = await res.json(); errMsg = j.message || errMsg; } catch(e) {}
      throw new Error(errMsg);
    }
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
    Swal.close();
    showToast(`${total ? total+' data ' : ''}Berhasil diekspor!`, 'success');
  } catch(e) {
    Swal.close();
    showToast('Gagal: ' + e.message, 'error');
  }
}
