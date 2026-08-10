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
 */

/** Sondes vides consécutives avant d'admettre qu'il n'y a plus rien à lire. */
export const PROBE_MAX_CONSECUTIVE_EMPTY = 5;

/** Budget global de la sonde : la session BLE d'une serrure TTLock est courte. */
export const PROBE_BUDGET_MS = 20 * 1000;

/**
 * Plus grand recordNumber présent dans le cache oplog du SDK (tableau creux indexé par
 * recordNumber). Parcours explicite plutôt que Math.max(...spread) : le journal peut
 * compter des milliers d'entrées, au-delà de la limite d'arguments du spread.
 * @param {any} lock
 * @returns {number} 0 si le cache est vide ou absent
 */
export function maxRecordNumber(lock) {
  if (!lock || !Array.isArray(lock.operationLog)) return 0;
  for (let i = lock.operationLog.length - 1; i >= 0; i--) {
    const entry = lock.operationLog[i];
    if (entry && typeof entry.recordNumber === 'number') return entry.recordNumber;
  }
  return 0;
}

/**
 * Sonde les enregistrements AJOUTÉS depuis la dernière lecture, au-delà du dernier
 * recordNumber connu. Le flux « new events » 0xffff du firmware ne les renvoie pas
 * (cf. SDK TTLock.js) : seule une sonde séquentielle au-delà du max les fait apparaître.
 *
 * Reprend la sémantique du probe interne du SDK — wrap-around inclus : passé la fin du
 * journal, le firmware réémet un vieil enregistrement, compté comme « vide » pour que la
 * sonde puisse terminer — mais avec des bornes adaptées au chemin automatique :
 * 5 sondes vides consécutives au lieu de 20, plus un budget temps global.
 *
 * Écrit directement dans `lock.operationLog` (couplage interne au SDK, comme
 * `lock.adminAuth` / `lock.newEvents` ailleurs) puis émet `dataUpdated` une seule fois
 * pour déclencher la persistance via TTLockClient → manager._onUpdatedLockData.
 * @param {any} lock
 * @param {number} maxKnown dernier recordNumber connu avant la sonde
 * @returns {Promise<number>} nombre d'enregistrements ajoutés
 */
export async function probeAppendedOperations(lock, maxKnown) {
  // Feature-detect : une évolution de la forme du SDK dégrade en « pas de sonde »
  // (le flux 0xffff continue d'alimenter le journal) plutôt qu'en crash.
  if (typeof lock.probeOperationLog !== 'function' || !Array.isArray(lock.operationLog)) return 0;
  const deadline = Date.now() + PROBE_BUDGET_MS;
  let sequence = maxKnown + 1;
  let consecutiveEmpty = 0;
  let added = 0;
  while (consecutiveEmpty < PROBE_MAX_CONSECUTIVE_EMPTY) {
    // _oplogAbandoned : posé par le timeout de _processOperationLog pour couper le
    // trafic BLE avant que le mutex ne soit relâché (pas de lecture orpheline).
    if (lock._oplogAbandoned || !lock.isConnected() || Date.now() >= deadline) break;
    let producedNewRecord = false;
    try {
      const response = await lock.probeOperationLog(sequence);
      // null = session perdue ou admin login échoué : inutile d'insister.
      if (response === null) break;
      for (const entry of response.data || []) {
        if (entry && typeof entry.recordNumber === 'number' && entry.recordNumber > maxKnown) {
          lock.operationLog[entry.recordNumber] = entry;
          producedNewRecord = true;
          added++;
        }
      }
    } catch (error) {
      // Erreur BLE transitoire : traitée comme une sonde vide, la boucle décidera
      // d'arrêter via consecutiveEmpty / isConnected().
    }
    consecutiveEmpty = producedNewRecord ? 0 : consecutiveEmpty + 1;
    sequence++;
  }
  if (added > 0 && typeof lock.emit === 'function') {
    lock.emit('dataUpdated', lock);
  }
  return added;
}

/**
 * Flux 0xffff puis sonde des enregistrements ajoutés.
 * @param {any} lock
 * @returns {Promise<{adminOk: boolean, operations: Array}>}
 */
export async function readOperationLogIncremental(lock) {
  // all=false : uniquement le flux 0xffff, qui rafraîchit lock.operationLog.
  await lock.getOperationLog(false, false);
  // adminAuth est relevé ICI, tant que la session est vivante. Le tester seulement à la
  // fin produisait un faux négatif systématique : la serrure se self-déconnecte souvent
  // juste après la dernière commande, et onDisconnected remet adminAuth à false même
  // quand la lecture a parfaitement abouti.
  const adminOk = lock.adminAuth === true;
  if (adminOk) {
    await probeAppendedOperations(lock, maxRecordNumber(lock));
  }
  const operations = Array.isArray(lock.operationLog) ? lock.operationLog.filter(Boolean) : [];
  return { adminOk, operations };
}
