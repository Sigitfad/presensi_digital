const express = require('express');
const path    = require('path');
const fs      = require('fs');
const multer  = require('multer');
const { queryAll, queryOne, run, logActivity } = require('../database');
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

function auth(req,res,next){
  if(!req.session.operatorId) return res.status(401).json({success:false,message:'Silakan login'});
  next();
}
function requireOperator(req,res,next){
  if(req.session.operatorRole!=='operator')
    return res.status(403).json({success:false,message:'Hanya Operator yang dapat mengakses'});
  next();
}
router.use(auth, requireOperator);

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
  ids.forEach(id => {
    const d = queryOne('SELECT * FROM pindahan WHERE id=?',[id]);
    if(d){
      if(d.surat_pindah){ const p=path.join(__dirname,'../public',d.surat_pindah); if(fs.existsSync(p)) fs.unlinkSync(p); }
      try{ run('DELETE FROM pindahan WHERE id=?',[id]); count++; } catch(e){}
    }
  });
  logActivity(req.session.operatorId,req.session.operatorNama,req.session.operatorRole,'Hapus Pindahan',`Hapus massal: ${count} data`);
  res.json({success:true,message:`${count} data pindahan berhasil dihapus`});
});

module.exports = router;
