import type { EncryptedPayload } from "../../domain/entities";

const deriveKey = async (
  password: string,
  salt: Uint8Array,
): Promise<CryptoKey> => {
  const enc = new TextEncoder().encode(password);
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc,
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as unknown as BufferSource,
      iterations: 600_000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
};

export const encryptData = async (plaintext: string): Promise<EncryptedPayload> => {
  const password = crypto.randomUUID();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);

  const encoded = new TextEncoder().encode(plaintext);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource, tagLength: 128 },
    key,
    encoded,
  );

  const ciphertext = new Uint8Array(encrypted.slice(0, encrypted.byteLength - 16));
  const authTag = new Uint8Array(encrypted.slice(encrypted.byteLength - 16));

  return { ciphertext, iv, authTag, salt, password };
};

const convertIndexedJSONToUint8Array = (obj: Record<string, number>): Uint8Array => {
  const arr = new Uint8Array(Object.keys(obj).length);
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key) && !isNaN(Number(key))) {
      arr[parseInt(key)] = obj[key]!;
    }
  }
  return arr;
};

export const decryptData = async (
  payload: EncryptedPayload,
  password: string,
): Promise<string> => {
  const ciphertext = convertIndexedJSONToUint8Array(
    payload.ciphertext as unknown as Record<string, number>,
  );
  const iv = convertIndexedJSONToUint8Array(
    payload.iv as unknown as Record<string, number>,
  );
  const authTag = convertIndexedJSONToUint8Array(
    payload.authTag as unknown as Record<string, number>,
  );
  const salt = convertIndexedJSONToUint8Array(
    payload.salt as unknown as Record<string, number>,
  );

  const key = await deriveKey(password, salt);
  const combined = new Uint8Array(ciphertext.length + authTag.length);
  combined.set(ciphertext, 0);
  combined.set(authTag, ciphertext.length);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource, tagLength: 128 },
    key,
    combined as unknown as BufferSource,
  );

  return new TextDecoder().decode(decrypted);
};

export const getHash = async (input: string): Promise<string> => {
  const encoded = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", encoded);
  const hex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex;
};
