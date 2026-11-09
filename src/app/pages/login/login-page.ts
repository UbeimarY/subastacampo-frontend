import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AUTH_CLIENT } from '../../core/api/clients';
import { describeError } from '../../core/api/errors';
import { SessionStore } from '../../core/auth/session.store';
import { Hillside } from '../../shared/hillside';

@Component({
  selector: 'app-login-page',
  imports: [Hillside, ReactiveFormsModule, RouterLink],
  templateUrl: './login-page.html',
  styleUrl: '../../shared/auth-layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  private readonly auth = inject(AUTH_CLIENT);
  private readonly router = inject(Router);
  protected readonly session = inject(SessionStore);

  /** Page to return to after signing in (query parameter "volver"). */
  readonly volver = input<string>();

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    try {
      this.session.start(await this.auth.login(this.form.getRawValue()));
      await this.router.navigateByUrl(safeReturnUrl(this.volver()));
    } catch (caught) {
      this.error.set(describeError(caught).message);
    } finally {
      this.submitting.set(false);
    }
  }
}

/** Only same-site paths: an attacker cannot craft a link that redirects elsewhere. */
export function safeReturnUrl(url: string | undefined): string {
  return url && url.startsWith('/') && !url.startsWith('//') ? url : '/';
}
