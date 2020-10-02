function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

import $ from 'jquery';
/**
 * A specialised GoldenLayout component that binds GoldenLayout container
 * lifecycle events to react components
 *
 * @constructor
 *
 * @param {ItemContainer} container
 * @param {Object} state state is not required for react components
 */

var ReactComponentHandler = /*#__PURE__*/function () {
  function ReactComponentHandler(container, state) {
    _classCallCheck(this, ReactComponentHandler);

    this._reactComponent = null;
    this._originalComponentWillUpdate = null;
    this._container = container;
    this._initialState = state;
    this._reactClass = this._getReactClass();

    this._container.on('open', this._render, this);

    this._container.on('destroy', this._destroy, this);
  }
  /**
   * Creates the react class and component and hydrates it with
   * the initial state - if one is present
   *
   * By default, react's getInitialState will be used
   *
   * @private
   * @returns {void}
   */


  _createClass(ReactComponentHandler, [{
    key: "_render",
    value: function _render() {
      ReactDOM.render(this._getReactComponent(), this._container.getElement()[0]);
    }
    /**
     * Fired by react when the component is created.  Also fired upon destruction (where component is null).
     * <p>
     * Note: This callback is used instead of the return from `ReactDOM.render` because
     *	   of https://github.com/facebook/react/issues/10309.
     * </p>
     *
     * @private
     * @arg {React.Ref} component The component instance created by the `ReactDOM.render` call in the `_render` method.
     * @returns {void}
     */

  }, {
    key: "_gotReactComponent",
    value: function _gotReactComponent(component) {
      if (component !== null) {
        this._reactComponent = component;

        this._originalComponentWillUpdate = this._reactComponent.componentWillUpdate || function () {};

        this._reactComponent.componentWillUpdate = this._onUpdate.bind(this);

        if (this._container.getState()) {
          this._reactComponent.setState(this._container.getState());
        }
      }
    }
    /**
     * Removes the component from the DOM and thus invokes React's unmount lifecycle
     *
     * @private
     * @returns {void}
     */

  }, {
    key: "_destroy",
    value: function _destroy() {
      ReactDOM.unmountComponentAtNode(this._container.getElement()[0]);

      this._container.off('open', this._render, this);

      this._container.off('destroy', this._destroy, this);
    }
    /**
     * Hooks into React's state management and applies the componentstate
     * to GoldenLayout
     *
     * @private
     * @returns {void}
     */

  }, {
    key: "_onUpdate",
    value: function _onUpdate(nextProps, nextState) {
      this._container.setState(nextState);

      this._originalComponentWillUpdate.call(this._reactComponent, nextProps, nextState);
    }
    /**
     * Retrieves the react class from GoldenLayout's registry
     *
     * @private
     * @returns {React.Class}
     */

  }, {
    key: "_getReactClass",
    value: function _getReactClass() {
      var componentName = this._container._config.component;
      var reactClass;

      if (!componentName) {
        throw new Error('No react component name. type: react-component needs a field `component`');
      }

      reactClass = this._container.layoutManager.getComponent(this._container._config);

      if (!reactClass) {
        throw new Error('React component "' + componentName + '" not found. ' + 'Please register all components with GoldenLayout using `registerComponent(name, component)`');
      }

      return reactClass;
    }
    /**
     * Copies and extends the properties array and returns the React element
     *
     * @private
     * @returns {React.Element}
     */

  }, {
    key: "_getReactComponent",
    value: function _getReactComponent() {
      var defaultProps = {
        glEventHub: this._container.layoutManager.eventHub,
        glContainer: this._container,
        ref: this._gotReactComponent.bind(this)
      };
      var props = $.extend(defaultProps, this._container._config.props);
      return React.createElement(this._reactClass, props);
    }
  }]);

  return ReactComponentHandler;
}();

export { ReactComponentHandler as default };