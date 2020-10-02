function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

import { now, animFrame, fnBind } from '../utils/utils';
import $ from 'jquery';

var TransitionIndicator = /*#__PURE__*/function () {
  function TransitionIndicator() {
    _classCallCheck(this, TransitionIndicator);

    this._element = $('<div class="lm_transition_indicator"></div>');
    $(document.body).append(this._element);
    this._toElement = null;
    this._fromDimensions = null;
    this._totalAnimationDuration = 200;
    this._animationStartTime = null;
  }

  _createClass(TransitionIndicator, [{
    key: "destroy",
    value: function destroy() {
      this._element.remove();
    }
  }, {
    key: "transitionElements",
    value: function transitionElements(fromElement, toElement) {
      /**
       * TODO - This is not quite as cool as expected. Review.
       */
      return; // this._toElement = toElement;
      // this._animationStartTime = now();
      // this._fromDimensions = this._measure(fromElement);
      // this._fromDimensions.opacity = 0.8;
      // this._element.show().css(this._fromDimensions);
      // animFrame(fnBind(this._nextAnimationFrame, this));
    }
  }, {
    key: "_nextAnimationFrame",
    value: function _nextAnimationFrame() {
      var toDimensions = this._measure(this._toElement),
          animationProgress = (now() - this._animationStartTime) / this._totalAnimationDuration,
          currentFrameStyles = {},
          cssProperty;

      if (animationProgress >= 1) {
        this._element.hide();

        return;
      }

      toDimensions.opacity = 0;

      for (cssProperty in this._fromDimensions) {
        currentFrameStyles[cssProperty] = this._fromDimensions[cssProperty] + (toDimensions[cssProperty] - this._fromDimensions[cssProperty]) * animationProgress;
      }

      this._element.css(currentFrameStyles);

      animFrame(fnBind(this._nextAnimationFrame, this));
    }
  }, {
    key: "_measure",
    value: function _measure(element) {
      var offset = element.offset();
      return {
        left: offset.left,
        top: offset.top,
        width: element.outerWidth(),
        height: element.outerHeight()
      };
    }
  }]);

  return TransitionIndicator;
}();

export { TransitionIndicator as default };