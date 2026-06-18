const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { queryAll, queryOne, run, runWithoutSave, saveDB, logActivity } = require('../database');
const router  = express.Router();

const uploadDir = path.join(__dirname,'../public/uploads/ijazah');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir,{recursive:true});

const storage = multer.diskStorage({
  destination:(req,file,cb)=>cb(null,uploadDir),
  filename   :(req,file,cb)=>cb(null,`ijazah_${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({
  storage,
  limits:{fileSize:10*1024*1024},
  fileFilter:(req,file,cb)=>{
    const allowed = /jpeg|jpg|png|pdf/;
    const ext = path.extname(file.originalname).toLowerCase().slice(1);
    if(allowed.test(ext)) cb(null,true);
    else cb(new Error('Hanya file gambar (jpg/png) atau PDF yang diizinkan'));
  }
});

const { auth, requireOperator, detectDelimiter, parseCSV } = require('./_helpers');
router.use(auth, requireOperator);

// Multer untuk CSV import (memory storage)
const csvUpload = multer({ storage: multer.memoryStorage(), limits:{fileSize:5*1024*1024},
  fileFilter:(req,file,cb)=> {
    const ext = path.extname(file.originalname).toLowerCase();
    if(ext!=='.csv' && file.mimetype!=='text/csv' && file.mimetype!=='application/vnd.ms-excel')
      return cb(new Error('Hanya file CSV'));
    cb(null,true);
  }
});

// GET: export alumni ke CSV (harus sebelum /:id)
router.get('/export', (req,res) => {
  const { search='', tahun_lulus='' } = req.query;
  let sql = 'SELECT * FROM alumni WHERE 1=1';
  const p = [];
  if(search){ sql += ' AND (nama LIKE ? OR nisn LIKE ? OR nipd LIKE ?)'; p.push(`%${search}%`,`%${search}%`,`%${search}%`); }
  if(tahun_lulus){ sql += ' AND tahun_lulus=?'; p.push(tahun_lulus); }
  sql += ' ORDER BY tahun_lulus DESC, nama ASC';
  const data = queryAll(sql,p);
  const header = ['nisn','nipd','nama','kelas_lulus','tahun_lulus','foto','ijazah'];
  const textCols = ['nisn','nipd'];
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
  res.setHeader('Content-Disposition','attachment; filename=data_alumni.csv');
  res.send('\uFEFF' + csvRows.join('\n'));
});

// POST: import alumni dari CSV
router.post('/import', csvUpload.single('file'), (req,res) => {
  try {
    if(!req.file) return res.json({success:false,message:'File CSV tidak ditemukan'});
    let text = req.file.buffer.toString('utf-8');
    if(text.charCodeAt(0)===0xFEFF) text=text.slice(1);
    const {header, rows: rawRows} = parseCSV(text);
    const required = ['nama','nisn','kelas_lulus','tahun_lulus'];
    const missing = required.filter(r=>!header.includes(r));
    if(missing.length) return res.json({success:false,message:`Kolom wajib tidak ditemukan: ${missing.join(', ')}`});

    const rows = rawRows.filter(r=>required.some(k=>r[k])).map(r=>{
      const o={};for(const k of Object.keys(r)){let v=r[k];if(/^=".+"$/.test(v))v=v.slice(2,-1);o[k]=v;}
      return o;
    });

    let sukses=0, gagal=0, errors=[];
    const sql = 'INSERT INTO alumni (nama,nisn,kelas_lulus,tahun_lulus,foto,ijazah,nipd) VALUES (?,?,?,?,?,?,?)';

    runWithoutSave('BEGIN TRANSACTION');
    for(let i=0; i<rows.length; i++){
      const r = rows[i];
      const no = i+2;
      const errs = [];
      for(const f of required) if(!r[f]) errs.push(`${f} kosong`);
      if(r.nisn&&queryOne('SELECT id FROM alumni WHERE nisn=?',[r.nisn])) errs.push('NISN sudah terdaftar');
      if(errs.length){gagal++;errors.push(`Baris ${no}: ${errs.join('; ')}`);continue;}
      try {
        runWithoutSave(sql, [r.nama,r.nisn,r.kelas_lulus,r.tahun_lulus,(r.foto||''),(r.ijazah||''),(r.nipd||'')]);
        sukses++;
      } catch(e){gagal++;errors.push(`Baris ${no}: ${e.message}`);}
    }
    runWithoutSave('COMMIT');
    saveDB();

    logActivity(req.session.operatorId,req.session.operatorNama,req.session.operatorRole,'Import CSV',`${sukses} sukses, ${gagal} gagal - Alumni`);
    res.json({success:true, sukses, gagal, errors, message:`${sukses} berhasil, ${gagal} gagal`});
  } catch(e){
    res.json({success:false,message:e.message});
  }
});

// GET: daftar alumni
router.get('/', (req,res) => {
  const { search='', tahun_lulus='' } = req.query;
  let sql = 'SELECT * FROM alumni WHERE 1=1';
  const p = [];
  if(search){ sql += ' AND (nama LIKE ? OR nisn LIKE ? OR nipd LIKE ?)'; p.push(`%${search}%`,`%${search}%`,`%${search}%`); }
  if(tahun_lulus){ sql += ' AND tahun_lulus=?'; p.push(tahun_lulus); }
  sql += ' ORDER BY tahun_lulus DESC, nama ASC';
  res.json({success:true, data:queryAll(sql,p)});
});

// GET: list tahun lulus unik
router.get('/tahun', (req,res) => {
  const rows = queryAll('SELECT DISTINCT tahun_lulus FROM alumni ORDER BY tahun_lulus DESC');
  res.json({success:true, data:rows.map(r=>r.tahun_lulus)});
});

// GET single alumni by ID
router.get('/:id', (req,res) => {
  const {id} = req.params;
  if(isNaN(id)) return res.json({success:false,message:'ID tidak valid'});
  const alumni = queryOne('SELECT * FROM alumni WHERE id=?',[id]);
  if(!alumni) return res.json({success:false,message:'Alumni tidak ditemukan'});
  res.json({success:true,data:alumni});
});

// POST: tambah alumni
router.post('/tambah', upload.single('ijazah'), (req,res) => {
  const {nama,nisn,kelas_lulus,tahun_lulus,foto='',nipd=''} = req.body;
  if(!nama||!nisn||!kelas_lulus||!tahun_lulus)
    return res.json({success:false,message:'Semua field wajib diisi!'});
  try {
    let ijazah = '';
    if(req.file){
      const safe = nama.replace(/[^a-zA-Z0-9\s]/g,'').replace(/\s+/g,'_').trim()||'alumni';
      const ext  = path.extname(req.file.filename);
      const baru = `${safe}_${Date.now()}${ext}`;
      fs.renameSync(req.file.path, path.join(uploadDir,baru));
      ijazah = `/uploads/ijazah/${baru}`;
    }
    run('INSERT INTO alumni (nama,nisn,kelas_lulus,tahun_lulus,foto,ijazah,nipd) VALUES (?,?,?,?,?,?,?)',
        [nama,nisn,kelas_lulus,tahun_lulus,foto,ijazah,nipd]);
    logActivity(req.session.operatorId,req.session.operatorNama,req.session.operatorRole,
                'Tambah Alumni',`${nama} (${nisn}) - Kelas ${kelas_lulus} Lulus ${tahun_lulus}`);
    res.json({success:true,message:'Alumni berhasil ditambahkan'});
  } catch(e){res.json({success:false,message:e.message});}
});

// POST: edit alumni
router.post('/edit', upload.single('ijazah'), (req,res) => {
  const {id,nama,nisn,kelas_lulus,tahun_lulus,nipd} = req.body;
  if(!id||!nama||!nisn||!kelas_lulus||!tahun_lulus)
    return res.json({success:false,message:'Semua field wajib diisi!'});
  const lama = queryOne('SELECT ijazah,foto FROM alumni WHERE id=?',[id]);
  let ijazah = lama?.ijazah || '';
  let foto = lama?.foto || '';
  if(req.file){
    if(lama?.ijazah){ const p=path.join(__dirname,'../public',lama.ijazah); if(fs.existsSync(p)) fs.unlinkSync(p); }
    const safe = nama.replace(/[^a-zA-Z0-9\s]/g,'').replace(/\s+/g,'_').trim()||'alumni';
    const ext  = path.extname(req.file.filename);
    const baru = `${safe}_${Date.now()}${ext}`;
    fs.renameSync(req.file.path, path.join(uploadDir,baru));
    ijazah = `/uploads/ijazah/${baru}`;
  }
  if(req.body.foto) foto = req.body.foto;
  try {
    run('UPDATE alumni SET nama=?,nisn=?,kelas_lulus=?,tahun_lulus=?,foto=?,ijazah=?,nipd=?,updated_at=datetime("now","localtime") WHERE id=?',
        [nama,nisn,kelas_lulus,tahun_lulus,foto,ijazah,nipd||'',id]);
    logActivity(req.session.operatorId,req.session.operatorNama,req.session.operatorRole,
                'Edit Alumni',`Edit: ${nama} (${nisn})`);
    res.json({success:true,message:'Data alumni berhasil diperbarui'});
  } catch(e){res.json({success:false,message:e.message});}
});

// POST: hapus ijazah
router.post('/hapus-ijazah', (req,res) => {
  const {id} = req.body;
  const a = queryOne('SELECT ijazah FROM alumni WHERE id=?',[id]);
  if(!a) return res.json({success:false,message:'Alumni tidak ditemukan'});
  if(a.ijazah){ const p=path.join(__dirname,'../public',a.ijazah); if(fs.existsSync(p)) fs.unlinkSync(p); }
  run('UPDATE alumni SET ijazah=? WHERE id=?',['',id]);
  res.json({success:true,message:'Ijazah dihapus'});
});

// POST: hapus alumni
router.post('/hapus', (req,res) => {
  const {id} = req.body;
  const a = queryOne('SELECT * FROM alumni WHERE id=?',[id]);
  if(!a) return res.json({success:false,message:'Alumni tidak ditemukan'});
  if(a.ijazah){ const p=path.join(__dirname,'../public',a.ijazah); if(fs.existsSync(p)) fs.unlinkSync(p); }
  try {
    run('DELETE FROM alumni WHERE id=?',[id]);
    logActivity(req.session.operatorId,req.session.operatorNama,req.session.operatorRole,
                'Hapus Alumni',`Hapus: ${a.nama} (${a.nisn})`);
    res.json({success:true,message:'Alumni berhasil dihapus'});
  } catch(e){res.json({success:false,message:e.message});}
});

// POST: hapus massal
router.post('/hapus-massal', (req,res) => {
  const {ids} = req.body;
  if(!ids||!Array.isArray(ids)||!ids.length)
    return res.json({success:false,message:'Tidak ada data yang dipilih'});
  let count = 0;
  try {
    runWithoutSave('BEGIN TRANSACTION');
    ids.forEach(id => {
      const a = queryOne('SELECT * FROM alumni WHERE id=?',[id]);
      if(a){
        if(a.ijazah){ const p=path.join(__dirname,'../public',a.ijazah); if(fs.existsSync(p)) fs.unlinkSync(p); }
        try{ runWithoutSave('DELETE FROM alumni WHERE id=?',[id]); count++; } catch(e){}
      }
    });
    runWithoutSave('COMMIT');
    saveDB();
  } catch(e) {
    try { runWithoutSave('ROLLBACK'); } catch(er) {}
    return res.json({success:false,message:e.message});
  }
  logActivity(req.session.operatorId,req.session.operatorNama,req.session.operatorRole,
              'Hapus Alumni',`Hapus massal: ${count} alumni`);
  res.json({success:true,message:`${count} alumni berhasil dihapus`});
});

module.exports = router;
