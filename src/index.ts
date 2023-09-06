#!/usr/bin/env node

import fs from 'fs';
import GeoJsonRenderer from './render.js';
import script from './script.js';
import { Props } from './types/type.js';

export default async function visualize(props: Partial<Props>) {
  const { inputFile, outputDir, ...parameters } = props;

  if (!inputFile || !fs.existsSync(inputFile) || !outputDir) {
    throw new Error('Input file or output directory does not exist.');
  }

  const renderer = new GeoJsonRenderer(parameters);

  await renderer.save(inputFile as string, outputDir as string);
}

(async () => {
  const props = await script();
  await visualize(props);
})();
