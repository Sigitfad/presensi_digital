const http = require('http');
const app = require('./server');
const server = app.listen(0, () => {
  const port = server.address().port;
  console.log('Server on port ' + port);

  const pages = ['/', '/scan', '/login', '/api/session', '/api/identitas/public'];
  let tested = 0;

  pages.forEach(url => {
    http.get('http://localhost:' + port + url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const ok = res.statusCode >= 200 && res.statusCode < 400;
        console.log((ok ? 'OK' : 'FAIL') + ' ' + res.statusCode + ' ' + url + ' (' + data.length + 'b)');
        if (++tested === pages.length) {
          // Verify login.html content
          if (url === '/login' && data.length > 0) {
            if (data.includes('rfid.png')) console.log('OK login.html includes rfid.png');
            else console.log('FAIL login.html missing rfid.png');
            if (data.includes('id="uid"')) console.log('OK login.html has uid input');
            else console.log('FAIL login.html missing uid input');
            if (data.includes('font-size:42px')) console.log('OK login.html font-size:42px');
            else console.log('FAIL login.html font-size missing');
          }
          // Verify scan.html content
          if (url === '/scan' && data.length > 0) {
            if (data.includes('rfid.png')) console.log('OK scan.html includes rfid.png');
            else console.log('FAIL scan.html missing rfid.png');
            if (data.includes('id="manual-uid"')) console.log('OK scan.html has manual-uid');
            else console.log('FAIL scan.html missing manual-uid');
          }
          // Verify api/session
          if (url === '/api/session' && data.length > 0) {
            const j = JSON.parse(data);
            console.log('OK /api/session success=' + j.success);
          }
          server.close(() => process.exit(0));
        }
      });
    }).on('error', e => {
      console.log('FAIL ' + url + ': ' + e.message);
      if (++tested === pages.length) { server.close(() => process.exit(1)); }
    });
  });
});
