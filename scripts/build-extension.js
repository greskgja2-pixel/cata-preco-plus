'use strict';

const fs = require('node:fs');
const path = require('node:path');
const archiver = require('archiver');

const root = path.join(__dirname, '..');
const source = path.join(root, 'extension');
const outputDir = path.join(root, 'public', 'downloads');
const outputPath = path.join(outputDir, 'coletor-cata-preco-plus.zip');

if (!fs.existsSync(path.join(source, 'manifest.json'))) throw new Error('manifest.json da extensão não encontrado.');
fs.mkdirSync(outputDir, { recursive: true });

const stream = fs.createWriteStream(outputPath);
const archive = archiver('zip', { zlib: { level: 9 } });
archive.on('warning', error => { if (error.code !== 'ENOENT') throw error; });
archive.on('error', error => { throw error; });
stream.on('close', () => process.stdout.write(`Extensão gerada: ${outputPath} (${archive.pointer()} bytes)\n`));
archive.pipe(stream);
archive.directory(source, false);
archive.finalize();
