'use strict';

const dns = require('node:dns').promises;
const net = require('node:net');

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function isPrivateIp(address) {
  if (!net.isIP(address)) return true;
  if (address.includes(':')) {
    const value = address.toLowerCase();
    return value === '::1' || value.startsWith('fc') || value.startsWith('fd') || value.startsWith('fe8') || value.startsWith('fe9') || value.startsWith('fea') || value.startsWith('feb');
  }
  const parts = address.split('.').map(Number);
  return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    (parts[0] >= 224);
}

async function validatePublicUrl(rawUrl, lookup = dns.lookup) {
  let url;
  try { url = new URL(rawUrl); } catch { throw new Error('Informe uma URL válida.'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('A URL deve usar HTTP ou HTTPS.');
  if (url.username || url.password) throw new Error('URLs com credenciais não são permitidas.');
  let records;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      records = await lookup(url.hostname, { all: true, verbatim: true });
      break;
    } catch (error) {
      if (!['EBUSY', 'EAI_AGAIN'].includes(error.code) || attempt === 2) {
        if (['EBUSY', 'EAI_AGAIN', 'ENOTFOUND'].includes(error.code)) throw new Error('Não foi possível localizar o domínio do fornecedor. Verifique o endereço e tente novamente.');
        throw error;
      }
      await wait(250 * (attempt + 1));
    }
  }
  if (!records.length || records.some(record => isPrivateIp(record.address))) {
    throw new Error('O endereço informado não é um site público permitido.');
  }
  url.hash = '';
  return url;
}

function sameOrigin(candidate, origin) {
  try { return new URL(candidate, origin).origin === new URL(origin).origin; } catch { return false; }
}

module.exports = { isPrivateIp, validatePublicUrl, sameOrigin };
