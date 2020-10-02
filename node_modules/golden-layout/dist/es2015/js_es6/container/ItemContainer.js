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

import EventEmitter from '../utils/EventEmitter';
import $ from 'jquery';

var ItemContainer = /*#__PURE__*/function (_EventEmitter) {
  _inherits(ItemContainer, _EventEmitter);

  var _super = _createSuper(ItemContainer);

  function ItemContainer(config, parent, layoutManager) {
    var _this;

    _classCallCheck(this, ItemContainer);

    _this = _super.call(this);
    _this.width = null;
    _this.height = null;
    _this.title = config.componentName;
    _this.parent = parent;
    _this.layoutManager = layoutManager;
    _this.isHidden = false;
    _this._config = config;
    _this._element = $(['<div class="lm_item_container">', '<div class="lm_content"></div>', '</div>'].join(''));
    _this._contentElement = _this._element.find('.lm_content');
    return _this;
  }
  /**
   * Get the inner DOM element the container's content
   * is intended to live in
   *
   * @returns {DOM element}
   */


  _createClass(ItemContainer, [{
    key: "getElement",
    value: function getElement() {
      return this._contentElement;
    }
    /**
     * Hide the container. Notifies the containers content first
     * and then hides the DOM node. If the container is already hidden
     * this should have no effect
     *
     * @returns {void}
     */

  }, {
    key: "hide",
    value: function hide() {
      this.emit('hide');
      this.isHidden = true;

      this._element.hide();
    }
    /**
     * Shows a previously hidden container. Notifies the
     * containers content first and then shows the DOM element.
     * If the container is already visible this has no effect.
     *
     * @returns {void}
     */

  }, {
    key: "show",
    value: function show() {
      this.emit('show');
      this.isHidden = false;

      this._element.show(); // call shown only if the container has a valid size


      if (this.height != 0 || this.width != 0) {
        this.emit('shown');
      }
    }
    /**
     * Set the size from within the container. Traverses up
     * the item tree until it finds a row or column element
     * and resizes its items accordingly.
     *
     * If this container isn't a descendant of a row or column
     * it returns false
     * @todo  Rework!!!
     * @param {Number} width  The new width in pixel
     * @param {Number} height The new height in pixel
     *
     * @returns {Boolean} resizeSuccesful
     */

  }, {
    key: "setSize",
    value: function setSize(width, height) {
      var rowOrColumn = this.parent,
          rowOrColumnChild = this,
          totalPixel,
          percentage,
          direction,
          newSize,
          delta,
          i;

      while (!rowOrColumn.isColumn && !rowOrColumn.isRow) {
        rowOrColumnChild = rowOrColumn;
        rowOrColumn = rowOrColumn.parent;
        /**
         * No row or column has been found
         */

        if (rowOrColumn.isRoot) {
          return false;
        }
      }

      direction = rowOrColumn.isColumn ? "height" : "width";
      newSize = direction === "height" ? height : width;
      totalPixel = this[direction] * (1 / (rowOrColumnChild.config[direction] / 100));
      percentage = newSize / totalPixel * 100;
      delta = (rowOrColumnChild.config[direction] - percentage) / (rowOrColumn.contentItems.length - 1);

      for (i = 0; i < rowOrColumn.contentItems.length; i++) {
        if (rowOrColumn.contentItems[i] === rowOrColumnChild) {
          rowOrColumn.contentItems[i].config[direction] = percentage;
        } else {
          rowOrColumn.contentItems[i].config[direction] += delta;
        }
      }

      rowOrColumn.callDownwards('setSize');
      return true;
    }
    /**
     * Closes the container if it is closable. Can be called by
     * both the component within at as well as the contentItem containing
     * it. Emits a close event before the container itself is closed.
     *
     * @returns {void}
     */

  }, {
    key: "close",
    value: function close() {
      if (this._config.isClosable) {
        this.emit('close');
        this.parent.close();
      }
    }
    /**
     * Returns the current state object
     *
     * @returns {Object} state
     */

  }, {
    key: "getState",
    value: function getState() {
      return this._config.componentState;
    }
    /**
     * Merges the provided state into the current one
     *
     * @param   {Object} state
     *
     * @returns {void}
     */

  }, {
    key: "extendState",
    value: function extendState(state) {
      this.setState($.extend(true, this.getState(), state));
    }
    /**
     * Notifies the layout manager of a stateupdate
     *
     * @param {serialisable} state
     */

  }, {
    key: "setState",
    value: function setState(state) {
      this._config.componentState = state;
      this.parent.emitBubblingEvent('stateChanged');
    }
    /**
     * Set's the components title
     *
     * @param {String} title
     */

  }, {
    key: "setTitle",
    value: function setTitle(title) {
      this.parent.setTitle(title);
    }
    /**
     * Set's the containers size. Called by the container's component.
     * To set the size programmatically from within the container please
     * use the public setSize method
     *
     * @param {[Int]} width  in px
     * @param {[Int]} height in px
     *
     * @returns {void}
     */

  }, {
    key: "_$setSize",
    value: function _$setSize(width, height) {
      if (width !== this.width || height !== this.height) {
        this.width = width;
        this.height = height;
        $.zepto ? this._contentElement.width(width) : this._contentElement.outerWidth(width);
        $.zepto ? this._contentElement.height(height) : this._contentElement.outerHeight(height);
        this.emit('resize');
      }
    }
  }]);

  return ItemContainer;
}(EventEmitter);

export { ItemContainer as default };