import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';

import { AUCTION_CLIENT } from '../core/api/clients';
import { describeError } from '../core/api/errors';
import { SessionStore } from '../core/auth/session.store';
import { callLink, mailLink, whatsappLink } from '../core/contact';
import { formatCop } from '../core/format';
import { formatQuantity } from '../core/labels';
import type { Auction, GetAuctionContactResponse } from '../gen/subastacampo/v1/auction_pb';
import { UserRole } from '../gen/subastacampo/v1/common_pb';

/**
 * After the close, the producer and the winner see each other's contact details
 * to agree on payment and delivery. The server decides who may see them; this
 * card only asks, and shows the links that open WhatsApp, the phone or email.
 */
@Component({
  selector: 'app-contact-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './contact-card.html',
  styleUrl: './contact-card.scss',
})
export class ContactCard {
  private readonly auctions = inject(AUCTION_CLIENT);
  private readonly session = inject(SessionStore);

  readonly auction = input.required<Auction>();
  /** Compact version for lists. */
  readonly compact = input(false);

  protected readonly response = signal<GetAuctionContactResponse | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly contact = computed(() => this.response()?.contact ?? null);
  protected readonly otherIsBuyer = computed(() => this.contact()?.role === UserRole.BUYER);
  protected readonly title = computed(() =>
    this.otherIsBuyer() ? 'Comprador ganador' : 'Productor del lote',
  );

  private readonly message = computed(() => {
    const contact = this.contact();
    const auction = this.auction();
    const product = auction.product;
    if (!contact || !product) return '';
    const me = this.session.user()?.fullName ?? '';
    const lot = `${product.name} (${formatQuantity(product.quantity, product.unit)})`;
    const price = formatCop(this.response()?.finalPrice);
    const name = contact.fullName.split(' ')[0];
    return this.otherIsBuyer()
      ? `Hola ${name}, soy ${me} de SubastaCampo. Ganaste mi subasta de ${lot} por ${price}. ¿Cómo coordinamos el pago y la entrega?`
      : `Hola ${name}, soy ${me}. Gané en SubastaCampo tu lote de ${lot} por ${price}. ¿Cuándo y dónde coordinamos la entrega?`;
  });

  protected readonly whatsapp = computed(() => {
    const phone = this.contact()?.phone;
    return phone ? whatsappLink(phone, this.message()) : null;
  });
  protected readonly call = computed(() => {
    const phone = this.contact()?.phone;
    return phone ? callLink(phone) : null;
  });
  protected readonly mail = computed(() => {
    const contact = this.contact();
    const name = this.auction().product?.name ?? 'el lote';
    return contact ? mailLink(contact.email, `SubastaCampo: ${name}`, this.message()) : null;
  });

  protected readonly formatCop = formatCop;

  constructor() {
    effect(() => {
      const id = this.auction().id;
      void this.load(id);
    });
  }

  private async load(auctionId: string): Promise<void> {
    try {
      this.response.set(await this.auctions.getAuctionContact({ auctionId }));
      this.error.set(null);
    } catch (caught) {
      this.error.set(describeError(caught).message);
    }
  }
}
