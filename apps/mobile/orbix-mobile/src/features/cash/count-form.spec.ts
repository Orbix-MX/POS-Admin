/**
 * Suma del desglose por denominación.
 *
 * El desglose es una ayuda para contar, no el dato que se envía: el importe
 * escrito manda. Pero si la suma está mal, el atajo "usar {{total}}" escribe un
 * número equivocado en el campo que sí se manda — y eso acaba en el corte.
 */
import { sumDenominations } from './count-form';

describe('sumDenominations', () => {
  it('suma denominación por cantidad', () => {
    // 2×1000 + 3×500 + 5×100 = 4000
    expect(sumDenominations({ '1000': 2, '500': 3, '100': 5 })).toBe(4000);
  });

  it('un desglose vacío suma cero', () => {
    expect(sumDenominations({})).toBe(0);
  });

  it('ignora las cantidades en cero', () => {
    expect(sumDenominations({ '500': 0, '100': 2 })).toBe(200);
  });

  it('cuadra con un cajón realista', () => {
    // 1×500 + 2×200 + 3×50 + 4×20 + 1×10 + 2×5 = 1150
    expect(sumDenominations({ '500': 1, '200': 2, '50': 3, '20': 4, '10': 1, '5': 2 })).toBe(1150);
  });

  it('no explota con una cantidad indefinida', () => {
    expect(
      sumDenominations({ '100': undefined as unknown as number, '50': 2 }),
    ).toBe(100);
  });
});
