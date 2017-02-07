'use strict';

let woscope = require('../');

let libraryInfo = [
    {
        file: 'khrang.ogg',
        mpeg: 'khrang.m4a',
        author: 'Jerobeam Fenderson',
        title: 'Khrậng',
        link: 'https://www.youtube.com/watch?v=vAyCl4IHIz8',
        swap: true,
    },
    {
        file: 'oscillofun.ogg',
        mpeg: 'oscillofun.mp3',
        author: 'ATOM DELTA',
        title: 'Oscillofun',
        link: 'https://www.youtube.com/watch?v=o4YyI6_y6kw',
        invert: true,
    },
    {
        file: 'alpha_molecule.ogg',
        mpeg: 'alpha_molecule.mp3',
        author: 'Alexander Taylor',
        title: 'The Alpha Molecule',
        link: 'https://www.youtube.com/watch?v=XM8kYRS-cNk',
        invert: true,
    },
];

let libraryDict = {};
libraryInfo.forEach(function (e) {
    libraryDict[e.file] = e;
});

let query = parseq(location.search);
if (!query.file) {
    query = libraryInfo[0];
}

let file = query.file;

window.onload = function() {
    let htmlAudio = $('htmlAudio');

    updatePageInfo();

    htmlAudio.src = './woscope-music/' + (htmlAudio.canPlayType('audio/ogg') ? file : libraryDict[file].mpeg);
    htmlAudio.load();

    window.onresize();

    initWoscope();
};

function initWoscope(config) {
    let canvas = $('c'),
        htmlAudio = $('htmlAudio'),
        htmlError = $('htmlError');

    config = Object.assign({
      canvas: canvas,
      audio: htmlAudio,
      callback: function () { htmlAudio.play(); },
      error: function (msg) { htmlError.innerHTML = msg; },
      color: [1/32, 1, 1/32, 1],
      color2: [1, 0, 1, 1],
      background: [0, 0, 0, 1],
      swap: query.swap,
      invert: query.invert,
      sweep: query.sweep,
      bloom: query.bloom,
      live: query.live,
    }, config);

    let myWoscope = woscope(config);

    setupOptionsUI(
        function (options) { return Object.assign(myWoscope, options); },
        {
            swap: 'swap channels',
            invert: 'invert coordinates',
            sweep: 'traditional oscilloscope display',
            bloom: 'add glow',
            live: 'analyze audio in real time\n\n' +
                '- no display while paused/scrubbing\n' +
                '- volume affects the display size\n' +
                '- does not work in Mobile Safari',
        }
    );
}

let mySourceNode;

function resetWoscope(woscopeInstance) {
    // Chrome has limit of one sourceNode per audio element, so keep a reference
    mySourceNode = woscopeInstance.sourceNode || mySourceNode;

    woscopeInstance.destroy();

    // replace canvas. more compatible than restoring gl context on old canvas
    let canvas = $('c');
    let replacement = document.createElement('div');
    replacement.innerHTML = canvas.outerHTML;
    canvas.parentNode.replaceChild(replacement.firstChild, canvas);

    // prevent doubled audio
    if (query.live && mySourceNode) {
        mySourceNode.disconnect();
    }

    initWoscope({sourceNode: mySourceNode});
}

window.onresize = function () {
    let canvas = $('c'),
        length = Math.min(window.innerHeight, canvas.parentNode.offsetWidth);
    canvas.width = length;
    canvas.height = length;
};

function $(id) { return document.getElementById(id); }

function parseq(search) {
    search = search.replace(/^\?/, '');
    let obj = {};
    search.split('&').forEach(function (pair) {
        pair = pair.split('=');
        obj[decodeURIComponent(pair[0])] =
            pair.length > 1 ? decodeURIComponent(pair[1]) : true;
    });
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
    libraryInfo.forEach(function (song) {
        let a = document.createElement('a'),
            li = document.createElement('li');
        a.appendChild(document.createTextNode(song.title));

        a.href = '?' + dumpq(makeQuery(song));

        li.appendChild(a);
        ul.appendChild(li);
    });
}

function makeQuery(song) {
    let q = {file: song.file};
    if (song.swap) { q.swap = true; }
    if (song.invert) { q.invert = true; }
    if (query.live) { q.live = true; }
    return q;
}

function setupOptionsUI(updater, options) {
    let ul = $('options');
    ul.innerHTML = '';
    Object.keys(options).forEach(function (param) {
        let li = document.createElement('li');
        li.innerHTML = `<label title="${options[param]}"><input type="checkbox" id="${param}"> ${param}</label>`;
        let input = li.firstChild.firstChild;

        input.checked = query[param];
        input.onchange = (param === 'live') ? getLiveToggle() : toggle;

        ul.appendChild(li);
    });

    function getLiveToggle() {
        // prefer to reset woscope when toggling live mode, but Safari viz loses
        // sync when live = false and a MediaElementSourceNode is attached to
        // the audio element, so reload page instead.
        // this depends on Safari using webkitAudioContext and may be fragile
        return (window.AudioContext) ? toggleAndReset : toggleAndReload;
    }
    function toggle(e) {
        updateUrl(e);
        let result = {};
        result[e.target.id] = e.target.checked;
        updater(result);
    }
    function toggleAndReset(e) {
        updateUrl(e);
        updatePageInfo();
        resetWoscope(updater());
    }
    function toggleAndReload(e) {
        location.href = makeUrl(e);
    }
    function updateUrl(e) {
        history.replaceState(null, '', makeUrl(e));
        query = parseq(location.search);
    }
    function makeUrl(e) {
        let q = parseq(location.search);
        if (!q.file) {
            q = makeQuery(libraryInfo[0]);
        }
        if (e.target.checked) {
            q[e.target.id] = true;
        } else {
            delete q[e.target.id];
        }
        return '?' + dumpq(q);
    }
}
