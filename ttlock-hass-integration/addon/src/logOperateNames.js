/**
 * French names for TTLock operation records, keyed by recordType (LogOperate code).
 * Sole source of French labels — consumed by manager.js (recordTypeName sent to the
 * UI over WebSocket) and mqttTopics.js (recordTypeName published on MQTT).
 */

const FR_NAMES = {
  1: 'Déverrouillage Bluetooth / réseau',
  4: 'Déverrouillage par code',
  5: 'Code modifié',
  6: 'Code supprimé',
  7: 'Code incorrect',
  8: 'Tous les codes supprimés',
  9: 'Code remplacé (capacité maximale atteinte)',
  10: 'Déverrouillage par code à usage unique (efface les codes précédents)',
  11: 'Code expiré',
  12: 'Échec du déverrouillage : stockage insuffisant',
  13: 'Échec du déverrouillage : code sur liste noire',
  14: 'Redémarrage de la serrure (batterie reconnectée)',
  15: 'Carte IC ajoutée',
  16: 'Toutes les cartes IC supprimées',
  17: 'Déverrouillage par carte IC',
  18: 'Carte IC supprimée',
  19: 'Déverrouillage par bracelet',
  20: 'Déverrouillage par empreinte digitale',
  21: 'Empreinte digitale ajoutée',
  22: 'Échec du déverrouillage par empreinte digitale',
  23: 'Empreinte digitale supprimée',
  24: 'Toutes les empreintes digitales supprimées',
  25: 'Échec du déverrouillage par carte IC (expirée ou invalide)',
  26: 'Verrouillage Bluetooth / réseau',
  27: 'Déverrouillage par clé mécanique',
  28: 'Déverrouillage par passerelle',
  29: 'Tentative de forçage de la serrure',
  30: 'Porte fermée détectée',
  31: 'Porte ouverte détectée',
  32: 'Ouverture depuis l’intérieur',
  33: 'Verrouillage par empreinte digitale',
  34: 'Verrouillage par code',
  35: 'Verrouillage par carte IC',
  36: 'Verrouillage par clé mécanique',
  37: 'Déverrouillage par télécommande',
  38: 'Échec du déverrouillage par code : porte bloquée',
  39: 'Échec du déverrouillage par carte IC : porte bloquée',
  40: 'Échec du déverrouillage par empreinte digitale : porte bloquée',
  41: 'Échec du déverrouillage par application : porte bloquée',
  42: 'Alarme anti-sabotage',
  43: 'Alarme de batterie faible',
  44: 'Alarme : porte déverrouillée',
  45: 'Alarme : porte ouverte',
  46: 'Anomalie du capteur de porte',
  47: 'Clavier verrouillé (trop de tentatives incorrectes)',
  48: 'Bouton de réinitialisation pressé',
  55: 'Déverrouillage par porte-clés sans fil',
  56: 'Clavier sans fil (batterie)',
  92: 'Code administrateur modifié via le clavier',
  93: 'Code administrateur défini via le clavier (initialisation)',
};


/**
 * @param {number} recordType
 * @param {string} lang
 * @param {string[]} fallbackNames LogOperateNames array from the SDK (English)
 */
export function getRecordTypeName(recordType, lang, fallbackNames) {
  if (lang === 'fr' && FR_NAMES[recordType]) return FR_NAMES[recordType];
  return fallbackNames[recordType] ?? null;
}
