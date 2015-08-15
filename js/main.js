// Copyright (c) 2015, Masahiko Imanaka. All rights reserved.
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
    if (inputContext) {
      Composer.clearCompose();
      toggleSuggestBox('collapse');
      TransferManager.resetSuggest();
      clearSuggests();
      inputContext = null;
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
  inputContext = navigator.mozInputMethod.inputcontext;
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
  if (!inputContext) {
    getInputContext();
  }
  // Set backgound-color.
  toggleKeyStyle(ev.target, true);
}

function endKeyHandle(ev) {
  // Recover backgound-color.
  toggleKeyStyle(ev.target, false);

  if (inputContext) {
    keyHandle(ev.target, ev.direction);
    //console.log('compose: ', Composer.relCursorPos, Composer.textStr, '/', Composer.lastStr, Composer.isComposing, '/', Composer.isTransferred);
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


// Main Key Handler.
function keyHandle(aCurrentKey, aFlickDirection) {
  var ictx = inputContext,
      val = '',
      ch = '',
      textBC = '',
      t_str = '', nextStr = '',
      lastKana = '';

  // If form text is cleard by its clear button.
  if (ictx.textBeforeCursor.length < 1 &&
      ictx.textAfterCursor.length < 1 &&
      Composer.isComposing) {
    ictx.endComposition('');
    Composer.clearCompose();
    console.log('JaK - form is cleared.');
  }

  // Get char from class name.
  if (aCurrentKey.classList.contains('key')) {
    val = aCurrentKey.getAttribute('code');
    //console.log("keyHandle: aCurrentKey.code="+val);
    if (Composer.isComposing) {
      switch (val) {
        case 'UNDO':
          if (Composer.isTransferred === true) {
            lastKana = TransferManager.getLastKana();
            Composer.isTransferred = false;
            TransferManager.resetSuggest();
            Composer.setCurrentStr(Composer.lastStr);
            Composer.relCursorPos = (lastKana.length > 0) ? lastKana.length : Composer.lastStr.length;
          } else {
            if (Composer.lastStr === Composer.textStr) {
              Composer.setLastStr('');
              Composer.isComposing = false;
            }
          }
          break;
        case 'C_BS':
          // Backspace
          if (Composer.isTransferred === true) {
            Composer.isTransferred = false;
            TransferManager.resetSuggest();
            Composer.setCurrentStr(Composer.lastStr);
          } else {
            Composer.backSpace();
          }
          break;
        case 'C_LT':
          // Move cursor to left.
          Composer.moveCursorPos(-1);
          if (Composer.isTransferred === true) {
            lastKana = TransferManager.getLastKana();
            Composer.relCursorPos = lastKana.length - 1;
            transWord(Composer.lastStr.slice(0, Composer.relCursorPos));
            t_str = TransferManager.getNextWord();
            nextStr = Composer.lastStr.slice(Composer.relCursorPos);
            Composer.setCurrentStr(t_str + nextStr);
            if (Composer.relCursorPos > 0) {
              TransferManager.setClauses(Composer.textStr.length, Composer.relCursorPos);
            } else {
              Composer.isTransferred = false;
            }
          }
          break;
        case 'C_RT':
          // Move cursor to right.
          Composer.moveCursorPos(1);
          if (Composer.isTransferred === true) {
            lastKana = TransferManager.getLastKana();
            Composer.relCursorPos = lastKana.length + 1;
            transWord(Composer.lastStr.slice(0, Composer.relCursorPos));
            t_str = TransferManager.getNextWord();
            nextStr = Composer.lastStr.slice(Composer.relCursorPos);
            Composer.setCurrentStr(t_str + nextStr);
            TransferManager.setClauses(Composer.textStr.length, Composer.relCursorPos);
          }
          break;
        case 'XFER':
          if (Composer.isTransferred === false) {
            Composer.isTransferred = true;
            Composer.setLastStr(Composer.textStr);
            transWord(Composer.textStr.slice(0, Composer.relCursorPos));
          }
          t_str = TransferManager.getNextWord();
          nextStr = Composer.lastStr.slice(Composer.relCursorPos);
          Composer.setCurrentStr(t_str + nextStr);
          TransferManager.setClauses(Composer.textStr.length, t_str.length);
          break;
        case 'ENTR':
          if (TransferManager.clausesCount > 1) {
            var selectedText = Composer.textStr.slice(0, TransferManager.clauses[0].length),
                remainText = Composer.textStr.slice(selectedText.length);
            ictx.endComposition(selectedText);
            //TransferManager.resetSuggest(remainText);
            clearSuggests();
            Composer.setLastStr(remainText);
            Composer.setCurrentStr(remainText);  // next clause.
            Composer.moveCursorPos(remainText.length);  // last pos: remainText.length
            TransferManager.setClauses(Composer.textStr.length, Composer.relCursorPos);
            transWord(remainText);
          } else {
            TransferManager.setLastKana(Composer.lastStr);
            Composer.setLastStr(Composer.textStr);
            Composer.isComposing = false;
          }
          break;
        case 'MODE':
          Composer.toggleMode();
          break;
        case 'SWKB':
          ictx.endComposition(Composer.textStr);
          Composer.clearCompose();
          TransferManager.resetSuggest();
          clearSuggests();
          if (aFlickDirection === 'up') {
            mgmt.showAll();
          } else {
            mgmt.next();
          }
          break;
        case 'STAR':
          // '*' key
          if (aFlickDirection === 'tap') {
            var str = Composer.textStr,
                pos = Composer.relCursorPos;
            if (pos > 0) {
              ch = transVoicedKana(str.slice(pos - 1, pos));  // Get a char before cursor.
              Composer.replaceChar(ch, pos);
            }
          } else {
            ch = getFlickedChar('STAR', aFlickDirection);
            Composer.insertChar(ch);
          }
          break;
        /*
        case 'HASH':
          // '#' key
          ch = getFlickedChar(val, aFlickDirection);
          var text = (ch !== '') ? Composer.textStr + ch : Composer.textStr;
          ictx.endComposition(text);
          Composer.clearCompose();
          break;
        */
        default:
          if (Composer.isTransferred) {
            ictx.endComposition(Composer.textStr);
            Composer.setLastStr('');
            Composer.clearCompose();
            TransferManager.resetSuggest();
            Composer.isComposing = true;
          }
          ch = getFlickedChar(val, aFlickDirection);
          Composer.insertChar(ch);
      }
    } else {
      // Composer.isComposing == false
      switch (val) {
        case 'UNDO':
          if (Composer.lastStr.length > 0) {
            textBC = ictx.textBeforeCursor;
            var lastStr_len = Composer.lastStr.length;
            if (textBC && textBC.length >= lastStr_len) {
              // Replace the last string.
              if (textBC.slice(-lastStr_len) == Composer.lastStr) {
                ictx.deleteSurroundingText(-lastStr_len, lastStr_len);
                // Revert the last string.
                Composer.isComposing = true;
                lastKana = TransferManager.getLastKana();
                if (lastKana.length > 0) {
                  Composer.setCurrentStr(lastKana);
                  Composer.relCursorPos = lastKana.length;
                } else {
                  Composer.setCurrentStr(Composer.lastStr);
                  Composer.relCursorPos = Composer.lastStr.length;
                }
              }
            }
          }
          break;
        case 'C_BS':
          // Backspace
          if (aFlickDirection === 'down') {
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
          switch (Composer.getMode()) {
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
          Composer.toggleMode();
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
        case 'STAR':
          // '*' key
          textBC = ictx.textBeforeCursor;
          if (textBC) {
            ch = transVoicedKana(textBC[textBC.length - 1]);
            if (ch.length > 0) {
              ictx.replaceSurroundingText(ch, -1, 1);
            }
          }
          break;
        /*
        case 'HASH':
          // '#' key
          ch = getFlickedChar(val, aFlickDirection);
          ictx.setComposition(ch);
          ictx.endComposition(ch);
          break;
        */
        default:
          Composer.isComposing = true;
          // Set cursor position.
          Composer.relCursorPos = 0;
          ch = getFlickedChar(val, aFlickDirection);
          Composer.insertChar(ch);
      }
    }
  } else {
    return;
  }

  if (Composer.isComposing) {
    if (Composer.textStr.length > 0) {
      if (Composer.isTransferred === true &&
          TransferManager.clauses.length > 0) {
        //console.log('clauses:', TransferManager.clauses);
        ictx.setComposition(Composer.textStr, TransferManager.clauses[0].length, TransferManager.clauses);
      } else {
        TransferManager.clauses = [];
        ictx.setComposition(Composer.textStr, Composer.relCursorPos);
      }
      var suggs = TransferManager.getSuggests();
      if(suggs.length > 0) {
        updateSuggests(suggs, TransferManager.getLastKana());
      } else {
        clearSuggests();
      }
    } else  {
      Composer.clearCompose();
      TransferManager.resetSuggest();
      ictx.endComposition('');
    }
  } else {
    if (Composer.textStr.length > 0) {
      //console.log(' compose end: ', Composer.lastStr);
      ictx.endComposition(Composer.lastStr);
      if (Composer.isTransferred) {
        TransferManager.resetSuggest();
        clearSuggests();
      }
      Composer.clearCompose();
    }
  }

  return;
}


function transVoicedKana(aChar) {
  var chCode = aChar.charCodeAt(0);

  if (0x3041 <= chCode && chCode <= 0x3093) {  // あ～ん
    if (chCode <= 0x304a) {
      if ((chCode % 2) === 0) {
        chCode--;  // あ～お -> ぁ～ぉ
      } else {
        if (chCode === 0x3045) {
          chCode = 0x3094;  // ぅ -> ゔ
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
      chCode++;  // っ -> つ
    } else if (chCode <= 0x3069) {
      if ((chCode % 2) === 0) {
        chCode++;  // つ～と -> づ～ど
      } else if (chCode === 0x3065) {
        chCode -= 2;  // づ -> っ
      } else {
        chCode--;  // で～ど -> て～と
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
    } else if (chCode === 0x308E) {
      chCode++;  // ゎ -> わ
    } else if (chCode === 0x308F) {
      chCode--;  // わ -> ゎ
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
      case 0x3094: chCode = 0x3046; break;  // ゔ -> う
      case 0x309b: chCode = 0x3001; break;  // ゛ -> 、
      case 0x309c: chCode = 0x3002; break;  // ゜ -> 。
      case 0x309d: chCode++; break;         // ゝ -> ゞ
      case 0x309e: chCode--; break;         // ゞ -> ゝ
      case 0x3000: chCode = 0x0020; break;  // '　' -> ' '
      case 0x3001: chCode = 0xff0c; break;  // 、 -> ，
      case 0x3002: chCode = 0xff0e; break;  // 。 -> ．
      case 0xff0c: chCode = 0x3001; break;  // ， -> 、
      case 0xff0e: chCode = 0x3002; break;  // ． -> 。
      case 0xff0d: chCode = 0x30fc; break;  // － -> ー
      case 0x30fc: chCode = 0xff5e; break;  // ー -> ～
      case 0xff5e: chCode = 0xff0d; break;  // ～ -> －
      default:
    }
  }
  //console.log(' trans code: ',chCode.toString(16));
  return String.fromCharCode(chCode);
}


/*
//addVoicedMark(Composer.textStr, Composer.relCursorPos);
function addVoicedMark(aStr, aPos) {
  if (aStr.length === 0 || aPos < 1) {
    return '';
  }

  var chCode = aStr.charCodeAt(aPos - 1);
  if (0x304b <= chCode && chCode <= 0x3062) {
    if ((chCode % 2) === 1) {
      chCode++;  // か～ち -> が～ぢ
    }
  } else if (0x3064 <= chCode && chCode <= 0x3069) {
    if ((chCode % 2) === 0) {
      chCode++;  // つ～と -> づ～ど
    }
  } else if (0x306f <= chCode && chCode <= 0x307d) {
    if (((chCode - 0x306e) % 3) === 1) {
      chCode++;  // は～ほ -> ば～ぼ
    }
  } else if (chCode === 0x3046) {
    chCode = 0x3094;  // う -> ゔ
  } else if (chCode === 0x309d) {
    chCode++;  // ゝ -> ゞ
  } else {
    return '';
  }
  return String.fromCharCode(chCode);
}


function addSemiVoicedMark(aStr, aPos) {
  if (aStr.length === 0 || aPos < 1) {
    return '';
  }
  var chCode = aStr.charCodeAt(aPos - 1);
  if (0x306f <= chCode && chCode <= 0x307d) {
    if (((chCode - 0x306e) % 3) === 1) {
      chCode += 2;  // は～ほ -> ぱ～ぽ
    }
  } else {
    return '';
  }
  return String.fromCharCode(chCode);
}
*/

function transChar(aStr, aMode) {
  // aMode: 'kana' | 'eisu'
  //console.log('transChar:',aMode,aStr);
  var transStr = [],
      chCode, i;
  switch(aMode) {
    case 'kana':
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
    case 'eisu':
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


function transWord(aStr) {
  if (aStr.length < 1) {
    console.log('JaK - transWord: empty strings.');
    TransferManager.resetSuggest('');
    return;
  }

  var dicData = SampleDic,
      firstCode = aStr.charCodeAt(0),
      results = [];
  if (0x3040 <= firstCode && firstCode <= 0x30ff) {
    // Hiragana -> Katakana.
    results.push(transChar(aStr, 'kana'));
    // Hiragana -> dic words.
    if (aStr in dicData) {
      results = results.concat(dicData[aStr]);
    }
  } else {
    // Eisu half <-> full width
    results.push(transChar(aStr, 'eisu'));
  }
  TransferManager.resetSuggest(aStr);
  TransferManager.addSuggest(results);
}


// wordSuggests box.
function updateSuggests(aSuggs, aKana) {
  //console.log('sugg:',aSuggs);
  var suggListBox = document.getElementById('suggests'),
      suggKana = suggListBox.getAttribute('kana'),
      prev_item = suggListBox.getElementsByClassName('wordSelected');
  
  suggListBox.style.visibility = 'hidden';
  if ((aKana === suggKana) && (prev_item.length > 0)) {
    prev_item[0].className = '';
    var curr_item = document.getElementById('W' + TransferManager.selectPos);
    curr_item.className = 'wordSelected';
    // Scroll suggests box view to the selected word.
    // .offsetTop and scrollIntoView() makes reflow.
    if ((curr_item && curr_item.offsetLeft < 20) || TransferManager.selectPos === 0) {
      curr_item.scrollIntoView(true);
    }
  } else {
    suggListBox.textContent = '';
    var suggItems = document.createDocumentFragment();
    aSuggs.forEach(function (word, n) {
      var item = document.createElement('li');
      item.textContent = word;
      item.setAttribute('id', 'W'+n);
      if (n === TransferManager.selectPos) {
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
  switch (mode) {
    case 'expand':
      wordSuggestsElement.setAttribute('collapsed', 'false');
      break;
    case 'collapse':
      wordSuggestsElement.setAttribute('collapsed', 'true');
      break;
    default:
      var boxCollapsed = wordSuggestsElement.getAttribute('collapsed');
      if (boxCollapsed === 'true') {
        wordSuggestsElement.setAttribute('collapsed', 'false');
      } else {
        wordSuggestsElement.setAttribute('collapsed', 'true');
      }
  }
  return;
}

function suggExpand(ev) {
  ev.preventDefault();
  if (TransferManager.getSuggests().length > 0) {
    toggleSuggestBox();
  } else {
    toggleSuggestBox('collapse');
  }
}

function clickSuggestsBox(ev) {
  ev.preventDefault();
  if (ev.target.tagName === 'LI'){
    var ictx = inputContext,
        word = ev.target.textContent;
    //console.log('sugg selected:', text);
    ictx.endComposition(word);
    var remainText = Composer.textStr.slice(TransferManager.clauses[0].length);
    if (TransferManager.clausesCount > 1) {
      Composer.setLastStr(remainText);
      Composer.clearCompose();
      Composer.isComposing = true;
      Composer.isTransferred = true;
      Composer.setCurrentStr(remainText);
      Composer.moveCursorPos(remainText.length);  // last: remainText.length
      transWord(remainText);
      ictx.setComposition(remainText, remainText.length);
    } else {
      Composer.clearCompose();
      Composer.setLastStr(word);
    }
    TransferManager.resetSuggest(remainText);
    clearSuggests();
  }
}

var Composer = {
  _mode: 'KANA',  // 'KANA' | 'EISU'
  isComposing: false,
  isTransferred: false,
  relCursorPos: 0,
  textStr: '',
  lastStr: '',

  insertChar: function CM_insertChar(aCh) {
    if (aCh) {
      var s = this.textStr,
          pos = this.relCursorPos;
      this.textStr = s.slice(0, pos) + aCh + s.slice(pos);
      this.moveCursorPos(1);
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
      this.moveCursorPos(aCh.length - 1);
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
      this.moveCursorPos(-1);
    } else {
      this.relCursorPos = 0;
    }
    return;
  },

  moveCursorPos: function CM_moveCursorPos(aNum) {
    var newPos = this.relCursorPos + aNum;
    if (newPos > this.textStr.length) {
      this.relCursorPos = this.textStr.length;
    } else if (newPos < 0) {
      this.relCursorPos = 0;
    } else {
      this.relCursorPos = newPos;
    }
    return this.relCursorPos;
  },

  setCurrentStr: function CM_setCurrentStr(aStr) {
    this.textStr = aStr;
  },

  setLastStr: function CM_setLastStr(aStr) {
    // Set decided string. This will set to inputContext.endComposition().
    this.lastStr = aStr;
  },

  clearCompose: function CM_clearTextStr() {
    this.isComposing = false;
    this.isTransferred = false;
    // Clear composed data.
    this.textStr = '';
    this.relCursorPos = 0;
  },

  getMode: function CM_getMode() {
    return this._mode;
  },

  toggleMode: function CM_toggleMode() {
    var mode_key = document.getElementById('mode_key');
    switch (this._mode) {
      case 'KANA':
        this._mode = 'EISU';
        mode_key.textContent = 'A';
        break;
      case 'EISU':
        this._mode = 'KANA';
        mode_key.textContent = 'か';
        break;
      default:
    }
    console.log('JaK - mode:', this._mode);
  }
};

var TransferManager = {
  _lastKana: '',
  _suggestWords: [],
  selectPos: 0,
  clauses: [],
  clausesCount: 0,

  setClauses: function TM_setClauses(aTextLength, aRelCursorPos) {
    //console.log(this._suggestWords, this.selectPos);
    if (this._suggestWords.length < 1) {
      this.clausesCount = 0;
      return;
    }
    this.clauses = [];
    this.clauses.push({selectionType: 'selected-converted-text', length: this._suggestWords[this.selectPos].length});
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
    this.selectPos = 0;
    this.clausesCount = 0;
    if (aWord) {
      this._suggestWords.push(aWord);
      this.setLastKana(aWord);
    } else {
      //this.setLastKana('');
    }
  },

  getSuggests: function TM_getSuggests(aCount) {
    if (this._suggestWords.length > 0) {
      aCount = aCount || this._suggestWords.length;
      return this._suggestWords.slice(0, aCount);
    } else {
      return [];
    }
  },

  getNextWord: function TM_getNextWord() {
    if (this._suggestWords.length > 0) {
      this.selectPos++;
      if (this.selectPos >= this._suggestWords.length) {
        this.selectPos = 0;
      }
      return this._suggestWords[this.selectPos];
    } else {
      this.selectPos = 0;
      return '';
    }
  },

  setLastKana: function TM_setLastKana(aStr) {
    this._lastKana = aStr;
  },

  getLastKana: function TM_getLastKana() {
    return this._lastKana;
  }
};


function getFlickedChar(aCode, aDir) {
  var flickKeyTable = {
    // keycode: [center, left, up, right, down]
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
      'STAR': ['', '\t', '', ' ', ''],
      'HASH': ['#', ',', '.', '?', '!']
    }
  };

  var f_key = flickKeyTable[Composer.getMode()][aCode],
      ch;

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
