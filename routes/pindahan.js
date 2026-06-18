const express = require('express');
const path    = require('path');
const fs      = require('fs');
const multer  = require('multer');
const { queryAll, queryOne, run, runWithoutSave, saveDB, logActivity } = require('../database');
const router  = express.Router();

const uploadDir = path.join(__dirname,'../public/uploads/surat-pindah');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir,{recursive:true});

const storage = multer.diskStorage({
  destination:(req,file,cb)=>cb(null,uploadDir),
  filename   :(req,file,cb)=>cb(null,`surat_${Date.now()}${path.extname(file.originalname)}`)
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

// GET: export pindahan ke CSV (harus sebelum /:id)
router.get('/export', (req,res) => {
  const { search='' } = req.query;
  let sql = 'SELECT * FROM pindahan WHERE 1=1';
  const p = [];
  if(search){ sql += ' AND (nama LIKE ? OR nisn LIKE ? OR nipd LIKE ?)'; p.push(`%${search}%`,`%${search}%`,`%${search}%`); }
  sql += ' ORDER BY tanggal_pindah DESC, nama ASC';
  const data = queryAll(sql,p);
  const header = ['nisn','nipd','nama','kelas','jenis_kelamin','nik','tempat_lahir','tanggal_lahir','agama','alamat','no_hp_ortu','alasan','tanggal_pindah','foto'];
  const textCols = ['nisn','nipd','nik','no_hp_ortu'];
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
  res.setHeader('Content-Disposition','attachment; filename=data_pindahan.csv');
  res.send('\uFEFF' + csvRows.join('\n'));
});

// POST: import pindahan dari CSV
router.post('/import', csvUpload.single('file'), (req,res) => {
  try {
    if(!req.file) return res.json({success:false,message:'File CSV tidak ditemukan'});
    let text = req.file.buffer.toString('utf-8');
    if(text.charCodeAt(0)===0xFEFF) text=text.slice(1);
    const {header, rows: rawRows} = parseCSV(text);
    const required = ['nama','nisn','kelas'];
    const missing = required.filter(r=>!header.includes(r));
    if(missing.length) return res.json({success:false,message:`Kolom wajib tidak ditemukan: ${missing.join(', ')}`});

    const rows = rawRows.filter(r=>required.some(k=>r[k])).map(r=>{
      const o={};for(const k of Object.keys(r)){let v=r[k];if(/^=".+"$/.test(v))v=v.slice(2,-1);o[k]=v;}
      return o;
    });

    let sukses=0, gagal=0, errors=[];
    const sql = 'INSERT INTO pindahan (nama,nisn,kelas,alasan,tanggal_pindah,foto,jenis_kelamin,nik,tempat_lahir,tanggal_lahir,agama,alamat,no_hp_ortu,nipd) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)';

    runWithoutSave('BEGIN TRANSACTION');
    for(let i=0; i<rows.length; i++){
      const r = rows[i];
      const no = i+2;
      const errs = [];
      for(const f of required) if(!r[f]) errs.push(`${f} kosong`);
      if(r.nisn&&queryOne('SELECT id FROM pindahan WHERE nisn=?',[r.nisn])) errs.push('NISN sudah terdaftar');
      if(errs.length){gagal++;errors.push(`Baris ${no}: ${errs.join('; ')}`);continue;}
      try {
        runWithoutSave(sql, [r.nama,r.nisn,r.kelas,(r.alasan||''),(r.tanggal_pindah||''),(r.foto||''),(r.jenis_kelamin||''),(r.nik||''),(r.tempat_lahir||''),(r.tanggal_lahir||''),(r.agama||''),(r.alamat||''),(r.no_hp_ortu||''),(r.nipd||'')]);
        sukses++;
      } catch(e){gagal++;errors.push(`Baris ${no}: ${e.message}`);}
    }
    runWithoutSave('COMMIT');
    saveDB();

    logActivity(req.session.operatorId,req.session.operatorNama,req.session.operatorRole,'Import CSV',`${sukses} sukses, ${gagal} gagal - Pindahan`);
    res.json({success:true, sukses, gagal, errors, message:`${sukses} berhasil, ${gagal} gagal`});
  } catch(e){
    res.json({success:false,message:e.message});
  }
});

router.get('/', (req,res) => {
  const { search='' } = req.query;
  let sql = 'SELECT * FROM pindahan WHERE 1=1';
  const p = [];
  if(search){ sql += ' AND (nama LIKE ? OR nisn LIKE ? OR nipd LIKE ?)'; p.push(`%${search}%`,`%${search}%`,`%${search}%`); }
  sql += ' ORDER BY tanggal_pindah DESC, nama ASC';
  res.json({success:true, data:queryAll(sql,p)});
});

router.get('/:id', (req,res) => {
  const {id} = req.params;
  if(isNaN(id)) return res.json({success:false,message:'ID tidak valid'});
  const d = queryOne('SELECT * FROM pindahan WHERE id=?',[id]);
  if(!d) return res.json({success:false,message:'Data tidak ditemukan'});
  res.json({success:true,data:d});
});

router.post('/tambah', (req,res) => {
  const {nama,nisn,kelas,alasan='',tanggal_pindah='',foto='',jenis_kelamin='',nik='',tempat_lahir='',tanggal_lahir='',agama='',alamat='',no_hp_ortu='',nipd=''} = req.body;
  if(!nama||!nisn||!kelas)
    return res.json({success:false,message:'Nama, NISN, dan kelas wajib diisi!'});
  try {
    run('INSERT INTO pindahan (nama,nisn,kelas,alasan,tanggal_pindah,foto,jenis_kelamin,nik,tempat_lahir,tanggal_lahir,agama,alamat,no_hp_ortu,nipd) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [nama,nisn,kelas,alasan,tanggal_pindah,foto,jenis_kelamin,nik,tempat_lahir,tanggal_lahir,agama,alamat,no_hp_ortu,nipd]);
    logActivity(req.session.operatorId,req.session.operatorNama,req.session.operatorRole,'Tambah Pindahan',`${nama} (${nisn})`);
    res.json({success:true,message:'Data pindahan berhasil ditambahkan'});
  } catch(e){res.json({success:false,message:e.message});}
});

router.post('/edit', upload.single('surat_pindah'), (req,res) => {
  const {id,sekolah_tujuan='',nomor_surat='',tanggal_surat='',nipd=''} = req.body;
  if(!id) return res.json({success:false,message:'ID tidak valid'});
  const lama = queryOne('SELECT * FROM pindahan WHERE id=?',[id]);
  if(!lama) return res.json({success:false,message:'Data tidak ditemukan'});
  let surat_pindah = lama.surat_pindah || '';
  if(req.file){
    if(lama.surat_pindah){ const p=path.join(__dirname,'../public',lama.surat_pindah); if(fs.existsSync(p)) fs.unlinkSync(p); }
    const safe = lama.nama.replace(/[^a-zA-Z0-9\s]/g,'').replace(/\s+/g,'_').trim()||'pindahan';
    const ext  = path.extname(req.file.filename);
    const baru = `${safe}_surat_${Date.now()}${ext}`;
    fs.renameSync(req.file.path, path.join(uploadDir,baru));
    surat_pindah = `/uploads/surat-pindah/${baru}`;
  }
  try {
    run('UPDATE pindahan SET sekolah_tujuan=?,nomor_surat=?,tanggal_surat=?,surat_pindah=?,nipd=?,updated_at=datetime("now","localtime") WHERE id=?',
        [sekolah_tujuan,nomor_surat,tanggal_surat,surat_pindah,nipd,id]);
    logActivity(req.session.operatorId,req.session.operatorNama,req.session.operatorRole,'Edit Pindahan',`Edit surat: ${lama.nama} (${lama.nisn})`);
    res.json({success:true,message:'Data surat pindahan berhasil diperbarui'});
  } catch(e){res.json({success:false,message:e.message});}
});

router.post('/hapus', (req,res) => {
  const {id} = req.body;
  const d = queryOne('SELECT * FROM pindahan WHERE id=?',[id]);
  if(!d) return res.json({success:false,message:'Data tidak ditemukan'});
  if(d.surat_pindah){ const p=path.join(__dirname,'../public',d.surat_pindah); if(fs.existsSync(p)) fs.unlinkSync(p); }
  try {
    run('DELETE FROM pindahan WHERE id=?',[id]);
    logActivity(req.session.operatorId,req.session.operatorNama,req.session.operatorRole,'Hapus Pindahan',`Hapus: ${d.nama} (${d.nisn})`);
    res.json({success:true,message:'Data pindahan berhasil dihapus'});
  } catch(e){res.json({success:false,message:e.message});}
});

router.post('/hapus-massal', (req,res) => {
  const {ids} = req.body;
  if(!ids||!Array.isArray(ids)||!ids.length)
    return res.json({success:false,message:'Tidak ada data yang dipilih'});
  let count = 0;
  try {
    runWithoutSave('BEGIN TRANSACTION');
    ids.forEach(id => {
      const d = queryOne('SELECT * FROM pindahan WHERE id=?',[id]);
      if(d){
        if(d.surat_pindah){ const p=path.join(__dirname,'../public',d.surat_pindah); if(fs.existsSync(p)) fs.unlinkSync(p); }
        try{ runWithoutSave('DELETE FROM pindahan WHERE id=?',[id]); count++; } catch(e){}
      }
    });
    runWithoutSave('COMMIT');
    saveDB();
  } catch(e) {
    try { runWithoutSave('ROLLBACK'); } catch(er) {}
    return res.json({success:false,message:e.message});
  }
  logActivity(req.session.operatorId,req.session.operatorNama,req.session.operatorRole,'Hapus Pindahan',`Hapus massal: ${count} data`);
  res.json({success:true,message:`${count} data pindahan berhasil dihapus`});
});

module.exports = router;
