const express = require('express');
const { queryAll, queryCount, queryOne, getSetting, getActiveTahunAjaran } = require('../database');
const { auth } = require('./_helpers');
const router  = express.Router();

router.use(auth);

router.get('/', (req,res) => {
  const today         = new Date().toLocaleDateString('sv-SE');
  const identitas     = queryOne('SELECT * FROM identitas_sekolah WHERE id=1') || {};
  const rawFilter     = req.session.pengampuKelas || 'Semua';
  const operatorId   = req.session.operatorId;
  const role          = req.session.operatorRole;
  const myBidang      = role==='guru_bidang' ? queryOne("SELECT bidang_keahlian FROM operators WHERE id=?",[operatorId])?.bidang_keahlian||'' : '';
  const isOperator    = role === 'operator';
  const taDash        = getActiveTahunAjaran();
  const taDashId      = taDash ? taDash.id : 0;

  const totalSiswa     = taDashId ? queryCount('SELECT COUNT(*) as c FROM siswa WHERE tahun_ajaran_id=?',[taDashId]) : queryCount('SELECT COUNT(*) as c FROM siswa');
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
  if (taDashId) { siswaSQL += ' AND tahun_ajaran_id=?'; siswaParams.push(taDashId); }
  const allSiswa = queryAll(siswaSQL, siswaParams);
  const todayPresensi = taDashId
    ? queryAll('SELECT siswa_id FROM presensi WHERE tanggal=? AND tahun_ajaran_id=?', [today, taDashId])
    : queryAll('SELECT siswa_id FROM presensi WHERE tanggal=?', [today]);
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
  const hadirParams = [today];
  let hadirSQL = 'SELECT COUNT(*) as c FROM presensi WHERE tanggal=?';
  if (taDashId) { hadirSQL += ' AND tahun_ajaran_id=?'; hadirParams.push(taDashId); }
  if (kelasArr.length) {
    hadirSQL += ` AND siswa_id IN (SELECT id FROM siswa WHERE kelas IN (${kelasArr.map(()=>'?').join(',')}))`;
    hadirParams.push(...kelasArr);
  }
  const totalHadir = queryCount(hadirSQL, hadirParams);

  // Count Terlambat today
  const terlambatParams = [today];
  let terlambatSQL = "SELECT COUNT(*) as c FROM presensi WHERE tanggal=? AND status='Terlambat'";
  if (taDashId) { terlambatSQL += ' AND tahun_ajaran_id=?'; terlambatParams.push(taDashId); }
  if (kelasArr.length) {
    terlambatSQL += ` AND siswa_id IN (SELECT id FROM siswa WHERE kelas IN (${kelasArr.map(()=>'?').join(',')}))`;
    terlambatParams.push(...kelasArr);
  }
  const totalTerlambat = queryCount(terlambatSQL, terlambatParams);

  // Presensi hari ini — JOIN untuk ambil data siswa + filter kelas
  const presensiParams = [today];
  let presensiSQL = `SELECT p.*,s.nama,s.kelas,s.nisn,s.foto FROM presensi p JOIN siswa s ON p.siswa_id=s.id WHERE p.tanggal=?`;
  if (taDashId) { presensiSQL += ' AND p.tahun_ajaran_id=?'; presensiParams.push(taDashId); }
  if (kelasArr.length) {
    presensiSQL += ` AND s.kelas IN (${kelasArr.map(()=>'?').join(',')})`;
    presensiParams.push(...kelasArr);
  }
  presensiSQL += ' ORDER BY p.jam_masuk DESC LIMIT 10';

  res.json({
    success:true,
    totalSiswa, totalGuru, totalOperator, totalKepsek, totalPenjaga, totalLulusan, totalPindahan, totalHadirHariIni: totalHadir, totalTerlambat, bidangCounts,
    presensiHariIni: queryAll(presensiSQL, presensiParams),
    siswaBelumAbsen,
    tanggal        : today,
    operator       : req.session.operatorNama,
    role, myBidang,
    pengampuKelas  : rawFilter,
    foto           : req.session.operatorFoto || '',
    jamMasuk       : getSetting('jam_masuk','07:00'),
    batasTerlambat : getSetting('batas_terlambat','07:00'),
    batasAlpha     : getSetting('batas_alpha','07:30'),
    identitas,
    tahun_ajaran   : taDash
  });
});

module.exports = router;
