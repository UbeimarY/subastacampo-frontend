import { InjectionToken, inject } from '@angular/core';
import {
  Code,
  ConnectError,
  createClient,
  type Client,
  type Interceptor,
  type Transport,
} from '@connectrpc/connect';
import { createConnectTransport } from '@connectrpc/connect-web';

import { environment } from '../../../environments/environment';
import { AuctionService } from '../../gen/subastacampo/v1/auction_pb';
import { AuthService } from '../../gen/subastacampo/v1/auth_pb';
import { CatalogService } from '../../gen/subastacampo/v1/catalog_pb';
import { SystemService } from '../../gen/subastacampo/v1/system_pb';
import { SessionStore } from '../auth/session.store';

/**
 * One Connect transport for the whole app. The Connect protocol runs over plain
 * HTTP, so the browser talks to the gRPC-compatible backend without a proxy.
 */
export const TRANSPORT = new InjectionToken<Transport>('TRANSPORT', {
  providedIn: 'root',
  factory: () => {
    const session = inject(SessionStore);

    const authenticate: Interceptor = (next) => async (request) => {
      const token = session.token();
      if (token) {
        request.header.set('Authorization', `Bearer ${token}`);
      }
      try {
        return await next(request);
      } catch (error) {
        // A rejected token means the session is over: forget it everywhere.
        if (token && ConnectError.from(error).code === Code.Unauthenticated) {
          session.expire();
        }
        throw error;
      }
    };

    return createConnectTransport({
      baseUrl: environment.apiUrl,
      interceptors: [authenticate],
      // Side-effect-free RPCs (NO_SIDE_EFFECTS in the contract) travel as GET: cacheable.
      useHttpGet: true,
    });
  },
});

function clientToken<T extends Parameters<typeof createClient>[0]>(name: string, service: T) {
  return new InjectionToken<Client<T>>(name, {
    providedIn: 'root',
    factory: () => createClient(service, inject(TRANSPORT)),
  });
}

export const AUTH_CLIENT = clientToken('AUTH_CLIENT', AuthService);
export const CATALOG_CLIENT = clientToken('CATALOG_CLIENT', CatalogService);
export const AUCTION_CLIENT = clientToken('AUCTION_CLIENT', AuctionService);
export const SYSTEM_CLIENT = clientToken('SYSTEM_CLIENT', SystemService);
