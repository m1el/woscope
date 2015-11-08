'use strict';

let woscope = require('../');

let libraryInfo = [
    {
        file: 'khrang.ogg',
        author: 'Jerobeam Fenderson',
        title: 'Khrậng',
        link: 'https://www.youtube.com/watch?v=vAyCl4IHIz8',
        swap: true,
    },
    {
        file: 'oscillofun.ogg',
        author: 'ATOM DELTA',
        title: 'Oscillofun',
        link: 'https://www.youtube.com/watch?v=o4YyI6_y6kw',
        invert: true,
    },
    {
        file: 'alpha_molecule.ogg',
        author: 'Alexander Taylor',
        title: 'The Alpha Molecule',
        link: 'https://www.youtube.com/watch?v=XM8kYRS-cNk',
        invert: true,
    },
];

let libraryDict = {};
for (let e of libraryInfo) {
    libraryDict[e.file] = e;
}

let query = parseq(location.search);
if (!query.file) {
    query = libraryInfo[0];
}

let file = query.file;
let audioUrl = './woscope-music/' + file;

window.onload = function() {
    let canvas = $('c'),
        htmlAudio = $('htmlAudio');

    updatePageInfo();

    htmlAudio.volume = 0.5;

    woscope({
      canvas: canvas,
      htmlAudio: htmlAudio,
      audioUrl: audioUrl,
      swap: query.swap,
      invert: query.invert
    });
};

function $(id) { return document.getElementById(id); }

function parseq(search) {
    search = search.replace(/^\?/, '');
    let obj = {};
    for (let pair of search.split('&')) {
        pair = pair.split('=');
        obj[decodeURIComponent(pair[0])] =
            pair.length > 1 ? decodeURIComponent(pair[1]) : true;
    }
    return obj;
}

function dumpq(obj) {
    return Object.keys(obj).map(function(key) {
        if (obj[key] === true) {
            return encodeURIComponent(key);
        } else {
            return encodeURIComponent(key) + '=' + encodeURIComponent(obj[key]);
        }
    }).join('&');
}

function updatePageInfo() {
    if (file in libraryDict) {
        let info = libraryDict[file],
            text = document.createTextNode(info.author + ' — ' + info.title + ' '),
            songInfo = $('songInfo'),
            a = document.createElement('a'),
            linkText = document.createTextNode('[link]');

        a.appendChild(linkText);
        a.href = info.link;
        songInfo.innerHTML = '';
        songInfo.appendChild(text);
        songInfo.appendChild(a);
    }

    let ul = $('playList');
    ul.innerHTML = '';
    for (let song of libraryInfo) {
        let a = document.createElement('a'),
            li = document.createElement('li');
        a.appendChild(document.createTextNode(song.title));

        let q = {file: song.file};
        if (song.swap) { q.swap = true; }
        if (song.invert) { q.invert = true; }
        a.href = '?' + dumpq(q);

        li.appendChild(a);
        ul.appendChild(li);
    }
}
