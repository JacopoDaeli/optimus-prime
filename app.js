'use strict';

require('classlist-polyfill');
var Promise = require('bluebird');
var md = require('markdown').markdown.toHTML;
var makeSomeNoise = require('./lib/wavesurfer').makeSomeNoise;

var optimusAscii = [];
optimusAscii.push(require('./optimus-ascii.txt'));
optimusAscii.push(require('./optimus-ascii2.txt'));

var headerHTML = require('./header.html');

var styleText = [];
styleText.push(require('./styles0.css'));
styleText.push(require('./styles1.css'));
styleText.push(require('./styles2.css'));
styleText.push(require('./styles3.css'));
styleText.push(require('./styles4.css'));

var preStyles = require('./prestyles.css');
var replaceURLs = require('./lib/replaceURLs');

// Ghetto per-browser prefixing
var browserPrefix = require('./lib/getPrefix')();
if (browserPrefix) {
  styleText = styleText.map(function(text) {
    return text.replace(/-webkit-/g, browserPrefix);
  });
}


// Wait for load to get started.
document.addEventListener("DOMContentLoaded", doWork);

// Vars that will help us get er done
var isDev = window.location.hostname === 'localhost';
var speed = isDev ? 0 : 10;
var style, terminalEl, optimusAsciiEl, musicEl, skipAnimationEl, pauseEl;
var animationSkipped = false, done = false;
var paused = false, resume = null;
function doWork(){


  // We're cheating a bit on styles.
  var preterminalEl = document.createElement('style');
  preterminalEl.textContent = preStyles;
  document.head.insertBefore(preterminalEl, document.getElementsByTagName('style')[0]);

  // Populate header.
  var header = document.getElementById('header');
  header.innerHTML = headerHTML;

  // El refs
  style = document.getElementById('style-tag');
  terminalEl = document.getElementById('terminal');
  optimusAsciiEl = document.getElementById('optimus-ascii');
  musicEl = document.getElementById('music');
  skipAnimationEl = document.getElementById('skip-animation');
  pauseEl = document.getElementById('pause-resume');

  // Mirror user edits back to the style element.
  terminalEl.addEventListener('input', function() {
    style.textContent = terminalEl.textContent;
  });

  // Skip anim on click to skipAnimation
  skipAnimationEl.addEventListener('click', function(e) {
    e.preventDefault();
    animationSkipped = true;
  });

  pauseEl.addEventListener('click', function(e) {
    e.preventDefault();
    if (paused) {
      pauseEl.textContent = "Pause ||";
      paused = false;
    } else {
      pauseEl.textContent = "Resume >>";
      paused = true;
    }
  });

  if (!isDev || true) {
    writeTo(terminalEl, styleText[0], 0, speed, true, 1)()
    .then(writeTo(optimusAsciiEl, optimusAscii[0], 0, speed, false, 1))
    .then(writeTo(terminalEl, styleText[1], 0, speed, true, 1))
    .then(writeTo(optimusAsciiEl, optimusAscii[1], 0, speed, false, 1))
    .delay(1000)
    .then(writeTo(terminalEl, styleText[2], 0, speed, true, 1))
    .then(writeTo(terminalEl, styleText[3], 0, speed, true, 1))
    .then(makeSomeNoise.bind(null, musicEl))
    .delay(14000)
    .then(writeTo(terminalEl, styleText[4], 0, speed, true, 1))
    .catch(function(e) {
      if (e.message === "SKIP IT") {
        makeSomeNoise(musicEl, true);
        skipAnimationFn();
      }
    });
  } else {
    skipAnimationFn();
  }
}

// Skips all the animations.
function skipAnimationFn() {
  if (done) return;
  done = true;
  var txt = styleText.join('\n');

  // The optimus-ascii animations are rough
  style.textContent = "#optimus-ascii * { " + browserPrefix + "transition: none; }";
  style.textContent += txt;
  var styleHTML = "";
  for(var i = 0; i < txt.length; i++) {
     styleHTML = handleChar(styleHTML, txt[i]);
  }
  terminalEl.innerHTML = styleHTML;
  optimusAsciiEl.innerHTML = optimusAscii[0] + optimusAscii[1];

  // Make scroll right
  var start = Date.now();
  var interval = setInterval(function() {
    optimusAsciiEl.scrollTop = Infinity;
    terminalEl.scrollTop = Infinity;
    if (Date.now() - 1000 > start) clearInterval(interval);
  }, 0);

}


/**
 * Helpers
 */

var openComment = false;
var styleBuffer = '';
var fullTextStorage = {};
function writeChar(el, char, buffer){
  // Grab text. We buffer it in storage so we don't have to read from the DOM every iteration.
  var fullText = fullTextStorage[el.id];
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
  if (openComment && char !== '/') {
    // Short-circuit during a comment so we don't highlight inside it.
    fullText += char;
  } else if (char === '/' && openComment === false) {
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

var endOfSentence = /[\.\?\!]\s$/;
var endOfBlock = /[^\/]\n\n$/;
function writeTo(el, message, index, interval, mirrorToStyle, charsPerInterval){
  return function() {
    return Promise.try(function() {
      if (animationSkipped) {
        // Lol who needs proper flow control
        throw new Error('SKIP IT');
      }
      // Write a character or multiple characters to the buffer.
      var chars = message.slice(index, index + charsPerInterval);
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
        var thisInterval = interval;
        var thisSlice = message.slice(index - 2, index + 1);
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
