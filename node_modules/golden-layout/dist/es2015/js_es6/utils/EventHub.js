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
import { ALL_EVENT } from '../utils/EventEmitter';
import { fnBind } from '../utils/utils';
import $ from 'jquery';
/**
 * An EventEmitter singleton that propagates events
 * across multiple windows. This is a little bit trickier since
 * windows are allowed to open childWindows in their own right
 *
 * This means that we deal with a tree of windows. Hence the rules for event propagation are:
 *
 * - Propagate events from this layout to both parents and children
 * - Propagate events from parent to this and children
 * - Propagate events from children to the other children (but not the emitting one) and the parent
 *
 * @constructor
 *
 * @param {lm.LayoutManager} layoutManager
 */

var EventHub = /*#__PURE__*/function (_EventEmitter) {
  _inherits(EventHub, _EventEmitter);

  var _super = _createSuper(EventHub);

  function EventHub(layoutManager) {
    var _this;

    _classCallCheck(this, EventHub);

    _this = _super.call(this);
    _this._layoutManager = layoutManager;
    _this._dontPropagateToParent = null;
    _this._childEventSource = null;

    _this.on(ALL_EVENT, fnBind(_this._onEventFromThis, _assertThisInitialized(_this)));

    _this._boundOnEventFromChild = fnBind(_this._onEventFromChild, _assertThisInitialized(_this));
    $(window).on('gl_child_event', _this._boundOnEventFromChild);
    return _this;
  }
  /**
   * Called on every event emitted on this eventHub, regardles of origin.
   *
   * @private
   *
   * @param {Mixed}
   *
   * @returns {void}
   */


  _createClass(EventHub, [{
    key: "_onEventFromThis",
    value: function _onEventFromThis() {
      var args = Array.prototype.slice.call(arguments);

      if (this._layoutManager.isSubWindow && args[0] !== this._dontPropagateToParent) {
        this._propagateToParent(args);
      }

      this._propagateToChildren(args); //Reset


      this._dontPropagateToParent = null;
      this._childEventSource = null;
    }
    /**
     * Called by the parent layout.
     *
     * @param   {Array} args Event name + arguments
     *
     * @returns {void}
     */

  }, {
    key: "_$onEventFromParent",
    value: function _$onEventFromParent(args) {
      this._dontPropagateToParent = args[0];
      this.emit.apply(this, args);
    }
    /**
     * Callback for child events raised on the window
     *
     * @param   {DOMEvent} event
     * @private
     *
     * @returns {void}
     */

  }, {
    key: "_onEventFromChild",
    value: function _onEventFromChild(event) {
      this._childEventSource = event.originalEvent.__gl;
      this.emit.apply(this, event.originalEvent.__glArgs);
    }
    /**
     * Propagates the event to the parent by emitting
     * it on the parent's DOM window
     *
     * @param   {Array} args Event name + arguments
     * @private
     *
     * @returns {void}
     */

  }, {
    key: "_propagateToParent",
    value: function _propagateToParent(args) {
      var event,
          eventName = 'gl_child_event';

      if (document.createEvent) {
        event = window.opener.document.createEvent('HTMLEvents');
        event.initEvent(eventName, true, true);
      } else {
        event = window.opener.document.createEventObject();
        event.eventType = eventName;
      }

      event.eventName = eventName;
      event.__glArgs = args;
      event.__gl = this._layoutManager;

      if (document.createEvent) {
        window.opener.dispatchEvent(event);
      } else {
        window.opener.fireEvent('on' + event.eventType, event);
      }
    }
    /**
     * Propagate events to children
     *
     * @param   {Array} args Event name + arguments
     * @private
     *
     * @returns {void}
     */

  }, {
    key: "_propagateToChildren",
    value: function _propagateToChildren(args) {
      var childGl, i;

      for (i = 0; i < this._layoutManager.openPopouts.length; i++) {
        childGl = this._layoutManager.openPopouts[i].getGlInstance();

        if (childGl && childGl !== this._childEventSource) {
          childGl.eventHub._$onEventFromParent(args);
        }
      }
    }
    /**
     * Destroys the EventHub
     *
     * @public
     * @returns {void}
     */

  }, {
    key: "destroy",
    value: function destroy() {
      $(window).off('gl_child_event', this._boundOnEventFromChild);
    }
  }]);

  return EventHub;
}(EventEmitter);

export { EventHub as default };