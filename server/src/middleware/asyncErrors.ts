import { NextFunction, Request, Response } from 'express';

type Layer = {
  handle: Function;
};

type LayerPrototype = {
  handle_request: (this: Layer, req: Request, res: Response, next: NextFunction) => unknown;
  handle_error: (
    this: Layer,
    error: unknown,
    req: Request,
    res: Response,
    next: NextFunction
  ) => unknown;
  __asyncErrorsInstalled?: boolean;
};

/**
 * Express 4 ignores promises returned by route and middleware handlers.
 * Patch its dispatch layer once so rejected promises reach error middleware.
 */
export function installAsyncErrorHandling(): void {
  const LayerConstructor = require('express/lib/router/layer');
  const layerPrototype = LayerConstructor.prototype as LayerPrototype;

  if (layerPrototype.__asyncErrorsInstalled) return;

  layerPrototype.handle_request = function handleRequest(req, res, next) {
    const handler = this.handle;

    if (handler.length > 3) return next();

    try {
      const result = handler(req, res, next);
      if (result && typeof result.then === 'function') {
        result.catch(next);
      }
      return result;
    } catch (error) {
      return next(error);
    }
  };

  layerPrototype.handle_error = function handleError(error, req, res, next) {
    const handler = this.handle;

    if (handler.length !== 4) return next(error);

    try {
      const result = handler(error, req, res, next);
      if (result && typeof result.then === 'function') {
        result.catch(next);
      }
      return result;
    } catch (handlerError) {
      return next(handlerError);
    }
  };

  layerPrototype.__asyncErrorsInstalled = true;
}

