// Données fictives pour le développement de l'UI sans backend.
//
// Activées uniquement quand `import.meta.env.DEV && import.meta.env.VITE_MOCK`
// (voir l'action `init` de src/store/index.js). Le bloc appelant — et donc cet
// import dynamique — est éliminé du bundle de production par tree-shaking.
//
// Injecté via les mutations existantes du store (`setLocks`, `setOperations`) :
// aucune mutation dédiée. Si le vrai backend se connecte ensuite, son message
// `status` appelle `setLocks` et remplace ces serrures fictives.

import moment from "moment";

const ADDR_ENTRANCE = "AA:BB:CC:DD:EE:01";
const ADDR_GARAGE = "AA:BB:CC:DD:EE:02";

export const mockLocks = [
  {
    address: ADDR_ENTRANCE,
    name: "Porte d'entrée",
    paired: true,
    locked: 0, // verrouillée
    battery: 87,
    rssi: -62,
    hasAutoLock: true,
    autoLockTime: 10,
    hasAudio: true,
    audio: true,
  },
  {
    address: ADDR_GARAGE,
    name: "Garage",
    paired: true,
    locked: 1, // déverrouillée
    battery: 18, // faible → chip error + auto-load des opérations
    rssi: -82,
    hasAutoLock: true,
    autoLockTime: 0, // auto-lock désactivé
    hasAudio: true,
    audio: false,
  },
  {
    address: "AA:BB:CC:DD:EE:03",
    name: "Serrure détectée",
    paired: false, // teste l'état « appairer » (pas de logs)
    locked: -1,
    battery: -1,
    rssi: -74,
  },
];

// Construit un horodatage `YYYYMMDDHHmmss` situé `minutesAgo` minutes avant maintenant.
function ago(minutesAgo) {
  return moment().subtract(minutesAgo, "minutes").format("YYYYMMDDHHmmss");
}

// Fabrique un jeu d'opérations couvrant tous les `recordTypeCategory` consommés
// par LockLogsDialog.lines et Home.lastFiveActions, y compris un type inconnu
// (→ rendu « other ») et des entrées avec credential.
function buildOperations(startRecord) {
  let n = startRecord;
  return [
    { operateDate: ago(2), recordNumber: n++, recordTypeCategory: "UNLOCK", recordTypeName: "Déverrouillage via application" },
    { operateDate: ago(18), recordNumber: n++, recordTypeCategory: "UNLOCK", recordTypeName: "Déverrouillage par code", passwordName: "Code Ménage", password: "1234" },
    { operateDate: ago(45), recordNumber: n++, recordTypeCategory: "LOCK", recordTypeName: "Verrouillage via application" },
    { operateDate: ago(90), recordNumber: n++, recordTypeCategory: "UNLOCK", recordTypeName: "Déverrouillage par badge", passwordName: "Badge Livreur" },
    { operateDate: ago(140), recordNumber: n++, recordTypeCategory: "FAILED", recordTypeName: "Code incorrect", password: "0000" },
    { operateDate: ago(220), recordNumber: n++, recordTypeCategory: "LOCK", recordTypeName: "Verrouillage automatique" },
    { operateDate: ago(360), recordNumber: n++, recordTypeCategory: "ALARM", recordTypeName: "Alarme d'effraction" },
    { operateDate: ago(500), recordNumber: n++, recordTypeCategory: "SYSTEM", recordTypeName: "Horloge synchronisée" },
    { operateDate: ago(640), recordNumber: n++, recordTypeCategory: "UNLOCK", recordTypeName: "Déverrouillage par empreinte", passwordName: "Empreinte Papa" },
  ];
}

export const mockOperations = {
  [ADDR_ENTRANCE]: buildOperations(1000),
  [ADDR_GARAGE]: buildOperations(2000),
};

export function installMockData(store) {
  store.commit("setLocks", mockLocks);
  for (const address of Object.keys(mockOperations)) {
    store.commit("setOperations", { address, operations: mockOperations[address] });
  }
}
