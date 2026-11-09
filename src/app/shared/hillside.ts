import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * The "colcha de retazos": ploughed fields on a Nariño hillside under the
 * Galeras volcano. Decorative; the red marker is the auction going on right now.
 */
@Component({
  selector: 'app-hillside',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `
    <svg viewBox="0 0 480 320" preserveAspectRatio="xMidYMax slice">
      <defs>
        @for (field of furrows; track field.id) {
          <pattern
            [attr.id]="field.id"
            width="8"
            height="8"
            patternUnits="userSpaceOnUse"
            [attr.patternTransform]="'rotate(' + field.angle + ')'"
          >
            <line x1="0" y1="0" x2="0" y2="8" stroke="rgb(255 255 255 / 0.14)" stroke-width="3" />
          </pattern>
        }
      </defs>

      <!-- Galeras -->
      <path
        d="M40 150 L170 58 Q200 44 228 60 L330 120 Q390 150 480 140 V320 H0 V170Z"
        fill="#cfdccf"
      />
      <path d="M170 58 Q200 44 228 60 L214 70 Q200 62 186 70Z" fill="#9fb3a3" />

      <!-- Fields, from the back of the slope to the front -->
      <g stroke="#f4f1e6" stroke-width="2.5" stroke-linejoin="round">
        @for (field of fields; track field.d) {
          <path [attr.d]="field.d" [attr.fill]="field.color" />
          <path [attr.d]="field.d" [attr.fill]="'url(#' + field.pattern + ')'" stroke="none" />
        }
      </g>

      <!-- Hedgerows of eucalyptus -->
      <g fill="#24503a">
        <circle cx="96" cy="196" r="7" />
        <circle cx="108" cy="192" r="6" />
        <circle cx="300" cy="170" r="6" />
        <circle cx="312" cy="174" r="7" />
        <circle cx="402" cy="236" r="7" />
      </g>

      @if (live()) {
        <g class="marker" transform="translate(262 214)">
          <circle r="14" fill="var(--barniz)" opacity="0.25" class="marker__halo" />
          <circle r="6.5" fill="var(--barniz)" stroke="#fff" stroke-width="2.5" />
        </g>
      }
    </svg>
  `,
  styles: `
    :host {
      display: block;
    }
    svg {
      display: block;
      width: 100%;
      height: 100%;
    }
    .marker__halo {
      transform-box: fill-box;
      transform-origin: center;
      animation: halo 2s ease-out infinite;
    }
    @keyframes halo {
      from {
        transform: scale(0.6);
        opacity: 0.45;
      }
      to {
        transform: scale(1.8);
        opacity: 0;
      }
    }
  `,
})
export class Hillside {
  /** Shows the pulsing marker of a live auction. */
  readonly live = input(true);

  protected readonly furrows = [
    { id: 'hs-a', angle: -25 },
    { id: 'hs-b', angle: 20 },
    { id: 'hs-c', angle: 65 },
    { id: 'hs-d', angle: -60 },
  ];

  protected readonly fields = [
    { d: 'M0 172 L120 150 L150 186 L40 210 L0 214Z', color: '#5f8a4a', pattern: 'hs-a' },
    { d: 'M120 150 L246 128 L262 168 L150 186Z', color: '#b9861d', pattern: 'hs-b' },
    { d: 'M246 128 L360 134 L388 172 L262 168Z', color: '#3f7a3a', pattern: 'hs-c' },
    { d: 'M360 134 L480 142 V186 L388 172Z', color: '#8e6a3a', pattern: 'hs-d' },
    { d: 'M0 214 L40 210 L150 186 L170 244 L0 262Z', color: '#7a4b2c', pattern: 'hs-b' },
    { d: 'M150 186 L262 168 L290 236 L170 244Z', color: '#6f9a4f', pattern: 'hs-d' },
    { d: 'M262 168 L388 172 L420 226 L290 236Z', color: '#8e2648', pattern: 'hs-a' },
    { d: 'M388 172 L480 186 V232 L420 226Z', color: '#c9a246', pattern: 'hs-c' },
    { d: 'M0 262 L170 244 L186 320 H0Z', color: '#3f7a3a', pattern: 'hs-c' },
    { d: 'M170 244 L290 236 L310 320 H186Z', color: '#b9861d', pattern: 'hs-a' },
    { d: 'M290 236 L420 226 L440 320 H310Z', color: '#5f8a4a', pattern: 'hs-b' },
    { d: 'M420 226 L480 232 V320 H440Z', color: '#7a4b2c', pattern: 'hs-d' },
  ];
}
