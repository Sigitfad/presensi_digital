/**
 * SERVER UTAMA v2.1
 * Presensi SDN Karangpawitan 1
 */
const express   = require('express');
const session   = require('express-session');
const FileStore = require('session-file-store')(session);
const path      = require('path');
const fs        = require('fs');
const { initDB } = require('./database');

const app  = express();
const BASE_PORT = parseInt(process.env.PORT, 10) || 3000;

// Pastikan semua folder upload dan session ada
['public/uploads/foto-siswa','public/uploads/foto-user','public/uploads/logo','public/uploads/ijazah','public/uploads/surat-pindah','database/sessions'].forEach(d => {
  const p = path.join(__dirname, d);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

app.use(express.json({ limit:'10mb' }));
app.use(express.urlencoded({ extended:true, limit:'10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  store: new FileStore({
    path     : path.join(__dirname, 'database/sessions'),
    ttl      : 28800,
    retries  : 5,
    reapInterval: 300,
    logFn    : () => {}
  }),
  secret           : 'presensi-sdn-kp1-v21-secret',
  resave           : false,
  saveUninitialized: false,
  cookie           : { maxAge: 8 * 60 * 60 * 1000 }
}));

initDB().then(() => {
  app.use('/',               require('./routes/auth'));
  app.use('/api/siswa',      require('./routes/siswa'));
  app.use('/api/presensi',   require('./routes/presensi'));
  app.use('/api/dashboard',  require('./routes/dashboard'));
  app.use('/api/users',      require('./routes/users'));
  app.use('/api/settings',   require('./routes/settings'));
  app.use('/api/rekap',      require('./routes/rekap'));
  app.use('/api/log',        require('./routes/actlog'));
  app.use('/api/backup',     require('./routes/backup'));
  app.use('/api/identitas',  require('./routes/identitas'));
  app.use('/api/kelas',      require('./routes/kelas'));
  app.use('/api/alumni',     require('./routes/alumni'));
  app.use('/api/pindahan',   require('./routes/pindahan'));
  app.use('/pages',          require('./routes/pages'));

  app.get('/', (req,res) => {
    if (req.session.operatorId) return res.redirect('/pages/dashboard');
    res.redirect('/login');
  });

  function startServer(port) {
    const server = app.listen(port);
    server.on('listening', () => {
      console.log('');
      console.log('==============================================');
      console.log(' PRESENSI SDN KARANGPAWITAN 1 v2.1 - SIAP!');
      console.log('==============================================');
      console.log(` Buka: http://localhost:${port}`);
      console.log(' Login: admin / password');
      console.log('==============================================');
      console.log('');
    });
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE' && port < BASE_PORT + 10) {
        console.log(`[Server] Port ${port} digunakan, coba port ${port + 1}...`);
        startServer(port + 1);
      } else {
        console.error(`[Server] Gagal bind port ${port}:`, err.message);
        process.exit(1);
      }
    });
  }
  startServer(BASE_PORT);
}).catch(e => { console.error('DB Error:', e.message); process.exit(1); });
