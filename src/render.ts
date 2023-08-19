import * as T from '@turf/turf';
import Color from 'color';
import { ScaleLinear, scaleLinear } from 'd3-scale';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import * as C from './constants.js';
import GeoJsonConverter from './stream.js';
import { GeoJsonIterator, Props } from './types/type.js';

class SVG {
  public static convertSVGtoPNG(
    svgPath: string,
    w: number,
    h: number,
    bgColor: string
  ): Promise<void> {
    const pngPath = svgPath.replace(/\.svg$/, '.png');

    return new Promise((resolve, reject) => {
      // 先に SVG をリサイズ
      sharp(svgPath)
        .resize(w, h)
        .toBuffer()
        .then((data) => {
          // リサイズされた SVG を基盤となる画像と合成
          sharp({
            create: {
              width: w,
              height: h,
              channels: 3,
              background: Color(bgColor).rgb().object(),
            },
          })
            .composite([
              {
                input: data, // ここでリサイズされた SVG のバッファを使用
                blend: 'over',
                top: 0,
                left: 0,
              },
            ])
            .png()
            .toFile(pngPath, (err) => {
              if (err) {
                reject(err);
              } else {
                resolve();
              }
            });
        })
        .catch(reject);
    });
  }

  public static writeSVGHeader(ws: fs.WriteStream, w: number, h: number): void {
    const header = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">\n`;
    ws.write(header);
  }

  public static writeSVGFooter(ws: fs.WriteStream): void {
    ws.write('</svg>');
  }

  public static writeSVGTitle(ws: fs.WriteStream, title: string): void {
    let svgTitle = `<title>${title}</title>\n`;
    svgTitle += `<text x="10" y="20" font-family="Arial" font-size="20" fill="black">${title}</text>\n`;
    ws.write(svgTitle);
  }
}

export default class GeoJsonRenderer {
  private outputStream: fs.WriteStream | null = null;
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
    const outputFile = path.join(outputDir, `${fileName}.svg`);

    this.outputStream = fs.createWriteStream(outputFile);

    if (!this.outputStream) {
      throw new Error('Failed to create a write stream.');
    }
    this.outputStream.on('error', (err) => {
      throw err;
    });

    // 0. geojson ファイルの bbox を取得する
    const iteratorWithBbox = GeoJsonConverter.convert(inputFile, this.encoder);
    await this.getBounds(iteratorWithBbox);

    if (!this.canvasHeight) {
      throw new Error('Failed to get the bounds.');
    }

    // 1. SVG のヘッダーを書き込む
    SVG.writeSVGHeader(this.outputStream, this.canvasWidth, this.canvasHeight);

    // 2. タイトルを描画する
    if (this.title) {
      SVG.writeSVGTitle(this.outputStream, this.title);
    }

    // 3. geojson ファイルを読み込んで、各 feature を描画する
    const iteratorWithFeature = GeoJsonConverter.convert(
      inputFile,
      this.encoder
    );
    await this.renderGeoJson(iteratorWithFeature);

    // 4. SVG のフッターを書き込む
    SVG.writeSVGFooter(this.outputStream);

    this.outputStream.end();

    // 5. SVG を PNG に変換する
    await SVG.convertSVGtoPNG(
      outputFile,
      this.canvasWidth,
      this.canvasHeight,
      this.bgColor
    );
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
    this.canvasHeight = this.fixNumber(this.canvasWidth * geoAspect);

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

    for await (const feature of iterator) {
      T.geojsonType(feature, 'Feature', 'geojson feature');
      const { geometry, properties } = feature;
      const score =
        properties && this.scoreKey
          ? Number(properties[this.scoreKey])
          : undefined;

      switch (geometry.type) {
        case 'Point':
          this.renderPoint(geometry.coordinates, score);
          break;
        case 'MultiPoint':
          for (const coord of geometry.coordinates) {
            this.renderPoint(coord, score);
          }
          break;

        case 'LineString':
          this.renderLineString(geometry.coordinates, score);
          break;
        case 'MultiLineString':
          for (const line of geometry.coordinates) {
            this.renderLineString(line, score);
          }
          break;

        case 'Polygon':
          this.renderPolygon(geometry.coordinates, score);
          break;
        case 'MultiPolygon':
          for (const polygon of geometry.coordinates) {
            this.renderPolygon(polygon, score);
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

  private renderPoint(coord: number[], score?: number): void {
    const [x, y] = this.project(coord);
    const element = `<circle cx="${x}" cy="${y}" r="1" fill="${this.colorize(
      this.fillStyle,
      score
    )}"/>\n`;
    this.outputStream?.write(element);
  }

  private renderLineString(line: number[][], score?: number): void {
    const d = line.map(([x, y]) => this.project([x, y]).join(',')).join(' ');
    const element = `<polyline points="${d}" stroke="${this.colorize(
      this.fillStyle,
      score
    )}" stroke-width="${this.lineWidth}"/>\n`;
    this.outputStream?.write(element);
  }

  private renderPolygon(polygon: number[][][], score?: number): void {
    for (const ring of polygon) {
      const d = ring.map(([x, y]) => this.project([x, y]).join(',')).join(' ');
      const element = `<polygon points="${d}" fill="${this.colorize(
        this.fillStyle,
        score
      )}" stroke="${this.strokeStyle}" stroke-width="${this.lineWidth}"/>\n`;
      this.outputStream?.write(element);
    }
  }

  private colorize(basicColor: string, score: number | undefined): string {
    if (this.scale && score) {
      return this.scale(score);
    }

    return basicColor;
  }

  private fixNumber(num: number) {
    return Number(num.toFixed(0));
  }
}
