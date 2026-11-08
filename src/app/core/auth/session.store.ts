import { Injectable, computed, signal } from '@angular/core';
import { fromJson, toJson, type JsonValue } from '@bufbuild/protobuf';
import { timestampDate } from '@bufbuild/protobuf/wkt';

import { type LoginResponse, type User, UserSchema } from '../../gen/subastacampo/v1/auth_pb';
import { UserRole } from '../../gen/subastacampo/v1/common_pb';

const STORAGE_KEY = 'subastacampo.session';

interface StoredSession {
  token: string;
  expiresAt: number;
  user: JsonValue;
}

/**
 * Holds the signed-in user and access token.
 *
 * The token lives in localStorage so a reload keeps the session. It is a
 * bearer token with a fixed expiry; the store forgets it as soon as it
 * expires or the server rejects it.
 */
@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly session = signal<{ token: string; expiresAt: number; user: User } | null>(
    readStoredSession(),
  );
  private expiryTimer: ReturnType<typeof setTimeout> | undefined;

  readonly user = computed(() => this.session()?.user ?? null);
  readonly token = computed(() => this.session()?.token ?? null);
  readonly isSignedIn = computed(() => this.session() !== null);
  readonly isProducer = computed(() => this.user()?.role === UserRole.PRODUCER);
  readonly isBuyer = computed(() => this.user()?.role === UserRole.BUYER);

  /** Set when the server rejected the session, so the login page can explain why. */
  readonly expiredNotice = signal(false);

  constructor() {
    this.scheduleExpiry();
  }

  start(response: LoginResponse): void {
    if (!response.user || !response.expiresAt) {
      throw new Error('Login response without user or expiry');
    }
    const session = {
      token: response.accessToken,
      expiresAt: timestampDate(response.expiresAt).getTime(),
      user: response.user,
    };
    this.session.set(session);
    this.expiredNotice.set(false);
    writeStoredSession({
      token: session.token,
      expiresAt: session.expiresAt,
      user: toJson(UserSchema, session.user),
    });
    this.scheduleExpiry();
  }

  /** The user signed out on purpose. */
  end(): void {
    this.session.set(null);
    writeStoredSession(null);
    clearTimeout(this.expiryTimer);
  }

  /** The token expired or the server rejected it. */
  expire(): void {
    if (this.session() === null) return;
    this.end();
    this.expiredNotice.set(true);
  }

  private scheduleExpiry(): void {
    clearTimeout(this.expiryTimer);
    const session = this.session();
    if (!session) return;
    // setTimeout overflows above ~24.8 days; tokens last one day.
    const delay = Math.min(session.expiresAt - Date.now(), 2 ** 31 - 1);
    this.expiryTimer = setTimeout(() => this.expire(), Math.max(0, delay));
  }
}

function readStoredSession(): { token: string; expiresAt: number; user: User } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredSession;
    if (typeof stored.token !== 'string' || stored.expiresAt <= Date.now()) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return {
      token: stored.token,
      expiresAt: stored.expiresAt,
      user: fromJson(UserSchema, stored.user),
    };
  } catch {
    // Private mode, blocked storage or a corrupted value: start signed out.
    return null;
  }
}

function writeStoredSession(value: StoredSession | null): void {
  try {
    if (value) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Storage unavailable: the session simply does not survive a reload.
  }
}
