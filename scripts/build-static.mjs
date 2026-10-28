import {cp, mkdir, rm} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'dist');

const files = [
    'index.html',
    'site.webmanifest',
    'css/main.css',
    'css/frogcourt.css',
    'data/connectome.bin.gz',
    'data/neuron_meta.json',
    'js/constants.js',
    'js/connectome.js',
    'js/brain-worker-bridge.js',
    'js/neuro-renderer.js',
    'js/fly-logic.js',
    'js/brain3d.js',
    'js/education.js',
    'js/main.js',
    'js/sim-worker.js',
    'js/frogcourt.js',
    'js/vendor/three.min.js',
    'js/vendor/OrbitControls.js',
    'svg/center.svg',
    'svg/clear.svg',
    'svg/github.svg',
    'svg/frogcourt-seal.svg',
];

await rm(output, {recursive: true, force: true});

for (const relative of files) {
    const destination = join(output, relative);
    await mkdir(dirname(destination), {recursive: true});
    await cp(join(root, relative), destination);
}

console.log(`Built Frog Court static artifact with ${files.length} files.`);
