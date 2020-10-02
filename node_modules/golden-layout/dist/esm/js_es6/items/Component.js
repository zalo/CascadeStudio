function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf(subClass, superClass); }

function _setPrototypeOf(o, p) { _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf(o, p); }

function _createSuper(Derived) { return function () { var Super = _getPrototypeOf(Derived), result; if (_isNativeReflectConstruct()) { var NewTarget = _getPrototypeOf(this).constructor; result = Reflect.construct(Super, arguments, NewTarget); } else { result = Super.apply(this, arguments); } return _possibleConstructorReturn(this, result); }; }

function _possibleConstructorReturn(self, call) { if (call && (_typeof(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized(self); }

function _assertThisInitialized(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

function _isNativeReflectConstruct() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Date.prototype.toString.call(Reflect.construct(Date, [], function () {})); return true; } catch (e) { return false; } }

function _getPrototypeOf(o) { _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf(o); }

import AbstractContentItem from '../items/AbstractContentItem';
import ItemContainer from '../container/ItemContainer';
import ReactComponentHandler from '../utils/ReactComponentHandler';
import $ from 'jquery';
/**
 * @param {[type]} layoutManager [description]
 * @param {[type]} config      [description]
 * @param {[type]} parent        [description]
 */

var Component = /*#__PURE__*/function (_AbstractContentItem) {
  _inherits(Component, _AbstractContentItem);

  var _super = _createSuper(Component);

  function Component(layoutManager, config, parent) {
    var _this;

    _classCallCheck(this, Component);

    _this = _super.call(this, layoutManager, config, parent);
    var ComponentConstructor = layoutManager.isReactConfig(config) ? ReactComponentHandler : layoutManager.getComponent(config),
        componentConfig = $.extend(true, {}, _this.config.componentState || {});
    componentConfig.componentName = _this.config.componentName;
    _this.componentName = _this.config.componentName;

    if (_this.config.title === '') {
      _this.config.title = _this.config.componentName;
    }

    _this.isComponent = true;
    _this.container = new ItemContainer(_this.config, _assertThisInitialized(_this), layoutManager);
    _this.instance = new ComponentConstructor(_this.container, componentConfig);
    _this.element = _this.container._element;
    return _this;
  }

  _createClass(Component, [{
    key: "close",
    value: function close() {
      this.parent.removeChild(this);
    }
  }, {
    key: "setSize",
    value: function setSize() {
      if (this.element.css('display') !== 'none') {
        // Do not update size of hidden components to prevent unwanted reflows
        this.container._$setSize(this.element.width(), this.element.height());
      }
    }
  }, {
    key: "_$init",
    value: function _$init() {
      AbstractContentItem.prototype._$init.call(this);

      this.container.emit('open');
    }
  }, {
    key: "_$hide",
    value: function _$hide() {
      this.container.hide();

      AbstractContentItem.prototype._$hide.call(this);
    }
  }, {
    key: "_$show",
    value: function _$show() {
      this.container.show();

      AbstractContentItem.prototype._$show.call(this);
    }
  }, {
    key: "_$shown",
    value: function _$shown() {
      this.container.shown();

      AbstractContentItem.prototype._$shown.call(this);
    }
  }, {
    key: "_$destroy",
    value: function _$destroy() {
      this.container.emit('destroy', this);

      AbstractContentItem.prototype._$destroy.call(this);
    }
    /**
     * Dragging onto a component directly is not an option
     *
     * @returns null
     */

  }, {
    key: "_$getArea",
    value: function _$getArea() {
      return null;
    }
  }]);

  return Component;
}(AbstractContentItem);

export { Component as default };