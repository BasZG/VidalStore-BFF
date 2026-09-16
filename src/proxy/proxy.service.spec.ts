import { HttpService } from '@nestjs/axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';
import { ProxyService } from './proxy.service.js';

describe('ProxyService', () => {
  let service: ProxyService;
  let requestMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    requestMock = vi.fn();

    const httpService = {
      request: requestMock,
    } as unknown as HttpService;

    service = new ProxyService(httpService);
  });

  it('debe reenviar Authorization y body al microservicio', async () => {
    requestMock.mockReturnValue(
      of({
        status: 201,
        data: { id: 'juego-1' },
      }),
    );

    const resultado = await service.forward(
      'POST',
      'http://localhost:3000/v1/catalogo',
      'Bearer token-prueba',
      { titulo: 'Juego' },
    );

    expect(requestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: 'http://localhost:3000/v1/catalogo',
        data: { titulo: 'Juego' },
        headers: {
          Authorization: 'Bearer token-prueba',
          'Content-Type': 'application/json',
        },
      }),
    );

    expect(resultado).toEqual({
      status: 201,
      data: { id: 'juego-1' },
    });
  });

  it('debe conservar el status y error del microservicio', async () => {
    requestMock.mockReturnValue(
      of({
        status: 403,
        data: {
          message: 'Forbidden',
          statusCode: 403,
        },
      }),
    );

    const resultado = await service.forward(
      'GET',
      'http://localhost:3000/v1/catalogo',
      'Bearer token-prueba',
    );

    expect(resultado.status).toBe(403);
    expect(resultado.data).toEqual({
      message: 'Forbidden',
      statusCode: 403,
    });
  });
});
