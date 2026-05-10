export function normalizePhone(phone: string): string {
  // Boşluk, tire, parantez, artı işaretlerini temizle
  let cleaned = phone.replace(/[\s\-\(\)\+]/g, "");

  // Sadece rakam kalsın
  cleaned = cleaned.replace(/\D/g, "");

  // Türkiye numaraları için: 05xx → 905xx
  if (cleaned.startsWith("05") && cleaned.length === 11) {
    cleaned = "9" + cleaned;
  }

  // 0'la başlayan yerel formatlar
  if (cleaned.startsWith("0") && cleaned.length === 11) {
    cleaned = cleaned.slice(1);
  }

  return cleaned;
}

export function toJid(phone: string): string {
  const normalized = normalizePhone(phone);
  return `${normalized}@s.whatsapp.net`;
}

export function fromJid(jid: string): string {
  return jid.split("@")[0];
}

export function isValidPhone(phone: string): boolean {
  const normalized = normalizePhone(phone);
  // E.164 format: 7-15 rakam
  return /^\d{7,15}$/.test(normalized);
}
