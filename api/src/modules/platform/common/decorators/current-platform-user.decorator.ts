import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { PlatformUser } from '@prisma/client';

export const CurrentPlatformUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PlatformUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as PlatformUser;
  },
);
