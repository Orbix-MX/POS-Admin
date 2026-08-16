import { ProductAIController } from './product-ai.controller';
import { PERMISSIONS_KEY } from '../../../../common/decorators/require-permissions.decorator';
import { REQUIRE_MODULE_KEY } from '../../../../common/guards/require-module.guard';

describe('ProductAIController', () => {
  const mockService = { draft: jest.fn() };
  let controller: ProductAIController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ProductAIController(mockService as any);
  });

  it('exige el permiso products:create (mismo que el alta manual — §07)', () => {
    // Se lee la metadata del decorador sobre la función; nunca se invoca con un `this`.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const required = Reflect.getMetadata(PERMISSIONS_KEY, ProductAIController.prototype.draft) as string[];
    expect(required).toEqual(['products:create']);
  });

  it('exige el módulo inventario, igual que ProductsController', () => {
    const module = Reflect.getMetadata(REQUIRE_MODULE_KEY, ProductAIController);
    expect(module).toBe('inventario');
  });

  it('delega en ProductAIService.draft con el mensaje del DTO', async () => {
    mockService.draft.mockResolvedValue({ aiRequestId: 'req-1', degradations: [] });

    const result = await controller.draft({ message: 'coca de 600' });

    expect(mockService.draft).toHaveBeenCalledWith('coca de 600');
    expect(result).toEqual({ aiRequestId: 'req-1', degradations: [] });
  });

  it('propaga el error tal cual si el servicio lanza (p. ej. AI_PROVIDER_UNAVAILABLE) — no lo envuelve ni lo oculta', async () => {
    const error = new Error('AI_PROVIDER_UNAVAILABLE');
    mockService.draft.mockRejectedValue(error);

    await expect(controller.draft({ message: 'x' })).rejects.toThrow(error);
  });
});
