import { callLink, internationalPhone, mailLink, whatsappLink } from './contact';

describe('contact links', () => {
  it('adds the Colombian prefix to mobile numbers', () => {
    expect(internationalPhone('300 123 4567')).toBe('573001234567');
    expect(internationalPhone('+57 300-123-4567')).toBe('573001234567');
    expect(internationalPhone('12')).toBeNull();
  });

  it('opens WhatsApp with the message already written', () => {
    expect(whatsappLink('3001234567', 'Hola, ¿cuándo entregamos?')).toBe(
      'https://wa.me/573001234567?text=Hola%2C%20%C2%BFcu%C3%A1ndo%20entregamos%3F',
    );
    expect(whatsappLink('', 'Hola')).toBeNull();
  });

  it('builds call and email links', () => {
    expect(callLink('3001234567')).toBe('tel:+573001234567');
    expect(mailLink('ana@demo.co', 'Lote', 'Hola Ana')).toBe(
      'mailto:ana@demo.co?subject=Lote&body=Hola%20Ana',
    );
  });
});
