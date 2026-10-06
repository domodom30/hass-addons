/**
 * Filtrage des clients par adresse IP source.
 *
 * L'add-on tourne en `host_network: true` : le port d'Ingress (55099) écoute donc sur
 * toutes les interfaces de l'hôte, LAN compris. Seul le proxy Ingress du Supervisor (et la
 * boucle locale, pour le développement) doit pouvoir l'atteindre — l'authentification
 * Home Assistant est faite par ce proxy, pas par l'add-on.
 *
 * Ce filtre doit couvrir LES DEUX chemins d'entrée du serveur HTTP : les requêtes Express
 * ET les upgrades WebSocket (`/api`), que le serveur `ws` traite directement sans passer
 * par les middlewares Express.
 *
 * Module pur (aucune dépendance) pour rester testable sans node_modules.
 */

/** Proxy Ingress du Supervisor (IPv4 et IPv4-mappée) + boucle locale. */
export const DEFAULT_ALLOWED_IPS = Object.freeze(['172.30.32.2', '::ffff:172.30.32.2', '::1', '::ffff:127.0.0.1']);

/**
 * @param {string|undefined} address adresse distante (req.ip / socket.remoteAddress)
 * @param {readonly string[]} [allowed]
 * @returns {boolean}
 */
export function isAllowedAddress(address, allowed = DEFAULT_ALLOWED_IPS) {
  return typeof address === 'string' && allowed.includes(address);
}

/**
 * Hook `verifyClient` (forme asynchrone) pour `new WebSocket.Server(...)` : refuse
 * l'upgrade avec un 403 si l'adresse source n'est pas autorisée.
 * @param {readonly string[]} [allowed]
 * @returns {(info: {req: import('node:http').IncomingMessage}, cb: (ok: boolean, code?: number, message?: string) => void) => void}
 */
export function createWsVerifyClient(allowed = DEFAULT_ALLOWED_IPS) {
  return (info, cb) => {
    const address = info?.req?.socket?.remoteAddress;
    if (isAllowedAddress(address, allowed)) {
      cb(true);
      return;
    }
    console.warn('WebSocket connection refused from', address);
    cb(false, 403, 'Denied');
  };
}
