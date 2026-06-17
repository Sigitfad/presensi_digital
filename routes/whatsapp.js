const express  = require('express');
const { queryOne, queryAll, getSetting, logActivity, getActiveTahunAjaran } = require('../database');
const { auth } = require('./_helpers');

const BULAN = ['','Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const HARI  = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];

async function sendWaNotification(siswa, status, jam, tanggal) {
  try {
    const enabled = (getSetting('wa_enabled', '1') || '1').trim();
    if (enabled !== '1') return;

    const noHp = (siswa.no_hp_ortu || '').trim();
    if (noHp.length < 10) return;

    const apiKey = (getSetting('wa_api_key', '') || '').trim();
    if (!apiKey) return;

    const endpoint = (getSetting('wa_endpoint', '') || '').trim() || 'https://api.fonnte.com/send';

    let tmpl = (getSetting('wa_template', '') || '').trim();
    if (!tmpl) {
      tmpl = [
        '*Presensi Digital*',
        '',
        'Assalamu\'alaikum Wr. Wb.',
        '',
        'Ananda {nama} (Kelas: {kelas}) telah melakukan presensi *{status}*',
        '🕐 Pukul: {jam} WIB',
        '📅 Tanggal: {tanggal}',
        '',
        'Terima kasih.'
      ].join('\n');
    }

    const d = new Date(tanggal + 'T' + jam);
    const tgl = HARI[d.getDay()] + ', ' + d.getDate() + ' ' + BULAN[d.getMonth() + 1] + ' ' + d.getFullYear();
    const hari = HARI[d.getDay()];

    const pesan = tmpl
      .replace(/\{nama\}/g, siswa.nama)
      .replace(/\{nisn\}/g, siswa.nisn)
      .replace(/\{kelas\}/g, siswa.kelas)
      .replace(/\{status\}/g, status)
      .replace(/\{jam\}/g, jam)
      .replace(/\{tanggal\}/g, tgl)
      .replace(/\{hari\}/g, hari);
    const fd = new FormData();
    fd.append('target', noHp);
    fd.append('message', pesan);
    fd.append('delay', '2');
    fd.append('countryCode', '62');
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Authorization': apiKey },
      body: fd
    });

    const result = await res.json();
    if (result.status) {
      logActivity(0, 'Sistem', 'sistem', 'WA Terkirim', siswa.nama + ' - ' + status + ' ke ' + noHp);
    } else {
      logActivity(0, 'Sistem', 'sistem', 'WA Gagal', siswa.nama + ': ' + (result.reason || 'unknown'));
    }
  } catch (e) {
    logActivity(0, 'Sistem', 'sistem', 'WA Error', siswa.nama + ': ' + e.message);
  }
}

const router = express.Router();

router.use(auth);

router.post('/test', (req,res) => {
  const enabled = (getSetting('wa_enabled', '1') || '1').trim();
  if (enabled !== '1') return res.json({success:false,message:'WhatsApp Gateway sedang dinonaktifkan. Aktifkan toggle terlebih dahulu.'});

  const { target } = req.body;
  if (!target || target.length < 10) return res.json({success:false,message:'Nomor tujuan tidak valid (min 10 digit)'});

  const apiKey = (getSetting('wa_api_key', '') || '').trim();
  if (!apiKey) return res.json({success:false,message:'API Key WhatsApp belum diisi di Pengaturan'});

  const endpoint = (getSetting('wa_endpoint', '') || '').trim() || 'https://api.fonnte.com/send';
  const now = new Date();
  const jam = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
  const tgl = HARI[now.getDay()] + ', ' + now.getDate() + ' ' + BULAN[now.getMonth() + 1] + ' ' + now.getFullYear();
  const hari = HARI[now.getDay()];

  let tmpl = (getSetting('wa_template', '') || '').trim();
  if (!tmpl) tmpl = 'Test WA dari Sistem Presensi Digital\n\nJika Anda menerima pesan ini, notifikasi WhatsApp berfungsi dengan baik!\n\nWaktu: {jam}\nTanggal: {tanggal}';

  const pesan = tmpl
    .replace(/\{nama\}/g, 'Test Siswa')
    .replace(/\{nisn\}/g, '0000000000')
    .replace(/\{kelas\}/g, 'Kelas Test')
    .replace(/\{status\}/g, 'Hadir')
    .replace(/\{jam\}/g, jam)
    .replace(/\{tanggal\}/g, tgl)
    .replace(/\{hari\}/g, hari);

  const fd = new FormData();
  fd.append('target', target);
  fd.append('message', pesan);
  fd.append('delay', '2');
  fd.append('countryCode', '62');
  fetch(endpoint, {
    method: 'POST',
    headers: { 'Authorization': apiKey },
    body: fd
  })
  .then(r => r.json())
  .then(result => {
    if (result.status) {
      logActivity(req.session.operatorId, req.session.operatorNama, req.session.operatorRole, 'WA Test', 'Test terkirim ke ' + target);
      res.json({success:true,message:'WA test berhasil dikirim!'});
    } else {
      res.json({success:false,message:'Gagal: ' + (result.reason || 'unknown')});
    }
  })
  .catch(e => res.json({success:false,message:'Error: ' + e.message}));
});

async function kirimBroadcast(siswaList, pesan, apiKey, endpoint, concurrency = 5) {
  let sukses = 0, gagal = 0;
  for(let i = 0; i < siswaList.length; i += concurrency) {
    const batch = siswaList.slice(i, i + concurrency);
    const results = await Promise.allSettled(batch.map(async (siswa) => {
      try {
        const noHp = (siswa.no_hp_ortu || '').trim();
        if(noHp.length < 10) return false;
        let msg = pesan
          .replace(/\{nama\}/g, siswa.nama)
          .replace(/\{nisn\}/g, siswa.nisn)
          .replace(/\{kelas\}/g, siswa.kelas);
        const fd = new FormData();
        fd.append('target', noHp);
        fd.append('message', msg);
        fd.append('delay', '2');
        fd.append('countryCode', '62');
        const r = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Authorization': apiKey },
          body: fd
        });
        const j = await r.json();
        return !!j.status;
      } catch(e) { return false; }
    }));
    results.forEach(r => { r.status === 'fulfilled' && r.value ? sukses++ : gagal++; });
  }
  return { sukses, gagal };
}

router.post('/broadcast', async (req,res) => {
  try {
    const enabled = (getSetting('wa_enabled', '1') || '1').trim();
    if(enabled !== '1') return res.json({success:false,message:'WhatsApp Gateway sedang dinonaktifkan'});
    const apiKey = (getSetting('wa_api_key', '') || '').trim();
    if(!apiKey) return res.json({success:false,message:'API Key WhatsApp belum diisi'});
    const endpoint = (getSetting('wa_endpoint', '') || '').trim() || 'https://api.fonnte.com/send';
    const {kelas='', pesan='', tahun_ajaran_id=''} = req.body;
    if(!pesan || !pesan.trim()) return res.json({success:false,message:'Pesan tidak boleh kosong'});
    const taBC = tahun_ajaran_id || (getActiveTahunAjaran()||{}).id || 0;

    let sql = 'SELECT id,nisn,nama,kelas,no_hp_ortu FROM siswa WHERE no_hp_ortu IS NOT NULL AND no_hp_ortu!=\'\' AND LENGTH(no_hp_ortu)>=10';
    const params = [];
    if(kelas && kelas !== 'Semua') { sql += ' AND kelas=?'; params.push(kelas); }
    if(taBC) { sql += ' AND tahun_ajaran_id=?'; params.push(taBC); }
    const siswaList = queryAll(sql, params);
    if(!siswaList.length) return res.json({success:false,message:'Tidak ada siswa dengan nomor WA yang valid' + (kelas?' di kelas '+kelas:'')});

    logActivity(req.session.operatorId, req.session.operatorNama, req.session.operatorRole,
                'Broadcast WA Dimulai', `Kelas: ${kelas||'Semua'} - ${siswaList.length} nomor`);

    const {sukses, gagal} = await kirimBroadcast(siswaList, pesan, apiKey, endpoint);
    logActivity(req.session.operatorId, req.session.operatorNama, req.session.operatorRole,
                'Broadcast WA Selesai', `Sukses: ${sukses}, Gagal: ${gagal}, Kelas: ${kelas||'Semua'}`);
    res.json({success:true,message:`Broadcast selesai! ${sukses} terkirim, ${gagal} gagal.`, sukses, gagal, total: siswaList.length});
  } catch(e) { res.json({success:false,message:e.message}); }
});

module.exports = { sendWaNotification, router };
