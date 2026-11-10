import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AUTH_CLIENT } from '../../core/api/clients';
import { describeError } from '../../core/api/errors';
import { SessionStore } from '../../core/auth/session.store';
import { NARINO_MUNICIPALITIES } from '../../core/narino';
import { UserRole } from '../../gen/subastacampo/v1/common_pb';
import { Hillside } from '../../shared/hillside';

@Component({
  selector: 'app-register-page',
  imports: [Hillside, ReactiveFormsModule, RouterLink],
  templateUrl: './register-page.html',
  styleUrls: ['../../shared/auth-layout.scss', './register-page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterPage {
  protected readonly municipalities = NARINO_MUNICIPALITIES;
  private readonly auth = inject(AUTH_CLIENT);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);

  protected readonly UserRole = UserRole;
  protected readonly form = inject(NonNullableFormBuilder).group({
    role: [UserRole.PRODUCER, Validators.required],
    fullName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(128)]],
    phone: ['', Validators.pattern(/^\+?[\d\s-]{7,20}$/)],
    municipality: ['', Validators.maxLength(100)],
  });
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected invalid(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name];
    return control.touched && control.invalid;
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    const value = this.form.getRawValue();
    try {
      await this.auth.register({
        fullName: value.fullName.trim(),
        email: value.email.trim(),
        password: value.password,
        role: value.role,
        // Optional fields are omitted when empty, as the contract's `optional` expects.
        phone: value.phone.trim() || undefined,
        municipality: value.municipality.trim() || undefined,
      });
      // Registered: sign in right away so the user lands ready to work.
      this.session.start(
        await this.auth.login({ email: value.email.trim(), password: value.password }),
      );
      await this.router.navigateByUrl(value.role === UserRole.PRODUCER ? '/publicar' : '/');
    } catch (caught) {
      this.error.set(describeError(caught).message);
    } finally {
      this.submitting.set(false);
    }
  }
}
