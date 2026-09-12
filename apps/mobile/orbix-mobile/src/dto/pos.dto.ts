/**
 * `/branches`.
 *
 * Lo de caja vive en `cash.dto.ts` y lo de ventas en `orders.dto.ts`: los tres
 * estaban aquí juntos cuando el POS era la única pantalla que los tocaba, y con
 * el ciclo del día completo cada uno tiene ya su propio repositorio.
 */

export interface BranchDto {
  id: string;
  name: string;
  code: string;
  isMain: boolean;
}
