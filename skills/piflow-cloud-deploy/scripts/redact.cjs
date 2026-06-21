'use strict';

const SECRET_RE = /(TOKEN|SECRET|PASSWORD|PRIVATE[_-]?KEY|SERVICE[_-]?ACCOUNT|ACCESS[_-]?KEY|SESSION|COOKIE)/i;

function mask(value) {
  const text = String(value == null ? '' : value);
  if (!text) return '';
  if (text.length <= 8) return '***';
  return `${text.slice(0, 4)}...${text.slice(-4)}`;
}

function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const [key, raw] of Object.entries(value)) {
    if (SECRET_RE.test(key)) {
      out[key] = mask(raw);
    } else if (raw && typeof raw === 'object') {
      out[key] = redact(raw);
    } else {
      out[key] = raw;
    }
  }
  return out;
}

module.exports = { redact, mask, SECRET_RE };
