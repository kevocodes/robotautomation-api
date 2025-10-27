export type ApiResponse<T = any> = {
  statusCode: number;
  message: string | string[];
  data: T;
};
