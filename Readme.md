## woscope: oscilloscope emulator

This is a POC oscilloscope emulator with [live demo](http://m1el.github.io/woscope/)

Full explanation available on [the blag](http://m1el.github.io/woscope-how/)

Code is available under MIT license.

### Example
```html
<audio id="myAudio" controls src="woscope-music/khrang.mp3"></audio><br>
<canvas id="myCanvas" width="800" height="800"></canvas>
<script src="dist/woscope.js"></script>
<script>
    var myCanvas = document.getElementById('myCanvas'),
        myAudio = document.getElementById('myAudio');

    woscope({
        canvas: myCanvas,
        audio: myAudio,
        callback: function () { htmlAudio.play(); }
    });
</script>
```

### Dev commands
```sh
npm install      # install dev dependencies
npm run demo     # run demo locally with livereload
npm run build    # build dist files
npm run lint     # check source files with jshint
```
