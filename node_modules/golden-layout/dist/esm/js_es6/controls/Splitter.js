function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

import DragListener from '../utils/DragListener';
import $ from 'jquery';

var Splitter = /*#__PURE__*/function () {
  function Splitter(isVertical, size, grabSize) {
    _classCallCheck(this, Splitter);

    this._isVertical = isVertical;
    this._size = size;
    this._grabSize = grabSize < size ? size : grabSize;
    this.element = this._createElement();
    this._dragListener = new DragListener(this.element);
  }

  _createClass(Splitter, [{
    key: "on",
    value: function on(event, callback, context) {
      this._dragListener.on(event, callback, context);
    }
  }, {
    key: "_$destroy",
    value: function _$destroy() {
      this.element.remove();
    }
  }, {
    key: "_createElement",
    value: function _createElement() {
      var dragHandle = $('<div class="lm_drag_handle"></div>');
      var element = $('<div class="lm_splitter"></div>');
      element.append(dragHandle);
      var handleExcessSize = this._grabSize - this._size;
      var handleExcessPos = handleExcessSize / 2;

      if (this._isVertical) {
        dragHandle.css('top', -handleExcessPos);
        dragHandle.css('height', this._size + handleExcessSize);
        element.addClass('lm_vertical');
        element['height'](this._size);
      } else {
        dragHandle.css('left', -handleExcessPos);
        dragHandle.css('width', this._size + handleExcessSize);
        element.addClass('lm_horizontal');
        element['width'](this._size);
      }

      return element;
    }
  }]);

  return Splitter;
}();

export { Splitter as default };