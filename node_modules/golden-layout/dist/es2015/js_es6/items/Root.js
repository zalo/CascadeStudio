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
import RowOrColumn from '../items/RowOrColumn';
import $ from 'jquery';

var Root = /*#__PURE__*/function (_AbstractContentItem) {
  _inherits(Root, _AbstractContentItem);

  var _super = _createSuper(Root);

  function Root(layoutManager, config, containerElement) {
    var _this;

    _classCallCheck(this, Root);

    _this = _super.call(this, layoutManager, config, null);
    _this.isRoot = true;
    _this.type = 'root';
    _this.element = $('<div class="lm_goldenlayout lm_item lm_root"></div>');
    _this.childElementContainer = _this.element;
    _this._containerElement = containerElement;

    _this._containerElement.append(_this.element);

    return _this;
  }

  _createClass(Root, [{
    key: "addChild",
    value: function addChild(contentItem) {
      if (this.contentItems.length > 0) {
        throw new Error('Root node can only have a single child');
      }

      contentItem = this.layoutManager._$normalizeContentItem(contentItem, this);
      this.childElementContainer.append(contentItem.element);
      AbstractContentItem.prototype.addChild.call(this, contentItem);
      this.callDownwards('setSize');
      this.emitBubblingEvent('stateChanged');
    }
  }, {
    key: "setSize",
    value: function setSize(width, height) {
      width = typeof width === 'undefined' ? this._containerElement.width() : width;
      height = typeof height === 'undefined' ? this._containerElement.height() : height;
      this.element.width(width);
      this.element.height(height);
      /*
       * Root can be empty
       */

      if (this.contentItems[0]) {
        this.contentItems[0].element.width(width);
        this.contentItems[0].element.height(height);
      }
    }
  }, {
    key: "_$highlightDropZone",
    value: function _$highlightDropZone(x, y, area) {
      this.layoutManager.tabDropPlaceholder.remove();

      AbstractContentItem.prototype._$highlightDropZone.apply(this, arguments);
    }
  }, {
    key: "_$onDrop",
    value: function _$onDrop(contentItem, area) {
      var stack;

      if (contentItem.isComponent) {
        stack = this.layoutManager.createContentItem({
          type: 'stack',
          header: contentItem.config.header || {}
        }, this);

        stack._$init();

        stack.addChild(contentItem);
        contentItem = stack;
      }

      if (!this.contentItems.length) {
        this.addChild(contentItem);
      } else {
        /*
         * If the contentItem that's being dropped is not dropped on a Stack (cases which just passed above and 
         * which would wrap the contentItem in a Stack) we need to check whether contentItem is a RowOrColumn.
         * If it is, we need to re-wrap it in a Stack like it was when it was dragged by its Tab (it was dragged!).
         */
        if (contentItem.config.type === 'row' || contentItem.config.type === 'column') {
          stack = this.layoutManager.createContentItem({
            type: 'stack'
          }, this);
          stack.addChild(contentItem);
          contentItem = stack;
        }

        var type = area.side[0] == 'x' ? 'row' : 'column';
        var dimension = area.side[0] == 'x' ? 'width' : 'height';
        var insertBefore = area.side[1] == '2';
        var column = this.contentItems[0];

        if (!(column instanceof RowOrColumn) || column.type != type) {
          var rowOrColumn = this.layoutManager.createContentItem({
            type: type
          }, this);
          this.replaceChild(column, rowOrColumn);
          rowOrColumn.addChild(contentItem, insertBefore ? 0 : undefined, true);
          rowOrColumn.addChild(column, insertBefore ? undefined : 0, true);
          column.config[dimension] = 50;
          contentItem.config[dimension] = 50;
          rowOrColumn.callDownwards('setSize');
        } else {
          var sibbling = column.contentItems[insertBefore ? 0 : column.contentItems.length - 1];
          column.addChild(contentItem, insertBefore ? 0 : undefined, true);
          sibbling.config[dimension] *= 0.5;
          contentItem.config[dimension] = sibbling.config[dimension];
          column.callDownwards('setSize');
        }
      }
    }
  }]);

  return Root;
}(AbstractContentItem);

export { Root as default };