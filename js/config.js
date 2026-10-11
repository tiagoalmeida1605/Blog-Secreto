// Cole o UID da ÚNICA conta proprietária criada no Firebase Authentication.
// O mesmo UID deve constar em v2/firestore.rules.
export const OWNER_UID = "COLE_UID_DO_PROPRIETARIO";
export const isOwnerUidConfigured = Boolean(OWNER_UID) && !OWNER_UID.startsWith("COLE_");
