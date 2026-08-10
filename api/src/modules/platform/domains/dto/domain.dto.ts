import { IsString, IsNotEmpty, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// Hostname only — no protocol, no path. Port allowed for dev origins
// (e.g. "localhost:4321"). Matches what `new URL(origin).host` produces.
const HOSTNAME_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*(:\d+)?$/i;

export class CreateDomainDto {
  @ApiProperty({ example: 'manzanitas.mx', description: 'Hostname the e-commerce site will be served from (no protocol/path). Include the port for dev origins, e.g. "localhost:4321".' })
  @IsString()
  @IsNotEmpty()
  @Matches(HOSTNAME_PATTERN, { message: 'hostname debe ser un dominio válido, sin protocolo ni ruta (ej. "manzanitas.mx" o "localhost:4321")' })
  hostname: string;
}
