import { HttpService } from '@nestjs/axios';
import { HttpStatus, Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

type ProxyResult = {
  status: number;
  data: unknown;
};

@Injectable()
export class ProxyService {
  private static readonly TIMEOUT_MS = 3000;

  constructor(private readonly httpService: HttpService) {}

  async forward(
    method: string,
    url: string,
    authorization?: string,
    body?: unknown,
  ): Promise<ProxyResult> {
    try {
      const response = await firstValueFrom(
        this.httpService.request({
          method,
          url,
          data: body,
          headers: {
            ...(authorization
              ? { Authorization: authorization }
              : {}),
            'Content-Type': 'application/json',
          },
          timeout: ProxyService.TIMEOUT_MS,

          // Las respuestas HTTP del destino, incluso errores,
          // deben conservar su status y body.
          validateStatus: () => true,
        }),
      );

      return {
        status: response.status,
        data: response.data,
      };
    } catch (error: unknown) {
      const axiosError = error as {
        code?: string;
        response?: {
          status: number;
          data: unknown;
        };
      };

      // Respaldo: si Axios entrega una respuesta HTTP
      // dentro del error, conservarla sin transformarla.
      if (axiosError.response) {
        return {
          status: axiosError.response.status,
          data: axiosError.response.data,
        };
      }

      if (
        axiosError.code === 'ECONNABORTED' ||
        axiosError.code === 'ETIMEDOUT'
      ) {
        return {
          status: HttpStatus.GATEWAY_TIMEOUT,
          data: {
            statusCode: HttpStatus.GATEWAY_TIMEOUT,
            message: 'Gateway Timeout',
          },
        };
      }

      return {
        status: HttpStatus.BAD_GATEWAY,
        data: {
          statusCode: HttpStatus.BAD_GATEWAY,
          message: 'Bad Gateway',
        },
      };
    }
  }
}
