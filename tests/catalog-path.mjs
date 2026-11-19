import fs from 'node:fs';
const pointer='dist/catalog-data/current.json';
export const catalogRoot=fs.existsSync(pointer)?JSON.parse(fs.readFileSync(pointer,'utf8')).dataRoot:'catalog-data';
export const catalogPath=file=>'dist/'+catalogRoot+'/'+file;
