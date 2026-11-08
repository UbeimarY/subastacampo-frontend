import { create } from '@bufbuild/protobuf';
import { Code, ConnectError } from '@connectrpc/connect';

import { ErrorDetailSchema, ErrorReason, MoneySchema } from '../../gen/subastacampo/v1/common_pb';
import { describeError, isTransient } from './errors';

function rpcError(
  code: Code,
  detail: Parameters<typeof create<typeof ErrorDetailSchema>>[1],
): ConnectError {
  return new ConnectError('server message', code, undefined, [
    { desc: ErrorDetailSchema, value: create(ErrorDetailSchema, detail) },
  ]);
}

describe('describeError', () => {
  it('translates the contract reason, never shows the server message', () => {
    const error = rpcError(Code.Unauthenticated, { reason: ErrorReason.INVALID_CREDENTIALS });

    expect(describeError(error).message).toBe('El correo o la contraseña no son correctos.');
  });

  it('explains which field failed validation', () => {
    const error = rpcError(Code.InvalidArgument, {
      reason: ErrorReason.VALIDATION_FAILED,
      field: 'password',
    });

    expect(describeError(error)).toEqual({
      message: 'La contraseña debe tener entre 8 y 128 caracteres.',
      field: 'password',
      minimumBid: undefined,
    });
  });

  it('carries the new minimum when a bid was too low', () => {
    const error = rpcError(Code.FailedPrecondition, {
      reason: ErrorReason.BID_TOO_LOW,
      minimumBid: create(MoneySchema, { currencyCode: 'COP', units: 510_000n }),
    });

    expect(describeError(error).minimumBid).toBe(510_000n);
  });

  it('reports a network failure in plain words', () => {
    const error = new ConnectError('fetch failed', Code.Unavailable);

    expect(describeError(error).message).toContain('No hay conexión');
    expect(isTransient(error)).toBe(true);
  });

  it('does not retry business errors', () => {
    expect(
      isTransient(rpcError(Code.FailedPrecondition, { reason: ErrorReason.BID_TOO_LOW })),
    ).toBe(false);
  });
});
