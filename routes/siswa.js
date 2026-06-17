const express  = require('express');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const { queryAll, queryOne, run, runWithoutSave, saveDB, logActivity, getActiveTahunAjaran } = require('../database');
const { auth, getKelasFilter, detectDelimiter, parseCSV } = require('./_helpers');
const router   = express.Router();

const storage = multer.diskStorage({
  destination:(req,file,cb)=>cb(null,path.join(__dirname,'../public/uploads/foto-siswa')),
  filename   :(req,file,cb)=>cb(null,`siswa_${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits:{fileSize:2*1024*1024},
  fileFilter:(req,file,cb)=>(/image\/(jpeg|jpg|png|webp)/.test(file.mimetype)?cb(null,true):cb(new Error('Hanya gambar')))
});

router.use(auth);

// GET: daftar siswa
router.get('/', (req,res) => {
  const { search='', kelas='', tahun_ajaran_id='' } = req.query;
  const kelasFilter = getKelasFilter(req);

  let sql='SELECT s.*, ta.nama as tahun_ajaran_nama FROM siswa s LEFT JOIN tahun_ajaran ta ON s.tahun_ajaran_id=ta.id WHERE 1=1';
  const p=[];
  if(search){ sql+=' AND (s.nama LIKE ? OR s.nisn LIKE ? OR s.nipd LIKE ? OR s.kelas LIKE ? OR s.uid LIKE ?)'; p.push(`%${search}%`,`%${search}%`,`%${search}%`,`%${search}%`,`%${search}%`); }

  // kelasFilter = batasan dari session (pengampu kelas)
  // Jika user memilih kelas tertentu dari dropdown, hormati pilihan tsb
  const allowed = kelasFilter ? (Array.isArray(kelasFilter) ? kelasFilter : [kelasFilter]) : [];
  if(kelas.trim() && allowed.length && allowed.includes(kelas.trim())){
    sql+=' AND s.kelas=?'; p.push(kelas.trim());
  } else if(allowed.length){
    sql+=` AND s.kelas IN (${allowed.map(()=>'?').join(',')})`;
    p.push(...allowed);
  } else if(kelas.trim()){
    sql+=' AND s.kelas=?'; p.push(kelas.trim());
  }
  if(tahun_ajaran_id) { sql+=' AND s.tahun_ajaran_id=?'; p.push(tahun_ajaran_id); }
  sql+=' ORDER BY s.nama ASC LIMIT 5000';
  res.json({success:true, data:queryAll(sql,p)});
});

// GET pengampu kelas by kelas siswa
router.get('/pengampu/:id', (req,res) => {
  const {id} = req.params;
  const s = queryOne('SELECT kelas FROM siswa WHERE id=?',[id]);
  if(!s) return res.json({success:true, pengampu:'',pengampuList:[]});
  const list = queryAll(
    "SELECT nama FROM operators WHERE (pengampu_kelas LIKE ? OR pengampu_kelas='Semua') AND role IN ('guru','kepala_sekolah','guru_bidang') ORDER BY nama",
    [`%${s.kelas}%`]
  );
  res.json({success:true, pengampu: list.map(r=>r.nama).join(', '), pengampuList: list.map(r=>r.nama)});
});

// GET: export siswa ke CSV (harus sebelum /:id)
router.get('/export', (req,res) => {
  const { search='', kelas='', tahun_ajaran_id='' } = req.query;
  const kelasFilter = getKelasFilter(req);
  let sql='SELECT * FROM siswa WHERE 1=1';
  const p=[];
  if(search){ sql+=' AND (nama LIKE ? OR nisn LIKE ? OR nipd LIKE ? OR kelas LIKE ? OR uid LIKE ?)'; p.push(`%${search}%`,`%${search}%`,`%${search}%`,`%${search}%`,`%${search}%`); }
  const allowed = kelasFilter ? (Array.isArray(kelasFilter) ? kelasFilter : [kelasFilter]) : [];
  if(kelas.trim() && allowed.length && allowed.includes(kelas.trim())){
    sql+=' AND kelas=?'; p.push(kelas.trim());
  } else if(allowed.length){
    sql+=` AND kelas IN (${allowed.map(()=>'?').join(',')})`;
    p.push(...allowed);
  } else if(kelas.trim()){
    sql+=' AND kelas=?'; p.push(kelas.trim());
  }
  if(tahun_ajaran_id) { sql+=' AND tahun_ajaran_id=?'; p.push(tahun_ajaran_id); }
  sql+=' ORDER BY nama ASC';
  const data = queryAll(sql,p);
  const header = ['nisn','nipd','nama','kelas','jenis_kelamin','uid','nik','tempat_lahir','tanggal_lahir','agama','alamat','no_hp_ortu'];
  const textCols = ['nisn','nipd','nik','uid','no_hp_ortu'];
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
  res.setHeader('Content-Disposition','attachment; filename=data_siswa.csv');
  res.send('\uFEFF' + csvRows.join('\n'));
});

// GET single siswa by ID
router.get('/:id', (req,res) => {
  const {id} = req.params;
  if(isNaN(id)) return res.json({success:false,message:'ID tidak valid'});
  const siswa = queryOne('SELECT * FROM siswa WHERE id=?',[id]);
  if(!siswa) return res.json({success:false,message:'Siswa tidak ditemukan'});

  // Cari pengampu kelas untuk kelas siswa ini
  const pengampu = queryAll(
    "SELECT id, nama, role, pengampu_kelas FROM operators WHERE (pengampu_kelas LIKE ? OR pengampu_kelas='Semua') AND role IN ('guru','kepala_sekolah','guru_bidang') ORDER BY nama ASC",
    [`%${siswa.kelas}%`]
  );
  siswa.pengampu_kelas_list = pengampu;

  res.json({success:true,data:siswa});
});

router.post('/tambah', upload.single('foto'), (req,res) => {
  const {nisn,nama,kelas,jenis_kelamin,no_hp_ortu='',nik='',tempat_lahir='',tanggal_lahir='',agama='',alamat='',nipd='',uid=''} = req.body;
  if(!nisn||!nama||!kelas||!jenis_kelamin)
    return res.json({success:false,message:'Semua field wajib diisi!'});
  if(!nipd) return res.json({success:false,message:'NIPD wajib diisi!'});
  if(!uid) return res.json({success:false,message:'UID RFID wajib diisi!'});
  if(queryOne('SELECT id FROM siswa WHERE nisn=?',[nisn]))
    return res.json({success:false,message:'NISN sudah terdaftar!'});
  if(uid && queryOne('SELECT id FROM siswa WHERE uid=?',[uid]))
    return res.json({success:false,message:'UID sudah terdaftar!'});
  const foto = req.file ? `/uploads/foto-siswa/${req.file.filename}` : '';
  const ta = getActiveTahunAjaran();
  const taId = ta ? ta.id : 1;
  try {
    run('INSERT INTO siswa (nisn,nama,kelas,jenis_kelamin,foto,no_hp_ortu,nik,tempat_lahir,tanggal_lahir,agama,alamat,nipd,uid,tahun_ajaran_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[nisn,nama,kelas,jenis_kelamin,foto,no_hp_ortu,nik,tempat_lahir,tanggal_lahir,agama,alamat,nipd,uid,taId]);
    logActivity(req.session.operatorId,req.session.operatorNama,req.session.operatorRole,'Tambah Siswa',`${nama} (${nisn})`);
    res.json({success:true,message:'Siswa berhasil ditambahkan'});
  } catch(e){res.json({success:false,message:e.message});}
});

router.post('/edit', upload.single('foto'), (req,res) => {
  let {id,nisn,nama,kelas,jenis_kelamin,no_hp_ortu='',nik='',tempat_lahir='',tanggal_lahir='',agama='',alamat='',nipd='',uid=''} = req.body;
  if(!id||!nisn||!nama||!kelas||!jenis_kelamin)
    return res.json({success:false,message:'Semua field wajib diisi!'});
  if(!uid) return res.json({success:false,message:'UID RFID wajib diisi!'});
  if(!nipd){const s=queryOne('SELECT nipd FROM siswa WHERE id=?',[id]);if(s&&s.nipd)nipd=s.nipd;}
  if(queryOne('SELECT id FROM siswa WHERE nisn=? AND id!=?',[nisn,id]))
    return res.json({success:false,message:'NISN sudah digunakan!'});
  if(uid && queryOne('SELECT id FROM siswa WHERE uid=? AND id!=?',[uid,id]))
    return res.json({success:false,message:'UID sudah digunakan!'});
  const lama = queryOne('SELECT foto FROM siswa WHERE id=?',[id]);
  let foto   = lama?.foto||'';
  if(req.file){
    if(lama?.foto){const p=path.join(__dirname,'../public',lama.foto);if(fs.existsSync(p))fs.unlinkSync(p);}
    foto=`/uploads/foto-siswa/${req.file.filename}`;
  }
  try {
    run('UPDATE siswa SET nisn=?,nama=?,kelas=?,jenis_kelamin=?,foto=?,no_hp_ortu=?,nik=?,tempat_lahir=?,tanggal_lahir=?,agama=?,alamat=?,nipd=?,uid=?,updated_at=datetime("now","localtime") WHERE id=?',
        [nisn,nama,kelas,jenis_kelamin,foto,no_hp_ortu,nik,tempat_lahir,tanggal_lahir,agama,alamat,nipd,uid,id]);
    logActivity(req.session.operatorId,req.session.operatorNama,req.session.operatorRole,'Edit Siswa',`${nama} (${nisn})`);
    res.json({success:true,message:'Data berhasil diperbarui'});
  } catch(e){res.json({success:false,message:e.message});}
});

router.post('/hapus-foto', (req,res) => {
  const {id}=req.body;
  const s=queryOne('SELECT foto FROM siswa WHERE id=?',[id]);
  if(!s) return res.json({success:false,message:'Siswa tidak ditemukan'});
  if(s.foto){const p=path.join(__dirname,'../public',s.foto);if(fs.existsSync(p))fs.unlinkSync(p);}
  run('UPDATE siswa SET foto=? WHERE id=?',['',id]);
  res.json({success:true,message:'Foto dihapus'});
});

router.post('/hapus', (req,res) => {
  const {id}=req.body;
  const s=queryOne('SELECT * FROM siswa WHERE id=?',[id]);
  if(!s) return res.json({success:false,message:'Siswa tidak ditemukan'});
  if(s.foto){const p=path.join(__dirname,'../public',s.foto);if(fs.existsSync(p))fs.unlinkSync(p);}
  try {
    run('DELETE FROM siswa WHERE id=?',[id]);
    logActivity(req.session.operatorId,req.session.operatorNama,req.session.operatorRole,'Hapus Siswa',`${s.nama} (${s.nisn})`);
    res.json({success:true,message:'Siswa berhasil dihapus'});
  } catch(e){res.json({success:false,message:e.message});}
});

router.post('/hapus-massal', (req,res) => {
  const {ids}=req.body;
  if(!ids||!Array.isArray(ids)||!ids.length)
    return res.json({success:false,message:'Tidak ada data yang dipilih'});
  let count=0;
  try {
    runWithoutSave('BEGIN TRANSACTION');
    ids.forEach(id=>{
      const s=queryOne('SELECT * FROM siswa WHERE id=?',[id]);
      if(s){
        if(s.foto){const p=path.join(__dirname,'../public',s.foto);if(fs.existsSync(p))fs.unlinkSync(p);}
        try{runWithoutSave('DELETE FROM siswa WHERE id=?',[id]);count++;}
        catch(e){}
      }
    });
    runWithoutSave('COMMIT');
    saveDB();
  } catch(e) {
    try { runWithoutSave('ROLLBACK'); } catch(er) {}
    return res.json({success:false,message:e.message});
  }
  logActivity(req.session.operatorId,req.session.operatorNama,req.session.operatorRole,'Hapus Siswa',`Hapus massal: ${count} siswa`);
  res.json({success:true,message:`${count} siswa berhasil dihapus`});
});

router.post('/lulus-massal', (req,res) => {
  const {ids, tahun_lulus} = req.body;
  if(!ids||!Array.isArray(ids)||!ids.length)
    return res.json({success:false,message:'Tidak ada data yang dipilih'});
  if(!tahun_lulus)
    return res.json({success:false,message:'Tahun lulus wajib diisi'});
  let count=0;
  try {
    runWithoutSave('BEGIN TRANSACTION');
    ids.forEach(id=>{
      try{
        const s=queryOne('SELECT * FROM siswa WHERE id=?',[id]);
        if(s){
          runWithoutSave('INSERT INTO alumni (nama,nisn,kelas_lulus,tahun_lulus,foto,jenis_kelamin,nik,tempat_lahir,tanggal_lahir,agama,alamat,no_hp_ortu,nipd) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
            [s.nama,s.nisn,s.kelas,tahun_lulus,s.foto||'',s.jenis_kelamin||'',s.nik||'',s.tempat_lahir||'',s.tanggal_lahir||'',s.agama||'',s.alamat||'',s.no_hp_ortu||'',s.nipd||'']);
          runWithoutSave('DELETE FROM siswa WHERE id=?',[id]);
          count++;
        }
      }catch(e){}
    });
    runWithoutSave('COMMIT');
    saveDB();
  } catch(e) {
    try { runWithoutSave('ROLLBACK'); } catch(er) {}
    return res.json({success:false,message:e.message});
  }
  logActivity(req.session.operatorId,req.session.operatorNama,req.session.operatorRole,'Lulus Massal',`${count} siswa dipindahkan ke Data Lulusan tahun ${tahun_lulus}`);
  res.json({success:true,message:`${count} siswa berhasil dipindahkan ke Data Lulusan`});
});

router.post('/pindah-massal', (req,res) => {
  const {ids, alasan='', tanggal_pindah=''} = req.body;
  if(!ids||!Array.isArray(ids)||!ids.length)
    return res.json({success:false,message:'Tidak ada data yang dipilih'});
  let count=0;
  try {
    runWithoutSave('BEGIN TRANSACTION');
    ids.forEach(id=>{
      try{
        const s=queryOne('SELECT * FROM siswa WHERE id=?',[id]);
        if(s){
          runWithoutSave('INSERT INTO pindahan (nama,nisn,kelas,alasan,tanggal_pindah,foto,jenis_kelamin,nik,tempat_lahir,tanggal_lahir,agama,alamat,no_hp_ortu,nipd) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
            [s.nama,s.nisn,s.kelas,alasan,tanggal_pindah,s.foto||'',s.jenis_kelamin||'',s.nik||'',s.tempat_lahir||'',s.tanggal_lahir||'',s.agama||'',s.alamat||'',s.no_hp_ortu||'',s.nipd||'']);
          runWithoutSave('DELETE FROM siswa WHERE id=?',[id]);
          count++;
        }
      }catch(e){}
    });
    runWithoutSave('COMMIT');
    saveDB();
  } catch(e) {
    try { runWithoutSave('ROLLBACK'); } catch(er) {}
    return res.json({success:false,message:e.message});
  }
  logActivity(req.session.operatorId,req.session.operatorNama,req.session.operatorRole,'Pindah Massal',`${count} siswa dipindahkan ke Data Pindahan`);
  res.json({success:true,message:`${count} siswa berhasil dipindahkan ke Data Pindahan`});
});

router.post('/kenaikan-kelas', (req,res) => {
  const { promotions, graduations, tahun_lulus } = req.body;
  const taKenaikan = getActiveTahunAjaran();
  const taKenaikanId = taKenaikan ? taKenaikan.id : 1;
  let sukses = 0, gagal = 0;
  try {
    runWithoutSave('BEGIN TRANSACTION');
    if (promotions && Array.isArray(promotions)) {
      promotions.forEach(p => {
        try {
          runWithoutSave('UPDATE siswa SET kelas=?, tahun_ajaran_id=?, updated_at=datetime("now","localtime") WHERE id=?', [p.kelas_baru, taKenaikanId, p.id]);
          sukses++;
        } catch(e) { gagal++; }
      });
    }
    if (graduations && Array.isArray(graduations) && tahun_lulus) {
      graduations.forEach(id => {
        try {
          const s = queryOne('SELECT * FROM siswa WHERE id=?', [id]);
          if (s) {
            runWithoutSave('INSERT INTO alumni (nama,nisn,kelas_lulus,tahun_lulus,foto,jenis_kelamin,nik,tempat_lahir,tanggal_lahir,agama,alamat,no_hp_ortu,nipd) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
              [s.nama,s.nisn,s.kelas,tahun_lulus,s.foto||'',s.jenis_kelamin||'',s.nik||'',s.tempat_lahir||'',s.tanggal_lahir||'',s.agama||'',s.alamat||'',s.no_hp_ortu||'',s.nipd||'']);
            runWithoutSave('DELETE FROM siswa WHERE id=?', [id]);
            sukses++;
          }
        } catch(e) { gagal++; }
      });
    }
    runWithoutSave('COMMIT');
    saveDB();
  } catch(e) {
    try { runWithoutSave('ROLLBACK'); } catch(er) {}
    return res.json({success:false,message:e.message});
  }
  logActivity(req.session.operatorId,req.session.operatorNama,req.session.operatorRole,'Kenaikan Kelas',`${sukses} siswa diproses`);
  res.json({success:true,sukses,gagal,message:`${sukses} siswa berhasil diproses${gagal?`, ${gagal} gagal`:''}`});
});

// Multer untuk CSV import (memory storage)
const csvUpload = multer({ storage: multer.memoryStorage(), limits:{fileSize:5*1024*1024},
  fileFilter:(req,file,cb)=> {
    const ext = path.extname(file.originalname).toLowerCase();
    if(ext!=='.csv' && file.mimetype!=='text/csv' && file.mimetype!=='application/vnd.ms-excel')
      return cb(new Error('Hanya file CSV'));
    cb(null,true);
  }
});

function normalizeDate(v){
  if(!v) return '';
  if(/^\d{2}\/\d{2}\/\d{4}$/.test(v)){
    const [d,m,y]=v.split('/');
    return `${y}-${m}-${d}`;
  }
  return v;
}

// POST: import siswa dari CSV
router.post('/import', csvUpload.single('file'), (req,res) => {
  try {
    if(!req.file) return res.json({success:false,message:'File CSV tidak ditemukan'});
    let text = req.file.buffer.toString('utf-8');
    if(text.charCodeAt(0)===0xFEFF) text=text.slice(1);
    const {header, rows: rawRows} = parseCSV(text);
    const required = ['nisn','nipd','nama','kelas','jenis_kelamin','uid'];
    const missing = required.filter(r=>!header.includes(r));
    if(missing.length) return res.json({success:false,message:`Kolom wajib tidak ditemukan: ${missing.join(', ')}`});

    // Buang baris yang semua kolomnya kosong
    const rows = rawRows.filter(r=>required.some(k=>r[k])).map(r=>{
      const o={};for(const k of Object.keys(r)){let v=r[k];if(/^=".+"$/.test(v))v=v.slice(2,-1);o[k]=v;}
      return o;
    });

    const taImport = getActiveTahunAjaran();
    const taImportId = taImport ? taImport.id : 1;
    let sukses=0, gagal=0, errors=[];
    const sql = 'INSERT INTO siswa (nisn,nipd,nama,kelas,jenis_kelamin,uid,nik,tempat_lahir,tanggal_lahir,agama,alamat,no_hp_ortu,tahun_ajaran_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)';

    // Pre-scan: cari duplikat UID dalam file CSV sendiri
    const uidSeen = {};
    const rowUidErrors = {};
    for(let i=0; i<rows.length; i++){
      const u = rows[i].uid;
      if(!u) continue;
      if(uidSeen[u]!==undefined){
        rowUidErrors[i] = 'UID duplikat dalam file CSV (sama dengan baris '+(uidSeen[u]+2)+')';
      } else {
        uidSeen[u] = i;
      }
    }

    runWithoutSave('BEGIN TRANSACTION');
    for(let i=0; i<rows.length; i++){
      const r = rows[i];
      const no = i+2;
      const errs = [];
      if(rowUidErrors[i]){ errs.push(rowUidErrors[i]); }
      for(const f of required) if(!r[f]) errs.push(`${f} kosong`);
      if(r.uid&&r.uid.length!==10 && !rowUidErrors[i]) errs.push('UID harus 10 digit');
      if(r.uid&&!rowUidErrors[i]&&queryOne('SELECT id FROM siswa WHERE uid=?',[r.uid])) errs.push('UID sudah terdaftar');
      if(r.nisn&&queryOne('SELECT id FROM siswa WHERE nisn=?',[r.nisn])) errs.push('NISN sudah terdaftar');
      if(r.jenis_kelamin&&!['Laki-laki','Perempuan'].includes(r.jenis_kelamin)) errs.push('Jenis kelamin harus Laki-laki/Perempuan');
      if(errs.length){gagal++;errors.push(`Baris ${no}: ${errs.join('; ')}`);continue;}
      try {
        runWithoutSave(sql, [r.nisn,r.nipd,r.nama,r.kelas,r.jenis_kelamin,r.uid,r.nik||'',r.tempat_lahir||'',normalizeDate(r.tanggal_lahir),r.agama||'',r.alamat||'',r.no_hp_ortu||'',taImportId]);
        sukses++;
      } catch(e){gagal++;errors.push(`Baris ${no}: ${e.message}`);}
    }
    runWithoutSave('COMMIT');
    saveDB();

    logActivity(req.session.operatorId,req.session.operatorNama,req.session.operatorRole,'Import CSV',`${sukses} sukses, ${gagal} gagal`);
    res.json({success:true, sukses, gagal, errors, message:`${sukses} berhasil, ${gagal} gagal`});
  } catch(e){
    res.json({success:false,message:e.message});
  }
});

module.exports = router;
