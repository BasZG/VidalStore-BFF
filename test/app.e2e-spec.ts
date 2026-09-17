import type { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from 'vitest';
import { AppModule } from './../src/app.module.js';
import { RolesGuard } from './../src/auth/roles.guard.js';
import { TokenGuard } from './../src/auth/token.guard.js';

type Destino = {
  server: Server;
  url: string;
};

async function leerBody(
  req: Parameters<
    Parameters<typeof createServer>[0]
  >[0],
): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(
      Buffer.isBuffer(chunk)
        ? chunk
        : Buffer.from(chunk),
    );
  }

  if (chunks.length === 0) {
    return undefined;
  }

  const contenido =
    Buffer.concat(chunks).toString('utf8');

  if (!contenido) {
    return undefined;
  }

  try {
    return JSON.parse(contenido);
  } catch {
    return contenido;
  }
}

async function iniciarDestino(): Promise<Destino> {
  const server = createServer(async (req, res) => {
    const authorization =
      req.headers.authorization;

    if (authorization === 'Bearer timeout') {
      setTimeout(() => {
        if (!res.destroyed) {
          res.statusCode = 200;
          res.setHeader(
            'Content-Type',
            'application/json',
          );
          res.end(
            JSON.stringify({
              message: 'respuesta tardia',
            }),
          );
        }
      }, 3500);

      return;
    }

    if (
      authorization === 'Bearer disconnect'
    ) {
      req.socket.destroy();
      return;
    }

    if (
      authorization ===
      'Bearer error-destino'
    ) {
      res.statusCode = 422;
      res.setHeader(
        'Content-Type',
        'application/json',
      );
      res.end(
        JSON.stringify({
          statusCode: 422,
          message: 'Error del microservicio',
        }),
      );
      return;
    }

    const body = await leerBody(req);

    res.statusCode =
      req.method === 'POST' ? 201 : 200;

    res.setHeader(
      'Content-Type',
      'application/json',
    );

    res.end(
      JSON.stringify({
        method: req.method,
        url: req.url,
        authorization:
          authorization ?? null,
        body: body ?? null,
      }),
    );
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const address =
    server.address() as AddressInfo;

  return {
    server,
    url: `http://127.0.0.1:${address.port}`,
  };
}

async function cerrarServidor(
  server: Server,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

describe('BFF forwarding (e2e)', () => {
  let app: INestApplication;
  let catalogo: Destino;
  let biblioteca: Destino;

  beforeAll(async () => {
    catalogo = await iniciarDestino();
    biblioteca = await iniciarDestino();

    process.env.CATALOGO_URL = catalogo.url;
    process.env.BIBLIOTECA_URL =
      biblioteca.url;

    const guardPermitido = {
      canActivate: () => true,
    };

    const moduleFixture: TestingModule =
      await Test.createTestingModule({
        imports: [AppModule],
      })
        .overrideGuard(TokenGuard)
        .useValue(guardPermitido)
        .overrideGuard(RolesGuard)
        .useValue(guardPermitido)
        .compile();

    app =
      moduleFixture.createNestApplication();

    await app.init();
  });

  afterAll(async () => {
    await app.close();

    await cerrarServidor(catalogo.server);
    await cerrarServidor(
      biblioteca.server,
    );
  });

  it('GET /v1/catalogo reenvia metodo y path', async () => {
    const response = await request(
      app.getHttpServer(),
    )
      .get('/v1/catalogo')
      .set(
        'Authorization',
        'Bearer token-prueba',
      )
      .expect(200);

    expect(response.body.method).toBe('GET');
    expect(response.body.url).toBe(
      '/v1/catalogo',
    );
    expect(
      response.body.authorization,
    ).toBe('Bearer token-prueba');
  });

  it('POST /v1/catalogo reenvia metodo, path y body', async () => {
    const body = {
      titulo: 'Juego',
      precio: 12990,
    };

    const response = await request(
      app.getHttpServer(),
    )
      .post('/v1/catalogo')
      .set(
        'Authorization',
        'Bearer token-prueba',
      )
      .send(body)
      .expect(201);

    expect(response.body.method).toBe(
      'POST',
    );
    expect(response.body.url).toBe(
      '/v1/catalogo',
    );
    expect(response.body.body).toEqual(body);
  });

  it('PUT /v1/catalogo/:juegoId codifica identificador', async () => {
    const response = await request(
      app.getHttpServer(),
    )
      .put(
        '/v1/catalogo/juego%2Fespecial',
      )
      .send({
        precio: 14990,
      })
      .expect(200);

    expect(response.body.method).toBe('PUT');
    expect(response.body.url).toBe(
      '/v1/catalogo/juego%2Fespecial',
    );
  });

  it('POST /v1/compras reenvia al servicio biblioteca', async () => {
    const response = await request(
      app.getHttpServer(),
    )
      .post('/v1/compras')
      .send({
        juegoId: 'juego-1',
      })
      .expect(201);

    expect(response.body.method).toBe(
      'POST',
    );
    expect(response.body.url).toBe(
      '/v1/compras',
    );
    expect(response.body.body).toEqual({
      juegoId: 'juego-1',
    });
  });

  it('GET /v1/biblioteca reenvia metodo y path', async () => {
    const response = await request(
      app.getHttpServer(),
    )
      .get('/v1/biblioteca')
      .expect(200);

    expect(response.body.method).toBe('GET');
    expect(response.body.url).toBe(
      '/v1/biblioteca',
    );
  });

  it('GET /v1/licencias reenvia metodo y path', async () => {
    const response = await request(
      app.getHttpServer(),
    )
      .get('/v1/licencias')
      .expect(200);

    expect(response.body.method).toBe('GET');
    expect(response.body.url).toBe(
      '/v1/licencias',
    );
  });

  it('DELETE /v1/licencias/:licenciaId codifica identificador', async () => {
    const response = await request(
      app.getHttpServer(),
    )
      .delete(
        '/v1/licencias/licencia%2Fespecial',
      )
      .expect(200);

    expect(response.body.method).toBe(
      'DELETE',
    );
    expect(response.body.url).toBe(
      '/v1/licencias/licencia%2Fespecial',
    );
  });

  it('conserva status y body HTTP del microservicio', async () => {
    const response = await request(
      app.getHttpServer(),
    )
      .get('/v1/catalogo')
      .set(
        'Authorization',
        'Bearer error-destino',
      )
      .expect(422);

    expect(response.body).toEqual({
      statusCode: 422,
      message: 'Error del microservicio',
    });
  });

  it(
    'timeout del microservicio devuelve 504',
    async () => {
      const response = await request(
        app.getHttpServer(),
      )
        .get('/v1/catalogo')
        .set(
          'Authorization',
          'Bearer timeout',
        )
        .expect(504);

      expect(response.body).toEqual({
        statusCode: 504,
        message: 'Gateway Timeout',
      });
    },
    5000,
  );

  it('conexion interrumpida devuelve 502', async () => {
    const response = await request(
      app.getHttpServer(),
    )
      .get('/v1/catalogo')
      .set(
        'Authorization',
        'Bearer disconnect',
      )
      .expect(502);

    expect(response.body).toEqual({
      statusCode: 502,
      message: 'Bad Gateway',
    });
  });
});
