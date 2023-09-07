import * as T from '@turf/turf';
import { Readable, ReadableOptions } from 'stream';

export interface Props {
  inputFile: string;
  outputDir: string;
  encoder: string;
  title: string | null;
  canvasWidth: number;
  strokeStyle: string;
  lineWidth: number;
  fillStyle: string;
  bgColor: string;
  scoreKey: string;
}

export interface GeoJsonIterator {
  [Symbol.asyncIterator](): AsyncIterator<T.Feature<T.Geometries>>;
}

export class GeoJsonStream extends Readable implements GeoJsonIterator {
  constructor(options?: ReadableOptions) {
    super({ ...options, objectMode: true });
  }

  [Symbol.asyncIterator](): AsyncIterableIterator<T.Feature<T.Geometries>> {
    return this;
  }

  async next(): Promise<IteratorResult<T.Feature<T.Geometries>>> {
    const value: T.Feature<T.Geometries> | null = this.read();

    if (value === null) {
      return { value: undefined as any, done: true };
    }

    return { value, done: false };
  }
}
