const express  = require('express');
const { queryAll, queryOne, run, hitungStatus, logActivity } = require('../database');
const router   = express.Router();

function auth(req,res,next){
  if(!req.session.operatorId) return res.status(401).json({success:false});
  next();
}
router.use(auth);

function getKelasFilter(req) {
  const role  = req.session.operatorRole;
  const kelas = req.session.pengampuKelas || 'Semua';
  if (role === 'operator') return null;
  if (kelas === 'Semua')   return null;
  const arr = kelas.split(',').map(k=>k.trim()).filter(Boolean);
  return arr.length > 1 ? arr : arr[0] || null;
}

// GET: riwayat presensi (dengan filter role)
router.get('/', (req,res) => {
  const {tanggal='',tanggal2='',kelas=''} = req.query;
  const kelasFilter = getKelasFilter(req);
  const allowed = kelasFilter ? (Array.isArray(kelasFilter) ? kelasFilter : [kelasFilter]) : [];

  let sql=`SELECT p.id,p.tanggal,p.jam_masuk,p.status,p.keterangan,
           s.nisn,s.nama,s.kelas,s.jenis_kelamin,s.foto
           FROM presensi p JOIN siswa s ON p.siswa_id=s.id WHERE 1=1`;
  const params=[];
  if(tanggal)       {sql+=' AND p.tanggal>=?'; params.push(tanggal);}
  if(tanggal2)      {sql+=' AND p.tanggal<=?'; params.push(tanggal2);}
  if(kelas.trim() && allowed.length && allowed.includes(kelas.trim())){
    sql+=' AND s.kelas=?'; params.push(kelas.trim());
  } else if(allowed.length){
    sql+=` AND s.kelas IN (${allowed.map(()=>'?').join(',')})`; params.push(...allowed);
  } else if(kelas.trim()){
    sql+=' AND s.kelas=?'; params.push(kelas.trim());
  }
  sql+=' ORDER BY p.tanggal DESC,p.jam_masuk DESC LIMIT 10000';
  res.json({success:true,data:queryAll(sql,params)});
});

// POST: scan presensi
router.post('/scan', (req,res) => {
  const {nisn}=req.body;
  if(!nisn) return res.json({success:false,message:'NISN kosong'});
  const siswa=queryOne('SELECT * FROM siswa WHERE nisn=?',[nisn.trim()]);
  if(!siswa) return res.json({success:false,message:`Siswa NISN "${nisn}" tidak ditemukan!`});
  const now=new Date();
  const tanggal=now.toLocaleDateString('sv-SE');
  const jam=now.toTimeString().slice(0,8);
  const status=hitungStatus(jam.slice(0,5));
  const sudah=queryOne('SELECT * FROM presensi WHERE siswa_id=? AND tanggal=?',[siswa.id,tanggal]);
  if(sudah) return res.json({success:false,sudah:true,
    message:`${siswa.nama} sudah presensi pukul ${sudah.jam_masuk.slice(0,5)}`,
    siswa,presensi:sudah});
  try {
    run('INSERT INTO presensi (siswa_id,tanggal,jam_masuk,status) VALUES (?,?,?,?)',
        [siswa.id,tanggal,jam,status]);
    logActivity(req.session.operatorId,req.session.operatorNama,req.session.operatorRole,
                'Scan Presensi',`${siswa.nama} - ${status} pukul ${jam.slice(0,5)}`);
    res.json({success:true,message:'Presensi berhasil!',siswa,status,jam_masuk:jam,tanggal});
  } catch(e){res.json({success:false,message:e.message});}
});

// POST: presensi manual
router.post('/manual', (req,res) => {
  const {siswa_id,tanggal,status,keterangan=''} = req.body;
  if(!siswa_id||!tanggal||!status) return res.json({success:false,message:'Data tidak lengkap'});
  const jam=status==='Izin'||status==='Sakit'||status==='Alpha'?'00:00:00':new Date().toTimeString().slice(0,8);
  const sudah=queryOne('SELECT id FROM presensi WHERE siswa_id=? AND tanggal=?',[siswa_id,tanggal]);
  if(sudah){
    run('UPDATE presensi SET status=?,keterangan=?,jam_masuk=? WHERE id=?',[status,keterangan,jam,sudah.id]);
  } else {
    run('INSERT INTO presensi (siswa_id,tanggal,jam_masuk,status,keterangan) VALUES (?,?,?,?,?)',
        [siswa_id,tanggal,jam,status,keterangan]);
  }
  logActivity(req.session.operatorId,req.session.operatorNama,req.session.operatorRole,
              'Presensi Manual',`Siswa ID ${siswa_id}: ${status} tgl ${tanggal}`);
  res.json({success:true,message:'Presensi berhasil disimpan'});
});

// GET: export excel
router.get('/export-excel', (req,res) => {
  try {
    const XLSX=require('xlsx');
    const {tanggal='',tanggal2='',kelas=''}=req.query;
    const kelasFilter=getKelasFilter(req);
    const allowed = kelasFilter ? (Array.isArray(kelasFilter) ? kelasFilter : [kelasFilter]) : [];

    let sql=`SELECT p.tanggal,s.nisn,s.nama,s.kelas,s.jenis_kelamin,p.jam_masuk,p.status,p.keterangan
             FROM presensi p JOIN siswa s ON p.siswa_id=s.id WHERE 1=1`;
    const params=[];
    if(tanggal)    {sql+=' AND p.tanggal>=?';params.push(tanggal);}
    if(tanggal2)   {sql+=' AND p.tanggal<=?';params.push(tanggal2);}
    if(kelas.trim() && allowed.length && allowed.includes(kelas.trim())){
      sql+=' AND s.kelas=?'; params.push(kelas.trim());
    } else if(allowed.length){
      sql+=` AND s.kelas IN (${allowed.map(()=>'?').join(',')})`; params.push(...allowed);
    } else if(kelas.trim()){
      sql+=' AND s.kelas=?'; params.push(kelas.trim());
    }
    sql+=' ORDER BY p.tanggal DESC,p.jam_masuk DESC';

    const data=queryAll(sql,params);
    const wb=XLSX.utils.book_new();
    const ws=XLSX.utils.aoa_to_sheet([
      ['Tanggal','NISN','Nama Siswa','Kelas','Jenis Kelamin','Jam Masuk','Status','Keterangan'],
      ...data.map(d=>[d.tanggal,d.nisn,d.nama,d.kelas,d.jenis_kelamin,d.jam_masuk.slice(0,5),d.status,d.keterangan||''])
    ]);
    ws['!cols']=[{wch:12},{wch:10},{wch:25},{wch:10},{wch:14},{wch:10},{wch:12},{wch:20}];
    XLSX.utils.book_append_sheet(wb,ws,'Presensi');
    const buf=XLSX.write(wb,{type:'buffer',bookType:'xlsx'});
    const kelasLabel=kelas?kelas.replace(/\s/g,''):'Semua';
    const fname=`Presensi_${tanggal}_${kelasLabel}.xlsx`;
    res.setHeader('Content-Disposition',`attachment; filename="${fname}"`);
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch(e){res.status(500).json({success:false,message:e.message});}
});

module.exports = router;
