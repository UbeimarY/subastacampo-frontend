import { ChangeDetectionStrategy, Component, input } from '@angular/core';

let nextId = 0;

/**
 * A band of Barniz de Pasto (mopa-mopa) inlay: stepped frets and diamonds in the
 * craft's red, maize and green over dark lacquered wood, between two fine lines.
 * The identity mark of the app, used sparingly: under the top bar and over the footer.
 */
@Component({
  selector: 'app-barniz-band',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', '[style.height.px]': 'height()' },
  template: `
    <svg width="100%" [attr.height]="height()" preserveAspectRatio="none">
      <defs>
        <pattern
          [attr.id]="id"
          width="40"
          height="14"
          patternUnits="userSpaceOnUse"
          [attr.patternTransform]="'scale(' + height() / 14 + ')'"
        >
          <rect width="40" height="14" fill="#2a1a10" />
          <rect y="1" width="40" height="0.8" fill="#f3e6c8" opacity="0.75" />
          <rect y="12.2" width="40" height="0.8" fill="#f3e6c8" opacity="0.75" />
          <path d="M10 3 14 7 10 11 6 7Z" fill="#c42b1c" />
          <path d="M10 5.2 11.8 7 10 8.8 8.2 7Z" fill="#e9b10a" />
          <path
            d="M18 11V9h3V7h3V5h2v2h3v2h3v2Z"
            fill="#2f6b4f"
            stroke="#f3e6c8"
            stroke-width="0.4"
          />
          <circle cx="25" cy="9.6" r="0.9" fill="#e9b10a" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" [attr.fill]="'url(#' + id + ')'" />
    </svg>
  `,
  styles: `
    :host {
      display: block;
      overflow: hidden;
      line-height: 0;
    }
    svg {
      display: block;
    }
  `,
})
export class BarnizBand {
  readonly height = input(14);
  protected readonly id = `barniz-${nextId++}`;
}
