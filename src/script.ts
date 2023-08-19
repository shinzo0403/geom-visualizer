import inquirer from 'inquirer';
import yargs, { Options } from 'yargs';
import { hideBin } from 'yargs/helpers';
import * as C from './constants.js';
import { Props } from './types/type.js';

const OPTIONS: { [key: string]: Options } = {
  inputFile: {
    type: 'string',
    describe: 'Input file',
  },
  outputDir: {
    type: 'string',
    describe: 'Output directory',
  },
  title: {
    type: 'string',
    describe: 'Title for the canvas',
    default: C.DEFAULT_TITLE,
  },
  encoder: {
    type: 'string',
    describe: 'Encoder',
    default: C.DEFAULT_ENCODER,
  },
  canvasWidth: {
    type: 'number',
    describe: 'Width of the canvas',
    default: C.DEFAULT_CANVAS_WIDTH,
  },
  strokeStyle: {
    type: 'string',
    describe: 'Stroke style',
    default: C.DEFAULT_STROKE_STYLE,
  },
  lineWidth: {
    type: 'number',
    describe: 'Line width',
    default: C.DEFAULT_LINE_WIDTH,
  },
  fillStyle: {
    type: 'string',
    describe: 'Fill style',
    default: C.DEFAULT_FILL_STYLE,
  },
  bgColor: {
    type: 'string',
    describe: 'Background color',
    default: C.DEFAULT_BG_COLOR,
  },
  scoreKey: {
    type: 'string',
    describe: 'Score key',
    default: C.DEFAULT_SCORE_KEY,
  },
};

function isPromise(obj: any): obj is Promise<unknown> {
  return !!obj && typeof obj.then === 'function';
}

export default async function script() {
  // yargs を使って CLI 引数を取得
  const asyncArgv = yargs(hideBin(process.argv)).options(OPTIONS).argv;

  // promise かどうかで分岐
  const argv = isPromise(asyncArgv) ? await asyncArgv : asyncArgv;

  // inquirer を使って対話型のプロンプトを表示
  const responses: {
    [key: string]: string | number | null;
  } = await inquirer.prompt([
    {
      type: 'input',
      name: 'inputFile',
      message: 'Enter input file:',
    },
    {
      type: 'input',
      name: 'outputDir',
      message: 'Enter output directory:',
    },
    {
      type: 'input',
      name: 'title',
      message: 'Enter title for the canvas:',
      default: argv.title,
    },
    {
      type: 'input',
      name: 'encoder',
      message: 'Enter encoder(Enter to skip):',
      default: argv.encoder,
    },
    {
      type: 'number',
      name: 'canvasWidth',
      message: 'Enter width of the canvas(Enter to skip):',
      default: argv.canvasWidth,
    },
    {
      type: 'input',
      name: 'strokeStyle',
      message: 'Enter stroke style(Enter to skip):',
      default: argv.strokeStyle,
    },
    {
      type: 'number',
      name: 'lineWidth',
      message: 'Enter line width(Enter to skip):',
      default: argv.lineWidth,
    },
    {
      type: 'input',
      name: 'fillStyle',
      message: 'Enter fill style(Enter to skip):',
      default: argv.fillStyle,
    },
    {
      type: 'input',
      name: 'bgColor',
      message: 'Enter background color(Enter to skip):',
      default: argv.bgColor,
    },
    {
      type: 'input',
      name: 'scoreKey',
      message: 'Enter score key(Enter to skip):',
      default: argv.scoreKey,
    },
  ]);

  const props = Object.assign({}, argv, responses);

  return props as Partial<Props>;
}
