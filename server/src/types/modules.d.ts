declare global {
  namespace Express {
    namespace Multer {
      interface File {
        fieldname: string;
        originalname: string;
        encoding: string;
        mimetype: string;
        size: number;
        destination: string;
        filename: string;
        path: string;
        buffer: Buffer;
      }
    }
  }
}

declare module 'multer' {
  namespace multer {
    type File = Express.Multer.File;

    interface StorageEngine {
      _handleFile(req: any, file: Express.Multer.File, callback: (error?: any, info?: Partial<Express.Multer.File>) => void): void;
      _removeFile(req: any, file: Express.Multer.File, callback: (error: Error | null) => void): void;
    }

    interface DiskStorageOptions {
      destination?: string | ((req: any, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => void);
      filename?: (req: any, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => void;
    }

    function diskStorage(options?: DiskStorageOptions): StorageEngine;

    interface Options {
      dest?: string;
      storage?: StorageEngine;
      limits?: {
        fieldNameSize?: number;
        fieldSize?: number;
        fields?: number;
        fileSize?: number;
        files?: number;
        parts?: number;
        headerPairs?: number;
      };
    }

    interface Instance {
      single(fieldName: string): any;
      array(fieldName: string, maxCount?: number): any;
      fields(fields: readonly { name: string; maxCount?: number }[]): any;
      none(): any;
      any(): any;
    }
  }

  function multer(options?: multer.Options): multer.Instance;

  export = multer;
}

declare module 'ws' {
  import { EventEmitter } from 'events';
  import { IncomingMessage } from 'http';
  import { Duplex } from 'stream';

  export class WebSocket extends EventEmitter {
    static readonly CONNECTING: 0;
    static readonly OPEN: 1;
    static readonly CLOSING: 2;
    static readonly CLOSED: 3;

    readonly readyState: number;

    send(data: any, cb?: (err?: Error) => void): void;
    close(code?: number, data?: string | Buffer): void;
    terminate(): void;

    on(event: 'close', listener: (code: number, reason: Buffer) => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
    on(event: 'message', listener: (data: any, isBinary: boolean) => void): this;
    on(event: 'open', listener: () => void): this;
    on(event: string | symbol, listener: (...args: any[]) => void): this;
  }

  export interface ServerOptions {
    host?: string;
    port?: number;
    backlog?: number;
    server?: any;
    verifyClient?: any;
    handleProtocols?: any;
    path?: string;
    noServer?: boolean;
    clientTracking?: boolean;
    perMessageDeflate?: any;
    maxPayload?: number;
    skipUTF8Validation?: boolean;
  }

  export class WebSocketServer extends EventEmitter {
    constructor(options?: ServerOptions, callback?: () => void);
    handleUpgrade(
      request: IncomingMessage,
      socket: Duplex,
      head: Buffer,
      callback: (client: WebSocket, request: IncomingMessage) => void
    ): void;
    close(cb?: (err?: Error) => void): void;
    on(event: 'connection', cb: (socket: WebSocket, request: IncomingMessage) => void): this;
    on(event: 'error', cb: (error: Error) => void): this;
    on(event: string | symbol, listener: (...args: any[]) => void): this;
  }

  export default WebSocket;
}
