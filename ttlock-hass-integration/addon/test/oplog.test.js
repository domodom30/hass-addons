import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  newestRecord,
  probeAppendedOperations,
  readOperationLogIncremental,
  selectNewOperations,
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
  assert.equal(await probeAppendedOperations(lock, op(10)), 0);
});

// --- Journal circulaire ---------------------------------------------------------------
// Le firmware borne son journal (plafond ≈ 4998 sur R6) puis réécrit sur des index bas.
// La tête d'écriture est alors un recordNumber PETIT portant la date la PLUS récente,
// tandis que les index hauts conservent des enregistrements périmés.

/** Enregistrement daté explicitement, pour construire un anneau ayant fait un tour. */
const dated = (recordNumber, operateDate, recordType = 7) => ({ recordNumber, recordType, operateDate });

test('newestRecord: la tête est la date la plus récente, pas le plus grand index', () => {
  const lock = makeLock({
    records: [
      dated(4997, 20260710120000), // pré-wrap : index haut, date ancienne
      dated(369, 20260810090716),  // post-wrap : index bas, date récente
      dated(365, 20260808194406)
    ]
  });
  // L'index maximum du cache est 4997 (pré-wrap) : c'est précisément ce qu'il ne faut
  // PAS prendre comme ancre.
  assert.equal(newestRecord(lock).recordNumber, 369);
  assert.equal(newestRecord({ operationLog: [] }), null);
  assert.equal(newestRecord(null), null);
});

test('wrap: la sonde repart de la tête d\'écriture et capte les opérations réécrites', async () => {
  // Reproduit le blocage terrain : seuil bloqué sur #4997, opérations réelles écrites
  // en #370+. Une sonde ancrée sur maxRecordNumber interrogerait 4998, 4999… à vide.
  const lock = makeLock({
    records: [dated(4997, 20260710120000), dated(369, 20260810090716)],
    appended: [dated(370, 20260810150356, 17), dated(371, 20260810150408, 30)]
  });

  const result = await readOperationLogIncremental(lock);

  assert.equal(result.head.recordNumber, 369, 'la tête retournée est celle d\'AVANT la sonde');
  assert.equal(Math.min(...lock.reads), 370, 'la sonde démarre juste après la tête');
  assert.equal(lock.operationLog[370].operateDate, 20260810150356);
  assert.equal(lock.operationLog[371].operateDate, 20260810150408);
  assert.ok(lock.emitted.includes('dataUpdated'));
});

test('wrap: un enregistrement périmé au-delà de la tête compte comme une sonde vide', async () => {
  // #370 existe toujours dans l'anneau mais date d'avant le tour : il ne doit ni être
  // retenu comme nouveau, ni faire avancer la tête.
  const lock = makeLock({
    records: [dated(4997, 20260710120000), dated(369, 20260810090716)],
    appended: [dated(370, 20260709080000)] // périmé
  });

  await readOperationLogIncremental(lock);

  assert.equal(lock.reads.length, PROBE_MAX_CONSECUTIVE_EMPTY);
  assert.equal(lock.operationLog[370], undefined, 'un enregistrement périmé n\'entre pas au cache');
  assert.ok(!lock.emitted.includes('dataUpdated'));
});

test('wrap: le pointeur de séquence en arrière du firmware est suivi une seule fois', async () => {
  // Fin d'anneau : le firmware réémet l'enregistrement d'init avec nextSeq=2. On reprend
  // là où il pointe pour retrouver la zone réécrite, sans jamais boucler.
  const lock = makeLock({ records: [dated(4997, 20260710120000)] });
  const fresh = dated(3, 20260810150356, 17);
  lock.probeOperationLog = async (sequence) => {
    lock.reads.push(sequence);
    if (sequence === 4998) return { sequence: 2, data: [dated(1, 20260101000000)] };
    if (sequence === 3) return { sequence: 4, data: [fresh] };
    return { sequence: sequence + 1, data: [] };
  };

  await readOperationLogIncremental(lock);

  assert.deepEqual(lock.reads.slice(0, 3), [4998, 2, 3], 'reprise sur le pointeur firmware');
  assert.equal(lock.operationLog[3].operateDate, 20260810150356);
  // Une seule reprise : la suite est strictement séquentielle jusqu'à épuisement.
  assert.deepEqual(lock.reads.slice(3), [4, 5, 6, 7, 8]);
});

// --- selectNewOperations --------------------------------------------------------------

test('selectNewOperations: nouveauté jugée sur la date, recordNumber en départage', () => {
  const operations = [
    dated(365, 20260808194406),
    dated(369, 20260810090716),
    dated(370, 20260810150356, 17)
  ];
  const result = selectNewOperations(operations, dated(369, 20260810090716), {
    lastRecord: 369,
    lastDate: 20260810090716
  });
  assert.deepEqual(result.newOps.map((o) => o.recordNumber), [370]);
  assert.equal(result.lastRecord, 370);
  assert.equal(result.lastDate, 20260810150356);
  assert.equal(result.resynced, false);
});

test('selectNewOperations: à date égale, seul un recordNumber supérieur est neuf', () => {
  const operations = [dated(10, 20260810150356), dated(11, 20260810150356)];
  const result = selectNewOperations(operations, dated(10, 20260810150356), {
    lastRecord: 10,
    lastDate: 20260810150356
  });
  assert.deepEqual(result.newOps.map((o) => o.recordNumber), [11]);
});

test('selectNewOperations: seuil numérique bloqué en fin d\'anneau — réalignement', () => {
  // Situation terrain : seuil figé sur #4997 alors que la tête est retombée sur #369.
  // Sans réalignement, l'opération #370 de 15:03 resterait invisible à vie.
  const operations = [
    dated(369, 20260810090716),
    dated(370, 20260810150356, 17),
    dated(4997, 20260710120000)
  ];
  const result = selectNewOperations(operations, dated(369, 20260810090716), {
    lastRecord: 4997,
    lastDate: 20260810090716
  });
  assert.equal(result.resynced, true, 'le rattrapage doit être silencieux');
  assert.deepEqual(result.newOps.map((o) => o.recordNumber), [370]);
  assert.equal(result.lastRecord, 370);
  assert.equal(result.lastDate, 20260810150356);
});

test('selectNewOperations: amorçage depuis un seuil hérité purement numérique', () => {
  // Montée de version : lastDate absent, seul lastRecord existe. Le cache entier ne doit
  // pas être considéré comme neuf — la date de la tête sert de point de départ.
  const operations = [
    dated(365, 20260808194406),
    dated(369, 20260810090716),
    dated(4997, 20260710120000)
  ];
  const result = selectNewOperations(operations, dated(369, 20260810090716), { lastRecord: 4997 });
  assert.equal(result.resynced, true);
  assert.deepEqual(result.newOps, []);
  assert.equal(result.lastRecord, 369, 'le seuil numérique suit la tête');
  assert.equal(result.lastDate, 20260810090716);
});

test('selectNewOperations: sans réalignement, les seuils sont conservés tels quels', () => {
  const operations = [dated(369, 20260810090716)];
  const result = selectNewOperations(operations, dated(369, 20260810090716), {
    lastRecord: 369,
    lastDate: 20260810090716
  });
  assert.deepEqual(result.newOps, []);
  assert.equal(result.lastRecord, 369);
  assert.equal(result.lastDate, 20260810090716);
  assert.equal(result.resynced, false);
});

test('selectNewOperations: un backfill d\'enregistrements anciens n\'est jamais « neuf »', () => {
  // Les index hauts rapatriés par la sonde/backfill portent des dates antérieures :
  // les émettre déclencherait des milliers d'évènements HA périmés.
  const operations = [dated(369, 20260810090716), dated(4500, 20260601080000)];
  const result = selectNewOperations(operations, dated(369, 20260810090716), {
    lastRecord: 369,
    lastDate: 20260810090716
  });
  assert.deepEqual(result.newOps, []);
});

test('selectNewOperations: cache froid — tout est neuf', () => {
  const operations = [dated(1, 20260810090716), dated(2, 20260810150356)];
  const result = selectNewOperations(operations, null, {});
  assert.deepEqual(result.newOps.map((o) => o.recordNumber), [1, 2]);
  assert.equal(result.resynced, false);
  assert.equal(result.lastRecord, 2);
  assert.equal(result.lastDate, 20260810150356);
});
