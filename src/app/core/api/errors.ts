import { Code, ConnectError } from '@connectrpc/connect';

import { ErrorDetailSchema, ErrorReason } from '../../gen/subastacampo/v1/common_pb';

export interface UiError {
  /** Text for the user, in Spanish. */
  message: string;
  /** Contract field that failed validation (for example "email"), if any. */
  field?: string;
  /** For a bid that was too low: the current minimum. */
  minimumBid?: bigint;
}

// The backend sends a language-neutral reason; the interface owns the wording.
const REASON_MESSAGES: Record<ErrorReason, string> = {
  [ErrorReason.UNSPECIFIED]: 'Ocurrió un error inesperado. Inténtalo de nuevo.',
  [ErrorReason.VALIDATION_FAILED]: 'Revisa los datos del formulario.',
  [ErrorReason.EMAIL_ALREADY_REGISTERED]: 'Ya existe una cuenta con ese correo. Inicia sesión.',
  [ErrorReason.INVALID_CREDENTIALS]: 'El correo o la contraseña no son correctos.',
  [ErrorReason.SESSION_EXPIRED]: 'Tu sesión terminó. Vuelve a iniciar sesión.',
  [ErrorReason.PRODUCER_ONLY]: 'Solo los productores pueden hacer esto.',
  [ErrorReason.BUYER_ONLY]: 'Solo los compradores pueden pujar.',
  [ErrorReason.NOT_PRODUCT_OWNER]: 'Este producto pertenece a otro productor.',
  [ErrorReason.PRODUCT_NOT_FOUND]: 'No encontramos ese producto.',
  [ErrorReason.HARVEST_DATE_IN_FUTURE]: 'La fecha de cosecha no puede ser posterior a hoy.',
  [ErrorReason.AUCTION_NOT_FOUND]: 'No encontramos esa subasta.',
  [ErrorReason.AUCTION_ALREADY_ACTIVE]: 'Este producto ya tiene una subasta en curso.',
  [ErrorReason.AUCTION_NOT_ACTIVE]: 'La subasta ya terminó: no recibe más pujas.',
  [ErrorReason.BID_TOO_LOW]: 'Alguien pujó antes que tú. Tu puja debe superar el nuevo mínimo.',
  [ErrorReason.AUTHENTICATION_REQUIRED]: 'Inicia sesión para continuar.',
  [ErrorReason.AUCTION_HAS_NO_WINNER]:
    'Los datos de contacto se comparten cuando la subasta cierra con un ganador.',
  [ErrorReason.NOT_AUCTION_PARTY]:
    'Solo el productor y quien ganó pueden ver los datos de contacto.',
};

const FIELD_MESSAGES: Record<string, string> = {
  full_name: 'El nombre debe tener entre 2 y 100 caracteres.',
  email: 'Escribe un correo electrónico válido.',
  password: 'La contraseña debe tener entre 8 y 128 caracteres.',
  phone: 'El teléfono debe tener entre 7 y 20 dígitos.',
  municipality: 'El municipio puede tener hasta 100 caracteres.',
  name: 'El nombre del producto debe tener entre 2 y 150 caracteres.',
  description: 'La descripción puede tener hasta 2000 caracteres.',
  category: 'Elige una categoría.',
  unit: 'Elige una unidad.',
  quantity: 'La cantidad debe ser mayor que cero, con máximo 2 decimales.',
  harvest_date: 'Escribe una fecha de cosecha válida.',
  shelf_life_days: 'La vida útil debe estar entre 1 y 365 días.',
  starting_price: 'El precio inicial debe ser mayor que cero.',
  min_increment: 'El incremento mínimo debe ser mayor que cero.',
  duration: 'La duración debe estar entre 1 minuto y 24 horas.',
  amount: 'La puja debe ser mayor que cero.',
  product_id: 'Este producto ya no se puede subastar: terminó su vida útil.',
};

/** Translates any error thrown by an RPC into a message for the user. */
export function describeError(error: unknown): UiError {
  const connectError = ConnectError.from(error);
  const [detail] = connectError.findDetails(ErrorDetailSchema);

  if (detail) {
    const field = detail.field || undefined;
    const message =
      detail.reason === ErrorReason.VALIDATION_FAILED && field && FIELD_MESSAGES[field]
        ? FIELD_MESSAGES[field]
        : (REASON_MESSAGES[detail.reason] ?? REASON_MESSAGES[ErrorReason.UNSPECIFIED]);
    return { message, field, minimumBid: detail.minimumBid?.units };
  }

  switch (connectError.code) {
    case Code.Unavailable:
    case Code.Unknown:
      return {
        message: 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.',
      };
    case Code.DeadlineExceeded:
      return { message: 'El servidor tardó demasiado en responder. Inténtalo de nuevo.' };
    case Code.Unauthenticated:
      return { message: REASON_MESSAGES[ErrorReason.SESSION_EXPIRED] };
    default:
      return { message: REASON_MESSAGES[ErrorReason.UNSPECIFIED] };
  }
}

/** Network-level failures where retrying the same request is safe and useful. */
export function isTransient(error: unknown): boolean {
  const code = ConnectError.from(error).code;
  return code === Code.Unavailable || code === Code.Unknown || code === Code.DeadlineExceeded;
}
