const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { queryAll, queryOne, run, logActivity } = require('../database');
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

// GET: daftar alumni
router.get('/', (req,res) => {
  const { search='', tahun_lulus='' } = req.query;
  let sql = 'SELECT * FROM alumni WHERE 1=1';
  const p = [];
  if(search){ sql += ' AND (nama LIKE ? OR nisn LIKE ?)'; p.push(`%${search}%`,`%${search}%`); }
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
  const {nama,nisn,kelas_lulus,tahun_lulus,foto=''} = req.body;
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
    run('INSERT INTO alumni (nama,nisn,kelas_lulus,tahun_lulus,foto,ijazah) VALUES (?,?,?,?,?,?)',
        [nama,nisn,kelas_lulus,tahun_lulus,foto,ijazah]);
    logActivity(req.session.operatorId,req.session.operatorNama,req.session.operatorRole,
                'Tambah Alumni',`${nama} (${nisn}) - Kelas ${kelas_lulus} Lulus ${tahun_lulus}`);
    res.json({success:true,message:'Alumni berhasil ditambahkan'});
  } catch(e){res.json({success:false,message:e.message});}
});

// POST: edit alumni
router.post('/edit', upload.single('ijazah'), (req,res) => {
  const {id,nama,nisn,kelas_lulus,tahun_lulus} = req.body;
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
    run('UPDATE alumni SET nama=?,nisn=?,kelas_lulus=?,tahun_lulus=?,foto=?,ijazah=?,updated_at=datetime("now","localtime") WHERE id=?',
        [nama,nisn,kelas_lulus,tahun_lulus,foto,ijazah,id]);
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
  ids.forEach(id => {
    const a = queryOne('SELECT * FROM alumni WHERE id=?',[id]);
    if(a){
      if(a.ijazah){ const p=path.join(__dirname,'../public',a.ijazah); if(fs.existsSync(p)) fs.unlinkSync(p); }
      try{ run('DELETE FROM alumni WHERE id=?',[id]); count++; } catch(e){}
    }
  });
  logActivity(req.session.operatorId,req.session.operatorNama,req.session.operatorRole,
              'Hapus Alumni',`Hapus massal: ${count} alumni`);
  res.json({success:true,message:`${count} alumni berhasil dihapus`});
});

module.exports = router;
