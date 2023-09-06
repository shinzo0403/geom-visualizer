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
    demandOption: false,
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

  // 対話型プロンプトの配列を動的に生成
  const prompts = [];

  for (const [key, option] of Object.entries(OPTIONS)) {
    // argv[key] が未定義の場合、ユーザーに尋ねる
    if (argv[key] === undefined || argv[key] === option.default) {
      const basePrompt = {
        name: key,
        default: option.default,
      };

      switch (option.type) {
        case 'string':
          prompts.push({
            ...basePrompt,
            type: 'input',
            message: `Enter ${option.describe?.toLowerCase()}:`,
          });
          break;
        case 'number':
          prompts.push({
            ...basePrompt,
            type: 'number',
            message: `Enter ${option.describe?.toLowerCase()}(Enter to skip):`,
          });
          break;
        // 他のタイプの場合も必要に応じて追加
      }
    }
  }

  // prompts 配列が空でなければ inquirer を使って対話型プロンプトを表示
  const responses = prompts.length > 0 ? await inquirer.prompt(prompts) : {};

  const props = Object.assign({}, argv, responses);

  return props as Partial<Props>;
}
