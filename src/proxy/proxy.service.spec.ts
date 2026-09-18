import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
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

  it('debe reenviar Authorization y body con timeout explicito', async () => {
    requestMock.mockReturnValue(
      of({
        status: 201,
        data: {
          id: 'juego-1',
        },
      }),
    );

    const resultado = await service.forward(
      'POST',
      'http://localhost:3000/v1/catalogo',
      'Bearer token-prueba',
      {
        titulo: 'Juego',
      },
    );

    expect(requestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: 'http://localhost:3000/v1/catalogo',
        data: {
          titulo: 'Juego',
        },
        timeout: 3000,
        headers: {
          Authorization: 'Bearer token-prueba',
          'Content-Type': 'application/json',
        },
      }),
    );

    expect(resultado).toEqual({
      status: 201,
      data: {
        id: 'juego-1',
      },
    });
  });

  it('debe conservar status y body HTTP del destino', async () => {
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

    expect(resultado).toEqual({
      status: 403,
      data: {
        message: 'Forbidden',
        statusCode: 403,
      },
    });
  });

  it('debe conservar una respuesta HTTP incluso si Axios la entrega como error', async () => {
    requestMock.mockReturnValue(
      throwError(() => ({
        response: {
          status: 404,
          data: {
            message: 'No encontrado',
            statusCode: 404,
          },
        },
      })),
    );

    const resultado = await service.forward(
      'GET',
      'http://localhost:3000/recurso',
    );

    expect(resultado).toEqual({
      status: 404,
      data: {
        message: 'No encontrado',
        statusCode: 404,
      },
    });
  });

  it('debe devolver 504 cuando ocurre timeout', async () => {
    requestMock.mockReturnValue(
      throwError(() => ({
        code: 'ECONNABORTED',
      })),
    );

    const resultado = await service.forward(
      'GET',
      'http://localhost:3000/v1/catalogo',
    );

    expect(resultado).toEqual({
      status: 504,
      data: {
        statusCode: 504,
        message: 'Gateway Timeout',
      },
    });
  });

  it('debe devolver 502 cuando el destino no responde', async () => {
    requestMock.mockReturnValue(
      throwError(() => ({
        code: 'ECONNREFUSED',
      })),
    );

    const resultado = await service.forward(
      'GET',
      'http://localhost:3000/v1/catalogo',
      'Bearer token-que-no-debe-registrarse',
    );

    expect(resultado).toEqual({
      status: 502,
      data: {
        statusCode: 502,
        message: 'Bad Gateway',
      },
    });
  });
});