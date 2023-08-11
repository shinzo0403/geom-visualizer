import yargs, { Options } from 'yargs';
import inquirer from 'inquirer';
import { execSync } from 'child_process';
import { hideBin } from 'yargs/helpers';
import fs from 'fs';
import { Props } from './type';
import * as C from './constants';

const OPTIONS: { [key: string]: Options } = {
  title: {
    type: 'string',
    describe: 'Title for the canvas',
    default: C.DEFAULT_TITLE,
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
  const inputFile = process.argv[2];

  console.log(process.argv);

  if (!inputFile || !fs.existsSync(inputFile)) {
    console.error(
      'Input file is not specified or does not exist. :' + inputFile
    );
    process.exit(1);
  }

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
      name: 'title',
      message: 'Enter title for the canvas:',
      default: argv.title,
    },
    {
      type: 'number',
      name: 'canvasWidth',
      message: 'Enter width of the canvas:',
      default: argv.canvasWidth,
    },
    {
      type: 'input',
      name: 'strokeStyle',
      message: 'Enter stroke style:',
      default: argv.strokeStyle,
    },
    {
      type: 'number',
      name: 'lineWidth',
      message: 'Enter line width:',
      default: argv.lineWidth,
    },
    {
      type: 'input',
      name: 'fillStyle',
      message: 'Enter fill style:',
      default: argv.fillStyle,
    },
    {
      type: 'input',
      name: 'bgColor',
      message: 'Enter background color:',
      default: argv.bgColor,
    },
    {
      type: 'input',
      name: 'scoreKey',
      message: 'Enter score key:',
      default: argv.scoreKey,
    },
  ]);

  const props = Object.assign({}, argv, responses, { inputFile });

  return props as Partial<Props>;
}
