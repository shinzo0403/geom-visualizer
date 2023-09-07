import * as T from '@turf/turf';

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
  labelKey: string;
}

export interface GeoJsonIterator {
  [Symbol.asyncIterator](): AsyncIterator<T.Feature<T.Geometries>>;
}
