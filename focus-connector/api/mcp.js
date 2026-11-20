// Vercel serverless entry point: https://<your-project>.vercel.app/mcp?key=<FOCUS_CONNECTOR_KEY>
//
// Required environment variables (Vercel > Project > Settings > Environment Variables):
//   FIREBASE_SERVICE_ACCOUNT  Full JSON of a Firebase service account key for focus-app-38732
//   FOCUS_UID                 Your Firebase Auth user ID (Firebase console > Authentication > Users)
//   FOCUS_CONNECTOR_KEY       A long random secret; only requests that carry it are served
// Optional:
//   FOCUS_TZ                  IANA time zone for "today" (default America/Los_Angeles)
import crypto from 'node:crypto';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { handleMcpBody } from '../lib/mcp.js';

function db() {
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  }
  return getFirestore();
}

// Reads the same documents the Focus app writes: users/{uid}/data/{tasks,recurring,log}.
// Each stores its payload as a JSON string field.
async function loadData() {
  const base = db().collection('users').doc(process.env.FOCUS_UID).collection('data');
  const [tasksSnap, recurringSnap, logSnap] = await Promise.all([
    base.doc('tasks').get(), base.doc('recurring').get(), base.doc('log').get(),
  ]);
  const parse = (snap, field) => {
    if (!snap.exists) return [];
    try { return JSON.parse(snap.get(field) || '[]'); } catch { return []; }
  };
  const main = parse(tasksSnap, 'tasks').filter((t) => !t.recurringKey);
  const recurring = parse(recurringSnap, 'recurring');
  return { tasks: [...main, ...recurring], log: parse(logSnap, 'log') };
}

function authorized(req) {
  const expected = process.env.FOCUS_CONNECTOR_KEY || '';
  if (expected.length < 24) return false; // refuse to run with a missing or weak key
  const url = new URL(req.url, 'http://localhost');
  const header = req.headers.authorization || '';
  const given = url.searchParams.get('key') || (header.startsWith('Bearer ') ? header.slice(7) : '');
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!authorized(req)) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  if (req.method === 'GET') {
    // No server-initiated stream; clients fall back to POST-only.
    res.setHeader('Allow', 'POST');
    res.status(405).end();
    return;
  }
  if (req.method === 'DELETE') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).end(); return; }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch {
      res.status(400).json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
      return;
    }
  }
  const out = await handleMcpBody(body, {
    loadData,
    tz: process.env.FOCUS_TZ || 'America/Los_Angeles',
  });
  if (out === null) { res.status(202).end(); return; }
  res.status(200).json(out);
}
