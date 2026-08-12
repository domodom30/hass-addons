/**
 * Lecture incrémentale du journal opérationnel d'une serrure TTLock.
 *
 * Module volontairement sans dépendance au SDK (il ne fait qu'appeler des méthodes de
 * l'objet `lock` qu'on lui passe) : le binding BLE natif ne se charge pas partout, et
 * cette logique doit rester testable avec une serrure factice.
 *
 * Pourquoi ne pas simplement appeler `lock.getOperationLog(true, …)` :
 * son mode « all » rejoue, à chaque cycle, un backfill de TOUTES les séquences absentes
 * du cache entre 0 et maxRecordNumber. Comme le journal persisté est volontairement borné
 * (Store.MAX_OPLOG), ces « trous » se comptent en milliers et ne se comblent jamais
 * (journal firmware circulaire). La lecture dépassait alors tout budget raisonnable, la
 * serrure se déconnectait, et la boucle de backfill du SDK — non gardée par isConnected() —
 * continuait à tourner en arrière-plan puis entrait en collision avec la session suivante
 * (« Command already in progress » → macro_adminLogin en échec → adminAuth absent),
 * verrouillant l'addon dans une boucle d'échecs permanente.
 *
 * Le rattrapage complet des trous anciens reste disponible via le rafraîchissement manuel
 * de l'UI (manager.getOperationLog, budget 120 s).
 *
 * Journal CIRCULAIRE — pourquoi la sonde s'ancre sur la date et non sur l'index :
 * le firmware borne son journal (plafond observé ≈ 4998 sur R6) puis réécrit sur des index
 * bas. Une sonde partant de `max(recordNumber) + 1` interroge alors des séquences situées
 * au-delà de la fin de l'anneau et ne revient jamais sur la zone réellement écrite :
 * l'addon devient définitivement aveugle aux nouvelles opérations. L'ancre correcte est la
 * TÊTE D'ÉCRITURE — l'enregistrement de `operateDate` le plus récent — et le critère de
 * nouveauté est la date, seule grandeur monotone du journal.
 */

import { latestOperation, isNewerOperation } from './mqttTopics.js';

/** Sondes vides consécutives avant d'admettre qu'il n'y a plus rien à lire. */
export const PROBE_MAX_CONSECUTIVE_EMPTY = 5;

/** Budget global de la sonde : la session BLE d'une serrure TTLock est courte. */
export const PROBE_BUDGET_MS = 20 * 1000;

/**
 * Tête d'écriture du firmware telle que la reflète le cache : l'enregistrement de
 * `operateDate` la plus récente (départage par recordNumber desc). C'est l'ancre de la
 * sonde et le point de référence de la nouveauté — contrairement au plus grand
 * recordNumber, elle reste correcte après un tour du journal circulaire.
 * Réutilise l'ordre de tri unique du projet (mqttTopics.latestOperation), le même que
 * store._denseOperationLog et le frontend.
 * @param {any} lock
 * @returns {object|null} null si le cache est vide ou absent
 */
export function newestRecord(lock) {
  if (!lock || !Array.isArray(lock.operationLog)) return null;
  return latestOperation(lock.operationLog);
}

/**
 * Sonde les enregistrements AJOUTÉS depuis la dernière lecture, à partir de la séquence
 * suivant la tête d'écriture. Le flux « new events » 0xffff du firmware ne les renvoie pas
 * (cf. SDK TTLock.js) : seule une sonde séquentielle les fait apparaître.
 *
 * Reprend la sémantique du probe interne du SDK — wrap-around inclus : passé la fin du
 * journal, le firmware réémet un vieil enregistrement, compté comme « vide » pour que la
 * sonde puisse terminer — mais avec des bornes adaptées au chemin automatique :
 * 5 sondes vides consécutives au lieu de 20, plus un budget temps global.
 *
 * Deux différences essentielles avec le probe du SDK :
 *  - la nouveauté se juge sur `operateDate`, pas sur `recordNumber` (journal circulaire) ;
 *  - la tête avance à chaque trouvaille, de sorte que la sonde suit l'écriture séquentielle
 *    du firmware même quand celle-ci est repartie sur des index bas.
 *
 * Bouclage : quand le firmware répond avec un pointeur de séquence EN ARRIÈRE (typiquement
 * l'enregistrement d'init, nextSeq=2), c'est son signal de fin d'anneau — on le suit une
 * seule fois par lecture, ce qui permet de retrouver la zone réécrite sans jamais boucler.
 *
 * Écrit directement dans `lock.operationLog` (couplage interne au SDK, comme
 * `lock.adminAuth` / `lock.newEvents` ailleurs) puis émet `dataUpdated` une seule fois
 * pour déclencher la persistance via TTLockClient → manager._onUpdatedLockData.
 * @param {any} lock
 * @param {object|null} head tête d'écriture connue avant la sonde (cf. newestRecord)
 * @returns {Promise<number>} nombre d'enregistrements ajoutés
 */
export async function probeAppendedOperations(lock, head) {
  // Feature-detect : une évolution de la forme du SDK dégrade en « pas de sonde »
  // (le flux 0xffff continue d'alimenter le journal) plutôt qu'en crash.
  if (typeof lock.probeOperationLog !== 'function' || !Array.isArray(lock.operationLog)) return 0;
  // Cache froid : aucune tête connue, tout est nouveau.
  let cursor = head || { recordNumber: 0, operateDate: 0 };
  const deadline = Date.now() + PROBE_BUDGET_MS;
  let sequence = (cursor.recordNumber || 0) + 1;
  let consecutiveEmpty = 0;
  let wrapped = false;
  let added = 0;
  while (consecutiveEmpty < PROBE_MAX_CONSECUTIVE_EMPTY) {
    // _oplogAbandoned : posé par le timeout de _processOperationLog pour couper le
    // trafic BLE avant que le mutex ne soit relâché (pas de lecture orpheline).
    if (lock._oplogAbandoned || !lock.isConnected() || Date.now() >= deadline) break;
    let producedNewRecord = false;
    let nextSequence = null;
    try {
      const response = await lock.probeOperationLog(sequence);
      // null = session perdue ou admin login échoué : inutile d'insister.
      if (response === null) break;
      nextSequence = response.sequence;
      for (const entry of response.data || []) {
        if (entry && typeof entry.recordNumber === 'number' && isNewerOperation(entry, cursor)) {
          lock.operationLog[entry.recordNumber] = entry;
          cursor = entry; // la tête suit l'écriture du firmware
          producedNewRecord = true;
          added++;
        }
      }
    } catch (error) {
      // Erreur BLE transitoire : traitée comme une sonde vide, la boucle décidera
      // d'arrêter via consecutiveEmpty / isConnected().
    }
    consecutiveEmpty = producedNewRecord ? 0 : consecutiveEmpty + 1;
    if (!producedNewRecord && !wrapped && typeof nextSequence === 'number'
      && nextSequence > 0 && nextSequence < sequence) {
      // Fin d'anneau signalée par le firmware : reprendre où il pointe, une seule fois.
      wrapped = true;
      sequence = nextSequence;
    } else {
      sequence++;
    }
  }
  if (added > 0 && typeof lock.emit === 'function') {
    lock.emit('dataUpdated', lock);
  }
  return added;
}

/**
 * Décide quelles opérations d'une lecture sont réellement nouvelles, et où replacer les
 * seuils de déduplication. Fonction pure : c'est le cœur du correctif « journal
 * circulaire », il doit être vérifiable sans BLE ni SDK.
 *
 * Deux resynchronisations sont possibles, toutes deux signalées par `resynced` :
 *  - AMORÇAGE : montée depuis une version qui ne mémorisait que le recordNumber
 *    (`lastDate === 0` alors qu'un seuil numérique existe) — on adopte la date de la tête
 *    au lieu de considérer tout le cache comme neuf ;
 *  - RÉALIGNEMENT : la tête d'écriture est passée SOUS le seuil numérique, c'est-à-dire
 *    que le firmware a bouclé son journal (ou a été remis à zéro) — le seuil numérique
 *    suit la tête, la date reste le juge.
 *
 * `resynced` sert à publier le rattrapage sur les capteurs SANS émettre d'évènements :
 * rejouer des heures d'opérations déclencherait rétroactivement les automations HA.
 *
 * @param {Array} operations journal complet en cache après lecture
 * @param {object|null} head tête d'écriture connue AVANT la sonde (cf. newestRecord)
 * @param {{lastRecord?: number, lastDate?: number}} state seuils persistés
 * @returns {{newOps: Array, lastRecord: number, lastDate: number, resynced: boolean}}
 *   `lastRecord`/`lastDate` sont les seuils à persister, nouveautés ou non.
 */
export function selectNewOperations(operations, head, state = {}) {
  let threshold = state.lastRecord || 0;
  let lastDate = state.lastDate || 0;
  let resynced = false;
  if (head) {
    if (lastDate === 0 && threshold > 0) {
      lastDate = head.operateDate || 0;
      resynced = true;
    }
    if (head.recordNumber < threshold && (head.operateDate || 0) >= lastDate) {
      threshold = head.recordNumber;
      resynced = true;
    }
  }
  const newOps = (operations || []).filter((op) => {
    if (!op) return false;
    const date = op.operateDate || 0;
    if (date !== lastDate) return date > lastDate;
    return (op.recordNumber || 0) > threshold;
  });
  const newHead = latestOperation(newOps);
  return {
    newOps,
    lastRecord: newHead ? newHead.recordNumber : threshold,
    lastDate: newHead ? (newHead.operateDate || 0) : lastDate,
    resynced
  };
}

/**
 * Flux 0xffff puis sonde des enregistrements ajoutés.
 * @param {any} lock
 * @returns {Promise<{adminOk: boolean, operations: Array, head: object|null}>}
 *   `head` = tête d'écriture AVANT la sonde. Le manager en a besoin pour distinguer
 *   ce qui vient d'être découvert de ce qu'il connaissait déjà.
 */
export async function readOperationLogIncremental(lock) {
  // all=false : uniquement le flux 0xffff, qui rafraîchit lock.operationLog.
  await lock.getOperationLog(false, false);
  // adminAuth est relevé ICI, tant que la session est vivante. Le tester seulement à la
  // fin produisait un faux négatif systématique : la serrure se self-déconnecte souvent
  // juste après la dernière commande, et onDisconnected remet adminAuth à false même
  // quand la lecture a parfaitement abouti.
  const adminOk = lock.adminAuth === true;
  const head = newestRecord(lock);
  if (adminOk) {
    await probeAppendedOperations(lock, head);
  }
  const operations = Array.isArray(lock.operationLog) ? lock.operationLog.filter(Boolean) : [];
  return { adminOk, operations, head };
}
