import fs from 'node:fs';
import path from 'node:path';

const [, , filename] = process.argv;
const sourcePath = path.resolve('.', path.dirname(filename));
const contents = fs.readFileSync(filename).toString();

process.stdout.write(
  contents.replace(/\$embed: (.+)\$/g, (_, snippet) => {
    return fs.readFileSync(path.resolve(sourcePath, snippet)).toString().trim();
  }),
);
