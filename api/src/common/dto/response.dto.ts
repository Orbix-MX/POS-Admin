export class ResponseDto<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: any;

  constructor(success: boolean, data?: T, message?: string, error?: any) {
    this.success = success;
    this.data = data;
    this.message = message;
    this.error = error;
  }

  static success<T>(data?: T, message?: string): ResponseDto<T> {
    return new ResponseDto(true, data, message);
  }

  static error<T>(error: any, message?: string): ResponseDto<T> {
    return new ResponseDto<T>(false, undefined, message, error);
  }
}
