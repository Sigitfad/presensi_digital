const express  = require('express');
const bcrypt   = require('bcryptjs');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const { queryAll, queryOne, run, logActivity } = require('../database');
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
  const data = queryAll('SELECT id,nama,username,role,no_hp,email,foto,pengampu_kelas,nip,alamat,bidang_keahlian,uid,password_plain,created_at FROM operators ORDER BY role ASC,nama ASC');
  res.json({success:true, data});
});

router.post('/tambah', requireOperator, upload.single('foto'), (req,res) => {
  let {nama,username,password,role,no_hp='',email='',pengampu_kelas='Semua',nip='',alamat='',bidang_keahlian='',uid=''} = req.body;
  if(!nama||!role) return res.json({success:false,message:'Nama dan Role wajib diisi!'});
  // Penjaga sekolah: username/password opsional, auto-generate
  if(role==='penjaga_sekolah'){
    if(!username) username = `p_${Date.now()}`;
    if(!password) password = 'penjaga123';
  }
  if(!username||!password) return res.json({success:false,message:'Username dan Password wajib diisi!'});
  if(password.length<6) return res.json({success:false,message:'Password minimal 6 karakter!'});
  if(queryOne('SELECT id FROM operators WHERE username=?',[username]))
    return res.json({success:false,message:'Username sudah digunakan!'});
  if(uid&&queryOne('SELECT id FROM operators WHERE uid=?',[uid]))
    return res.json({success:false,message:'UID sudah digunakan!'});

  const foto = req.file ? `/uploads/foto-user/${req.file.filename}` : '';
  const hash = bcrypt.hashSync(password,10);
  run('INSERT INTO operators (nama,username,password,password_plain,role,no_hp,email,foto,pengampu_kelas,nip,alamat,bidang_keahlian,uid) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [nama,username,hash,password,role,no_hp,email,foto,pengampu_kelas,nip,alamat,bidang_keahlian,uid]);
  const roleDisplay = role==='guru_bidang'&&bidang_keahlian ? bidang_keahlian : role;
  logActivity(req.session.operatorId,req.session.operatorNama,req.session.operatorRole,
              'Tambah User',`User baru: ${nama} (${roleDisplay}) - Pengampu: ${pengampu_kelas} - NIP: ${nip}`);
  res.json({success:true,message:'Pengguna berhasil ditambahkan'});
});

router.post('/edit', requireOperator, upload.single('foto'), (req,res) => {
  const {id,nama,username,role,no_hp='',email='',password='',pengampu_kelas='Semua',nip='',alamat='',bidang_keahlian='',uid=''} = req.body;
  if(!id||!nama||!username||!role)
    return res.json({success:false,message:'Field wajib tidak boleh kosong!'});
  if(queryOne('SELECT id FROM operators WHERE username=? AND id!=?',[username,id]))
    return res.json({success:false,message:'Username sudah digunakan!'});
  if(uid&&queryOne('SELECT id FROM operators WHERE uid=? AND id!=?',[uid,id]))
    return res.json({success:false,message:'UID sudah digunakan!'});

  const lama = queryOne('SELECT foto FROM operators WHERE id=?',[id]);
  let foto   = lama?.foto || '';
  if(req.file){
    if(lama?.foto){ const op=path.join(__dirname,'../public',lama.foto); if(fs.existsSync(op)) fs.unlinkSync(op); }
    foto = `/uploads/foto-user/${req.file.filename}`;
  }

  if(password && password.length>=6 && password!=='********'){
    const hash = bcrypt.hashSync(password,10);
    run('UPDATE operators SET nama=?,username=?,password=?,password_plain=?,role=?,no_hp=?,email=?,foto=?,pengampu_kelas=?,nip=?,alamat=?,bidang_keahlian=?,uid=? WHERE id=?',
        [nama,username,hash,password,role,no_hp,email,foto,pengampu_kelas,nip,alamat,bidang_keahlian,uid,id]);
  } else {
    run('UPDATE operators SET nama=?,username=?,role=?,no_hp=?,email=?,foto=?,pengampu_kelas=?,nip=?,alamat=?,bidang_keahlian=?,uid=? WHERE id=?',
        [nama,username,role,no_hp,email,foto,pengampu_kelas,nip,alamat,bidang_keahlian,uid,id]);
  }

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
  ids.forEach(id=>{
    const user=queryOne('SELECT * FROM operators WHERE id=?',[id]);
    if(!user) return;
    if(user.role==='operator'){skipped++;return;}
    if(parseInt(id)===req.session.operatorId){skipped++;return;}
    if(user.foto){const p=path.join(__dirname,'../public',user.foto);if(fs.existsSync(p))fs.unlinkSync(p);}
    try{run('DELETE FROM operators WHERE id=?',[id]);count++;}
    catch(e){}
  });
  logActivity(req.session.operatorId,req.session.operatorNama,req.session.operatorRole,
              'Hapus User',`Hapus massal: ${count} pengguna`);
  const msg=skipped>0?`${count} dihapus, ${skipped} dilewati (Operator)`:`${count} pengguna berhasil dihapus`;
  res.json({success:true,message:msg});
});

module.exports = router;
