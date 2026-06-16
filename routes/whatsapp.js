const express  = require('express');
const { queryOne, getSetting, logActivity } = require('../database');

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

function auth(req,res,next){
  if(!req.session.operatorId) return res.status(401).json({success:false});
  next();
}
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

module.exports = { sendWaNotification, router };
