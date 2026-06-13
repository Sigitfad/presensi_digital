const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { queryOne, run, logActivity } = require('../database');
const router  = express.Router();

const storage = multer.diskStorage({
  destination:(req,file,cb)=>cb(null,path.join(__dirname,'../public/uploads/logo')),
  filename   :(req,file,cb)=>cb(null,`${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits:{fileSize:2*1024*1024} });

// Endpoint publik (tanpa auth) untuk login page
router.get('/public', (req,res) => {
  const data = queryOne('SELECT * FROM identitas_sekolah WHERE id=1');
  res.json({success:true, data: data||{}});
});

function auth(req,res,next){
  if(!req.session.operatorId) return res.status(401).json({success:false});
  next();
}
router.use(auth);

router.get('/', (req,res) => {
  const data = queryOne('SELECT * FROM identitas_sekolah WHERE id=1');
  res.json({success:true, data: data||{}});
});

router.post('/simpan', upload.fields([{name:'logo',maxCount:1},{name:'foto_opsi',maxCount:1}]), (req,res) => {
  const {nama_sekolah,alamat,tahun_ajaran,telp,email,website} = req.body;
  const lama = queryOne('SELECT logo,foto_opsi FROM identitas_sekolah WHERE id=1');
  let logo = lama?.logo || '';
  let foto_opsi = lama?.foto_opsi || '';

  if (req.files?.logo?.[0]) {
    if (lama?.logo) {
      const old = path.join(__dirname,'../public', lama.logo);
      if (fs.existsSync(old)) fs.unlinkSync(old);
    }
    logo = `/uploads/logo/${req.files.logo[0].filename}`;
  }
  if (req.files?.foto_opsi?.[0]) {
    if (lama?.foto_opsi) {
      const old = path.join(__dirname,'../public', lama.foto_opsi);
      if (fs.existsSync(old)) fs.unlinkSync(old);
    }
    foto_opsi = `/uploads/logo/${req.files.foto_opsi[0].filename}`;
  }

  run(`UPDATE identitas_sekolah SET nama_sekolah=?,alamat=?,tahun_ajaran=?,telp=?,email=?,website=?,logo=?,foto_opsi=?,updated_at=datetime('now','localtime') WHERE id=1`,
      [nama_sekolah,alamat,tahun_ajaran,telp||'',email||'',website||'',logo,foto_opsi]);
  logActivity(req.session.operatorId,req.session.operatorNama,req.session.operatorRole,
              'Edit Identitas Sekolah','Memperbarui identitas sekolah');
  res.json({success:true,message:'Identitas sekolah berhasil disimpan'});
});

router.post('/delete-logo', (req,res) => {
  const lama = queryOne('SELECT logo FROM identitas_sekolah WHERE id=1');
  if (lama?.logo) {
    const old = path.join(__dirname,'../public', lama.logo);
    if (fs.existsSync(old)) fs.unlinkSync(old);
  }
  run(`UPDATE identitas_sekolah SET logo='',updated_at=datetime('now','localtime') WHERE id=1`);
  logActivity(req.session.operatorId,req.session.operatorNama,req.session.operatorRole,
              'Hapus Logo','Menghapus logo sekolah');
  res.json({success:true,message:'Logo berhasil dihapus'});
});

router.post('/delete-foto-opsi', (req,res) => {
  const lama = queryOne('SELECT foto_opsi FROM identitas_sekolah WHERE id=1');
  if (lama?.foto_opsi) {
    const old = path.join(__dirname,'../public', lama.foto_opsi);
    if (fs.existsSync(old)) fs.unlinkSync(old);
  }
  run(`UPDATE identitas_sekolah SET foto_opsi='',updated_at=datetime('now','localtime') WHERE id=1`);
  logActivity(req.session.operatorId,req.session.operatorNama,req.session.operatorRole,
              'Hapus Foto Opsi','Menghapus foto opsi sekolah');
  res.json({success:true,message:'Foto opsi berhasil dihapus'});
});

module.exports = router;
