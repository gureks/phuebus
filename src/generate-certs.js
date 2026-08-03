const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const selfsigned = require('selfsigned');

function getLanIP() {
  const nets = os.networkInterfaces();
  for (const iface of Object.values(nets)) {
    for (const addr of iface) {
      if (addr.family === 'IPv4' && !addr.internal) return addr.address;
    }
  }
  return 'localhost';
}

async function generate() {
  const certsDir = path.join(__dirname, 'certs');
  const keyPath = path.join(certsDir, 'key.pem');
  const certPath = path.join(certsDir, 'cert.pem');

  if (!fs.existsSync(certsDir)) {
    fs.mkdirSync(certsDir, { recursive: true });
  }

  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    console.log('[Server] Generating self-signed SSL certificates for secure contexts...');
    const attrs = [{ name: 'commonName', value: getLanIP() }];
    const pems = await selfsigned.generate(attrs, { days: 365 });
    fs.writeFileSync(keyPath, pems.private);
    fs.writeFileSync(certPath, pems.cert);
    console.log('[Server] SSL certificates generated successfully.');
  }
}

generate().catch(err => {
  console.error('[Server] SSL certificate generation failed:', err);
  process.exit(1);
});
