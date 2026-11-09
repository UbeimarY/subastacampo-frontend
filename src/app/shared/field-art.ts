import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { ProductCategory } from '../gen/subastacampo/v1/common_pb';

interface FieldStyle {
  color: string;
  /** Angle of the furrows: every field on the hillside is ploughed differently. */
  furrows: number;
  icon: string;
}

/** Simple line icons (24×24, stroked in white), one per category. */
const ICONS = {
  tubers:
    'M6.5 9.5c1.4-3.6 6.6-4.6 9.6-2.4 3 2.2 2.9 7.3-.6 9.6-3.6 2.4-8.6.9-9.4-2.9-.2-1.5 0-3 .4-4.3Z M10 10.5h.01 M14 13h.01 M11 15.5h.01',
  vegetables: 'M5 19c0-7 5-12 14-14-1 9-6 14-13 14Z M5 19l8-8 M9 15l1.5-4 M12 12l3-.8',
  fruits:
    'M12 6.5V4 M12 6.5c1.5-1.8 3.5-2 5-1.5 M9 9.5a2 2 0 1 0 0 .01 M15 9.5a2 2 0 1 0 0 .01 M12 12.5a2 2 0 1 0 0 .01 M9 15.5a2 2 0 1 0 0 .01 M15 15.5a2 2 0 1 0 0 .01 M12 18.5a2 2 0 1 0 0 .01',
  grains:
    'M12 21V8 M12 9c-2.5 0-3.5-2-3.5-4 2.5 0 3.5 2 3.5 4Zm0 0c2.5 0 3.5-2 3.5-4-2.5 0-3.5 2-3.5 4Z M12 13.5c-2.5 0-3.5-2-3.5-4 2.5 0 3.5 2 3.5 4Zm0 0c2.5 0 3.5-2 3.5-4-2.5 0-3.5 2-3.5 4Z M12 18c-2.5 0-3.5-2-3.5-4 2.5 0 3.5 2 3.5 4Zm0 0c2.5 0 3.5-2 3.5-4-2.5 0-3.5 2-3.5 4Z',
  dairy: 'M9 3.5h6 M9.5 3.5v3L7 10v9.5h10V10l-2.5-3.5v-3 M7 13h10',
  other: 'M4 10h16l-1.6 9H5.6L4 10Z M8 10l4-6 4 6 M9 14v2 M12 14v2 M15 14v2',
};

const STYLES: Record<ProductCategory, FieldStyle> = {
  [ProductCategory.UNSPECIFIED]: { color: 'var(--field-other)', furrows: 20, icon: ICONS.other },
  [ProductCategory.TUBERS]: { color: 'var(--field-tubers)', furrows: -28, icon: ICONS.tubers },
  [ProductCategory.VEGETABLES]: {
    color: 'var(--field-vegetables)',
    furrows: 18,
    icon: ICONS.vegetables,
  },
  [ProductCategory.FRUITS]: { color: 'var(--field-fruits)', furrows: 62, icon: ICONS.fruits },
  [ProductCategory.GRAINS]: { color: 'var(--field-grains)', furrows: -8, icon: ICONS.grains },
  [ProductCategory.DAIRY]: { color: 'var(--field-dairy)', furrows: 40, icon: ICONS.dairy },
  [ProductCategory.OTHER]: { color: 'var(--field-other)', furrows: -50, icon: ICONS.other },
};

/**
 * A ploughed field in the category's colour with its icon: the visual mark of a
 * product across the app (cards, the auction room, the producer's list).
 * The furrows are a CSS gradient, so the field fills any shape; the icon keeps its size.
 */
@Component({
  selector: 'app-field-art',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    '[style.background-color]': 'style().color',
    '[style.background-image]': 'furrows()',
  },
  template: `
    <svg viewBox="0 0 24 24">
      <path
        [attr.d]="style().icon"
        fill="none"
        stroke="#fff"
        stroke-width="1.7"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  `,
  styles: `
    :host {
      display: grid;
      place-items: center;
      overflow: hidden;
      border-radius: inherit;
      container-type: size;
    }
    svg {
      width: min(46cqmin, 56px);
      height: min(46cqmin, 56px);
    }
  `,
})
export class FieldArt {
  readonly category = input.required<ProductCategory>();
  protected readonly style = computed(() => STYLES[this.category()] ?? STYLES[0]);
  protected readonly furrows = computed(
    () =>
      `repeating-linear-gradient(${this.style().furrows + 90}deg, rgb(255 255 255 / 0.13) 0 3px, transparent 3px 9px)`,
  );
}
