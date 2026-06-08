const express  = require('express');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const { queryAll, queryOne, run, logActivity } = require('../database');
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
  if(search){ sql+=' AND (nama LIKE ? OR nisn LIKE ? OR kelas LIKE ?)'; p.push(`%${search}%`,`%${search}%`,`%${search}%`); }

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
  if(!s) return res.json({success:true, pengampu:''});
  const list = queryAll(
    "SELECT nama FROM operators WHERE (pengampu_kelas LIKE ? OR pengampu_kelas='Semua') AND role IN ('guru','kepala_sekolah','guru_bidang') ORDER BY nama",
    [`%${s.kelas}%`]
  );
  res.json({success:true, pengampu: list.map(r=>r.nama).join(', ')});
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
  const {nisn,nama,kelas,jenis_kelamin,no_hp_ortu='',nik='',tempat_lahir='',tanggal_lahir='',agama='',alamat=''} = req.body;
  if(!nisn||!nama||!kelas||!jenis_kelamin)
    return res.json({success:false,message:'Semua field wajib diisi!'});
  if(queryOne('SELECT id FROM siswa WHERE nisn=?',[nisn]))
    return res.json({success:false,message:'NISN sudah terdaftar!'});
  const foto = req.file ? `/uploads/foto-siswa/${req.file.filename}` : '';
  try {
    run('INSERT INTO siswa (nisn,nama,kelas,jenis_kelamin,foto,no_hp_ortu,nik,tempat_lahir,tanggal_lahir,agama,alamat) VALUES (?,?,?,?,?,?,?,?,?,?,?)',[nisn,nama,kelas,jenis_kelamin,foto,no_hp_ortu,nik,tempat_lahir,tanggal_lahir,agama,alamat]);
    logActivity(req.session.operatorId,req.session.operatorNama,req.session.operatorRole,'Tambah Siswa',`${nama} (${nisn})`);
    res.json({success:true,message:'Siswa berhasil ditambahkan'});
  } catch(e){res.json({success:false,message:e.message});}
});

router.post('/edit', upload.single('foto'), (req,res) => {
  const {id,nisn,nama,kelas,jenis_kelamin,no_hp_ortu='',nik='',tempat_lahir='',tanggal_lahir='',agama='',alamat=''} = req.body;
  if(!id||!nisn||!nama||!kelas||!jenis_kelamin)
    return res.json({success:false,message:'Semua field wajib diisi!'});
  if(queryOne('SELECT id FROM siswa WHERE nisn=? AND id!=?',[nisn,id]))
    return res.json({success:false,message:'NISN sudah digunakan!'});
  const lama = queryOne('SELECT foto FROM siswa WHERE id=?',[id]);
  let foto   = lama?.foto||'';
  if(req.file){
    if(lama?.foto){const p=path.join(__dirname,'../public',lama.foto);if(fs.existsSync(p))fs.unlinkSync(p);}
    foto=`/uploads/foto-siswa/${req.file.filename}`;
  }
  try {
    run('UPDATE siswa SET nisn=?,nama=?,kelas=?,jenis_kelamin=?,foto=?,no_hp_ortu=?,nik=?,tempat_lahir=?,tanggal_lahir=?,agama=?,alamat=?,updated_at=datetime("now","localtime") WHERE id=?',
        [nisn,nama,kelas,jenis_kelamin,foto,no_hp_ortu,nik,tempat_lahir,tanggal_lahir,agama,alamat,id]);
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
        run('INSERT INTO alumni (nama,nisn,kelas_lulus,tahun_lulus,foto,jenis_kelamin,nik,tempat_lahir,tanggal_lahir,agama,alamat,no_hp_ortu) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
          [s.nama,s.nisn,s.kelas,tahun_lulus,s.foto||'',s.jenis_kelamin||'',s.nik||'',s.tempat_lahir||'',s.tanggal_lahir||'',s.agama||'',s.alamat||'',s.no_hp_ortu||'']);
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
        run('INSERT INTO pindahan (nama,nisn,kelas,alasan,tanggal_pindah,foto,jenis_kelamin,nik,tempat_lahir,tanggal_lahir,agama,alamat,no_hp_ortu) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
          [s.nama,s.nisn,s.kelas,alasan,tanggal_pindah,s.foto||'',s.jenis_kelamin||'',s.nik||'',s.tempat_lahir||'',s.tanggal_lahir||'',s.agama||'',s.alamat||'',s.no_hp_ortu||'']);
        run('DELETE FROM siswa WHERE id=?',[id]);
        count++;
      }
    }catch(e){}
  });
  logActivity(req.session.operatorId,req.session.operatorNama,req.session.operatorRole,'Pindah Massal',`${count} siswa dipindahkan ke Data Pindahan`);
  res.json({success:true,message:`${count} siswa berhasil dipindahkan ke Data Pindahan`});
});

module.exports = router;
