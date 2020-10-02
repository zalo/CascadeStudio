function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

import $ from 'jquery';

var HeaderButton = /*#__PURE__*/function () {
  function HeaderButton(header, label, cssClass, action) {
    _classCallCheck(this, HeaderButton);

    this._header = header;
    this.element = $('<li class="' + cssClass + '" title="' + label + '"></li>');

    this._header.on('destroy', this._$destroy, this);

    this._action = action;
    this.element.on('click touchstart', this._action);

    this._header.controlsContainer.append(this.element);
  }

  _createClass(HeaderButton, [{
    key: "_$destroy",
    value: function _$destroy() {
      this.element.off();
      this.element.remove();
    }
  }]);

  return HeaderButton;
}();

export { HeaderButton as default };