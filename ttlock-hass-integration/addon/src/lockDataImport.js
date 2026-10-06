/**
 * Validation de l'import de configuration (lockData) depuis l'interface web.
 *
 * L'import remplace TOUT lockData.json, qui porte les clés des serrures (aesKey, adminPs,
 * unlockKey). Sans contrôle, un JSON valide mais inattendu (`{}`, une entrée sans adresse,
 * un doublon) pouvait effacer ou corrompre ces clés — irrécupérables sans ré-appairage.
 *
 * Retirer une serrure par l'import reste autorisé (c'est le seul moyen d'oublier une
 * serrure injoignable, que « Désappairer » ne peut pas réinitialiser en BLE) ; les
 * serrures retirées sont renvoyées pour être journalisées.
 *
 * Module pur (aucune dépendance) pour rester testable sans node_modules. Les messages
 * d'erreur ne citent jamais le contenu des entrées : ils remontent dans l'UI et les logs.
 */

const MAC_RE = /^[0-9A-F]{2}(?::[0-9A-F]{2}){5}$/i;

/**
 * Entrée porteuse d'identifiants complets (serrure appairée et utilisable).
 * Source unique, aussi utilisée par store.setLockData.
 * @param {any} entry
 * @returns {boolean}
 */
export function isPairedEntry(entry) {
  const pd = entry && entry.privateData;
  return !!(pd && pd.aesKey && pd.admin && pd.admin.adminPs && pd.admin.unlockKey);
}

/**
 * @param {any} data contenu JSON déjà parsé de l'import
 * @param {any[]} [current] lockData actuel (store.getLockData())
 * @returns {{ok: true, removed: string[]} | {ok: false, error: string}}
 *   removed : adresses des serrures appairées absentes de l'import
 */
export function validateLockDataImport(data, current = []) {
  if (!Array.isArray(data)) {
    return { ok: false, error: 'expected a JSON array of locks' };
  }
  const known = new Map();
  for (const entry of current) {
    if (entry && typeof entry.address === 'string') known.set(entry.address, entry);
  }
  const seen = new Set();
  for (const [index, entry] of data.entries()) {
    const label = `entry ${index + 1}`;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return { ok: false, error: `${label} is not an object` };
    }
    if (typeof entry.address !== 'string' || !MAC_RE.test(entry.address)) {
      return { ok: false, error: `${label} has an invalid or missing address` };
    }
    const key = entry.address.toUpperCase();
    if (seen.has(key)) {
      return { ok: false, error: `duplicate address ${entry.address}` };
    }
    seen.add(key);
    // Serrure déjà connue : store.setLockData conserve ses identifiants si l'entrée importée
    // est incomplète. Serrure nouvelle : rien ne pourrait les reconstituer, on refuse.
    if (!known.has(entry.address) && !isPairedEntry(entry)) {
      return {
        ok: false,
        error: `${entry.address}: missing lock credentials (privateData.aesKey, privateData.admin.adminPs, privateData.admin.unlockKey)`
      };
    }
  }
  const removed = [];
  for (const [address, entry] of known) {
    if (!seen.has(address.toUpperCase()) && isPairedEntry(entry)) removed.push(address);
  }
  return { ok: true, removed };
}
