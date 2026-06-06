// Affiche l'IP LAN du PC utilisee pour sortir sur le reseau (donc joignable
// par un autre appareil du meme wifi). On demande au systeme quelle interface
// router vers une IP externe : ca evite les adaptateurs virtuels (WSL en 172.*,
// VirtualBox en 192.168.56.*, etc.). Repli sur une heuristique par prefixe.
import dgram from 'dgram';
import os from 'os';

function fallback() {
  const c = Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal);
  const score = (a) =>
    a.startsWith('192.168.56.') ? -1 : // VirtualBox host-only
    a.startsWith('192.168.')    ? 3 :
    a.startsWith('10.')         ? 2 :
    a.startsWith('172.')        ? 0 : // souvent WSL/Docker/Hyper-V
    1;
  c.sort((x, y) => score(y.address) - score(x.address));
  return c[0]?.address ?? '127.0.0.1';
}

const sock = dgram.createSocket('udp4');
let done = false;
const finish = (ip) => {
  if (done) return;
  done = true;
  try { sock.close(); } catch {}
  console.log(ip);
};

const timer = setTimeout(() => finish(fallback()), 500);
sock.on('error', () => { clearTimeout(timer); finish(fallback()); });
// connect() UDP n'envoie rien mais fixe l'adresse locale selon la table de routage.
sock.connect(80, '8.8.8.8', () => {
  clearTimeout(timer);
  let ip = null;
  try { ip = sock.address().address; } catch {}
  finish(ip && ip !== '0.0.0.0' ? ip : fallback());
});
