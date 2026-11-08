import { TestBed } from '@angular/core/testing';
import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';

import { LoginResponseSchema, UserSchema } from '../../gen/subastacampo/v1/auth_pb';
import { UserRole } from '../../gen/subastacampo/v1/common_pb';
import { SessionStore } from './session.store';

function loginResponse(expiresInMs: number) {
  return create(LoginResponseSchema, {
    accessToken: 'token-123',
    expiresAt: timestampFromMs(Date.now() + expiresInMs),
    user: create(UserSchema, { id: 'u1', fullName: 'Ana Productora', role: UserRole.PRODUCER }),
  });
}

describe('SessionStore', () => {
  beforeEach(() => localStorage.clear());

  it('starts a session and survives a reload', () => {
    TestBed.inject(SessionStore).start(loginResponse(60_000));
    TestBed.resetTestingModule();

    const reloaded = TestBed.inject(SessionStore);

    expect(reloaded.token()).toBe('token-123');
    expect(reloaded.isProducer()).toBe(true);
  });

  it('forgets an expired token on load', () => {
    TestBed.inject(SessionStore).start(loginResponse(-1));
    TestBed.resetTestingModule();

    expect(TestBed.inject(SessionStore).isSignedIn()).toBe(false);
  });

  it('flags a session the server rejected', () => {
    const store = TestBed.inject(SessionStore);
    store.start(loginResponse(60_000));

    store.expire();

    expect(store.isSignedIn()).toBe(false);
    expect(store.expiredNotice()).toBe(true);
  });
});
