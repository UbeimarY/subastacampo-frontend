import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { SessionStore } from './core/auth/session.store';
import { BarnizBand } from './shared/barniz-band';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, BarnizBand],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly session = inject(SessionStore);
  private readonly router = inject(Router);

  constructor() {
    // When the server rejects the token, send the user to sign in again.
    effect(() => {
      if (this.session.expiredNotice()) {
        void this.router.navigate(['/ingresar'], { queryParams: { volver: this.router.url } });
      }
    });
  }

  protected signOut(): void {
    this.session.end();
    void this.router.navigateByUrl('/');
  }

  protected firstName(fullName: string): string {
    return fullName.trim().split(/\s+/)[0] ?? fullName;
  }
}
