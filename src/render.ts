import * as T from '@turf/turf';
import { Canvas, CanvasRenderingContext2D, createCanvas } from 'canvas';
import { ScaleLinear, scaleLinear } from 'd3-scale';
import fs from 'fs';
import path from 'path';
import * as C from './constants.js';
import GeoJsonConverter from './stream.js';
import { GeoJsonIterator, Props } from './type';

export default class GeoJsonRenderer {
  private canvas: Canvas | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private bounds?: number[];

  private title: string | null;
  private encoder: string;
  private canvasWidth: number;
  private canvasHeight: number | undefined = undefined;
  private strokeStyle: string;
  private lineWidth: number;
  private fillStyle: string;
  private bgColor: string;

  private scoreKey: string | null = null;

  private colorRange: string[] = [
    'hsl(241, 88%, 70%)',
    'hsl(82, 88%, 51%)',
    'hsl(0, 82%, 66%)',
  ];
  private scoreRange: [number, number] | null = null;
  private scale: ScaleLinear<string, string, never> | null = null;

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

    this.title = title;
    this.encoder = encoder;
    this.canvasWidth = canvasWidth;
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

    // 1. geojson ファイルの bbox を取得する
    const iteratorWithBbox = GeoJsonConverter.convert(inputFile, this.encoder);
    await this.getBounds(iteratorWithBbox);

    // 2. geojson ファイルを読み込んで、各 feature を描画する
    const iteratorWithFeature = GeoJsonConverter.convert(
      inputFile,
      this.encoder
    );
    await this.renderGeoJson(iteratorWithFeature);

    // 3. タイトルを描画する
    this.setTitle();

    // 4. 画像を保存する
    await this.saveToFile(outputFile);
  }

  private async saveToFile(output: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.canvas) {
        throw new Error('canvas is not set');
      }

      if (!fs.existsSync(path.dirname(output))) {
        fs.mkdirSync(path.dirname(output));
      }

      const out = fs.createWriteStream(output);
      const stream = this.canvas.createPNGStream();
      stream.pipe(out);
      out.on('finish', () => {
        console.log('PNG file was created.');
        resolve();
      });

      out.on('error', (err) => {
        reject(err);
      });
    });
  }

  private setTitle(): void {
    if (this.title && this.ctx) {
      this.ctx.fillStyle = this.strokeStyle;
      this.ctx.font = '24px Arial';
      this.ctx.fillText(this.title, 10, 30);
    }
  }

  /**
   * @desc geojson ファイルの bbox を取得する
   * @param input geojson ファイルのパス
   */
  private async getBounds(iterator: GeoJsonIterator): Promise<void> {
    // 各 feature の bbox を取得して、最終的に全体の bbox を返す
    for await (const feature of iterator) {
      T.geojsonType(feature, 'Feature', 'geojson feature');
      const { geometry } = feature;

      const bbox = T.bbox(geometry);

      if (!this.bounds) {
        this.bounds = bbox;
      }

      this.bounds[0] = Math.min(this.bounds[0], bbox[0]);
      this.bounds[1] = Math.min(this.bounds[1], bbox[1]);
      this.bounds[2] = Math.max(this.bounds[2], bbox[2]);
      this.bounds[3] = Math.max(this.bounds[3], bbox[3]);

      // スコアのレンジを取得する
      if (this.scoreKey && feature.properties) {
        try {
          const score = Number(feature.properties[this.scoreKey]);

          if (!this.scoreRange) {
            this.scoreRange = [score, score];
          }

          this.scoreRange[0] = Math.min(this.scoreRange[0], score);
          this.scoreRange[1] = Math.max(this.scoreRange[1], score);
        } catch (e) {
          throw new Error(`scoreKey ${this.scoreKey} is not found`);
        }
      }
    }

    if (!this.bounds) {
      throw new Error('bounds is not set');
    }

    // GeoJSON のアスペクト比を計算
    const geoWidth = this.bounds[2] - this.bounds[0];
    const geoHeight = this.bounds[3] - this.bounds[1];
    const geoAspect = geoHeight / geoWidth;

    // キャンバスの縦の長さを計算
    this.canvasHeight = this.canvasWidth * geoAspect;

    this.canvas = createCanvas(this.canvasWidth, this.canvasHeight);
    this.ctx = this.canvas.getContext('2d');

    // カラーグラデーションを作成
    if (this.scoreRange) {
      this.scale = scaleLinear<string>()
        .domain(this.scoreRange)
        .range(this.colorRange);
    }
  }

  /**
   * @desc geojson を描画する
   * @param input geojson ファイルのパス
   */
  private async renderGeoJson(iterator: GeoJsonIterator): Promise<void> {
    console.log('rendering...');
    if (!this.ctx || !this.canvas || !this.canvasHeight) {
      throw new Error('ctx is not set');
    }

    // Clear canvas
    this.ctx.fillStyle = this.bgColor;
    this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
    this.ctx.lineWidth = this.lineWidth;

    for await (const feature of iterator) {
      T.geojsonType(feature, 'Feature', 'geojson feature');
      const { geometry, properties } = feature;
      const score =
        properties && this.scoreKey
          ? Number(properties[this.scoreKey])
          : undefined;

      switch (geometry.type) {
        case 'Point':
          this.renderPoint(this.ctx, geometry.coordinates, score);
          break;
        case 'MultiPoint':
          for (const coord of geometry.coordinates) {
            this.renderPoint(this.ctx, coord, score);
          }
          break;

        case 'LineString':
          this.renderLineString(this.ctx, geometry.coordinates, score);
          break;
        case 'MultiLineString':
          for (const line of geometry.coordinates) {
            this.renderLineString(this.ctx, line, score);
          }
          break;

        case 'Polygon':
          this.renderPolygon(this.ctx, geometry.coordinates, score);
          break;
        case 'MultiPolygon':
          for (const polygon of geometry.coordinates) {
            this.renderPolygon(this.ctx, polygon, score);
          }
          break;
        default:
          throw new Error(`Unknown geometry type: ${geometry}`);
      }
    }
  }

  /**
   * @desc geojson の座標を canvas の座標に変換する
   * @param x geojson の x 座標
   * @param y geojson の y 座標
   * @returns
   */
  private project([x, y]: number[]): [number, number] {
    if (!this.bounds || !this.canvasHeight) {
      throw new Error('bounds is not set');
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

  private renderPoint(
    ctx: CanvasRenderingContext2D,
    coord: number[],
    score?: number
  ): void {
    const [canvasX, canvasY] = this.project(coord);
    ctx.beginPath();
    ctx.arc(canvasX, canvasY, 1, 0, 2 * Math.PI);
    ctx.fillStyle = this.colorize(this.fillStyle, score);
    ctx.fill();
  }

  private renderLineString(
    ctx: CanvasRenderingContext2D,
    line: number[][],
    score?: number
  ): void {
    ctx.beginPath();
    for (const coord of line) {
      const [canvasX, canvasY] = this.project(coord);
      ctx.lineTo(canvasX, canvasY);
    }
    ctx.strokeStyle = this.colorize(this.fillStyle, score);
    ctx.stroke();
  }

  private renderPolygon(
    ctx: CanvasRenderingContext2D,
    polygon: number[][][],
    score?: number
  ): void {
    ctx.beginPath();
    for (const ring of polygon) {
      for (const coord of ring) {
        const [canvasX, canvasY] = this.project(coord);
        ctx.lineTo(canvasX, canvasY);
      }
    }
    ctx.closePath();
    ctx.fillStyle = this.colorize(this.fillStyle, score);
    ctx.strokeStyle = this.strokeStyle;
    ctx.fill();
  }

  private colorize(basicColor: string, score: number | undefined): string {
    if (this.scale && score) {
      return this.scale(score);
    }

    return basicColor;
  }
}
