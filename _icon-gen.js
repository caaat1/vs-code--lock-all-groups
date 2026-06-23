'use strict';
const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');
const path = require('path');

const svg = fs.readFileSync(path.join(__dirname, 'icon.svg'), 'utf-8');
const png = new Resvg(svg, { fitTo: { mode: 'width', value: 128 } }).render().asPng();
fs.writeFileSync(path.join(__dirname, 'icon.png'), png);
console.log('icon.png written');
