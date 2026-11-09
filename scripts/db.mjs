// Perintah database Printora:  node --experimental-strip-types scripts/db.mjs <migrate|reset|status>
import {migrate, reset, pool} from '../lib/mysql.mjs';

const cmd = process.argv[2] || 'migrate';
try {
  if (cmd === 'migrate') { await migrate(); console.log('Skema MySQL siap.'); }
  else if (cmd === 'reset') { await reset(); console.log('Database dikosongkan; akun Admin dan master data awal dibuat.'); }
  else if (cmd === 'status') {
    await migrate();
    for (const t of ['users', 'sessions', 'catalog', 'payment_methods', 'channels', 'orders', 'designs', 'payments', 'attachments', 'files']) {
      const [[r]] = await pool().query(`SELECT COUNT(*) n FROM ${t}`);
      console.log(t.padEnd(16), r.n);
    }
  } else { console.error('Perintah tidak dikenal: ' + cmd); process.exitCode = 1; }
} catch (e) { console.error('Gagal:', e.message); process.exitCode = 1; } finally { await pool().end(); }
