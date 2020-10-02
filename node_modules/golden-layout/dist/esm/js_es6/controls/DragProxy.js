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
import { stripTags, getTouchEvent } from '../utils/utils';
import $ from 'jquery';

var _template = '<div class="lm_dragProxy">' + '<div class="lm_header">' + '<ul class="lm_tabs">' + '<li class="lm_tab lm_active"><i class="lm_left"></i>' + '<span class="lm_title"></span>' + '<i class="lm_right"></i></li>' + '</ul>' + '</div>' + '<div class="lm_content"></div>' + '</div>';
/**
 * This class creates a temporary container
 * for the component whilst it is being dragged
 * and handles drag events
 *
 * @constructor
 * @private
 *
 * @param {Number} x              The initial x position
 * @param {Number} y              The initial y position
 * @param {DragListener} dragListener
 * @param {lm.LayoutManager} layoutManager
 * @param {AbstractContentItem} contentItem
 * @param {AbstractContentItem} originalParent
 */


var DragProxy = /*#__PURE__*/function (_EventEmitter) {
  _inherits(DragProxy, _EventEmitter);

  var _super = _createSuper(DragProxy);

  function DragProxy(x, y, dragListener, layoutManager, contentItem, originalParent) {
    var _this;

    _classCallCheck(this, DragProxy);

    _this = _super.call(this);
    _this._dragListener = dragListener;
    _this._layoutManager = layoutManager;
    _this._contentItem = contentItem;
    _this._originalParent = originalParent;
    _this._area = null;
    _this._lastValidArea = null;

    _this._dragListener.on('drag', _this._onDrag, _assertThisInitialized(_this));

    _this._dragListener.on('dragStop', _this._onDrop, _assertThisInitialized(_this));

    _this.element = $(_template);

    if (originalParent && originalParent._side) {
      _this._sided = originalParent._sided;

      _this.element.addClass('lm_' + originalParent._side);

      if (['right', 'bottom'].indexOf(originalParent._side) >= 0) _this.element.find('.lm_content').after(_this.element.find('.lm_header'));
    }

    _this.element.css({
      left: x,
      top: y
    });

    _this.element.find('.lm_tab').attr('title', stripTags(_this._contentItem.config.title));

    _this.element.find('.lm_title').html(_this._contentItem.config.title);

    _this.childElementContainer = _this.element.find('.lm_content');

    _this.childElementContainer.append(contentItem.element);

    _this._undisplayTree();

    _this._layoutManager._$calculateItemAreas();

    _this._setDimensions();

    $(document.body).append(_this.element);

    var offset = _this._layoutManager.container.offset();

    _this._minX = offset.left;
    _this._minY = offset.top;
    _this._maxX = _this._layoutManager.container.width() + _this._minX;
    _this._maxY = _this._layoutManager.container.height() + _this._minY;
    _this._width = _this.element.width();
    _this._height = _this.element.height();

    _this._setDropPosition(x, y);

    return _this;
  }
  /**
   * Callback on every mouseMove event during a drag. Determines if the drag is
   * still within the valid drag area and calls the layoutManager to highlight the
   * current drop area
   *
   * @param   {Number} offsetX The difference from the original x position in px
   * @param   {Number} offsetY The difference from the original y position in px
   * @param   {jQuery DOM event} event
   *
   * @private
   *
   * @returns {void}
   */


  _createClass(DragProxy, [{
    key: "_onDrag",
    value: function _onDrag(offsetX, offsetY, event) {
      event = getTouchEvent(event);
      var x = event.pageX,
          y = event.pageY,
          isWithinContainer = x > this._minX && x < this._maxX && y > this._minY && y < this._maxY;

      if (!isWithinContainer && this._layoutManager.config.settings.constrainDragToContainer === true) {
        return;
      }

      this._setDropPosition(x, y);
    }
    /**
     * Sets the target position, highlighting the appropriate area
     *
     * @param   {Number} x The x position in px
     * @param   {Number} y The y position in px
     *
     * @private
     *
     * @returns {void}
     */

  }, {
    key: "_setDropPosition",
    value: function _setDropPosition(x, y) {
      this.element.css({
        left: x,
        top: y
      });
      this._area = this._layoutManager._$getArea(x, y);

      if (this._area !== null) {
        this._lastValidArea = this._area;

        this._area.contentItem._$highlightDropZone(x, y, this._area);
      }
    }
    /**
     * Callback when the drag has finished. Determines the drop area
     * and adds the child to it
     *
     * @private
     *
     * @returns {void}
     */

  }, {
    key: "_onDrop",
    value: function _onDrop() {
      this._updateTree();

      this._layoutManager.dropTargetIndicator.hide();
      /*
       * Valid drop area found
       */


      if (this._area !== null) {
        this._area.contentItem._$onDrop(this._contentItem, this._area);
        /**
         * No valid drop area available at present, but one has been found before.
         * Use it
         */

      } else if (this._lastValidArea !== null) {
        this._lastValidArea.contentItem._$onDrop(this._contentItem, this._lastValidArea);
        /**
         * No valid drop area found during the duration of the drag. Return
         * content item to its original position if a original parent is provided.
         * (Which is not the case if the drag had been initiated by createDragSource)
         */

      } else if (this._originalParent) {
        this._originalParent.addChild(this._contentItem);
        /**
         * The drag didn't ultimately end up with adding the content item to
         * any container. In order to ensure clean up happens, destroy the
         * content item.
         */

      } else {
        this._contentItem._$destroy();
      }

      this.element.remove();

      this._layoutManager.emit('itemDropped', this._contentItem);
    }
    /**
     * Undisplays the item from its original position within the tree
     *
     * @private
     *
     * @returns {void}
     */

  }, {
    key: "_undisplayTree",
    value: function _undisplayTree() {
      /**
       * parent is null if the drag had been initiated by a external drag source
       */
      if (this._contentItem.parent) {
        this._contentItem.parent.undisplayChild(this._contentItem);
      }
    }
    /**
     * Removes the item from its original position within the tree
     *
     * @private
     *
     * @returns {void}
     */

  }, {
    key: "_updateTree",
    value: function _updateTree() {
      /**
       * parent is null if the drag had been initiated by a external drag source
       */
      if (this._contentItem.parent) {
        this._contentItem.parent.removeChild(this._contentItem, true);
      }

      this._contentItem._$setParent(this);
    }
    /**
     * Updates the Drag Proxie's dimensions
     *
     * @private
     *
     * @returns {void}
     */

  }, {
    key: "_setDimensions",
    value: function _setDimensions() {
      var dimensions = this._layoutManager.config.dimensions,
          width = dimensions.dragProxyWidth,
          height = dimensions.dragProxyHeight;
      this.element.width(width);
      this.element.height(height);
      width -= this._sided ? dimensions.headerHeight : 0;
      height -= !this._sided ? dimensions.headerHeight : 0;
      this.childElementContainer.width(width);
      this.childElementContainer.height(height);

      this._contentItem.element.width(width);

      this._contentItem.element.height(height);

      this._contentItem.callDownwards('_$show');

      this._contentItem.callDownwards('setSize');
    }
  }]);

  return DragProxy;
}(EventEmitter);

export { DragProxy as default };