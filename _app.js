'use strict';

require('classlist-polyfill');
const Promise = require('bluebird');
const md = require('markdown').markdown.toHTML;
const headerHTML = require('./header.html');
const preStyles = require('./prestyles.css');
const replaceURLs = require('./lib/replaceURLs');

// Browserify + Stringify not supporting syntax like
// require(`./style${i}.css`)
// Need to require explicity every single file
let styleText = [];
styleText.push(require(`./styles0.css`));
styleText.push(require(`./styles1.css`));
styleText.push(require(`./styles2.css`));
styleText.push(require(`./styles3.css`));
styleText.push(require(`./styles4.css`));

// same above here
const optimusAscii = [];
optimusAscii.push(require('./optimus-ascii.txt'));
optimusAscii.push(require('./optimus-ascii2.txt'));

const WaveSurfer = require('./lib/wavesurfer');

// Ghetto per-browser prefixing
const browserPrefix = require('./lib/getPrefix')();
if (browserPrefix) {
  styleText = styleText.map(function(text) {
    return text.replace(/-webkit-/g, browserPrefix);
  });
}


// Wait for load to get started.
document.addEventListener("DOMContentLoaded", doWork);

// some important stuffs
const speed = 2;
let style, styleEl, optimusAsciiEl, musicEl, skipAnimationEl, pauseEl;
let animationSkipped = false;
let done = false;
let paused = false;
let resume = null;

function doWork(){

  // Preload basic styles
  const preStyleEl = document.createElement('style');

  preStyleEl.textContent = preStyles;
  document.head.insertBefore(preStyleEl, document.getElementsByTagName('style')[0]);

  // Populate header.
  const header = document.getElementById('header');
  header.innerHTML = headerHTML;

  // El refs
  style = document.getElementById('style-tag');
  styleEl = document.getElementById('terminal');
  optimusAsciiEl = document.getElementById('optimus-ascii');
  musicEl = document.getElementById('music');
  skipAnimationEl = document.getElementById('skip-animation');
  pauseEl = document.getElementById('pause-resume');

  // Mirror user edits back to the style element.
  styleEl.addEventListener('input', function() {
    style.textContent = styleEl.textContent;
  });

  // Skip anim on click to skipAnimation
  skipAnimationEl.addEventListener('click', function(e) {
    e.preventDefault();
    animationSkipped = true;
  });

  pauseEl.addEventListener('click', function(e) {
    e.preventDefault();
    if (paused) {
      pauseEl.textContent = "Pause";
      paused = false;
    } else {
      pauseEl.textContent = "Resume";
      paused = true;
    }
  });

  writeTo(styleEl, styleText[0], 0, speed, true, 1)()
  .then(writeTo(optimusAsciiEl, optimusAscii[0], 0, speed, false, 1))
  .then(writeTo(styleEl, styleText[1], 0, speed, true, 1))
  .then(writeTo(optimusAsciiEl, optimusAscii[1], 0, speed, false, 1))
  .then(writeTo(styleEl, styleText[2], 0, speed, true, 1))
  .delay(1000)
  .then(writeTo(styleEl, styleText[3], 0, speed, true, 1))
  .delay(1000)
  .then(writeTo(styleEl, styleText[4], 0, speed, true, 1))
  .catch(function(e) {
    if (e.message === "SKIP IT") {
      skipAnimation();
    }
  });
}

// Skips all the animations.
function skipAnimation() {
  if (done) return;
  done = true;
  const txt = styleText.join('\n');

  // The optimus-ascii animations are rough
  style.textContent = "#optimus-ascii * { " + browserPrefix + "transition: none; }";
  style.textContent += txt;
  let styleHTML = "";
  for(let i = 0; i < txt.length; i++) {
     styleHTML = handleChar(styleHTML, txt[i]);
  }
  styleEl.innerHTML = styleHTML;

  optimusAsciiEl.innerHTML = optimusAscii[0] + optimusAscii[1];

  // There's a bit of a scroll problem with this thing
  const start = Date.now();
  const interval = setInterval(function() {
    optimusAsciiEl.scrollTop = Infinity;
    if (Date.now() - 1000 > start) clearInterval(interval);
  }, 0);

  // makeSomeNoise();
}


/**
 * Helpers
 */

//
// Writing to boxes
//

let openComment = false;
let styleBuffer = '';
const fullTextStorage = {};
function writeChar(el, char, buffer){
  // Grab text. We buffer it in storage so we don't have to read from the DOM every iteration.
  let fullText = fullTextStorage[el.id];
  if (!fullText) fullText = fullTextStorage[el.id] = el.innerHTML;

  fullText = handleChar(fullText, char);
  // But we still write to the DOM every iteration, which can be pretty slow.
  el.innerHTML = fullTextStorage[el.id] = fullText;

  // Buffer writes to the <style> element so we don't have to paint quite so much.
  styleBuffer += char;
  if (char === ';') {
    style.textContent += styleBuffer;
    styleBuffer = '';
  }
}

function handleChar(fullText, char) {
  if (char === '/' && openComment === false) {
    openComment = true;
    fullText += char;
  } else if (char === '/' && fullText.slice(-1) === '*' && openComment === true) {
    openComment = false;
    // Unfortunately we can't just open a span and close it, because the browser will helpfully
    // 'fix' it for us, and we'll end up with a single-character span and an empty closing tag.
    fullText = fullText.replace(/(\/\*(?:[^](?!\/\*))*\*)$/, '<span class="comment">$1/</span>');
  } else if (char === ':') {
    fullText = fullText.replace(/([a-zA-Z- ^\n]*)$/, '<span class="key">$1</span>:');
  } else if (char === ';') {
    fullText = fullText.replace(/([^:]*)$/, '<span class="value">$1</span>;');
  } else if (char === '{') {
    fullText = fullText.replace(/(.*)$/, '<span class="selector">$1</span>{');
  } else if (char === 'x' && /\dp/.test(fullText.slice(-2))) {
    fullText = fullText.replace(/p$/, '<span class="value px">px</span>');
  } else {
    fullText += char;
  }
  return fullText;
}

function writeSimpleChar(el, char) {
  el.innerHTML += char;
}

const endOfSentence = /[\.\?\!]\s$/;
const endOfBlock = /[^\/]\n\n$/;

function writeTo(el, message, index, interval, mirrorToStyle, charsPerInterval){

  return function() {
    return Promise.try(function() {
      if (animationSkipped) {
        // Lol who needs proper flow control
        throw new Error('SKIP IT');
      }
      // Write a character or multiple characters to the buffer.
      const chars = message.slice(index, index + charsPerInterval);
      index += charsPerInterval;

      // Ensure we stay scrolled to the bottom.
      el.scrollTop = el.scrollHeight;

      // If this is going to <style> it's more complex; otherwise, just write.
      if (mirrorToStyle) {
        writeChar(el, chars);
      } else {
        writeSimpleChar(el, chars);
      }
    })
    .then(function() {
      if (index < message.length) {
        // Schedule another write.
        let thisInterval = interval;
        const thisSlice = message.slice(index - 2, index + 1);
        if (!isDev) {
          if (endOfSentence.test(thisSlice)) thisInterval *= 70;
          if (endOfBlock.test(thisSlice)) thisInterval *= 50;
        }

        return thisInterval;
      }
    })
    .then(function wait(thisInterval) {
      if (typeof thisInterval !== "number") return;
      if (paused) {
        return Promise.delay(thisInterval).then(wait.bind(null, thisInterval));
      } else {
        return Promise.delay(thisInterval)
        .then(writeTo(el, message, index, interval, mirrorToStyle, charsPerInterval));
      }
    });
  };
}

function makeSomeNoise() {
  const wavesurfer = Object.create(WaveSurfer);

  wavesurfer.init({
      container: document.querySelector('#music'),
      waveColor: 'violet',
      progressColor: 'purple'
  });

  wavesurfer.on('ready', function () {
      wavesurfer.play();
  });

  wavesurfer.load('./demo.mp3');
  return 1;
}
