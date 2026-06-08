const express = require('express');
const { queryAll, queryOne, run, logActivity } = require('../database');
const router  = express.Router();

function auth(req,res,next){
  if(!req.session.operatorId) return res.status(401).json({success:false});
  next();
}
router.use(auth);

router.get('/', (req,res) => {
  const rows = queryAll('SELECT key,value FROM settings');
  const obj  = {};
  rows.forEach(r => { obj[r.key] = r.value; });
  res.json({success:true, data: obj});
});

router.post('/simpan', (req,res) => {
  const { jam_masuk, batas_terlambat, backup_otomatis } = req.body;
  const updates = { jam_masuk, batas_terlambat, backup_otomatis };
  Object.entries(updates).forEach(([k,v]) => {
    if (v !== undefined) {
      if (queryOne('SELECT key FROM settings WHERE key=?',[k])) {
        run('UPDATE settings SET value=? WHERE key=?',[v,k]);
      } else {
        run('INSERT INTO settings (key,value) VALUES (?,?)',[k,v]);
      }
    }
  });
  logActivity(req.session.operatorId,req.session.operatorNama,req.session.operatorRole,
              'Edit Settings','Mengubah pengaturan jam masuk');
  res.json({success:true,message:'Pengaturan berhasil disimpan'});
});

module.exports = router;
