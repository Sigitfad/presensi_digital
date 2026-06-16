const express = require('express');
const { queryAll, queryCount, queryOne, getSetting } = require('../database');
const router  = express.Router();

router.use((req,res,next) => {
  if(!req.session.operatorId) return res.status(401).json({success:false});
  next();
});

router.get('/', (req,res) => {
  const today         = new Date().toLocaleDateString('sv-SE');
  const identitas     = queryOne('SELECT * FROM identitas_sekolah WHERE id=1') || {};
  const rawFilter     = req.session.pengampuKelas || 'Semua';
  const operatorId   = req.session.operatorId;
  const role          = req.session.operatorRole;
  const myBidang      = role==='guru_bidang' ? queryOne("SELECT bidang_keahlian FROM operators WHERE id=?",[operatorId])?.bidang_keahlian||'' : '';
  const isOperator    = role === 'operator';

  const totalSiswa     = queryCount('SELECT COUNT(*) as c FROM siswa');
  const totalGuru      = queryCount("SELECT COUNT(*) as c FROM operators WHERE role='guru'");
  const totalOperator  = queryCount("SELECT COUNT(*) as c FROM operators WHERE role='operator'");
  const totalKepsek    = queryCount("SELECT COUNT(*) as c FROM operators WHERE role='kepala_sekolah'");
  const totalPenjaga   = queryCount("SELECT COUNT(*) as c FROM operators WHERE role='penjaga_sekolah'");
  const totalLulusan   = queryCount("SELECT COUNT(*) as c FROM alumni");
  const totalPindahan  = queryCount("SELECT COUNT(*) as c FROM pindahan");
  const allBidang      = ['Guru Bahasa Inggris','Guru Agama','Guru Olahraga','Guru Seni'];
  const rawBidang      = queryAll("SELECT bidang_keahlian, COUNT(*) as count FROM operators WHERE role='guru_bidang' AND bidang_keahlian IS NOT NULL AND bidang_keahlian!='' GROUP BY bidang_keahlian");
  const countMap       = {};
  rawBidang.forEach(b=>{ countMap[b.bidang_keahlian]=b.count; });
  const bidangCounts   = allBidang.map(bidang=>({ bidang_keahlian:bidang, count:countMap[bidang]||0 }));

  // Siapkan filter kelas untuk non-operator (single / multi)
  let kelasArr = [];
  if(!isOperator && rawFilter !== 'Semua'){
    kelasArr = rawFilter.split(',').map(k=>k.trim()).filter(Boolean);
  }

  // === Siswa Belum Absen ===
  let siswaSQL = 'SELECT id, nisn, nama, kelas, foto FROM siswa WHERE 1=1';
  let siswaParams = [];
  if (kelasArr.length) {
    siswaSQL += ` AND kelas IN (${kelasArr.map(()=>'?').join(',')})`;
    siswaParams = [...kelasArr];
  }
  const allSiswa = queryAll(siswaSQL, siswaParams);
  const todayPresensi = queryAll('SELECT siswa_id FROM presensi WHERE tanggal=?', [today]);
  const hadirSet = new Set(todayPresensi.map(p => p.siswa_id));
  const nowTime = new Date().toTimeString().slice(0, 5);
  const batasTerlambat = getSetting('batas_terlambat','07:00');
  const batasAlpha = getSetting('batas_alpha','07:30');
  let lewatBatas = '';
  if (nowTime > batasAlpha) lewatBatas = 'Alpha';
  else if (nowTime > batasTerlambat) lewatBatas = 'Terlambat';
  const siswaBelumAbsen = allSiswa.filter(s => !hadirSet.has(s.id)).map(s => ({
    id: s.id, nisn: s.nisn, nama: s.nama, kelas: s.kelas,
    foto: s.foto, status: lewatBatas || 'Belum'
  }));

  // totalHadir — pakai subquery supaya tidak bergantung JOIN
  const hadirSQL = kelasArr.length
    ? `SELECT COUNT(*) as c FROM presensi WHERE tanggal=? AND siswa_id IN (SELECT id FROM siswa WHERE kelas IN (${kelasArr.map(()=>'?').join(',')}))`
    : 'SELECT COUNT(*) as c FROM presensi WHERE tanggal=?';
  const totalHadir = queryCount(hadirSQL, kelasArr.length ? [today, ...kelasArr] : [today]);

  // Count Terlambat today
  const terlambatSQL = kelasArr.length
    ? `SELECT COUNT(*) as c FROM presensi WHERE tanggal=? AND status='Terlambat' AND siswa_id IN (SELECT id FROM siswa WHERE kelas IN (${kelasArr.map(()=>'?').join(',')}))`
    : `SELECT COUNT(*) as c FROM presensi WHERE tanggal=? AND status='Terlambat'`;
  const totalTerlambat = queryCount(terlambatSQL, kelasArr.length ? [today, ...kelasArr] : [today]);

  // Presensi hari ini — JOIN untuk ambil data siswa + filter kelas
  const presensiSQL = kelasArr.length
    ? `SELECT p.*,s.nama,s.kelas,s.nisn,s.foto FROM presensi p JOIN siswa s ON p.siswa_id=s.id WHERE p.tanggal=? AND s.kelas IN (${kelasArr.map(()=>'?').join(',')}) ORDER BY p.jam_masuk DESC LIMIT 10`
    : `SELECT p.*,s.nama,s.kelas,s.nisn,s.foto FROM presensi p JOIN siswa s ON p.siswa_id=s.id WHERE p.tanggal=? ORDER BY p.jam_masuk DESC LIMIT 10`;

  res.json({
    success:true,
    totalSiswa, totalGuru, totalOperator, totalKepsek, totalPenjaga, totalLulusan, totalPindahan, totalHadirHariIni: totalHadir, totalTerlambat, bidangCounts,
    presensiHariIni: queryAll(presensiSQL, kelasArr.length ? [today, ...kelasArr] : [today]),
    siswaBelumAbsen,
    tanggal        : today,
    operator       : req.session.operatorNama,
    role, myBidang,
    pengampuKelas  : rawFilter,
    foto           : req.session.operatorFoto || '',
    jamMasuk       : getSetting('jam_masuk','07:00'),
    batasTerlambat : getSetting('batas_terlambat','07:00'),
    batasAlpha     : getSetting('batas_alpha','07:30'),
    identitas
  });
});

module.exports = router;
