import * as T from '@turf/turf';
import Color from 'color';
import { ScaleLinear, scaleLinear } from 'd3-scale';
import fs from 'fs';
import _ from 'lodash';
import path from 'path';
import sharp from 'sharp';
import { Duplex, Transform } from 'stream';
import * as C from './constants.js';
import GeoJsonConverter from './stream.js';
import { GeoJsonIterator, Props } from './types/type.js';

class GeoJSONOperator {
  private colorRange: string[] = [
    'hsl(241, 88%, 70%)',
    'hsl(82, 88%, 51%)',
    'hsl(0, 82%, 66%)',
  ];

  public scale: ScaleLinear<string, string, never> | null = null;

  constructor(
    public canvasWidth: number,
    public canvasHeight: number | null = null,
    public strokeStyle: string,
    public lineWidth: number,
    public fillStyle: string,
    public bounds: number[] | null = null
  ) {}

  public renderFeature(
    feature: T.Feature<T.Geometries>,
    scoreKey: string | null = null
  ): string {
    T.geojsonType(feature, 'Feature', 'geojson feature');

    const { geometry, properties } = feature;

    // スコアを取得する
    const score =
      properties && scoreKey ? Number(properties[scoreKey]) : undefined;

    switch (geometry.type) {
      case 'Point':
        return this.renderPoint(geometry.coordinates, score);
      case 'MultiPoint':
        return geometry.coordinates
          .map((coord) => this.renderPoint(coord, score))
          .join('\n');

      case 'LineString':
        return this.renderLineString(geometry.coordinates, score);
      case 'MultiLineString':
        return geometry.coordinates
          .map((line) => this.renderLineString(line, score))
          .join('\n');

      case 'Polygon':
        return this.renderPolygon(geometry.coordinates, score);
      case 'MultiPolygon':
        return geometry.coordinates
          .map((polygon) => this.renderPolygon(polygon, score))
          .join('\n');

      default:
        throw new Error(`Unknown geometry type: ${geometry}`);
    }
  }

  /**
   * @desc geojson の座標を canvas の座標に変換する
   * @param x geojson の x 座標
   * @param y geojson の y 座標
   * @returns
   */
  private project([x, y]: number[]): [number, number] {
    if (!this.canvasHeight || !this.bounds) {
      throw new Error('canvasHeight is not set.');
    }

    const canvasX =
      ((x - this.bounds[0]) / (this.bounds[2] - this.bounds[0])) *
      this.canvasWidth;
    const canvasY =
      this.canvasHeight -
      ((y - this.bounds[1]) / (this.bounds[3] - this.bounds[1])) *
        this.canvasHeight;
    return [canvasX, canvasY];
  }

  private renderPoint(coord: number[], score?: number): string {
    const [x, y] = this.project(coord);
    const element = `<circle cx="${x}" cy="${y}" r="1" fill="${this.colorize(
      this.fillStyle,
      score
    )}"/>\n`;

    return element;
  }

  private renderLineString(line: number[][], score?: number): string {
    const d = line.map(([x, y]) => this.project([x, y]).join(',')).join(' ');
    const element = `<polyline points="${d}" stroke="${this.colorize(
      this.fillStyle,
      score
    )}" stroke-width="${this.lineWidth}"/>\n`;

    return element;
  }

  private renderPolygon(polygon: number[][][], score?: number): string {
    return polygon
      .map((ring) => {
        const d = ring
          .map(([x, y]) => this.project([x, y]).join(','))
          .join(' ');
        const element = `<polygon points="${d}" fill="${this.colorize(
          this.fillStyle,
          score
        )}" stroke="${this.strokeStyle}" stroke-width="${this.lineWidth}"/>\n`;
        return element;
      })
      .join(' ');
  }

  private colorize(basicColor: string, score: number | undefined): string {
    return score && this.scale ? this.scale(score) : basicColor;
  }

  public generateGradient(
    scoreRange: [number, number]
  ): ScaleLinear<string, string, never> {
    const max = scoreRange[1];
    const min = scoreRange[0];
    const colorLength = this.colorRange.length;

    const step = (max - min) / (colorLength - 1);
    const domain = _.range(min, max + step * 0.5, step); // maxに近づけるためにステップの半分を加える

    const gradient = scaleLinear<string>()
      .domain(domain)
      .range(this.colorRange);

    return gradient;
  }
}

export default class GeoJsonRenderer extends GeoJSONOperator {
  private title: string | null;
  private encoder: string;
  private bgColor: string;

  private scoreKey: string | null = null;

  constructor(props: Partial<Exclude<Props, 'inputFile'>> = {}) {
    const {
      title = C.DEFAULT_TITLE,
      encoder = C.DEFAULT_ENCODER,
      canvasWidth = C.DEFAULT_CANVAS_WIDTH,
      strokeStyle = C.DEFAULT_STROKE_STYLE,
      lineWidth = C.DEFAULT_LINE_WIDTH,
      fillStyle = C.DEFAULT_FILL_STYLE,
      bgColor = C.DEFAULT_BG_COLOR,
      scoreKey = C.DEFAULT_SCORE_KEY,
    } = props;

    super(canvasWidth, null, strokeStyle, lineWidth, fillStyle, null);

    this.title = title;
    this.encoder = encoder;
    this.canvasWidth = this.fixNumber(canvasWidth);
    this.strokeStyle = strokeStyle;
    this.lineWidth = lineWidth;
    this.fillStyle = fillStyle;
    this.bgColor = bgColor;
    this.scoreKey = scoreKey;
  }

  public async save(inputFile: string, outputDir: string): Promise<void> {
    if (!fs.existsSync(inputFile)) {
      throw new Error('Input file does not exist.');
    }

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }

    const fileName = path.basename(inputFile, path.extname(inputFile));
    const outputFile = path.join(outputDir, `${fileName}.png`);

    const outputStream = fs.createWriteStream(outputFile);

    // 0. geojson ファイルの bbox を取得する
    const iteratorWithBbox = GeoJsonConverter.convert(inputFile, this.encoder);
    const { bounds, scoreRange } = await this.getBounds(iteratorWithBbox);

    this.bounds = bounds;

    if (!this.canvasHeight) {
      throw new Error('Failed to get the bounds.');
    }

    if (scoreRange) {
      this.scale = this.generateGradient(scoreRange);
    }

    const stream = this.generateStream(inputFile);

    return new Promise((resolve, reject) => {
      console.log('rendering...');

      stream.on('data', (chunk) => {
        outputStream.write(chunk);
      });

      stream.on('end', () => {
        outputStream.end();
        resolve();
      });

      stream.on('error', (err) => {
        reject(err);
      });
    });
  }

  private generateStream(inputFile: string): Duplex {
    let isStarted = false;
    const svgStream = new Transform({
      objectMode: true,
      transform: (row, _, done) => {
        T.geojsonType(row, 'Feature', 'Feature');
        if (!isStarted) {
          const header = this.writeSVGHeader();
          const title = this.writeSVGTitle();
          const svg = this.renderFeature(row, this.scoreKey);
          const buffer = Buffer.from(header + title + svg);
          done(null, buffer);
          isStarted = true;
        } else {
          const svg = this.renderFeature(row, this.scoreKey);
          const buffer = Buffer.from(svg);
          done(null, buffer);
        }
      },
      flush: (done) => {
        const footer = this.writeSVGFooter();
        const buffer = Buffer.from(footer);
        done(null, buffer);
      },
    });

    return GeoJsonConverter.convert(inputFile, this.encoder)
      .pipe(svgStream)
      .pipe(
        sharp()
          .flatten({ background: Color(this.bgColor).rgb().object() })
          .png()
      );
  }

  /**
   * @desc geojson ファイルの bbox を取得する
   * @param input geojson ファイルのパス
   */
  private async getBounds(iterator: GeoJsonIterator): Promise<{
    bounds: [number, number, number, number];
    scoreRange: [number, number] | undefined;
  }> {
    const bounds: [number, number, number, number] = [
      Infinity,
      Infinity,
      -Infinity,
      -Infinity,
    ];
    const scoreRange: [number, number] = [Infinity, -Infinity];

    // 各 feature の bbox を取得して、最終的に全体の bbox を返す
    for await (const feature of iterator) {
      T.geojsonType(feature, 'Feature', 'geojson feature');
      const { geometry } = feature;

      const bbox = T.bbox(geometry);

      if (!this.bounds) {
        this.bounds = bbox;
      }

      bounds[0] = Math.min(bounds[0], bbox[0]);
      bounds[1] = Math.min(bounds[1], bbox[1]);
      bounds[2] = Math.max(bounds[2], bbox[2]);
      bounds[3] = Math.max(bounds[3], bbox[3]);

      // スコアのレンジを取得する
      if (this.scoreKey && feature.properties) {
        try {
          const score = Number(feature.properties[this.scoreKey]);

          scoreRange[0] = Math.min(scoreRange[0], score);
          scoreRange[1] = Math.max(scoreRange[1], score);
        } catch (e) {
          throw new Error(`scoreKey ${this.scoreKey} is not found`);
        }
      }
    }

    // GeoJSON のアスペクト比を計算
    const geoWidth = bounds[2] - bounds[0];
    const geoHeight = bounds[3] - bounds[1];
    const geoAspect = geoHeight / geoWidth;

    // キャンバスの縦の長さを計算
    this.canvasHeight = this.fixNumber(this.canvasWidth * geoAspect);

    return {
      bounds,
      scoreRange: this.scoreKey ? scoreRange : undefined,
    };
  }

  private fixNumber(num: number) {
    return Number(num.toFixed(0));
  }

  private writeSVGHeader(): string {
    return `<svg width="${this.canvasWidth}" height="${this.canvasHeight}" xmlns="http://www.w3.org/2000/svg">\n`;
  }

  private writeSVGFooter(): string {
    return '</svg>';
  }

  private writeSVGTitle(): string {
    let svgTitle = `<title>${this.title}</title>\n`;
    svgTitle += `<text x="10" y="20" font-family="Arial" font-size="20" fill="black">${this.title}</text>\n`;
    return svgTitle;
  }
}
