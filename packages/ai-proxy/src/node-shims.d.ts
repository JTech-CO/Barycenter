declare module 'node:http' {
  export interface IncomingMessage extends AsyncIterable<Uint8Array> {
    method?: string;
    url?: string;
    headers: Record<string, string | string[] | undefined>;
  }

  export interface ServerResponse {
    headersSent: boolean;
    writeHead(
      statusCode: number,
      headers?: Record<string, string | number>,
    ): ServerResponse;
    end(data?: string): void;
  }

  export interface AddressInfo {
    address: string;
    family: string;
    port: number;
  }

  export interface Server {
    listen(port: number, hostname: string, callback?: () => void): Server;
    close(callback?: () => void): Server;
    address(): AddressInfo | string | null;
    once(eventName: string, listener: (...args: unknown[]) => void): Server;
  }

  export function createServer(
    listener: (
      request: IncomingMessage,
      response: ServerResponse,
    ) => void | Promise<void>,
  ): Server;
}

declare module 'node:events' {
  export function once(
    emitter: {
      once(eventName: string, listener: (...args: unknown[]) => void): unknown;
    },
    eventName: string,
  ): Promise<unknown[]>;
}

declare class Buffer extends Uint8Array {
  static byteLength(value: string): number;
  static concat(chunks: readonly Uint8Array[]): Buffer;
  toString(encoding?: string): string;
}

declare const process: {
  env: Record<string, string | undefined>;
  stdout: { write(value: string): unknown };
  stderr: { write(value: string): unknown };
  exitCode?: number;
};
