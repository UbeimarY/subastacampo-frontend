import { AuctionStatus, RiskLevel, RiskSignal } from '../gen/subastacampo/v1/auction_pb';
import { PriceFactorCode, type PriceFactor } from '../gen/subastacampo/v1/catalog_pb';
import { ProductCategory, QuantityUnit } from '../gen/subastacampo/v1/common_pb';
import { formatNumber } from './format';

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  [ProductCategory.UNSPECIFIED]: 'Sin categoría',
  [ProductCategory.FRUITS]: 'Frutas',
  [ProductCategory.VEGETABLES]: 'Hortalizas',
  [ProductCategory.TUBERS]: 'Tubérculos',
  [ProductCategory.GRAINS]: 'Granos',
  [ProductCategory.DAIRY]: 'Lácteos',
  [ProductCategory.OTHER]: 'Otros',
};

export const CATEGORY_OPTIONS = [
  ProductCategory.TUBERS,
  ProductCategory.VEGETABLES,
  ProductCategory.FRUITS,
  ProductCategory.GRAINS,
  ProductCategory.DAIRY,
  ProductCategory.OTHER,
].map((value) => ({ value, label: CATEGORY_LABELS[value] }));

const UNIT_NAMES: Record<QuantityUnit, [singular: string, plural: string]> = {
  [QuantityUnit.UNSPECIFIED]: ['unidad', 'unidades'],
  [QuantityUnit.KILOGRAM]: ['kilo', 'kilos'],
  [QuantityUnit.ARROBA]: ['arroba', 'arrobas'],
  [QuantityUnit.SACK]: ['bulto', 'bultos'],
  [QuantityUnit.CRATE]: ['canastilla', 'canastillas'],
};

export const UNIT_OPTIONS = [
  { value: QuantityUnit.SACK, label: 'Bultos (50 kg)' },
  { value: QuantityUnit.ARROBA, label: 'Arrobas (12,5 kg)' },
  { value: QuantityUnit.CRATE, label: 'Canastillas (20 kg)' },
  { value: QuantityUnit.KILOGRAM, label: 'Kilos' },
];

/** Kilograms in one unit, as the pricing model counts them. */
export const KG_PER_UNIT: Record<QuantityUnit, number> = {
  [QuantityUnit.UNSPECIFIED]: 1,
  [QuantityUnit.KILOGRAM]: 1,
  [QuantityUnit.ARROBA]: 12.5,
  [QuantityUnit.SACK]: 50,
  [QuantityUnit.CRATE]: 20,
};

export function formatQuantity(quantity: number, unit: QuantityUnit): string {
  const [singular, plural] = UNIT_NAMES[unit];
  return `${formatNumber(quantity)} ${quantity === 1 ? singular : plural}`;
}

export const STATUS_LABELS: Record<AuctionStatus, string> = {
  [AuctionStatus.UNSPECIFIED]: 'Desconocido',
  [AuctionStatus.SCHEDULED]: 'Programada',
  [AuctionStatus.ACTIVE]: 'En vivo',
  [AuctionStatus.CLOSED]: 'Cerrada',
  [AuctionStatus.CANCELLED]: 'Cancelada',
};

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  [RiskLevel.UNSPECIFIED]: 'Sin evaluar',
  [RiskLevel.LOW]: 'Riesgo bajo',
  [RiskLevel.MEDIUM]: 'Riesgo medio',
  [RiskLevel.HIGH]: 'Riesgo alto',
};

export const RISK_SIGNAL_LABELS: Record<RiskSignal, string> = {
  [RiskSignal.UNSPECIFIED]: 'Señal desconocida',
  [RiskSignal.LAST_10_SECONDS]: 'Pujó en los últimos 10 segundos',
  [RiskSignal.LAST_30_SECONDS]: 'Pujó en los últimos 30 segundos',
  [RiskSignal.FIRST_BID_AT_CLOSE]: 'Su primera puja fue justo al cierre',
  [RiskSignal.REPEATED_EXTENSIONS]: 'Ha extendido el cierre varias veces',
  [RiskSignal.NEW_ACCOUNT]: 'Cuenta creada hace menos de 24 horas',
  [RiskSignal.LAST_MINUTE_HABIT]: 'Suele pujar en el último momento',
  [RiskSignal.SHARES_PHONE_WITH_PRODUCER]: 'Comparte teléfono contigo (posible cómplice)',
};

/** Explains one factor of the AI price suggestion in plain words. */
export function describeFactor(factor: PriceFactor): string {
  const value = factor.value;
  switch (factor.code) {
    case PriceFactorCode.FRESH_PRODUCT:
      return `Producto fresco: le quedan ${formatNumber(value)} días de vida útil, eso sostiene el precio.`;
    case PriceFactorCode.SHORT_SHELF_LIFE:
      return `Vida útil corta (${formatNumber(value)} días): conviene un precio que se venda rápido.`;
    case PriceFactorCode.HIGH_DEMAND:
      return `Alta demanda: ${formatNumber(value)} pujas por subasta en esta categoría este mes.`;
    case PriceFactorCode.LOW_DEMAND:
      return `Demanda baja: ${formatNumber(value)} pujas por subasta en esta categoría este mes.`;
    case PriceFactorCode.LARGE_VOLUME:
      return `Volumen grande (${formatNumber(value)} kg): el precio por kilo baja un poco.`;
    default:
      return 'Factor del mercado.';
  }
}
