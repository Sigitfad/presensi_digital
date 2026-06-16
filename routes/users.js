const express  = require('express');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const { queryAll, queryOne, run, runWithoutSave, saveDB, logActivity } = require('../database');
const router   = express.Router();

const uploadDir = path.join(__dirname,'../public/uploads/foto-user');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir,{recursive:true});

const storage = multer.diskStorage({
  destination:(req,file,cb)=>cb(null,uploadDir),
  filename   :(req,file,cb)=>cb(null,`user_${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits:{fileSize:2*1024*1024},
  fileFilter:(req,file,cb)=>(/image\/(jpeg|jpg|png|webp)/.test(file.mimetype)?cb(null,true):cb(new Error('Hanya gambar')))
});

function auth(req,res,next){
  if(!req.session.operatorId) return res.status(401).json({success:false});
  next();
}
function requireOperator(req,res,next){
  if(req.session.operatorRole!=='operator')
    return res.status(403).json({success:false,message:'Hanya Operator yang dapat mengakses'});
  next();
}
router.use(auth);

router.get('/', (req,res) => {
  const data = queryAll('SELECT id,nama,role,no_hp,email,foto,pengampu_kelas,nip,alamat,bidang_keahlian,uid,created_at FROM operators ORDER BY role ASC,nama ASC');
  res.json({success:true, data});
});

router.post('/tambah', requireOperator, upload.single('foto'), (req,res) => {
  let {nama,role,no_hp='',email='',pengampu_kelas='Semua',nip='',alamat='',bidang_keahlian='',uid=''} = req.body;
  if(!nama||!role) return res.json({success:false,message:'Nama dan Role wajib diisi!'});
  if(uid&&queryOne('SELECT id FROM operators WHERE uid=?',[uid]))
    return res.json({success:false,message:'UID sudah digunakan!'});

  const foto = req.file ? `/uploads/foto-user/${req.file.filename}` : '';
  run('INSERT INTO operators (nama,role,no_hp,email,foto,pengampu_kelas,nip,alamat,bidang_keahlian,uid) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [nama,role,no_hp,email,foto,pengampu_kelas,nip,alamat,bidang_keahlian,uid]);
  const roleDisplay = role==='guru_bidang'&&bidang_keahlian ? bidang_keahlian : role;
  logActivity(req.session.operatorId,req.session.operatorNama,req.session.operatorRole,
              'Tambah User',`User baru: ${nama} (${roleDisplay}) - Pengampu: ${pengampu_kelas} - NIP: ${nip}`);
  res.json({success:true,message:'Pengguna berhasil ditambahkan'});
});

router.post('/edit', requireOperator, upload.single('foto'), (req,res) => {
  let {id,nama,role,no_hp='',email='',pengampu_kelas='',nip='',alamat='',bidang_keahlian='',uid=''} = req.body;
  if(!id||!nama||!role)
    return res.json({success:false,message:'Field wajib tidak boleh kosong!'});
  // Fall back ke nilai database untuk field yang tidak dikirim
  const ex=queryOne('SELECT * FROM operators WHERE id=?',[id]);
  if(ex){
    if(!no_hp) no_hp=ex.no_hp||'';
    if(!email) email=ex.email||'';
    if(!pengampu_kelas) pengampu_kelas=ex.pengampu_kelas||'Semua';
    if(!nip) nip=ex.nip||'';
    if(!alamat) alamat=ex.alamat||'';
    if(!bidang_keahlian) bidang_keahlian=ex.bidang_keahlian||'';
    if(!uid) uid=ex.uid||'';
  }
  if(uid&&queryOne('SELECT id FROM operators WHERE uid=? AND id!=?',[uid,id]))
    return res.json({success:false,message:'UID sudah digunakan!'});

  const lama = queryOne('SELECT foto FROM operators WHERE id=?',[id]);
  let foto   = lama?.foto || '';
  if(req.file){
    if(lama?.foto){ const op=path.join(__dirname,'../public',lama.foto); if(fs.existsSync(op)) fs.unlinkSync(op); }
    foto = `/uploads/foto-user/${req.file.filename}`;
  }

  run('UPDATE operators SET nama=?,role=?,no_hp=?,email=?,foto=?,pengampu_kelas=?,nip=?,alamat=?,bidang_keahlian=?,uid=? WHERE id=?',
      [nama,role,no_hp,email,foto,pengampu_kelas,nip,alamat,bidang_keahlian,uid,id]);

  // Update session jika yang diedit adalah diri sendiri
  if(parseInt(id)===req.session.operatorId){
    req.session.operatorFoto  = foto;
    req.session.pengampuKelas = pengampu_kelas;
    req.session.operatorBidang = bidang_keahlian || '';
  }

  const roleDisplay2 = role==='guru_bidang'&&bidang_keahlian ? bidang_keahlian : role;
  logActivity(req.session.operatorId,req.session.operatorNama,req.session.operatorRole,
              'Edit User',`Edit: ${nama} (${roleDisplay2}) - Pengampu: ${pengampu_kelas} - NIP: ${nip}`);
  res.json({success:true,message:'Pengguna berhasil diperbarui'});
});

router.post('/hapus-foto', requireOperator, (req,res) => {
  const {id} = req.body;
  const user = queryOne('SELECT foto FROM operators WHERE id=?',[id]);
  if(!user) return res.json({success:false,message:'User tidak ditemukan'});
  if(user.foto){ const p=path.join(__dirname,'../public',user.foto); if(fs.existsSync(p)) fs.unlinkSync(p); }
  run('UPDATE operators SET foto=? WHERE id=?',['',id]);
  if(parseInt(id)===req.session.operatorId) req.session.operatorFoto='';
  res.json({success:true,message:'Foto dihapus'});
});

router.post('/hapus', requireOperator, (req,res) => {
  const {id} = req.body;
  if(parseInt(id)===req.session.operatorId)
    return res.json({success:false,message:'Tidak bisa menghapus akun sendiri!'});
  const user = queryOne('SELECT * FROM operators WHERE id=?',[id]);
  if(!user) return res.json({success:false,message:'User tidak ditemukan'});
  if(user.role==='operator')
    return res.json({success:false,message:'Tidak dapat menghapus akun Operator!'});
  if(user.foto){ const p=path.join(__dirname,'../public',user.foto); if(fs.existsSync(p)) fs.unlinkSync(p); }
  run('DELETE FROM operators WHERE id=?',[id]);
  const roleHapus = user.role==='guru_bidang'&&user.bidang_keahlian ? user.bidang_keahlian : user.role;
  logActivity(req.session.operatorId,req.session.operatorNama,req.session.operatorRole,
              'Hapus User',`Hapus: ${user.nama} (${roleHapus}) - NIP: ${user.nip}`);
  res.json({success:true,message:'Pengguna berhasil dihapus'});
});

router.post('/hapus-massal', requireOperator, (req,res) => {
  const {ids}=req.body;
  if(!ids||!Array.isArray(ids)||!ids.length)
    return res.json({success:false,message:'Tidak ada data yang dipilih'});
  let count=0, skipped=0;
  try {
    runWithoutSave('BEGIN TRANSACTION');
    ids.forEach(id=>{
      const user=queryOne('SELECT * FROM operators WHERE id=?',[id]);
      if(!user) return;
      if(user.role==='operator'){skipped++;return;}
      if(parseInt(id)===req.session.operatorId){skipped++;return;}
      if(user.foto){const p=path.join(__dirname,'../public',user.foto);if(fs.existsSync(p))fs.unlinkSync(p);}
      try{runWithoutSave('DELETE FROM operators WHERE id=?',[id]);count++;}
      catch(e){}
    });
    runWithoutSave('COMMIT');
    saveDB();
  } catch(e) {
    try { runWithoutSave('ROLLBACK'); } catch(er) {}
    return res.json({success:false,message:e.message});
  }
  logActivity(req.session.operatorId,req.session.operatorNama,req.session.operatorRole,
              'Hapus User',`Hapus massal: ${count} pengguna`);
  const msg=skipped>0?`${count} dihapus, ${skipped} dilewati (Operator)`:`${count} pengguna berhasil dihapus`;
  res.json({success:true,message:msg});
});

// ── CSV Import/Export ──
const csvUploadUser = multer({ storage: multer.memoryStorage(), limits:{fileSize:5*1024*1024},
  fileFilter:(req,file,cb)=> {
    const ext = path.extname(file.originalname).toLowerCase();
    if(ext!=='.csv' && file.mimetype!=='text/csv' && file.mimetype!=='application/vnd.ms-excel')
      return cb(new Error('Hanya file CSV'));
    cb(null,true);
  }
});

function detectDelimiterUser(line){
  const commaCount = (line.match(/,/g)||[]).length;
  const semicolonCount = (line.match(/;/g)||[]).length;
  return semicolonCount > commaCount ? ';' : ',';
}

function parseCSVUser(text){
  const lines = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n').filter(Boolean);
  if(!lines.length) return {header:[],rows:[]};
  const delim = detectDelimiterUser(lines[0]);
  const header = lines[0].split(delim).map(h=>h.trim().replace(/^"|"$/g,'').toLowerCase());
  const rows = [];
  for(let i=1; i<lines.length; i++){
    const vals = lines[i].split(delim).map(v=>{
      let x=v.trim();
      if(/^="(.*)"$/.test(x)) x=x.slice(2,-1);
      else if(x.startsWith('="')) x=x.slice(2);
      else x=x.replace(/^"|"$/g,'');
      return x;
    });
    const row = {};
    header.forEach((h,idx)=> row[h]=vals[idx]||'');
    rows.push(row);
  }
  return {header, rows};
}

// GET: export users ke CSV
router.get('/export', (req,res) => {
  const data = queryAll('SELECT nama,role,no_hp,email,pengampu_kelas,nip,alamat,bidang_keahlian,uid FROM operators ORDER BY role ASC,nama ASC');
  const header = ['nama','role','no_hp','email','pengampu_kelas','nip','alamat','bidang_keahlian','uid'];
  const textCols = ['nip','no_hp','uid'];
  const csvRows = [header.join(';')];
  data.forEach(r => {
    csvRows.push(header.map(h => {
      let v = (r[h]||'')+'';
      if(textCols.includes(h) && /^\d+$/.test(v)) return '="'+v+'"';
      if(/[;"\n]/.test(v)) return '"'+v.replace(/"/g,'""')+'"';
      return v;
    }).join(';'));
  });
  res.setHeader('Content-Type','text/csv; charset=utf-8');
  res.setHeader('Content-Disposition','attachment; filename=data_gtk.csv');
  res.send('\uFEFF' + csvRows.join('\n'));
});

// POST: import users dari CSV
router.post('/import', requireOperator, csvUploadUser.single('file'), (req,res) => {
  try {
    if(!req.file) return res.json({success:false,message:'File CSV tidak ditemukan'});
    let text = req.file.buffer.toString('utf-8');
    if(text.charCodeAt(0)===0xFEFF) text=text.slice(1);
    const {header, rows: rawRows} = parseCSVUser(text);
    const required = ['nama','role'];
    const validRoles = ['operator','guru','kepala_sekolah','penjaga_sekolah','guru_bidang'];
    const missing = required.filter(r=>!header.includes(r));
    if(missing.length) return res.json({success:false,message:`Kolom wajib tidak ditemukan: ${missing.join(', ')}`});

    const rows = rawRows.filter(r=>required.some(k=>r[k])).map(r=>{
      const o={};for(const k of Object.keys(r)){let v=r[k];if(/^="(.*)"$/.test(v))v=v.slice(2,-1);else if(v.startsWith('="'))v=v.slice(2);o[k]=v;}
      return o;
    });
    let sukses=0, gagal=0, errors=[];
    const sql = 'INSERT INTO operators (nama,role,no_hp,email,pengampu_kelas,nip,alamat,bidang_keahlian,uid) VALUES (?,?,?,?,?,?,?,?,?)';

    const uidSeen = {}; const rowUidErrors = {};
    for(let i=0; i<rows.length; i++){
      const u = rows[i].uid;
      if(!u) continue;
      if(uidSeen[u]!==undefined) rowUidErrors[i] = 'UID duplikat dalam file CSV (sama dengan baris '+(uidSeen[u]+2)+')';
      else uidSeen[u] = i;
    }

    runWithoutSave('BEGIN TRANSACTION');
    for(let i=0; i<rows.length; i++){
      const r = rows[i];
      const no = i+2;
      const errs = [];
      if(rowUidErrors[i]){ errs.push(rowUidErrors[i]); }
      for(const f of required) if(!r[f]) errs.push(`${f} kosong`);
      if(!validRoles.includes(r.role)) errs.push('Role harus salah satu: '+validRoles.join(', '));
      if(r.uid&&!rowUidErrors[i]&&queryOne('SELECT id FROM operators WHERE uid=?',[r.uid])) errs.push('UID sudah terdaftar');
      if(r.nip&&queryOne('SELECT id FROM operators WHERE nip=?',[r.nip])) errs.push('NIP sudah terdaftar');
      if(errs.length){gagal++;errors.push(`Baris ${no}: ${errs.join('; ')}`);continue;}
      try {
        runWithoutSave(sql, [r.nama,r.role,r.no_hp||'',r.email||'',r.pengampu_kelas||'Semua',r.nip||'',r.alamat||'',r.bidang_keahlian||'',r.uid||'']);
        sukses++;
      } catch(e){gagal++;errors.push(`Baris ${no}: ${e.message}`);}
    }
    runWithoutSave('COMMIT');
    saveDB();
    logActivity(req.session.operatorId,req.session.operatorNama,req.session.operatorRole,'Import CSV GTK',`${sukses} sukses, ${gagal} gagal`);
    res.json({success:true, sukses, gagal, errors, message:`${sukses} berhasil, ${gagal} gagal`});
  } catch(e){
    res.json({success:false,message:e.message});
  }
});

module.exports = router;
