function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

import $ from 'jquery';
var _template = '<div class="lm_dropTargetIndicator"><div class="lm_inner"></div></div>';

var DropTargetIndicator = /*#__PURE__*/function () {
  function DropTargetIndicator() {
    _classCallCheck(this, DropTargetIndicator);

    this.element = $(_template);
    $(document.body).append(this.element);
  }

  _createClass(DropTargetIndicator, [{
    key: "destroy",
    value: function destroy() {
      this.element.remove();
    }
  }, {
    key: "highlight",
    value: function highlight(x1, y1, x2, y2) {
      this.highlightArea({
        x1: x1,
        y1: y1,
        x2: x2,
        y2: y2
      });
    }
  }, {
    key: "highlightArea",
    value: function highlightArea(area) {
      this.element.css({
        left: area.x1,
        top: area.y1,
        width: area.x2 - area.x1,
        height: area.y2 - area.y1
      }).show();
    }
  }, {
    key: "hide",
    value: function hide() {
      this.element.hide();
    }
  }]);

  return DropTargetIndicator;
}();

export { DropTargetIndicator as default };