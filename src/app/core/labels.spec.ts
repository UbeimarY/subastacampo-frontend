import { create } from '@bufbuild/protobuf';

import { PriceFactorCode, PriceFactorSchema } from '../gen/subastacampo/v1/catalog_pb';
import { QuantityUnit } from '../gen/subastacampo/v1/common_pb';
import { describeFactor, formatQuantity } from './labels';

describe('labels', () => {
  it('names quantities in singular and plural', () => {
    expect(formatQuantity(1, QuantityUnit.SACK)).toBe('1 bulto');
    expect(formatQuantity(20, QuantityUnit.SACK)).toBe('20 bultos');
  });

  it('explains the AI price factors in plain words', () => {
    const factor = create(PriceFactorSchema, { code: PriceFactorCode.LARGE_VOLUME, value: 1000 });

    expect(describeFactor(factor)).toContain('1.000 kg');
  });
});
