import fs from 'fs';
import GeoJsonRenderer from './render';
import script from './script';

(async () => {
  const props = await script();
  const { inputFile, outputDir, ...parameters } = props;

  if (!inputFile || !fs.existsSync(inputFile) || !outputDir) {
    throw new Error('Input file or output directory does not exist.');
  }

  const renderer = new GeoJsonRenderer(parameters);

  await renderer.save(inputFile as string, outputDir as string);
})();
