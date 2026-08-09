import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import store from '../src/store.js';

test('_denseOperationLog: retire les null/trous, trie récent→ancien, borne à 300', () => {
  // Tableau creux indexé par recordNumber, tel que produit par le SDK.
  const oplog = [];
  oplog[1] = { recordNumber: 1, operateDate: 20260101120000 };
  oplog[2] = { recordNumber: 2, operateDate: 20260101130000 };
  oplog[50] = { recordNumber: 50, operateDate: 20260102080000 };
  // indices 0, 3..49 sont des trous (recordNumbers non lus)

  const dense = store._denseOperationLog(oplog);
  assert.equal(dense.length, 3);
  assert.equal(dense.some((op) => op == null), false, 'aucun null dans le résultat');
  // Trié du plus récent au plus ancien (operateDate desc)
  assert.deepEqual(dense.map((op) => op.recordNumber), [50, 2, 1]);
});

test('_denseOperationLog: départage les operateDate égaux par recordNumber desc', () => {
  const oplog = [];
  oplog[5] = { recordNumber: 5, operateDate: 20260101120000 };
  oplog[6] = { recordNumber: 6, operateDate: 20260101120000 };
  const dense = store._denseOperationLog(oplog);
  assert.deepEqual(dense.map((op) => op.recordNumber), [6, 5]);
});

test('_denseOperationLog: borne aux 300 opérations les plus récentes', () => {
  const oplog = [];
  for (let i = 1; i <= 500; i++) {
    oplog[i] = { recordNumber: i, operateDate: 20260101000000 + i };
  }
  const dense = store._denseOperationLog(oplog);
  assert.equal(dense.length, 300);
  // Les 300 plus récentes = recordNumbers 500..201
  assert.equal(dense[0].recordNumber, 500);
  assert.equal(dense[299].recordNumber, 201);
});

test('_reindexOperationLog: reconstruit un tableau creux indexé par recordNumber', () => {
  const entry = {
    address: 'AA:BB',
    operationLog: [
      { recordNumber: 50, operateDate: 3 },
      { recordNumber: 2, operateDate: 2 },
      { recordNumber: 1, operateDate: 1 }
    ]
  };
  const out = store._reindexOperationLog(entry);
  assert.equal(out.operationLog[1].recordNumber, 1);
  assert.equal(out.operationLog[2].recordNumber, 2);
  assert.equal(out.operationLog[50].recordNumber, 50);
  // Les trous restent vides (pas d'entrée réelle)
  assert.equal(out.operationLog[3], undefined);
  assert.equal(out.operationLog.length, 51);
  // L'entrée d'origine n'est pas mutée
  assert.equal(entry.operationLog.length, 3);
});

test('_reindexOperationLog: ignore les op sans recordNumber numérique', () => {
  const entry = {
    operationLog: [
      { recordNumber: 4, operateDate: 1 },
      { operateDate: 2 }, // pas de recordNumber
      { recordNumber: '7', operateDate: 3 }, // recordNumber non numérique
      null
    ]
  };
  const out = store._reindexOperationLog(entry);
  assert.equal(out.operationLog.filter(Boolean).length, 1);
  assert.equal(out.operationLog[4].operateDate, 1);
});

test('_reindexOperationLog: entrée sans operationLog renvoyée telle quelle', () => {
  const noLog = { address: 'AA:BB' };
  assert.equal(store._reindexOperationLog(noLog), noLog);
  assert.equal(store._reindexOperationLog(null), null);
  const notArray = { operationLog: 'nope' };
  assert.equal(store._reindexOperationLog(notArray), notArray);
});

test('intégration disque: round-trip creux-avec-null → dense (save) → creux (load) sans null', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ttlock-store-'));
  try {
    // Écrit un lockData.json "hérité" au format creux (avec null), tel que produit avant le fix.
    const legacy = [
      {
        address: 'E1:58:1B:3A:60:5E',
        privateData: { aesKey: 'deadbeef', admin: { adminPs: 1, unlockKey: 2 } },
        operationLog: (() => {
          const a = [];
          a[1] = { recordNumber: 1, operateDate: 20260101120000 };
          a[2] = { recordNumber: 2, operateDate: 20260101130000 };
          a[50] = { recordNumber: 50, operateDate: 20260102080000 };
          return a; // JSON.stringify -> trous deviennent null
        })()
      }
    ];
    await fs.writeFile(path.join(dir, 'lockData.json'), JSON.stringify(legacy));
    const rawLegacy = await fs.readFile(path.join(dir, 'lockData.json'), 'utf8');
    assert.equal(rawLegacy.includes('null'), true, 'le fichier hérité contient bien des null');

    store.setDataPath(dir);
    await store.loadData();

    // En mémoire : indexé par recordNumber (creux), les op sont à leur index recordNumber.
    const mem = store.getLockData()[0].operationLog;
    assert.equal(mem[1].recordNumber, 1);
    assert.equal(mem[2].recordNumber, 2);
    assert.equal(mem[50].recordNumber, 50);

    // Réécrit sur disque via le chemin de sauvegarde.
    await store.saveData();

    // Le fichier écrit est dense et ne contient plus aucun null.
    const rawSaved = await fs.readFile(path.join(dir, 'lockData.json'), 'utf8');
    const saved = JSON.parse(rawSaved);
    const savedOplog = saved[0].operationLog;
    assert.equal(savedOplog.some((op) => op === null), false, 'aucun null persisté');
    assert.equal(savedOplog.length, 3);
    // Toutes les opérations réelles sont conservées, triées récent→ancien.
    assert.deepEqual(savedOplog.map((op) => op.recordNumber), [50, 2, 1]);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
