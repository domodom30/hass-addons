/**
 * Détection d'un monitor BLE « mort mais déclaré vivant ».
 *
 * Tout l'édifice de reprise du scan repose sur l'état que le scanner rapporte sur
 * lui-même : `TTLockClient.isMonitoring()`, la garde d'idempotence de `startMonitor()` et
 * le `_ensureMonitoring()` du manager s'y fient tous. Si un transport meurt sans le
 * signaler, cet état ment de façon cohérente et plus rien ne peut réparer — la radio
 * n'écoute plus, l'addon la croit active, et le watchdog de disponibilité finit par
 * publier toutes les serrures en `offline` alors qu'elles sont à portée.
 *
 * Le seul signal qui ne peut pas mentir est la réception effective de publicités BLE.
 * Une serrure TTLock émet toutes les quelques secondes : un silence prolongé alors qu'on
 * se croit en écoute est la signature d'un état périmé, quelle qu'en soit la cause.
 *
 * Module volontairement sans dépendance au SDK (fonction pure) : `manager.js` n'est pas
 * importable en test à cause du binding noble natif — même découpage que `oplog.js`.
 */

/** Silence toléré avant de conclure que l'état ment. */
export const MONITOR_SILENCE_MS = 3 * 60 * 1000;

/**
 * Délai minimum entre deux reprises forcées : quand les serrures sont réellement hors de
 * portée, le silence est légitime et se prolonge indéfiniment.
 *
 * 90 s et non 5 min : le cooldown protège du cas « silence légitime », mais il s'appliquait
 * aussi au cas « la reprise n'a rien réparé ». Une reprise inefficace gelait alors l'état des
 * serrures pendant 5 minutes de plus, sans que rien ne le signale — observé en production
 * sous la forme de trous de plus de 15 minutes, dont seul un redémarrage de l'add-on sortait.
 * L'escalade (cf. _verifyMonitorRecovery dans manager.js) traite la reprise inefficace ;
 * ce délai n'a plus qu'à espacer les tentatives.
 */
export const MONITOR_RECOVERY_COOLDOWN_MS = 90 * 1000;

/**
 * @param {object} params
 * @param {boolean} params.monitoring état déclaré par le SDK (`client.isMonitoring()`)
 * @param {Iterable<number>} params.lastSeen horodatages du dernier contact BLE par serrure
 * @param {number} params.now
 * @param {number} [params.lastRecoveryAt] horodatage de la dernière reprise forcée
 * @param {number} [params.silenceMs]
 * @param {number} [params.cooldownMs]
 * @returns {boolean} true s'il faut forcer un cycle stop/start du monitor
 */
export function shouldForceMonitorRecovery({
  monitoring,
  lastSeen,
  now,
  lastRecoveryAt = 0,
  silenceMs = MONITOR_SILENCE_MS,
  cooldownMs = MONITOR_RECOVERY_COOLDOWN_MS
}) {
  // Monitor déclaré inactif : le chemin de reprise normal s'en charge, rien à forcer.
  if (!monitoring) return false;
  if (lastRecoveryAt && now - lastRecoveryAt < cooldownMs) return false;
  // Aucune serrure connue, ou aucune jamais vue : pas de signal attendu, donc le silence
  // ne prouve rien.
  let sawTimestamp = false;
  let mostRecent = 0;
  for (const timestamp of lastSeen) {
    if (typeof timestamp !== 'number') continue;
    sawTimestamp = true;
    if (timestamp > mostRecent) mostRecent = timestamp;
  }
  if (!sawTimestamp) return false;
  return now - mostRecent > silenceMs;
}
