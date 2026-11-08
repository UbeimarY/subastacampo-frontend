import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';

import { UserRole } from '../../gen/subastacampo/v1/common_pb';
import { SessionStore } from './session.store';

/**
 * Lets signed-in users through; others go to the login page and come back after.
 * These guards only shape the navigation: the server authorizes every RPC.
 */
export const signedInGuard: CanActivateFn = (_route, state) => {
  if (inject(SessionStore).isSignedIn()) return true;
  return inject(Router).createUrlTree(['/ingresar'], { queryParams: { volver: state.url } });
};

export function roleGuard(role: UserRole): CanActivateFn {
  return (route, state) => {
    const session = inject(SessionStore);
    if (!session.isSignedIn()) {
      return inject(Router).createUrlTree(['/ingresar'], { queryParams: { volver: state.url } });
    }
    return session.user()?.role === role ? true : inject(Router).createUrlTree(['/']);
  };
}

export const signedOutGuard: CanActivateFn = () =>
  inject(SessionStore).isSignedIn() ? inject(Router).createUrlTree(['/']) : true;
