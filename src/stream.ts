import { wktToGeoJSON } from '@terraformer/wkt';
import csvParser from 'csv-parser';
import fs from 'fs';
import iconv from 'iconv-lite';
import { createRequire } from 'module';
import path from 'path';
import { Transform } from 'stream';
import streamJSON from 'stream-json';
import streamJSONPick from 'stream-json/filters/Pick.js';
import streamJSONArray from 'stream-json/streamers/StreamArray.js';

const { parser } = streamJSON;
const { pick } = streamJSONPick;
const { streamArray } = streamJSONArray;
const require = createRequire(import.meta.url);
const shpStream = require('shp-stream');

/**
 * データ型を判定して、geojson feature のストリームを返す
 */
export default class GeoJsonConverter {
  public static convert(input: string, decode: string) {
    // 拡張子に応じて変換処理を分岐
    const ext = path.extname(input).replace('.', '');

    switch (ext) {
      case 'geojson':
      case 'json':
        return this.convertGeojson(input, decode);
      case 'csv':
        return this.convertCsv(input, decode);
      case 'shp':
        return this.convertShp(input, decode);
      default:
        throw new Error(`Unsupported file type: ${ext}`);
    }
  }

  private static convertShp(input: string, decode: string) {
    const reader = shpStream.reader(input).createReadStream();

    const transform = new Transform({
      objectMode: true,
      transform: (row, _, done) => {
        const { geometry, properties } = row;

        const feature = {
          type: 'Feature',
          properties: this.encodeProperties(properties, decode),
          geometry: geometry,
        };

        done(null, feature);
      },
    });

    return reader.pipe(transform);
  }

  private static encodeProperties(row: any, decode: string) {
    return Object.entries(row).reduce((acc, [key, val]: [string, any]) => {
      acc[key] = iconv.encode(val, decode).toString('binary');
      return acc;
    }, {} as Record<string, string>);
  }

  private static convertGeojson(input: string, decode: string) {
    const transform = new Transform({
      objectMode: true,
      transform: (row, _, done) => {
        const { key, value } = row;

        done(null, value);
      },
    });

    return fs
      .createReadStream(input)
      .pipe(iconv.decodeStream(decode))
      .pipe(parser())
      .pipe(pick({ filter: 'features' }))
      .pipe(streamArray())
      .pipe(transform);
  }

  private static convertCsv(input: string, decode: string) {
    let wktColumn: string | undefined;

    const transform = new Transform({
      objectMode: true,
      transform: (row, _, done) => {
        if (!wktColumn) {
          wktColumn = this.hasWkt(row);
        }

        const { [wktColumn]: wkt, ...properties } = row;
        const geometry = wktToGeoJSON(wkt);

        const feature = {
          type: 'Feature',
          properties: properties,
          geometry: geometry,
        };

        done(null, feature);
      },
    });

    return fs
      .createReadStream(input)
      .pipe(iconv.decodeStream(decode))
      .pipe(csvParser())
      .pipe(transform);
  }

  private static hasWkt(row: any): string {
    const wktColumns = Object.entries(row)
      .filter(([key, val]) => typeof val === 'string' && val !== '')
      .map(([key, val]: [string, any]) => {
        try {
          const geojson = wktToGeoJSON(val);
          if (
            geojson &&
            geojson.type !== 'Feature' &&
            geojson.type !== 'FeatureCollection'
          ) {
            return key;
          }
        } catch {
          // エラーが発生した場合、変換できないとみなす
          return null;
        }
      })
      .filter(Boolean); // null や undefined を削除

    if (wktColumns.length === 0) {
      throw new Error('No WKT column found');
    }

    if (wktColumns.length > 1) {
      throw new Error('Multiple WKT columns found');
    }

    const wktColumn = wktColumns[0] as string;

    return wktColumn;
  }
}
