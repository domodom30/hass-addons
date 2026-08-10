import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  maxRecordNumber,
  probeAppendedOperations,
  readOperationLogIncremental,
  PROBE_MAX_CONSECUTIVE_EMPTY
} from '../src/oplog.js';

/**
 * Serrure factice reproduisant la surface du SDK utilisée par la lecture incrémentale.
 * `operationLog` est un tableau CREUX indexé par recordNumber, comme dans le SDK.
 * `reads` journalise toutes les séquences réellement demandées : c'est ce qui permet de
 * vérifier qu'aucune lecture ne repart sous le dernier record connu — le backfill du SDK,
 * cause de la boucle d'échec corrigée ici.
 */
function makeLock(options = {}) {
  const {
    records = [],
    appended = [],
    adminOk = true,
    disconnectAfterProbes = Infinity,
    probeThrows = false
  } = options;
  const operationLog = [];
  for (const entry of records) operationLog[entry.recordNumber] = entry;
  const appendedByRecord = new Map(appended.map((entry) => [entry.recordNumber, entry]));

  const lock = {
    operationLog,
    adminAuth: false,
    connected: true,
    reads: [],
    emitted: [],
    getAddress: () => 'AA:BB:CC:DD:EE:FF',
    isConnected: () => lock.connected,
    emit: (event) => lock.emitted.push(event),
    async getOperationLog(all) {
      // Phase 0xffff du SDK : n'expose jamais les enregistrements ajoutés depuis la
      // dernière lecture — seule la sonde les fait apparaître.
      lock.allFlag = all;
      lock.adminAuth = adminOk;
      return operationLog.filter(Boolean);
    },
    async probeOperationLog(sequence) {
      lock.reads.push(sequence);
      if (probeThrows) throw new Error('BLE hiccup');
      if (lock.reads.length >= disconnectAfterProbes) lock.connected = false;
      const entry = appendedByRecord.get(sequence);
      return { sequence, data: entry ? [entry] : [] };
    }
  };
  return lock;
}

const op = (recordNumber, recordType = 7) => ({
  recordNumber,
  recordType,
  operateDate: 20260101120000 + recordNumber
});

test('maxRecordNumber: dernier recordNumber d\'un tableau creux', () => {
  assert.equal(maxRecordNumber(makeLock({ records: [op(3935), op(4298)] })), 4298);
  assert.equal(maxRecordNumber({ operationLog: [] }), 0);
  assert.equal(maxRecordNumber({}), 0);
  assert.equal(maxRecordNumber(null), 0);
});

test('aucune lecture ne repart sous le dernier record connu', async () => {
  // Cache borné (Store.MAX_OPLOG) : 3 entrées pour un maxRecordNumber de 4298, soit
  // ~4295 « trous ». Le mode all=true du SDK les relisait tous à chaque cycle.
  const lock = makeLock({ records: [op(4296), op(4297), op(4298)] });

  const result = await readOperationLogIncremental(lock);

  assert.equal(result.adminOk, true);
  assert.equal(lock.allFlag, false, 'le mode all=true (backfill) ne doit jamais être utilisé');
  assert.ok(lock.reads.length > 0, 'la sonde doit avoir lieu');
  assert.ok(Math.min(...lock.reads) > 4298, `aucune lecture <= 4298, vu ${Math.min(...lock.reads)}`);
});

test('la sonde s\'arrête après 5 séquences vides consécutives', async () => {
  const lock = makeLock({ records: [op(10)] });
  await readOperationLogIncremental(lock);
  assert.equal(lock.reads.length, PROBE_MAX_CONSECUTIVE_EMPTY);
  assert.deepEqual(lock.reads, [11, 12, 13, 14, 15]);
});

test('les enregistrements ajoutés sont captés et persistés', async () => {
  const lock = makeLock({ records: [op(10)], appended: [op(11), op(12)] });

  const result = await readOperationLogIncremental(lock);

  // La sonde repart à zéro à chaque trouvaille : 11 et 12 pleins, puis 13..17 vides.
  assert.deepEqual(lock.reads, [11, 12, 13, 14, 15, 16, 17]);
  assert.equal(lock.operationLog[12].recordNumber, 12);
  assert.deepEqual(result.operations.map((entry) => entry.recordNumber), [10, 11, 12]);
  assert.ok(lock.emitted.includes('dataUpdated'), 'la persistance doit être déclenchée');
});

test('wrap-around: un vieil enregistrement réémis compte comme une sonde vide', async () => {
  // Passé la fin du journal le firmware réémet un record ancien (recordNumber <= max) :
  // sans cette règle la sonde ne s'arrêterait jamais.
  const lock = makeLock({ records: [op(10)], appended: [] });
  lock.probeOperationLog = async (sequence) => {
    lock.reads.push(sequence);
    return { sequence, data: [op(1)] };
  };
  await readOperationLogIncremental(lock);
  assert.equal(lock.reads.length, PROBE_MAX_CONSECUTIVE_EMPTY);
  assert.equal(lock.operationLog.filter(Boolean).length, 1);
});

test('une déconnexion en cours de sonde l\'interrompt', async () => {
  const lock = makeLock({ records: [op(10)], disconnectAfterProbes: 2 });
  await readOperationLogIncremental(lock);
  assert.deepEqual(lock.reads, [11, 12]);
});

test('_oplogAbandoned coupe la sonde immédiatement', async () => {
  const lock = makeLock({ records: [op(10)] });
  lock._oplogAbandoned = true;
  await readOperationLogIncremental(lock);
  assert.deepEqual(lock.reads, []);
});

test('une erreur BLE transitoire est traitée comme une sonde vide', async () => {
  const lock = makeLock({ records: [op(10)], probeThrows: true });
  await readOperationLogIncremental(lock);
  assert.equal(lock.reads.length, PROBE_MAX_CONSECUTIVE_EMPTY);
  assert.ok(!lock.emitted.includes('dataUpdated'));
});

test('probeOperationLog null (session perdue) arrête la sonde', async () => {
  const lock = makeLock({ records: [op(10)] });
  lock.probeOperationLog = async (sequence) => {
    lock.reads.push(sequence);
    return null;
  };
  await readOperationLogIncremental(lock);
  assert.deepEqual(lock.reads, [11]);
});

test('échec du handshake admin: aucune sonde émise', async () => {
  const lock = makeLock({ records: [op(10)], adminOk: false });
  const result = await readOperationLogIncremental(lock);
  assert.equal(result.adminOk, false);
  assert.deepEqual(lock.reads, []);
});

test('SDK sans probeOperationLog: dégradation en « pas de sonde », pas de crash', async () => {
  const lock = makeLock({ records: [op(10)] });
  delete lock.probeOperationLog;
  assert.equal(await probeAppendedOperations(lock, 10), 0);
});
