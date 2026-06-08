const express = require('express');
const { queryAll } = require('../database');
const router  = express.Router();

function auth(req,res,next){
  if(!req.session.operatorId) return res.status(401).json({success:false});
  next();
}
router.use(auth);

router.get('/', (req,res) => {
  const { limit=100, user='', aksi='' } = req.query;
  let sql = 'SELECT a.*, o.bidang_keahlian FROM activity_log a LEFT JOIN operators o ON a.user_id=o.id WHERE 1=1';
  const p = [];
  if(user) { sql+=' AND user_nama LIKE ?'; p.push(`%${user}%`); }
  if(aksi && aksi !== 'Semua') { sql+=' AND aksi LIKE ?'; p.push(`%${aksi}%`); }
  sql += ' ORDER BY created_at DESC LIMIT ?';
  p.push(parseInt(limit));
  res.json({success:true, data:queryAll(sql,p)});
});

module.exports = router;
