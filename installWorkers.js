#!/usr/bin/env node
'use strict';

const process = require('process');
const fs = require('fs');

let srcDir = `node_modules/@cloudempiere/cd-www/dist/assets`

let destDir;
if (process.argv[2]) {
	destDir = process.argv[2];
} else {
	destDir = 'src/assets';
}

let files = ['loggingWorker.js',  'netWorker.js',  'pouchWorker.js',  'stompWorker.js', 'commonWorker.js'];
files.forEach((file) => {
	let src = `${srcDir}/${file}`;
	let dest = `${destDir}/${file}`;
	console.log(`copy: ${src} --> ${dest}`);
	fs.copyFileSync(src, dest);
});
