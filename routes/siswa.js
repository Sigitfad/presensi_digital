const express  = require('express');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const { queryAll, queryOne, run, runWithoutSave, saveDB, logActivity } = require('../database');
const router   = express.Router();

const storage = multer.diskStorage({
  destination:(req,file,cb)=>cb(null,path.join(__dirname,'../public/uploads/foto-siswa')),
  filename   :(req,file,cb)=>cb(null,`siswa_${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits:{fileSize:2*1024*1024},
  fileFilter:(req,file,cb)=>(/image\/(jpeg|jpg|png|webp)/.test(file.mimetype)?cb(null,true):cb(new Error('Hanya gambar')))
});

function auth(req,res,next){
  if(!req.session.operatorId) return res.status(401).json({success:false,message:'Silakan login'});
  next();
}
router.use(auth);

// Helper: kelas filter berdasarkan role
function getKelasFilter(req) {
  const role  = req.session.operatorRole;
  const kelas = req.session.pengampuKelas || 'Semua';
  if (role === 'operator') return null;
  if (kelas === 'Semua')   return null;
  // Bisa comma-separated (guru_bidang dengan multi kelas)
  const arr = kelas.split(',').map(k=>k.trim()).filter(Boolean);
  return arr.length > 1 ? arr : arr[0] || null;
}

// GET: daftar siswa
router.get('/', (req,res) => {
  const { search='', kelas='' } = req.query;
  const kelasFilter = getKelasFilter(req);

  let sql='SELECT * FROM siswa WHERE 1=1';
  const p=[];
  if(search){ sql+=' AND (nama LIKE ? OR nisn LIKE ? OR nipd LIKE ? OR kelas LIKE ? OR uid LIKE ?)'; p.push(`%${search}%`,`%${search}%`,`%${search}%`,`%${search}%`,`%${search}%`); }

  // kelasFilter = batasan dari session (pengampu kelas)
  // Jika user memilih kelas tertentu dari dropdown, hormati pilihan tsb
  const allowed = kelasFilter ? (Array.isArray(kelasFilter) ? kelasFilter : [kelasFilter]) : [];
  if(kelas.trim() && allowed.length && allowed.includes(kelas.trim())){
    sql+=' AND kelas=?'; p.push(kelas.trim());
  } else if(allowed.length){
    sql+=` AND kelas IN (${allowed.map(()=>'?').join(',')})`;
    p.push(...allowed);
  } else if(kelas.trim()){
    sql+=' AND kelas=?'; p.push(kelas.trim());
  }
  sql+=' ORDER BY nama ASC LIMIT 5000';
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
  const { search='', kelas='' } = req.query;
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
  try {
    run('INSERT INTO siswa (nisn,nama,kelas,jenis_kelamin,foto,no_hp_ortu,nik,tempat_lahir,tanggal_lahir,agama,alamat,nipd,uid) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',[nisn,nama,kelas,jenis_kelamin,foto,no_hp_ortu,nik,tempat_lahir,tanggal_lahir,agama,alamat,nipd,uid]);
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
  ids.forEach(id=>{
    const s=queryOne('SELECT * FROM siswa WHERE id=?',[id]);
    if(s){
      if(s.foto){const p=path.join(__dirname,'../public',s.foto);if(fs.existsSync(p))fs.unlinkSync(p);}
      try{run('DELETE FROM siswa WHERE id=?',[id]);count++;}
      catch(e){}
    }
  });
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
  ids.forEach(id=>{
    try{
      const s=queryOne('SELECT * FROM siswa WHERE id=?',[id]);
      if(s){
        // Insert ke alumni
        run('INSERT INTO alumni (nama,nisn,kelas_lulus,tahun_lulus,foto,jenis_kelamin,nik,tempat_lahir,tanggal_lahir,agama,alamat,no_hp_ortu,nipd) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
          [s.nama,s.nisn,s.kelas,tahun_lulus,s.foto||'',s.jenis_kelamin||'',s.nik||'',s.tempat_lahir||'',s.tanggal_lahir||'',s.agama||'',s.alamat||'',s.no_hp_ortu||'',s.nipd||'']);
        // Hapus dari siswa
        run('DELETE FROM siswa WHERE id=?',[id]);
        count++;
      }
    }catch(e){}
  });
  logActivity(req.session.operatorId,req.session.operatorNama,req.session.operatorRole,'Lulus Massal',`${count} siswa dipindahkan ke Data Lulusan tahun ${tahun_lulus}`);
  res.json({success:true,message:`${count} siswa berhasil dipindahkan ke Data Lulusan`});
});

router.post('/pindah-massal', (req,res) => {
  const {ids, alasan='', tanggal_pindah=''} = req.body;
  if(!ids||!Array.isArray(ids)||!ids.length)
    return res.json({success:false,message:'Tidak ada data yang dipilih'});
  let count=0;
  ids.forEach(id=>{
    try{
      const s=queryOne('SELECT * FROM siswa WHERE id=?',[id]);
      if(s){
        run('INSERT INTO pindahan (nama,nisn,kelas,alasan,tanggal_pindah,foto,jenis_kelamin,nik,tempat_lahir,tanggal_lahir,agama,alamat,no_hp_ortu,nipd) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
          [s.nama,s.nisn,s.kelas,alasan,tanggal_pindah,s.foto||'',s.jenis_kelamin||'',s.nik||'',s.tempat_lahir||'',s.tanggal_lahir||'',s.agama||'',s.alamat||'',s.no_hp_ortu||'',s.nipd||'']);
        run('DELETE FROM siswa WHERE id=?',[id]);
        count++;
      }
    }catch(e){}
  });
  logActivity(req.session.operatorId,req.session.operatorNama,req.session.operatorRole,'Pindah Massal',`${count} siswa dipindahkan ke Data Pindahan`);
  res.json({success:true,message:`${count} siswa berhasil dipindahkan ke Data Pindahan`});
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

function detectDelimiter(line){
  const commaCount = (line.match(/,/g)||[]).length;
  const semicolonCount = (line.match(/;/g)||[]).length;
  return semicolonCount > commaCount ? ';' : ',';
}

function parseCSV(text){
  const lines = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n').filter(Boolean);
  if(!lines.length) return {header:[],rows:[]};
  const delim = detectDelimiter(lines[0]);
  const header = lines[0].split(delim).map(h=>h.trim().replace(/^"|"$/g,'').toLowerCase());
  const rows = [];
  for(let i=1; i<lines.length; i++){
    const vals = lines[i].split(delim).map(v=>v.trim().replace(/^"|"$/g,''));
    const row = {};
    header.forEach((h,idx)=> row[h]=vals[idx]||'');
    rows.push(row);
  }
  return {header, rows};
}

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
    const rows = rawRows.filter(r=>required.some(k=>r[k]));

    let sukses=0, gagal=0, errors=[];
    const sql = 'INSERT INTO siswa (nisn,nipd,nama,kelas,jenis_kelamin,uid,nik,tempat_lahir,tanggal_lahir,agama,alamat,no_hp_ortu) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)';

    // Pre‑scan: cari duplikat UID dalam file CSV sendiri
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
        runWithoutSave(sql, [r.nisn,r.nipd,r.nama,r.kelas,r.jenis_kelamin,r.uid,r.nik||'',r.tempat_lahir||'',normalizeDate(r.tanggal_lahir),r.agama||'',r.alamat||'',r.no_hp_ortu||'']);
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
