import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { ProxyService } from './proxy/proxy.service.js';

@Controller()
export class AppController {
  private readonly catalogoUrl: string;
  private readonly bibliotecaUrl: string;

  constructor(
    private readonly proxyService: ProxyService,
    private readonly configService: ConfigService,
  ) {
    this.catalogoUrl =
      this.configService.get<string>('CATALOGO_URL') ??
      'http://localhost:3000';

    this.bibliotecaUrl =
      this.configService.get<string>('BIBLIOTECA_URL') ??
      'http://localhost:3003';
  }

  @Get('v1/catalogo')
  async obtenerCatalogo(
    @Headers('authorization') authorization: string | undefined,
    @Res() res: Response,
  ) {
    return this.responder(
      res,
      await this.proxyService.forward(
        'GET',
        `${this.catalogoUrl}/v1/catalogo`,
        authorization,
      ),
    );
  }

  @Post('v1/catalogo')
  async crearJuego(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Res() res: Response,
  ) {
    return this.responder(
      res,
      await this.proxyService.forward(
        'POST',
        `${this.catalogoUrl}/v1/catalogo`,
        authorization,
        body,
      ),
    );
  }

  @Put('v1/catalogo/:juegoId')
  async actualizarJuego(
    @Param('juegoId') juegoId: string,
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Res() res: Response,
  ) {
    return this.responder(
      res,
      await this.proxyService.forward(
        'PUT',
        `${this.catalogoUrl}/v1/catalogo/${juegoId}`,
        authorization,
        body,
      ),
    );
  }

  @Post('v1/compras')
  async crearCompra(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Res() res: Response,
  ) {
    return this.responder(
      res,
      await this.proxyService.forward(
        'POST',
        `${this.bibliotecaUrl}/v1/compras`,
        authorization,
        body,
      ),
    );
  }

  @Get('v1/biblioteca')
  async obtenerBiblioteca(
    @Headers('authorization') authorization: string | undefined,
    @Res() res: Response,
  ) {
    return this.responder(
      res,
      await this.proxyService.forward(
        'GET',
        `${this.bibliotecaUrl}/v1/biblioteca`,
        authorization,
      ),
    );
  }

  @Get('v1/licencias')
  async obtenerLicencias(
    @Headers('authorization') authorization: string | undefined,
    @Res() res: Response,
  ) {
    return this.responder(
      res,
      await this.proxyService.forward(
        'GET',
        `${this.bibliotecaUrl}/v1/licencias`,
        authorization,
      ),
    );
  }

  @Delete('v1/licencias/:licenciaId')
  async revocarLicencia(
    @Param('licenciaId') licenciaId: string,
    @Headers('authorization') authorization: string | undefined,
    @Res() res: Response,
  ) {
    return this.responder(
      res,
      await this.proxyService.forward(
        'DELETE',
        `${this.bibliotecaUrl}/v1/licencias/${licenciaId}`,
        authorization,
      ),
    );
  }

  private responder(
    res: Response,
    resultado: {
      status: number;
      data: unknown;
    },
  ) {
    return res.status(resultado.status).send(resultado.data);
  }
}
