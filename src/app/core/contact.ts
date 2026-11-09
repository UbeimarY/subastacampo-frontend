/**
 * Links that open the phone's own apps to reach the other party of an auction.
 * Nothing is sent by SubastaCampo: the person decides when and how to write.
 */

/** Colombian mobile numbers have 10 digits and start with 3; WhatsApp needs the 57 prefix. */
export function internationalPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('3')) return `57${digits}`;
  if (digits.length === 12 && digits.startsWith('57')) return digits;
  return digits.length >= 7 ? digits : null;
}

export function whatsappLink(phone: string, message: string): string | null {
  const number = internationalPhone(phone);
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(message)}` : null;
}

export function callLink(phone: string): string | null {
  const number = internationalPhone(phone);
  return number ? `tel:+${number}` : null;
}

export function mailLink(email: string, subject: string, body: string): string {
  const query = `subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return `mailto:${email}?${query}`;
}
