import {
  IsString, IsNotEmpty, IsOptional, IsEnum,
  IsInt, IsBoolean, Min, MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum PrinterType {
  TICKET      = 'TICKET',
  SALE_TICKET = 'SALE_TICKET',
  LABEL       = 'LABEL',
  REPORT      = 'REPORT',
}

export enum PrinterConnection {
  USB       = 'USB',
  NETWORK   = 'NETWORK',
  BLUETOOTH = 'BLUETOOTH',
  SYSTEM    = 'SYSTEM',
}

export class CreatePrinterConfigDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsEnum(PrinterType)
  type: PrinterType;

  @IsEnum(PrinterConnection)
  connectionType: PrinterConnection;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  ipAddress?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  port?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  usbPath?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  bluetoothAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  systemName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  paperWidth?: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdatePrinterConfigDto extends CreatePrinterConfigDto {}

export class PrintReceiptDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsOptional()
  @IsEnum(PrinterType)
  printerType?: PrinterType;
}

export class QzSignDto {
  @IsString()
  @IsNotEmpty()
  request: string;
}
