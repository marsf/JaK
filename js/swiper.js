// Copyright (c) 2015, Masahiko Imanaka. All rights reserved.
// Swiper.js version 0.3 - angle omitted
(function(exports) {
'use strict';

function Swiper(elm) {
  this.element = elm;
  this.startX = this.startY = null;
  this.targetElment = null;
}

Swiper.prototype.threshold = 2;
Swiper.prototype.ontouch = null;
Swiper.prototype.onswiping = null;
Swiper.prototype.onswiped = null;

Swiper.prototype.start = function () {
  this.element.addEventListener('touchstart', this);
  this.element.addEventListener('touchmove', this);
  this.element.addEventListener('touchend', this);
};

Swiper.prototype.stop = function () {
  this.element.removeEventListener('touchstart', this);
  this.element.removeEventListener('touchmove', this);
  this.element.removeEventListener('touchend', this);
};

Swiper.prototype.handleEvent = function (ev) {
  var touch,
      direction;

  ev.preventDefault();

  switch(ev.type) {
    case 'touchstart':
      touch = ev.touches[0];
      this.targetElment = ev.target;
      this.startX = touch.pageX;
      this.startY = touch.pageY;
      this.touchID = touch.identifier;
      if (typeof this.ontouch === 'function') {
        this.ontouch({
          target: this.targetElment,
          startX: this.startX,
          startY: this.startY
        });
      }
      break;

    case 'touchmove':
      touch = ev.touches[0];
      if (touch.identifier != this.touchID) {
        return;
      }
      if (typeof this.onswiping === 'function') {
        dx = touch.pageX - this.startX;
        dy = touch.pageY - this.startY;
        direction = _getSimple4Direction(dx, dy, this.threshold);
        this.onswiping({
          target: this.targetElment,
          dx: dx,
          dy: dy,
          direction: direction
        });
      }
      //console.log('swiper: (touchmove)', direction, dx, dy);
      break;

    case 'touchend':
      var dx, dy;
      touch = ev.changedTouches[0];
      if (touch.identifier != this.touchID) {
        return;
      }
      if (typeof this.onswiped === 'function') {
        dx = touch.pageX - this.startX;
        dy = touch.pageY - this.startY;
        var length = _getLength(dx, dy);
        direction = _getSimple4Direction(dx, dy, this.threshold);
        this.onswiped({
          target: this.targetElment,
          dx: dx,
          dy: dy,
          length: length,
          direction: direction
        });
      }
      //console.log('swiper: (touchend)', direction, dx, dy);
      break;
    default:
  }
};

function _getLength(dx, dy) {
  var len = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2));
  //return Math.round(length*100) / 100;
  return Math.round(len);
}

function _getSimple4Direction(dx, dy, threshold) {
  var dx_abs = Math.abs(dx),
      dy_abs = Math.abs(dy);
  if (dx_abs < threshold && dy_abs < threshold) {
    return 'tap';
  }
  return (dx_abs >= dy_abs) ?
    ((dx > 0) ? 'right' : 'left') :
    ((dy > 0) ? 'down' : 'up');
}

exports.Swiper = Swiper;

})(window);
