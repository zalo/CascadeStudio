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
import { fnBind, getTouchEvent } from '../utils/utils';
import $ from 'jquery';

var DragListener = /*#__PURE__*/function (_EventEmitter) {
  _inherits(DragListener, _EventEmitter);

  var _super = _createSuper(DragListener);

  function DragListener(eElement, nButtonCode) {
    var _this;

    _classCallCheck(this, DragListener);

    _this = _super.call(this);
    _this._timeout = null;
    _this._eElement = $(eElement);
    _this._oDocument = $(document);
    _this._eBody = $(document.body);
    _this._nButtonCode = nButtonCode || 0;
    /**
     * The delay after which to start the drag in milliseconds
     */

    _this._nDelay = 200;
    /**
     * The distance the mouse needs to be moved to qualify as a drag
     */

    _this._nDistance = 10; //TODO - works better with delay only

    _this._nX = 0;
    _this._nY = 0;
    _this._nOriginalX = 0;
    _this._nOriginalY = 0;
    _this._bDragging = false;
    _this._fMove = fnBind(_this.onMouseMove, _assertThisInitialized(_this));
    _this._fUp = fnBind(_this.onMouseUp, _assertThisInitialized(_this));
    _this._fDown = fnBind(_this.onMouseDown, _assertThisInitialized(_this));

    _this._eElement.on('mousedown touchstart', _this._fDown);

    return _this;
  }

  _createClass(DragListener, [{
    key: "destroy",
    value: function destroy() {
      this._eElement.unbind('mousedown touchstart', this._fDown);

      this._oDocument.unbind('mouseup touchend', this._fUp);

      this._eElement = null;
      this._oDocument = null;
      this._eBody = null;
    }
  }, {
    key: "onMouseDown",
    value: function onMouseDown(oEvent) {
      oEvent.preventDefault();

      if (oEvent.button == 0 || oEvent.type === "touchstart") {
        var coordinates = this._getCoordinates(oEvent);

        this._nOriginalX = coordinates.x;
        this._nOriginalY = coordinates.y;

        this._oDocument.on('mousemove touchmove', this._fMove);

        this._oDocument.one('mouseup touchend', this._fUp);

        this._timeout = setTimeout(fnBind(this._startDrag, this), this._nDelay);
      }
    }
  }, {
    key: "onMouseMove",
    value: function onMouseMove(oEvent) {
      if (this._timeout != null) {
        oEvent.preventDefault();

        var coordinates = this._getCoordinates(oEvent);

        this._nX = coordinates.x - this._nOriginalX;
        this._nY = coordinates.y - this._nOriginalY;

        if (this._bDragging === false) {
          if (Math.abs(this._nX) > this._nDistance || Math.abs(this._nY) > this._nDistance) {
            clearTimeout(this._timeout);

            this._startDrag();
          }
        }

        if (this._bDragging) {
          this.emit('drag', this._nX, this._nY, oEvent);
        }
      }
    }
  }, {
    key: "onMouseUp",
    value: function onMouseUp(oEvent) {
      if (this._timeout != null) {
        clearTimeout(this._timeout);

        this._eBody.removeClass('lm_dragging');

        this._eElement.removeClass('lm_dragging');

        this._oDocument.find('iframe').css('pointer-events', '');

        this._oDocument.unbind('mousemove touchmove', this._fMove);

        this._oDocument.unbind('mouseup touchend', this._fUp);

        if (this._bDragging === true) {
          this._bDragging = false;
          this.emit('dragStop', oEvent, this._nOriginalX + this._nX);
        }
      }
    }
  }, {
    key: "_startDrag",
    value: function _startDrag() {
      this._bDragging = true;

      this._eBody.addClass('lm_dragging');

      this._eElement.addClass('lm_dragging');

      this._oDocument.find('iframe').css('pointer-events', 'none');

      this.emit('dragStart', this._nOriginalX, this._nOriginalY);
    }
  }, {
    key: "_getCoordinates",
    value: function _getCoordinates(event) {
      event = getTouchEvent(event);
      return {
        x: event.pageX,
        y: event.pageY
      };
    }
  }]);

  return DragListener;
}(EventEmitter);

export { DragListener as default };