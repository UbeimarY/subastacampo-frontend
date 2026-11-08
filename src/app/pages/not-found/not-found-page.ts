import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <h1>Esta página no existe</h1>
      <p class="lede">Puede que el enlace esté mal escrito o que la subasta ya no exista.</p>
      <a class="button" routerLink="/">Ver las subastas en vivo</a>
    </section>
  `,
})
export class NotFoundPage {}
