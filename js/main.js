// Copyright (c) 2015-2016, Masahiko Imanaka. All rights reserved.
/* global KeyEvent, Swiper */
/* jshint moz:true, esnext:true */

(function() {
'use strict';

var inputContext = null,
    mgmt = window.navigator.mozInputMethod.mgmt,
    formInputType = null,
    formInputMode = null,
    formLang = null;

var keyboardElement = document.getElementById('keyboard'),
    suggExpandButton = document.getElementById('suggExpandButton'),
    wordSuggestsElement = document.getElementById('wordSuggests'),
    keyContainer = document.getElementById('keyContainer'),
    swipeContainer = new Swiper(keyContainer),
    cachedWindowHeight = screen.availHeight,
    cachedWindowWidth = screen.availWidth;


function jakInit() {
  keyboardElement.addEventListener('mousedown', function onMouseDown(ev) {
    ev.preventDefault();
  }, false);

  swipeContainer.start();
  swipeContainer.ontouch = startKeyHandle;
  swipeContainer.onswiped = endKeyHandle;

  wordSuggestsElement.addEventListener('click', clickSuggestsBox, false);
  suggExpandButton.addEventListener('click', suggExpand, false);

  cachedWindowWidth = keyboardElement.clientWidth;
  cachedWindowHeight = keyboardElement.clientHeight;
  window.navigator.mozInputMethod.oninputcontextchange = function() {
    if (inputContext !== null) {
      Composer.clearCompose();
      toggleSuggestBox('collapse');
      TransferManager.resetSuggest();
      clearSuggests();
    }
    getInputContext();
    resizeWindow();
  };

  // Loading sample dic json file.
  getSampleDic();

  window.addEventListener('resize', resizeWindow, false);
  getInputContext();
}


function jakQuit() {
  swipeContainer.stop();
  wordSuggestsElement.removeEventListener('click', clickSuggestsBox, false);
  window.removeEventListener('resize', resizeWindow, false);
  window.removeEventListener('load', jakInit);
}


function getInputContext() {
  inputContext = window.navigator.mozInputMethod.inputcontext;
  if (inputContext) {
    formInputType = inputContext.inputType;
    formInputMode = inputContext.inputMode;
    formLang = inputContext.lang;
    //console.log('JaK form contexts - type:', formInputType, ' mode:', formInputMode);
  }
}

function resizeWindow() {
  window.resizeTo(cachedWindowWidth, cachedWindowHeight);
}



// Send key code to form.
function sendKeyCode(aKeyCode, isSpecial) {
  try {
    if (isSpecial) {
      inputContext.sendKey(aKeyCode, 0, 0);
    } else {
      inputContext.sendKey(0, aKeyCode, 0);
    }
  } catch(err) {
    Composer.clearCompose();
    console.error(err);
  }
}


// Key handlers.
function startKeyHandle(ev) {
  var ictx = inputContext,
      currentKey = ev.target;

  // Set backgound-color.
  toggleKeyStyle(currentKey, true);

  if (!ictx) {
    getInputContext();
  }
  // If form text is cleard by its clear button.
  if (ictx.textBeforeCursor.length < 1 &&
      ictx.textAfterCursor.length < 1 &&
      Composer.isComposing) {
    ictx.endComposition('');
    Composer.clearCompose();
    console.log('JaK - form is cleared.');
  }
}

function endKeyHandle(ev) {
  var currentKey = ev.target,
      tm = TransferManager;

  // Recover backgound-color.
  toggleKeyStyle(currentKey, false);

  if (currentKey.classList.contains('key')) {
    // Get char from class name.
    var val = currentKey.getAttribute('code');
    //console.log("keyHandle: currentKey.code=" + val);
    keyHandle(val, ev.direction).then(function () {
      //console.log('compose: ', Composer.relCursorPos, Composer.textStr, '/', tm.suggsLength, tm.targetKana, Composer.isComposing, '/', Composer.isTransferred);
      finalizeKeyHandle();
      if (Composer.isComposing) {
        if(tm.suggsLength > 0) {
          updateSuggests(tm.targetKana);
        } else {
          clearSuggests();
        }
      } else {
        tm.resetSuggest();
        clearSuggests();
      }
    }).catch(function(err) {
      console.error(err);
      clearSuggests();
    });
  }
}

function toggleKeyStyle(aKey, aIsTouched) {
  if (aIsTouched) {
    aKey.style.backgroundColor = '#f52';
  } else {
    if (aKey.classList.contains('key_ctrl')) {
      aKey.style.backgroundColor = '#222';
    } else {
      aKey.style.backgroundColor = '#555';
    }
  }
}


// Main Key Process.
function keyHandle(aKeyValue, aFlickDirection) {
  var ictx = inputContext,
      cp = Composer,
      tm = TransferManager,
      transPromise = null,
      ch = '',
      textBC = '',  // inputContext.textBeforeCursor.
      moveStep = 0;
  if (cp.isComposing) {
    switch (aKeyValue) {
      case 'UNDO':
        if (cp.isTransferred === true) {
          cp.isTransferred = false;
          tm.resetSuggest();
          cp.setCurrentStr(tm.lastKana);
          cp.relCursorPos = tm.targetKana.length;
        } else {
          if (cp.textStr === tm.lastKana) {
            cp.setCurrentStr('');
            tm.lastKana = '';
          }
        }
        break;
      case 'C_BS':
        // Backspace
        if (cp.isTransferred === true) {
          // Cancel transfer.
          cp.isTransferred = false;
          tm.resetSuggest();
          cp.setCurrentStr(tm.lastKana);
          cp.relCursorPos = tm.targetKana.length;
        } else {
          cp.backSpace();
          if (cp.textStr.length > 0) {
            tm.lastKana = cp.textStr;
            tm.targetKana = cp.textStr.slice(0, cp.relCursorPos);
            if (cp.relCursorPos > 0) {
              transPromise = getTransWords(tm.targetKana, false);
            } else {
              tm.resetSuggest();
            }
          } else {
            // Processed in finalizeKeyHandle().
          }
        }
        break;
      case 'C_LT':
        // Move cursor to left.
        if (cp.isTransferred === false) {
          cp.moveCursorPos(cp.relCursorPos - 1);
        } else {
          cp.setCurrentStr(tm.lastKana);
          moveStep = cp.moveCursorPos(tm.targetKana.length - 1);
          tm.targetKana = cp.textStr.slice(0, cp.relCursorPos);
          if (cp.relCursorPos > 0) {
            transPromise = getTransWords(tm.targetKana);
          } else {
            cp.isTransferred = false;
            tm.targetKana = '';
            tm.resetSuggest();
          }
        }
        break;
      case 'C_RT':
        // Move cursor to right.
        if (cp.isTransferred === false) {
          cp.moveCursorPos(cp.relCursorPos + 1);
        } else {
          cp.setCurrentStr(tm.lastKana);
          moveStep = cp.moveCursorPos(tm.targetKana.length + 1);
          if (moveStep !== 0) {
            tm.targetKana = cp.textStr.slice(0, cp.relCursorPos);
            transPromise = getTransWords(tm.targetKana);
          }
        }
        break;
      case 'XFER':
        if (cp.isTransferred === false) {
          if (cp.relCursorPos < 1) {
            cp.moveCursorPos(cp.textStr.length);
          }
          tm.targetKana = cp.textStr.slice(0, cp.relCursorPos);
          cp.isTransferred = true;
          transPromise = getTransWords(tm.targetKana);
        } else {
          var t_str = tm.getNextWord(),
              nextStr = tm.lastKana.slice(cp.relCursorPos);
          cp.setCurrentStr(t_str + nextStr);
          tm.setClauses(cp.textStr.length, t_str.length);
        }
        break;
      case 'ENTR':
        if (tm.clausesCount > 1) {
          var selectedText = cp.textStr.slice(0, tm.clauses[0].length),
              remainText = cp.textStr.slice(selectedText.length);
          ictx.replaceSurroundingText(selectedText, 0, 0);
          clearSuggests();
          cp.setCurrentStr(remainText);  // next clause.
          cp.moveCursorPos(remainText.length);  // last pos: remainText.length
          tm.setClauses(cp.textStr.length, cp.relCursorPos);
          tm.lastKana = remainText;
          tm.targetKana = remainText;
          transPromise = getTransWords(tm.targetKana);
        } else {
          cp.isComposing = false;
        }
        break;
      case 'MODE':
        ictx.endComposition(cp.textStr);
        cp.lastWord = cp.textStr;
        cp.clearCompose();
        tm.resetSuggest();
        clearSuggests();
        cp.setMode();
        break;
      case 'SWKB':
        ictx.endComposition(cp.textStr);
        cp.lastWord = cp.textStr;
        cp.clearCompose();
        tm.resetSuggest();
        clearSuggests();
        if (aFlickDirection === 'up') {
          mgmt.showAll();
        } else {
          mgmt.next();
        }
        break;
      /*
      case 'HASH':
        // '#' key
        ch = getFlickedChar(aKeyValue, aFlickDirection);
        var text = (ch !== '') ? cp.textStr + ch : cp.textStr;
        ictx.endComposition(text);
        cp.clearCompose();
        break;
      */
      case 'STAR':
        // '*' key
        if (aFlickDirection === 'tap') {
          var str = cp.textStr,
              pos = cp.relCursorPos;
          if (cp.isTransferred === false) {
            if (pos > 0) {
              ch = transVoicedKana(str.slice(pos - 1, pos));  // Get a char before cursor.
              cp.replaceChar(ch, pos);
              //console.log('STAR', cp.textStr);
              tm.lastKana = cp.textStr;
              tm.targetKana = cp.textStr.slice(0, cp.relCursorPos);
              transPromise = getTransWords(tm.targetKana);
            }
          }
          break;
        }
        // If flicked, don't break and continue to default section.
      default:
        if (cp.isTransferred === true) {
          ictx.replaceSurroundingText(cp.textStr, 0, 0);
          tm.targetKana = '';
          cp.clearCompose();
          tm.resetSuggest();
          cp.isComposing = true;
        }
        ch = getFlickedChar(aKeyValue, aFlickDirection);
        cp.insertChar(ch);
        tm.lastKana = cp.textStr;
        tm.targetKana = cp.textStr.slice(0, cp.relCursorPos);
        transPromise = getTransWords(tm.targetKana, false);
    }
  } else {
    // Composer.isComposing == false
    switch (aKeyValue) {
      case 'UNDO':
        var lastWord_len = cp.lastWord.length;
        if (lastWord_len > 0) {
          textBC = ictx.textBeforeCursor;
          if (textBC && textBC.length >= lastWord_len) {
            // Replace the last string.
            if (textBC.slice(-lastWord_len) == cp.lastWord) {
              ictx.deleteSurroundingText(-lastWord_len, lastWord_len);
              // Revert the last string.
              cp.isComposing = true;
              var lk = tm.lastKana;
              if (lk.length > 0) {
                cp.setCurrentStr(lk);
                cp.relCursorPos = lk.length;
              } else {
                cp.setCurrentStr(tm.targetKana);
                cp.relCursorPos = tm.targetKana.length;
              }
            }
          }
        }
        break;
      case 'C_BS':
        // Backspace
        if (aFlickDirection === 'left') {
          sendKeyCode(KeyEvent.DOM_VK_DELETE, true);
        } else {
          sendKeyCode(KeyEvent.DOM_VK_BACK_SPACE, true);
        }
        break;
      case 'C_LT':
        if (aFlickDirection === 'up') {
          // Move cursor to up.
          sendKeyCode(KeyEvent.DOM_VK_UP, true);
        } else {
          // Move cursor to left.
          sendKeyCode(KeyEvent.DOM_VK_LEFT, true);
        }
        break;
      case 'C_RT':
        if (aFlickDirection === 'down') {
          // Move cursor to down.
          sendKeyCode(KeyEvent.DOM_VK_DOWN, true);
        } else {
          // Move cursor to right.
          sendKeyCode(KeyEvent.DOM_VK_RIGHT, true);
        }
        break;
      case 'XFER':
        switch (cp.mode) {
          case 'KANA':
            sendKeyCode(0x3000, false);  // full width space.
            break;
          case 'EISU':
            sendKeyCode(0x0020, false);  // half width space.
            break;
          default:
        }
        break;
      case 'ENTR':
        sendKeyCode(KeyEvent.DOM_VK_RETURN, true);
        break;
      case 'MODE':
        cp.setMode();
        break;
      case 'SWKB':
        if (aFlickDirection === 'up') {
          mgmt.showAll();
        } else if (aFlickDirection === 'down') {
          mgmt.hide();
        } else {
          mgmt.next();
        }
        break;
      /*
      case 'HASH':
        // '#' key
        ch = getFlickedChar(aKeyValue, aFlickDirection);
        sendKeyCode(ch.charCodeAt(0), false);
        break;
      */
      case 'STAR':
        // '*' key
        textBC = ictx.textBeforeCursor;
        if (textBC) {
          ch = transVoicedKana(textBC[textBC.length - 1]);
          if (ch.length > 0) {
            ictx.replaceSurroundingText(ch, -1, 1);
          } else {
            ch = getFlickedChar(aKeyValue, aFlickDirection);
            sendKeyCode(ch.charCodeAt(0), false);
          }
        }
        break;
      default:
        cp.isComposing = true;
        // Reset cursor position.
        cp.relCursorPos = 0;
        ch = getFlickedChar(aKeyValue, aFlickDirection);
        cp.insertChar(ch);
        tm.lastKana = cp.textStr;
        tm.targetKana = cp.textStr;
        transPromise = getTransWords(tm.targetKana);
    }
  }

  // Process of getTransWords.then().
  if (transPromise !== null) {
    return transPromise.then(function (kanaStr) {
      var cursorPos = tm.targetKana.length,
          nextStr = cp.textStr.slice(cursorPos);
      cp.setCurrentStr(kanaStr + nextStr);
      if (cursorPos > 0 && kanaStr.length > 0) {
        tm.setClauses(cp.textStr.length, cursorPos);
      } else {
        cp.isTransferred = false;
      }
    }).catch(function (err) {
      console.error(err);
    });
  } else {
    return new Promise(function (resolve, reject) {
      resolve();
    });
  }
}

function finalizeKeyHandle() {
  var ictx = inputContext,
      cp = Composer,
      tm = TransferManager;
  if (cp.isComposing) {
    if (cp.textStr.length > 0) {
      if (cp.isTransferred === true &&
          tm.clauses.length > 0) {
        //console.log('clauses:', tm.clauses);
        ictx.setComposition(cp.textStr, tm.clauses[0].length, tm.clauses);
      } else {
        tm.clauses = [];
        ictx.setComposition(cp.textStr, cp.relCursorPos);
      }
    } else  {
      cp.clearCompose();
      tm.resetSuggest();
      ictx.endComposition('');
    }
  } else {
    if (cp.textStr.length > 0) {
      //console.log(' compose end: ', cp.textStr);
      ictx.endComposition(cp.textStr);
      cp.lastWord = cp.textStr;
      if (cp.isTransferred) {
        tm.resetSuggest();
      }
    } else {
      tm.resetSuggest();
    }
    cp.clearCompose();
  }
  return;
}


function transVoicedKana(aChar) {
  var chCode = aChar.charCodeAt(0);

  if (0x3041 <= chCode && chCode <= 0x3094) {  // あ～ん, ゔ
    if (chCode <= 0x304a) {
      if ((chCode % 2) === 0) {
        chCode--;  // あ～お -> ぁ～ぉ
      } else {
        if (chCode === 0x3045) {
          chCode = 0x3094;  // ぅ -> ゔ
        } else if (chCode === 0x3043) {
          chCode = 0x3090;  // ぃ -> ゐ
        } else if (chCode === 0x3047) {
          chCode = 0x3091;  // ぇ -> ゑ
        } else {
          chCode++;  // ぁ～ぉ -> あ～お
        }
      }
    } else if (chCode <= 0x3062) {
      if ((chCode % 2) === 1) {
        chCode++;  // か～ち -> が～ぢ
      } else {
        chCode--;  // が～ぢ -> か～ち
      }
    } else if (chCode === 0x3063) {
      chCode += 2;  // っ -> づ
    } else if (chCode === 0x3064) {
      chCode--;  // つ -> っ
    } else if (chCode <= 0x3069) {
      if ((chCode % 2) === 0) {
        chCode++;  // て～と -> で～ど
      } else {
        chCode--;  // づ～ど -> つ～と
      }
    } else if (0x306f <= chCode && chCode <= 0x307d) {
      var chGroup = (chCode - 0x306e) % 3;
      if (chGroup === 0) {
        chCode -= 2;  // ぱ～ぽ -> は～ほ
      } else {
        chCode++;  // は～ほ -> ば～ぼ -> ぱ～ぽ
      }
    } else if (0x3083 <= chCode && chCode <= 0x3088) {
      if ((chCode % 2) === 1) {
        chCode++;  // ゃゅょ -> やゆよ
      } else {
        chCode--;  // やゆよ -> ゃゅょ
      }
    } else {
      switch (chCode) {
        case 0x308E: chCode++; break;  // ゎ -> わ
        case 0x308F: chCode--; break;  // わ -> ゎ
        case 0x3090: chCode = 0x3044; break;  // ゐ -> い
        case 0x3091: chCode = 0x3048; break;  // ゑ -> え
        case 0x3094: chCode = 0x3046; break;  // ゔ -> う
        default:
      }
    }
  } else if (0xff21 <= chCode && chCode <= 0xff5a) {  // Ａ～ｚ
    if (0xff21 <= chCode && chCode <= 0xff3a) {
      chCode += 0x20;  // Ａ～Ｚ -> ａ～ｚ
    } else if (0xff41 <= chCode && chCode <= 0xff5a) {
      chCode -= 0x20;  // ａ～ｚ -> Ａ～Ｚ
    }
  } else if (0x41 <= chCode && chCode <= 0x7d) {  // A～z
    if (0x41 <= chCode && chCode <= 0x5d) {
      chCode += 0x20;  // A～Z -> a～z
    } else if (0x60 <= chCode && chCode <= 0x7d) {
      chCode -= 0x20;  // a～z -> A～Z
    }
  } else {
    switch (chCode) {
      case 0x3000: chCode = 0x0020; break;  // '　' -> ' '
      case 0x3001: chCode = 0xff0c; break;  // 、 -> ，
      case 0x3002: chCode = 0xff0e; break;  // 。 -> ．
      case 0x309b: chCode = 0x3001; break;  // ゛ -> 、
      case 0x309c: chCode = 0x3002; break;  // ゜ -> 。
      case 0x309d: chCode++; break;         // ゝ -> ゞ
      case 0x309e: chCode--; break;         // ゞ -> ゝ
      case 0x30fc: chCode = 0xff5e; break;  // ー -> ～
      case 0xff0c: chCode = 0x3001; break;  // ， -> 、
      case 0xff0e: chCode = 0x3002; break;  // ． -> 。
      case 0xff0d: chCode = 0x30fc; break;  // － -> ー
      case 0xff5e: chCode = 0xff0d; break;  // ～ -> －
      default:
    }
  }
  //console.log(' trans code: ',chCode.toString(16));
  return String.fromCharCode(chCode);
}


function transChar(aStr, aMode) {
  // aMode: 'KANA' | 'EISU'
  //console.log('transChar:',aMode,aStr);
  var transStr = [],
      chCode, i;
  switch(aMode) {
    case 'KANA':
      for (i = 0; i< aStr.length; i++) {
        chCode = aStr.charCodeAt(i);
        if (0x3041 <= chCode && chCode <= 0x3096) {  // Hiragana
          transStr.push(chCode + 0x60);
        } else if (0x30a1 <= chCode && chCode <= 0x30f6) {  // Katakana
          transStr.push(chCode - 0x60);
        } else {
          transStr.push(chCode);
        }
      }
      break;
    case 'EISU':
      for (i = 0; i< aStr.length; i++) {
        chCode = aStr.charCodeAt(i);
        if (0xff01 <= chCode && chCode <= 0xff5e) {  // Half width
          transStr.push(chCode - 0xfee0);
        } else if (0x0021 <= chCode && chCode <= 0x007e) {  // Full width
          transStr.push(chCode + 0xfee0);
        } else {
          switch (chCode) {
            case 0x3000: transStr.push(0x0020); break;  // 　 -> (space)
            case 0x3001: transStr.push(0x002c); break;  // 、 -> ,
            case 0x3002: transStr.push(0x002e); break;  // 。 -> .
            default:
              transStr.push(chCode);
          }
        }
      }
      break;
    default:
  }
  return transStr.map(c => String.fromCharCode(c)).join('');
}


function getTransWords(aStr) {
  return new Promise(function(resolve, reject) {
    var tm = TransferManager;
    if (aStr.length < 1) {
      console.log('JaK - getTransWords: empty strings.');
      tm.resetSuggest('');
      reject('empty strings.');
    }
    tm.resetSuggest(aStr);
    var dicData = SampleDic,
        firstCode = aStr.charCodeAt(0),
        results = [];
    if (0x3040 <= firstCode && firstCode <= 0x30ff) {
      // ひらがなカタカナ変換
      results.push(transChar(aStr, 'KANA'));
      if (aStr in dicData) {
        results = results.concat(dicData[aStr]);
      }
    } else {
      // 英数記号 半角全角変換
      results.push(transChar(aStr, 'EISU'));
    }
    tm.addSuggest(results);
    resolve(aStr);
  }).catch(function (err) {
    console.log(err);
    return aStr;
  });
}

// wordSuggests box.
function updateSuggests(aKana) {
  var suggListBox = document.getElementById('suggests'),
      suggKana = suggListBox.getAttribute('kana'),
      prev_item = suggListBox.getElementsByClassName('wordSelected'),
      tm = TransferManager;

  suggListBox.style.visibility = 'hidden';
  //console.log('updateSuggests:', aKana, suggKana);
  if ((aKana === suggKana) && (prev_item.length > 0)) {
    // Just move the cursor in suggest list.
    prev_item[0].className = '';
    var curr_item = document.getElementById('W' + tm.selectPos);
    curr_item.className = 'wordSelected';
    // Scroll suggests box view to the selected word.
    // .offsetLeft and scrollIntoView() makes reflow.
    if ((curr_item && curr_item.offsetLeft < 10) || tm.selectPos === 0) {
      curr_item.scrollIntoView(true);
    } else if (tm.selectPos > 1) {
      toggleSuggestBox('expand');
    }
  } else {
    // Redraw suggest list.
    suggListBox.textContent = '';
    var suggItems = document.createDocumentFragment(),
        suggList = tm.getSuggestList();
    suggList.forEach(function (word, n) {
      var item = document.createElement('li');
      item.textContent = word;
      item.setAttribute('id', 'W'+n);
      if (n === tm.selectPos) {
       item.className = 'wordSelected';
      }
      suggItems.appendChild(item);
    });
    suggListBox.appendChild(suggItems);
    suggListBox.setAttribute('kana', aKana);
  }

  suggListBox.style.visibility = 'visible';
}

function clearSuggests() {
  var suggListBox = document.getElementById('suggests');
  suggListBox.style.visibility = 'hidden';
  suggListBox.removeAttribute('kana');
  suggListBox.textContent = '';
  toggleSuggestBox('collapse');
}

function toggleSuggestBox(mode) {
  var boxCollapsed = wordSuggestsElement.getAttribute('collapsed'),
      set_collapsed = '';
  switch (mode) {
    case 'expand':
      set_collapsed = 'false';
      break;
    case 'collapse':
      set_collapsed = 'true';
      break;
    default:
      set_collapsed = (boxCollapsed === 'true') ? 'false' : 'true';
  }
  if (boxCollapsed !== set_collapsed) {
    wordSuggestsElement.setAttribute('collapsed', set_collapsed);
    if (set_collapsed === 'true') {
      suggExpandButton.textContent = '…';
      suggExpandButton.style.top = '0';
      // Scroll to selected word.
      var selectedItem = document.querySelector('.wordSelected');
      if (selectedItem) {
        wordSuggestsElement.scrollTop = selectedItem.offsetTop;
      }
    } else {
      suggExpandButton.textContent = '▼';
      suggExpandButton.style.top = '-100px';
    }
  }
  return;
}

function suggExpand(ev) {
  ev.preventDefault();
  if (TransferManager.suggsLength > 0) {
    toggleSuggestBox();
  } else {
    toggleSuggestBox('collapse');
  }
}

function clickSuggestsBox(ev) {
  ev.preventDefault();
  if (ev.target.tagName === 'LI'){
    var ictx = inputContext,
        word = ev.target.textContent,
        cp = Composer,
        tm = TransferManager;
    //console.log('sugg selected:', word);
    cp.lastWord = word;
    clearSuggests();
    if (tm.clausesCount > 1) {
      ictx.replaceSurroundingText(word, 0, 0);
      var remainText = cp.textStr.slice(tm.clauses[0].length);
      cp.setCurrentStr(remainText);
      cp.moveCursorPos(remainText.length);  // last: remainText.length
      tm.lastKana = cp.textStr;
      tm.targetKana = cp.textStr.slice(0, cp.relCursorPos);
      getTransWords(tm.targetKana, true).then(function () {
        ictx.setComposition(remainText, remainText.length);
        if(tm.suggsLength > 0) {
          updateSuggests(tm.targetKana);
        } else {
          clearSuggests();
        }
      }).catch(function (err) {
        console.error(err);
      });
    } else {
      ictx.endComposition(word);
      cp.clearCompose();
      tm.resetSuggest();
    }
  }
}

var Composer = {
  _mode: 'KANA',
  _modeList: ['KANA', 'EISU'],
  isComposing: false,
  isTransferred: false,
  relCursorPos: 0,
  textStr: '',  // Entire composed string.
  lastWord: '',  // The last decided word.

  get mode() {
    return this._mode;
  },

  setMode: function CM_setMode(aMode) {
    var mode_key = document.getElementById('mode_key');
    if (aMode) {
      if (this._modeList.indexOf(aMode) > -1) {
        this._mode = aMode;
      } else {
        console.log('JaK - invalid mode:', aMode);
      }
    } else {
      // Rotate the mode: KANA <-> EISU
      var mode_idx = this._modeList.indexOf(this._mode);
      mode_idx = (mode_idx > this._modeList.length - 2) ? 0 : mode_idx + 1;
      this._mode =  this._modeList[mode_idx];
    }
    switch (this._mode) {
      case 'KANA':
        mode_key.textContent = 'か';
        break;
      case 'EISU':
        mode_key.textContent = 'A';
        break;
      default:
        console.log('JaK - invalid mode.');
    }
    console.log('JaK - mode:', this._mode);
  },

  insertChar: function CM_insertChar(aCh) {
    if (aCh) {
      var s = this.textStr,
          pos = this.relCursorPos;
      this.textStr = s.slice(0, pos) + aCh + s.slice(pos);
      this.moveCursorPos(pos + 1);
    }
  },

  replaceChar: function CM_replaceChar(aCh, aPos) {
    if (aPos > 0) {
      if (aCh.length > 0) {
        var s = this.textStr;
        this.textStr = s.slice(0, aPos - 1) + aCh + s.slice(aPos);
      }
    }
    if (aCh.length > 1) {
      this.moveCursorPos(this.relCursorPos + aCh.length - 1);
    }
  },

  backSpace: function CM_backSpace() {
    var pos = this.relCursorPos,
        s = this.textStr;
    if (s.length > 0) {
      if (pos < 1 || pos > s.length) {
        return;
      }
      this.textStr = s.slice(0, pos - 1) + s.slice(pos);
      this.moveCursorPos(pos - 1);
    } else {
      this.relCursorPos = 0;
    }
    return;
  },

  moveCursorPos: function CM_moveCursorPos(aNewPos) {
    var oldPos = this.relCursorPos;
    if (aNewPos > this.textStr.length) {
      aNewPos = this.textStr.length;
    } else if (aNewPos < 0) {
      aNewPos = 0;
    }
    this.relCursorPos = aNewPos;
    return aNewPos - oldPos;
  },

  setCurrentStr: function CM_setCurrentStr(aStr) {
    this.textStr = aStr;
    if (this.relrelCursorPos > this.textStr.length) {
      this.relrelCursorPos = this.textStr.length;
    }
  },

  clearCompose: function CM_clearTextStr() {
    this.isComposing = false;
    this.isTransferred = false;
    // Clear composed data.
    this.textStr = '';
    this.relCursorPos = 0;
  }
};

var TransferManager = {
  _targetKana: '',  // Kana string of Transfer target.
  _lastKana: '',  // Kana string of entire composed text.
  _suggestWords: [],
  _selectPos: 0,
  clauses: [],
  clausesCount: 0,

  get targetKana() {
    return this._targetKana;
  },

  set targetKana(aStr) {
    // Set trasfer target string temporarily.
    this._targetKana = aStr;
  },

  set lastKana(aStr) {
    this._lastKana = aStr;
  },

  get lastKana() {
    return this._lastKana;
  },

  setClauses: function TM_setClauses(aTextLength, aRelCursorPos) {
    //console.log(this._suggestWords, this._selectPos);
    if (this._suggestWords.length < 1) {
      this.clausesCount = 0;
      return;
    }
    this.clauses = [];
    this.clauses.push({selectionType: 'selected-converted-text', length: this._suggestWords[this._selectPos].length});
    if (aRelCursorPos < aTextLength) {
      this.clauses.push({selectionType: 'converted-text', length: (aTextLength - aRelCursorPos)});
    }
    this.clausesCount = this.clauses.length;
  },

  addSuggest: function TM_setSuggest(aWords) {
    this._suggestWords = this._suggestWords.concat(aWords);
  },

  resetSuggest: function TM_resetSuggest(aWord) {
    this._suggestWords = [];
    this._selectPos = 0;
    this.clausesCount = 0;
    if (aWord) {
      this._suggestWords.push(aWord);
    }
  },

  getSuggestList: function TM_getSuggestList(aCount) {
    if (this._suggestWords.length > 0) {
      aCount = aCount || this._suggestWords.length;
      return this._suggestWords.slice(0, aCount);
    } else {
      return [];
    }
  },

  get suggsLength() {
    return this._suggestWords.length;
  },

  get selectPos() {
    return this._selectPos;
  },

  set selectPos(pos) {
    this._selectPos = pos;
  },

  getNextWord: function TM_getNextWord() {
    if (this._suggestWords.length > 0) {
      this._selectPos++;
      if (this._selectPos >= this._suggestWords.length) {
        this._selectPos = 0;
      }
      return this._suggestWords[this._selectPos];
    } else {
      this._selectPos = 0;
      return '';
    }
  }
};


function getFlickedChar(aCode, aDir) {
  // keycode: [center, left, up, right, down]
  var flickKeyTable = {
    'KANA': {
      '0': ['あ', 'い', 'う', 'え', 'お'],
      '1': ['か', 'き', 'く', 'け', 'こ'],
      '2': ['さ', 'し', 'す', 'せ', 'そ'],
      '3': ['た', 'ち', 'つ', 'て', 'と'],
      '4': ['な', 'に', 'ぬ', 'ね', 'の'],
      '5': ['は', 'ひ', 'ふ', 'へ', 'ほ'],
      '6': ['ま', 'み', 'む', 'め', 'も'],
      '7': ['や', '（', 'ゆ', '）', 'よ'],
      '8': ['ら', 'り', 'る', 'れ', 'ろ'],
      '9': ['わ', 'を', 'ん', 'ー', ''],
      'STAR': ['', '゛', '゜', '　', ''],
      'HASH': ['、', '。', '？', '！', '・']
    },
    'EISU': {
      '0': ['1', '.', '/', '@', ':'],
      '1': ['2', 'a', 'b', 'c', ';'],
      '2': ['3', 'd', 'e', 'f', '_'],
      '3': ['4', 'g', 'h', 'i', '('],
      '4': ['5', 'j', 'k', 'l', '\"'],
      '5': ['6', 'm', 'n', 'o', ')'],
      '6': ['7', 'p', 'q', 'r', 's'],
      '7': ['8', 't', 'u', 'v', '\''],
      '8': ['9', 'w', 'x', 'y', 'z'],
      '9': ['0', '-', '+', '*', '='],
      'STAR': ['*', '\t', '', ' ', ''],
      'HASH': ['#', ',', '.', '?', '!']
    }
  },
      mode = Composer.mode,
      ch = '';
  var f_key = flickKeyTable[mode][aCode];
  switch (aDir) {
    case 'tap':
      ch = f_key[0];
      break;
    case 'left':
      ch = f_key[1];
      break;
    case 'up':
      ch = f_key[2];
      break;
    case 'right':
      ch = f_key[3];
      break;
    case 'down':
      ch = f_key[4];
      break;
    default:
  }
  return ch;
}


// Load JSON File.
function loadJsonFile(url) {
  return new Promise(function(resolve, reject) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'json';
    xhr.overrideMimeType('application/json; charset=utf-8');
    xhr.onload = function() {
      if (xhr.readyState === 4) {
        if (xhr.status !== 404 && xhr.response !== null) {
          resolve(xhr.response);
        } else {
          reject(xhr.statusText);
        }
      }
    };
    xhr.send();
  });
}

var SampleDic = {};

function getSampleDic() {
  loadJsonFile('/dic/sample-dic.json').then(function(dic) {
    try {
      if (Object.keys(dic).length < 1) {
        console.error('No word data.');
        return;
      } else {
        SampleDic = dic;
        console.log('Sample dic is loaded.');
      }
    } catch(e) {
      console.error('ERROR: Loding dic data:', e);
    }
  });
}


window.addEventListener('load', jakInit);
window.addEventListener('unload', jakQuit);

})(window);
