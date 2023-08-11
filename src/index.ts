import GeoJsonRenderer from './render';
import script from './script';
import * as C from './constants';

(async () => {
  const props = await script();
  const { inputFile, ...parameters } = props;

  const renderer = new GeoJsonRenderer(parameters);

  await renderer.save(inputFile as string, C.OUT_DIR);
})();
