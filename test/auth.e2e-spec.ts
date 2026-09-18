import type { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { AppModule } from './../src/app.module.js';
import { ProxyService } from './../src/proxy/proxy.service.js';

describe('BFF forwarding de identidad (e2e)', () => {
  let app: INestApplication;
  const forward = vi.fn();

  beforeAll(async () => {
    forward.mockImplementation(
      async (
        _method: string,
        _url: string,
        authorization?: string,
      ) => {
        if (!authorization) {
          return {
            status: 401,
            data: {
              statusCode: 401,
              message: 'Unauthorized',
            },
          };
        }

        if (authorization === 'Bearer prohibido') {
          return {
            status: 403,
            data: {
              statusCode: 403,
              message: 'Forbidden',
            },
          };
        }

        return {
          status: 200,
          data: [],
        };
      },
    );

    const moduleFixture: TestingModule =
      await Test.createTestingModule({
        imports: [AppModule],
      })
        .overrideProvider(ProxyService)
        .useValue({
          forward,
        })
        .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    forward.mockClear();
  });

  afterAll(async () => {
    await app.close();
  });

  it('reenvia el Bearer sin interpretar sus claims', async () => {
    await request(app.getHttpServer())
      .get('/v1/catalogo')
      .set(
        'Authorization',
        'Bearer token-sin-firma-verificada',
      )
      .expect(200);

    expect(forward).toHaveBeenCalledWith(
      'GET',
      expect.stringContaining('/v1/catalogo'),
      'Bearer token-sin-firma-verificada',
    );
  });

  it('conserva el 401 entregado por el destino', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/catalogo')
      .expect(401);

    expect(response.body).toEqual({
      statusCode: 401,
      message: 'Unauthorized',
    });

    expect(forward).toHaveBeenCalledWith(
      'GET',
      expect.stringContaining('/v1/catalogo'),
      undefined,
    );
  });

  it('conserva el 403 entregado por el destino', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/licencias')
      .set('Authorization', 'Bearer prohibido')
      .expect(403);

    expect(response.body).toEqual({
      statusCode: 403,
      message: 'Forbidden',
    });

    expect(forward).toHaveBeenCalledWith(
      'GET',
      expect.stringContaining('/v1/licencias'),
      'Bearer prohibido',
    );
  });
});
