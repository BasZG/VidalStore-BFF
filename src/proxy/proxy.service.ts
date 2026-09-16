import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class ProxyService {
  constructor(private readonly httpService: HttpService) {}

  async forward(
    method: string,
    url: string,
    authorization?: string,
    body?: unknown,
  ) {
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

        // Queremos recibir también 401, 403, 404, etc.
        // y devolverlos sin transformarlos.
        validateStatus: () => true,
      }),
    );

    return {
      status: response.status,
      data: response.data,
    };
  }
}
