function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

import DragListener from '../utils/DragListener';
import DragProxy from '../controls/DragProxy';
import { isFunction } from '../utils/utils';
import $ from 'jquery';
/**
 * Allows for any DOM item to create a component on drag
 * start tobe dragged into the Layout
 *
 * @param {jQuery element} element
 * @param {Object} itemConfig the configuration for the contentItem that will be created
 * @param {LayoutManager} layoutManager
 *
 * @constructor
 */

var DragSource = /*#__PURE__*/function () {
  function DragSource(element, itemConfig, layoutManager) {
    _classCallCheck(this, DragSource);

    this._element = element;
    this._itemConfig = itemConfig;
    this._layoutManager = layoutManager;
    this._dragListener = null;

    this._createDragListener();
  }
  /**
   * Disposes of the drag listeners so the drag source is not usable any more.
   *
   * @returns {void}
   */


  _createClass(DragSource, [{
    key: "destroy",
    value: function destroy() {
      this._removeDragListener();
    }
    /**
     * Called initially and after every drag
     *
     * @returns {void}
     */

  }, {
    key: "_createDragListener",
    value: function _createDragListener() {
      this._removeDragListener();

      this._dragListener = new DragListener(this._element);

      this._dragListener.on('dragStart', this._onDragStart, this);

      this._dragListener.on('dragStop', this._createDragListener, this);
    }
    /**
     * Callback for the DragListener's dragStart event
     *
     * @param   {int} x the x position of the mouse on dragStart
     * @param   {int} y the x position of the mouse on dragStart
     *
     * @returns {void}
     */

  }, {
    key: "_onDragStart",
    value: function _onDragStart(x, y) {
      var itemConfig = this._itemConfig;

      if (isFunction(itemConfig)) {
        itemConfig = itemConfig();
      }

      var contentItem = this._layoutManager._$normalizeContentItem($.extend(true, {}, itemConfig)),
          dragProxy = new DragProxy(x, y, this._dragListener, this._layoutManager, contentItem, null);

      this._layoutManager.transitionIndicator.transitionElements(this._element, dragProxy.element);
    }
    /**
    * Called after every drag and when the drag source is being disposed of.
    *
    * @returns {void}
    */

  }, {
    key: "_removeDragListener",
    value: function _removeDragListener() {
      if (this._dragListener !== null) {
        this._dragListener.destroy();
      }
    }
  }]);

  return DragSource;
}();

export { DragSource as default };