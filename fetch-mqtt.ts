import { readJson, writeFile } from 'fs-extra';
import * as path from 'path';

import fetch from 'node-fetch';

async function fetchMqtt() {
    const {
        devDependencies: { mqtt: version },
    } = await readJson(path.join(process.cwd(), 'package.json'));
    const dir = path.join(process.cwd(), 'src', 'mqtt');
    const indexPath = path.join(dir, 'index.js');
    const index = await fetch(`https://unpkg.com/mqtt@${version}/dist/mqtt.js`);
    await writeFile(indexPath, await index.text());
}

fetchMqtt();