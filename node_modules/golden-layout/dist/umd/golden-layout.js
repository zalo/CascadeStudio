(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory(require("jquery"));
	else if(typeof define === 'function' && define.amd)
		define(["jquery"], factory);
	else if(typeof exports === 'object')
		exports["GoldenLayout"] = factory(require("jquery"));
	else
		root["GoldenLayout"] = factory(root["$"]);
})(window, function(__WEBPACK_EXTERNAL_MODULE_jquery__) {
return /******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
/******/ 		}
/******/ 	};
/******/
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = function(exports) {
/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		}
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/
/******/ 	// create a fake namespace object
/******/ 	// mode & 1: value is a module id, require it
/******/ 	// mode & 2: merge all properties of value into the ns
/******/ 	// mode & 4: return value when already ns object
/******/ 	// mode & 8|1: behave like require
/******/ 	__webpack_require__.t = function(value, mode) {
/******/ 		if(mode & 1) value = __webpack_require__(value);
/******/ 		if(mode & 8) return value;
/******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
/******/ 		var ns = Object.create(null);
/******/ 		__webpack_require__.r(ns);
/******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
/******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
/******/ 		return ns;
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = "./src/index.js");
/******/ })
/************************************************************************/
/******/ ({

/***/ "./src/index.js":
/*!**********************!*\
  !*** ./src/index.js ***!
  \**********************/
/*! exports provided: default, ItemContainer, BrowserPopout, Header, HeaderButton, Tab, Component, Root, RowOrColumn, Stack, BubblingEvent, ConfigMinifier, DragListener, EventEmitter, EventHub, ReactComponentHandler */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _js_es6_LayoutManager__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./js_es6/LayoutManager */ "./src/js_es6/LayoutManager.js");
/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "default", function() { return _js_es6_LayoutManager__WEBPACK_IMPORTED_MODULE_0__["default"]; });

/* harmony import */ var _js_es6_container_ItemContainer__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./js_es6/container/ItemContainer */ "./src/js_es6/container/ItemContainer.js");
/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "ItemContainer", function() { return _js_es6_container_ItemContainer__WEBPACK_IMPORTED_MODULE_1__["default"]; });

/* harmony import */ var _js_es6_controls_BrowserPopout__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./js_es6/controls/BrowserPopout */ "./src/js_es6/controls/BrowserPopout.js");
/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "BrowserPopout", function() { return _js_es6_controls_BrowserPopout__WEBPACK_IMPORTED_MODULE_2__["default"]; });

/* harmony import */ var _js_es6_controls_Header__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./js_es6/controls/Header */ "./src/js_es6/controls/Header.js");
/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "Header", function() { return _js_es6_controls_Header__WEBPACK_IMPORTED_MODULE_3__["default"]; });

/* harmony import */ var _js_es6_controls_HeaderButton__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./js_es6/controls/HeaderButton */ "./src/js_es6/controls/HeaderButton.js");
/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "HeaderButton", function() { return _js_es6_controls_HeaderButton__WEBPACK_IMPORTED_MODULE_4__["default"]; });

/* harmony import */ var _js_es6_controls_Tab__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./js_es6/controls/Tab */ "./src/js_es6/controls/Tab.js");
/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "Tab", function() { return _js_es6_controls_Tab__WEBPACK_IMPORTED_MODULE_5__["default"]; });

/* harmony import */ var _js_es6_items_Component__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./js_es6/items/Component */ "./src/js_es6/items/Component.js");
/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "Component", function() { return _js_es6_items_Component__WEBPACK_IMPORTED_MODULE_6__["default"]; });

/* harmony import */ var _js_es6_items_Root__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./js_es6/items/Root */ "./src/js_es6/items/Root.js");
/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "Root", function() { return _js_es6_items_Root__WEBPACK_IMPORTED_MODULE_7__["default"]; });

/* harmony import */ var _js_es6_items_RowOrColumn__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./js_es6/items/RowOrColumn */ "./src/js_es6/items/RowOrColumn.js");
/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "RowOrColumn", function() { return _js_es6_items_RowOrColumn__WEBPACK_IMPORTED_MODULE_8__["default"]; });

/* harmony import */ var _js_es6_items_Stack__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./js_es6/items/Stack */ "./src/js_es6/items/Stack.js");
/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "Stack", function() { return _js_es6_items_Stack__WEBPACK_IMPORTED_MODULE_9__["default"]; });

/* harmony import */ var _js_es6_utils_BubblingEvent__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./js_es6/utils/BubblingEvent */ "./src/js_es6/utils/BubblingEvent.js");
/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "BubblingEvent", function() { return _js_es6_utils_BubblingEvent__WEBPACK_IMPORTED_MODULE_10__["default"]; });

/* harmony import */ var _js_es6_utils_ConfigMinifier__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./js_es6/utils/ConfigMinifier */ "./src/js_es6/utils/ConfigMinifier.js");
/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "ConfigMinifier", function() { return _js_es6_utils_ConfigMinifier__WEBPACK_IMPORTED_MODULE_11__["default"]; });

/* harmony import */ var _js_es6_utils_DragListener__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ./js_es6/utils/DragListener */ "./src/js_es6/utils/DragListener.js");
/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "DragListener", function() { return _js_es6_utils_DragListener__WEBPACK_IMPORTED_MODULE_12__["default"]; });

/* harmony import */ var _js_es6_utils_EventEmitter__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ./js_es6/utils/EventEmitter */ "./src/js_es6/utils/EventEmitter.js");
/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "EventEmitter", function() { return _js_es6_utils_EventEmitter__WEBPACK_IMPORTED_MODULE_13__["default"]; });

/* harmony import */ var _js_es6_utils_EventHub__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ./js_es6/utils/EventHub */ "./src/js_es6/utils/EventHub.js");
/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "EventHub", function() { return _js_es6_utils_EventHub__WEBPACK_IMPORTED_MODULE_14__["default"]; });

/* harmony import */ var _js_es6_utils_ReactComponentHandler__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ./js_es6/utils/ReactComponentHandler */ "./src/js_es6/utils/ReactComponentHandler.js");
/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "ReactComponentHandler", function() { return _js_es6_utils_ReactComponentHandler__WEBPACK_IMPORTED_MODULE_15__["default"]; });

// helper file for webpack build system
// whatever is imported/exported here will be included in the build
//import 'less/test.less'
//import './less/goldenlayout-base.less'
//import './less/goldenlayout-dark-theme.less'
//
// Layout
 //
// container

 //
// controls




 //
// items




 //
// utils








/***/ }),

/***/ "./src/js_es6/LayoutManager.js":
/*!*************************************!*\
  !*** ./src/js_es6/LayoutManager.js ***!
  \*************************************/
/*! exports provided: REACT_COMPONENT_ID, default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "REACT_COMPONENT_ID", function() { return REACT_COMPONENT_ID; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "default", function() { return LayoutManager; });
/* harmony import */ var _utils_EventEmitter__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./utils/EventEmitter */ "./src/js_es6/utils/EventEmitter.js");
/* harmony import */ var _utils_ConfigMinifier__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./utils/ConfigMinifier */ "./src/js_es6/utils/ConfigMinifier.js");
/* harmony import */ var _utils_EventHub__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./utils/EventHub */ "./src/js_es6/utils/EventHub.js");
/* harmony import */ var _items_Root__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./items/Root */ "./src/js_es6/items/Root.js");
/* harmony import */ var _items_RowOrColumn__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./items/RowOrColumn */ "./src/js_es6/items/RowOrColumn.js");
/* harmony import */ var _items_Stack__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./items/Stack */ "./src/js_es6/items/Stack.js");
/* harmony import */ var _items_Component__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./items/Component */ "./src/js_es6/items/Component.js");
/* harmony import */ var _items_AbstractContentItem__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./items/AbstractContentItem */ "./src/js_es6/items/AbstractContentItem.js");
/* harmony import */ var _controls_BrowserPopout__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./controls/BrowserPopout */ "./src/js_es6/controls/BrowserPopout.js");
/* harmony import */ var _controls_DragSource__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./controls/DragSource */ "./src/js_es6/controls/DragSource.js");
/* harmony import */ var _controls_DropTargetIndicator__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./controls/DropTargetIndicator */ "./src/js_es6/controls/DropTargetIndicator.js");
/* harmony import */ var _controls_TransitionIndicator__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./controls/TransitionIndicator */ "./src/js_es6/controls/TransitionIndicator.js");
/* harmony import */ var _errors_ConfigurationError__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ./errors/ConfigurationError */ "./src/js_es6/errors/ConfigurationError.js");
/* harmony import */ var _config_defaultConfig__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ./config/defaultConfig */ "./src/js_es6/config/defaultConfig.js");
/* harmony import */ var _utils_utils__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ./utils/utils */ "./src/js_es6/utils/utils.js");
/* harmony import */ var jquery__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! jquery */ "jquery");
/* harmony import */ var jquery__WEBPACK_IMPORTED_MODULE_15___default = /*#__PURE__*/__webpack_require__.n(jquery__WEBPACK_IMPORTED_MODULE_15__);
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

















var REACT_COMPONENT_ID = 'lm-react-component';
/**
 * The main class that will be exposed as GoldenLayout.
 *
 * @public
 * @constructor
 * @param {GoldenLayout config} config
 * @param {[DOM element container]} container Can be a jQuery selector string or a Dom element. Defaults to body
 *
 * @returns {VOID}
 */

var LayoutManager = /*#__PURE__*/function (_EventEmitter) {
  _inherits(LayoutManager, _EventEmitter);

  var _super = _createSuper(LayoutManager);

  function LayoutManager(config, container) {
    var _this;

    _classCallCheck(this, LayoutManager);

    _this = _super.call(this);
    _this.isInitialised = false;
    _this._isFullPage = false;
    _this._resizeTimeoutId = null;
    _this._components = {};
    _this._itemAreas = [];
    _this._resizeFunction = Object(_utils_utils__WEBPACK_IMPORTED_MODULE_14__["fnBind"])(_this._onResize, _assertThisInitialized(_this));
    _this._unloadFunction = Object(_utils_utils__WEBPACK_IMPORTED_MODULE_14__["fnBind"])(_this._onUnload, _assertThisInitialized(_this));
    _this._maximisedItem = null;
    _this._maximisePlaceholder = jquery__WEBPACK_IMPORTED_MODULE_15___default()('<div class="lm_maximise_place"></div>');
    _this._creationTimeoutPassed = false;
    _this._subWindowsCreated = false;
    _this._dragSources = [];
    _this._updatingColumnsResponsive = false;
    _this._firstLoad = true;
    _this.width = null;
    _this.height = null;
    _this.root = null;
    _this.openPopouts = [];
    _this.selectedItem = null;
    _this.isSubWindow = false;
    _this.eventHub = new _utils_EventHub__WEBPACK_IMPORTED_MODULE_2__["default"](_assertThisInitialized(_this));
    _this.config = _this._createConfig(config);
    _this.container = container;
    _this.dropTargetIndicator = null;
    _this.transitionIndicator = null;
    _this.tabDropPlaceholder = jquery__WEBPACK_IMPORTED_MODULE_15___default()('<div class="lm_drop_tab_placeholder"></div>');

    if (_this.isSubWindow === true) {
      jquery__WEBPACK_IMPORTED_MODULE_15___default()('body').css('visibility', 'hidden');
    }

    _this._typeToItem = {
      'column': Object(_utils_utils__WEBPACK_IMPORTED_MODULE_14__["fnBind"])(_items_RowOrColumn__WEBPACK_IMPORTED_MODULE_4__["default"], _assertThisInitialized(_this), [true]),
      'row': Object(_utils_utils__WEBPACK_IMPORTED_MODULE_14__["fnBind"])(_items_RowOrColumn__WEBPACK_IMPORTED_MODULE_4__["default"], _assertThisInitialized(_this), [false]),
      'stack': _items_Stack__WEBPACK_IMPORTED_MODULE_5__["default"],
      'component': _items_Component__WEBPACK_IMPORTED_MODULE_6__["default"]
    };
    return _this;
  }
  /**
   * Takes a GoldenLayout configuration object and
   * replaces its keys and values recursively with
   * one letter codes
   *
   * @static
   * @public
   * @param   {Object} config A GoldenLayout config object
   *
   * @returns {Object} minified config
   */


  _createClass(LayoutManager, [{
    key: "minifyConfig",
    value: function minifyConfig(config) {
      return new _utils_ConfigMinifier__WEBPACK_IMPORTED_MODULE_1__["default"]().minifyConfig(config);
    }
    /**
     * Takes a configuration Object that was previously minified
     * using minifyConfig and returns its original version
     *
     * @static
     * @public
     * @param   {Object} minifiedConfig
     *
     * @returns {Object} the original configuration
     */

  }, {
    key: "unminifyConfig",
    value: function unminifyConfig(config) {
      return new _utils_ConfigMinifier__WEBPACK_IMPORTED_MODULE_1__["default"]().unminifyConfig(config);
    }
    /**
     * Register a component with the layout manager. If a configuration node
     * of type component is reached it will look up componentName and create the
     * associated component
     *
     *  {
     *    type: "component",
     *    componentName: "EquityNewsFeed",
     *    componentState: { "feedTopic": "us-bluechips" }
     *  }
     *
     * @public
     * @param   {String} name
     * @param   {Function} constructor
     *
     * @returns {void}
     */

  }, {
    key: "registerComponent",
    value: function registerComponent(name, constructor) {
      if (typeof constructor !== 'function') {
        throw new Error('Please register a constructor function');
      }

      if (this._components[name] !== undefined) {
        throw new Error('Component ' + name + ' is already registered');
      }

      this._components[name] = constructor;
    }
    /**
     * Register a component function with the layout manager. This function should
     * return a constructor for a component based on a config.  If undefined is returned, 
     * and no component has been registered under that name using registerComponent, an 
     * error will be thrown.
     *
     * @public
     * @param   {Function} callback
     *
     * @returns {void}
     */

  }, {
    key: "registerComponentFunction",
    value: function registerComponentFunction(callback) {
      if (typeof callback !== 'function') {
        throw new Error('Please register a callback function');
      }

      if (this._componentFunction !== undefined) {
        console.warn('Multiple component functions are being registered.  Only the final registered function will be used.');
      }

      this._componentFunction = callback;
    }
    /**
     * Creates a layout configuration object based on the the current state
     *
     * @public
     * @returns {Object} GoldenLayout configuration
     */

  }, {
    key: "toConfig",
    value: function toConfig(root) {
      var config, _next, i;

      if (this.isInitialised === false) {
        throw new Error('Can\'t create config, layout not yet initialised');
      }

      if (root && !(root instanceof _items_AbstractContentItem__WEBPACK_IMPORTED_MODULE_7__["default"])) {
        throw new Error('Root must be a ContentItem');
      }
      /*
       * settings & labels
       */


      config = {
        settings: Object(_utils_utils__WEBPACK_IMPORTED_MODULE_14__["copy"])({}, this.config.settings),
        dimensions: Object(_utils_utils__WEBPACK_IMPORTED_MODULE_14__["copy"])({}, this.config.dimensions),
        labels: Object(_utils_utils__WEBPACK_IMPORTED_MODULE_14__["copy"])({}, this.config.labels)
      };
      /*
       * Content
       */

      config.content = [];

      _next = function next(configNode, item) {
        var key, i;

        for (key in item.config) {
          if (key !== 'content') {
            configNode[key] = item.config[key];
          }
        }

        if (item.contentItems.length) {
          configNode.content = [];

          for (i = 0; i < item.contentItems.length; i++) {
            configNode.content[i] = {};

            _next(configNode.content[i], item.contentItems[i]);
          }
        }
      };

      if (root) {
        _next(config, {
          contentItems: [root]
        });
      } else {
        _next(config, this.root);
      }
      /*
       * Retrieve config for subwindows
       */


      this._$reconcilePopoutWindows();

      config.openPopouts = [];

      for (i = 0; i < this.openPopouts.length; i++) {
        config.openPopouts.push(this.openPopouts[i].toConfig());
      }
      /*
       * Add maximised item
       */


      config.maximisedItemId = this._maximisedItem ? '__glMaximised' : null;
      return config;
    }
    /**
     * Returns a previously registered component.  Attempts to utilize registered 
     * component by name first, then falls back to the component function.  If either
     * lack a response for what the component should be, it throws an error.
     *
     * @public
     * @param {Object} config - The item config
     * 
     * @returns {Function}
     */

  }, {
    key: "getComponent",
    value: function getComponent(config) {
      var name = this.getComponentNameFromConfig(config);
      var componentToUse = this._components[name];

      if (this._componentFunction !== undefined) {
        componentToUse = componentToUse || this._componentFunction({
          config: config
        });
      }

      if (componentToUse === undefined) {
        throw new _errors_ConfigurationError__WEBPACK_IMPORTED_MODULE_12__["default"]('Unknown component "' + name + '"');
      }

      return componentToUse;
    }
    /**
     * Creates the actual layout. Must be called after all initial components
     * are registered. Recurses through the configuration and sets up
     * the item tree.
     *
     * If called before the document is ready it adds itself as a listener
     * to the document.ready event
     *
     * @public
     *
     * @returns {void}
     */

  }, {
    key: "init",
    value: function init() {
      /**
       * Create the popout windows straight away. If popouts are blocked
       * an error is thrown on the same 'thread' rather than a timeout and can
       * be caught. This also prevents any further initilisation from taking place.
       */
      if (this._subWindowsCreated === false) {
        this._createSubWindows();

        this._subWindowsCreated = true;
      }
      /**
       * If the document isn't ready yet, wait for it.
       */


      if (document.readyState === 'loading' || document.body === null) {
        jquery__WEBPACK_IMPORTED_MODULE_15___default()(document).ready(Object(_utils_utils__WEBPACK_IMPORTED_MODULE_14__["fnBind"])(this.init, this));
        return;
      }
      /**
       * If this is a subwindow, wait a few milliseconds for the original
       * page's js calls to be executed, then replace the bodies content
       * with GoldenLayout
       */


      if (this.isSubWindow === true && this._creationTimeoutPassed === false) {
        setTimeout(Object(_utils_utils__WEBPACK_IMPORTED_MODULE_14__["fnBind"])(this.init, this), 7);
        this._creationTimeoutPassed = true;
        return;
      }

      if (this.isSubWindow === true) {
        this._adjustToWindowMode();
      }

      this._setContainer();

      this.dropTargetIndicator = new _controls_DropTargetIndicator__WEBPACK_IMPORTED_MODULE_10__["default"](this.container);
      this.transitionIndicator = new _controls_TransitionIndicator__WEBPACK_IMPORTED_MODULE_11__["default"]();
      this.updateSize();

      this._create(this.config);

      this._bindEvents();

      this.isInitialised = true;

      this._adjustColumnsResponsive();

      this.emit('initialised');
    }
    /**
     * Updates the layout managers size
     *
     * @public
     * @param   {[int]} width  height in pixels
     * @param   {[int]} height width in pixels
     *
     * @returns {void}
     */

  }, {
    key: "updateSize",
    value: function updateSize(width, height) {
      if (arguments.length === 2) {
        this.width = width;
        this.height = height;
      } else {
        this.width = this.container.width();
        this.height = this.container.height();
      }

      if (this.isInitialised === true) {
        this.root.callDownwards('setSize', [this.width, this.height]);

        if (this._maximisedItem) {
          this._maximisedItem.element.width(this.container.width());

          this._maximisedItem.element.height(this.container.height());

          this._maximisedItem.callDownwards('setSize');
        }

        this._adjustColumnsResponsive();
      }
    }
    /**
     * Destroys the LayoutManager instance itself as well as every ContentItem
     * within it. After this is called nothing should be left of the LayoutManager.
     *
     * @public
     * @returns {void}
     */

  }, {
    key: "destroy",
    value: function destroy() {
      if (this.isInitialised === false) {
        return;
      }

      this._onUnload();

      jquery__WEBPACK_IMPORTED_MODULE_15___default()(window).off('resize', this._resizeFunction);
      jquery__WEBPACK_IMPORTED_MODULE_15___default()(window).off('unload beforeunload', this._unloadFunction);
      this.root.callDownwards('_$destroy', [], true);
      this.root.contentItems = [];
      this.tabDropPlaceholder.remove();
      this.dropTargetIndicator.destroy();
      this.transitionIndicator.destroy();
      this.eventHub.destroy();

      this._dragSources.forEach(function (dragSource) {
        dragSource._dragListener.destroy();

        dragSource._element = null;
        dragSource._itemConfig = null;
        dragSource._dragListener = null;
      });

      this._dragSources = [];
    }
    /**
     * Returns whether or not the config corresponds to a react component or a normal component.
     * 
     * At some point the type is mutated, but the componentName should then correspond to the
     * REACT_COMPONENT_ID.
     * 
     * @param {Object} config ItemConfig
     * 
     * @returns {Boolean}
     */

  }, {
    key: "isReactConfig",
    value: function isReactConfig(config) {
      return config.type === 'react-component' || config.componentName === REACT_COMPONENT_ID;
    }
    /**
     * Returns the name of the component for the config, taking into account whether it's a react component or not.
     * 
     * @param {Object} config ItemConfig
     * 
     * @returns {String}
     */

  }, {
    key: "getComponentNameFromConfig",
    value: function getComponentNameFromConfig(config) {
      if (this.isReactConfig(config)) {
        return config.component;
      }

      return config.componentName;
    }
    /**
     * Recursively creates new item tree structures based on a provided
     * ItemConfiguration object
     *
     * @public
     * @param   {Object} config ItemConfig
     * @param   {[ContentItem]} parent The item the newly created item should be a child of
     *
     * @returns {ContentItem}
     */

  }, {
    key: "createContentItem",
    value: function createContentItem(config, parent) {
      var typeErrorMsg, contentItem;

      if (typeof config.type !== 'string') {
        throw new _errors_ConfigurationError__WEBPACK_IMPORTED_MODULE_12__["default"]('Missing parameter \'type\'', config);
      }

      if (this.isReactConfig(config)) {
        config.type = 'component';
        config.componentName = REACT_COMPONENT_ID;
      }

      if (!this._typeToItem[config.type]) {
        typeErrorMsg = 'Unknown type \'' + config.type + '\'. ' + 'Valid types are ' + Object(_utils_utils__WEBPACK_IMPORTED_MODULE_14__["objectKeys"])(this._typeToItem).join(',');
        throw new _errors_ConfigurationError__WEBPACK_IMPORTED_MODULE_12__["default"](typeErrorMsg);
      }
      /**
       * We add an additional stack around every component that's not within a stack anyways.
       */


      if ( // If this is a component
      config.type === 'component' && // and it's not already within a stack
      !(parent instanceof _items_Stack__WEBPACK_IMPORTED_MODULE_5__["default"]) && // and we have a parent
      !!parent && // and it's not the topmost item in a new window
      !(this.isSubWindow === true && parent instanceof _items_Root__WEBPACK_IMPORTED_MODULE_3__["default"])) {
        config = {
          type: 'stack',
          width: config.width,
          height: config.height,
          content: [config]
        };
      }

      contentItem = new this._typeToItem[config.type](this, config, parent);
      return contentItem;
    }
    /**
     * Creates a popout window with the specified content and dimensions
     *
     * @param   {Object|lm.itemsAbstractContentItem} configOrContentItem
     * @param   {[Object]} dimensions A map with width, height, left and top
     * @param    {[String]} parentId the id of the element this item will be appended to
     *                             when popIn is called
     * @param    {[Number]} indexInParent The position of this item within its parent element
     
     * @returns {BrowserPopout}
     */

  }, {
    key: "createPopout",
    value: function createPopout(configOrContentItem, dimensions, parentId, indexInParent) {
      var config = configOrContentItem,
          isItem = configOrContentItem instanceof _items_AbstractContentItem__WEBPACK_IMPORTED_MODULE_7__["default"],
          self = this,
          windowLeft,
          windowTop,
          offset,
          parent,
          child,
          browserPopout;
      parentId = parentId || null;

      if (isItem) {
        config = this.toConfig(configOrContentItem).content;
        parentId = Object(_utils_utils__WEBPACK_IMPORTED_MODULE_14__["getUniqueId"])();
        /**
         * If the item is the only component within a stack or for some
         * other reason the only child of its parent the parent will be destroyed
         * when the child is removed.
         *
         * In order to support this we move up the tree until we find something
         * that will remain after the item is being popped out
         */

        parent = configOrContentItem.parent;
        child = configOrContentItem;

        while (parent.contentItems.length === 1 && !parent.isRoot) {
          parent = parent.parent;
          child = child.parent;
        }

        parent.addId(parentId);

        if (isNaN(indexInParent)) {
          indexInParent = Object(_utils_utils__WEBPACK_IMPORTED_MODULE_14__["indexOf"])(child, parent.contentItems);
        }
      } else {
        if (!(config instanceof Array)) {
          config = [config];
        }
      }

      if (!dimensions && isItem) {
        windowLeft = window.screenX || window.screenLeft;
        windowTop = window.screenY || window.screenTop;
        offset = configOrContentItem.element.offset();
        dimensions = {
          left: windowLeft + offset.left,
          top: windowTop + offset.top,
          width: configOrContentItem.element.width(),
          height: configOrContentItem.element.height()
        };
      }

      if (!dimensions && !isItem) {
        dimensions = {
          left: window.screenX || window.screenLeft + 20,
          top: window.screenY || window.screenTop + 20,
          width: 500,
          height: 309
        };
      }

      if (isItem) {
        configOrContentItem.remove();
      }

      browserPopout = new _controls_BrowserPopout__WEBPACK_IMPORTED_MODULE_8__["default"](config, dimensions, parentId, indexInParent, this);
      browserPopout.on('initialised', function () {
        self.emit('windowOpened', browserPopout);
      });
      browserPopout.on('closed', function () {
        self._$reconcilePopoutWindows();
      });
      this.openPopouts.push(browserPopout);
      return browserPopout;
    }
    /**
     * Attaches DragListener to any given DOM element
     * and turns it into a way of creating new ContentItems
     * by 'dragging' the DOM element into the layout
     *
     * @param   {jQuery DOM element} element
     * @param   {Object|Function} itemConfig for the new item to be created, or a function which will provide it
     *
     * @returns {DragSource}  an opaque object that identifies the DOM element
    *          and the attached itemConfig. This can be used in
    *          removeDragSource() later to get rid of the drag listeners.
     */

  }, {
    key: "createDragSource",
    value: function createDragSource(element, itemConfig) {
      this.config.settings.constrainDragToContainer = false;
      var dragSource = new _controls_DragSource__WEBPACK_IMPORTED_MODULE_9__["default"](jquery__WEBPACK_IMPORTED_MODULE_15___default()(element), itemConfig, this);

      this._dragSources.push(dragSource);

      return dragSource;
    }
    /**
    * Removes a DragListener added by createDragSource() so the corresponding
    * DOM element is not a drag source any more.
    *
    * @param   {jQuery DOM element} element
    *
    * @returns {void}
    */

  }, {
    key: "removeDragSource",
    value: function removeDragSource(dragSource) {
      dragSource.destroy();
      lm.utils.removeFromArray(dragSource, this._dragSources);
    }
    /**
     * Programmatically selects an item. This deselects
     * the currently selected item, selects the specified item
     * and emits a selectionChanged event
     *
     * @param   {AbstractContentItem} item#
     * @param   {[Boolean]} _$silent Wheather to notify the item of its selection
     * @event    selectionChanged
     *
     * @returns {VOID}
     */

  }, {
    key: "selectItem",
    value: function selectItem(item, _$silent) {
      if (this.config.settings.selectionEnabled !== true) {
        throw new Error('Please set selectionEnabled to true to use this feature');
      }

      if (item === this.selectedItem) {
        return;
      }

      if (this.selectedItem !== null) {
        this.selectedItem.deselect();
      }

      if (item && _$silent !== true) {
        item.select();
      }

      this.selectedItem = item;
      this.emit('selectionChanged', item);
    }
    /*************************
     * PACKAGE PRIVATE
     *************************/

  }, {
    key: "_$maximiseItem",
    value: function _$maximiseItem(contentItem) {
      if (this._maximisedItem !== null) {
        this._$minimiseItem(this._maximisedItem);
      }

      this._maximisedItem = contentItem;
      contentItem.on('beforeItemDestroyed', this._$cleanupBeforeMaximisedItemDestroyed, this);

      this._maximisedItem.addId('__glMaximised');

      contentItem.element.addClass('lm_maximised');
      contentItem.element.after(this._maximisePlaceholder);
      this.root.element.prepend(contentItem.element);
      contentItem.element.width(this.container.width());
      contentItem.element.height(this.container.height());
      contentItem.callDownwards('setSize');

      this._maximisedItem.emit('maximised');

      this.emit('stateChanged');
    }
  }, {
    key: "_$minimiseItem",
    value: function _$minimiseItem(contentItem) {
      contentItem.element.removeClass('lm_maximised');
      contentItem.removeId('__glMaximised');

      this._maximisePlaceholder.after(contentItem.element);

      this._maximisePlaceholder.remove();

      contentItem.parent.callDownwards('setSize');
      this._maximisedItem = null;
      contentItem.off('beforeItemDestroyed', this._$cleanupBeforeMaximisedItemDestroyed, this);
      contentItem.emit('minimised');
      this.emit('stateChanged');
    }
  }, {
    key: "_$cleanupBeforeMaximisedItemDestroyed",
    value: function _$cleanupBeforeMaximisedItemDestroyed() {
      if (this._maximisedItem === event.origin) {
        this._maximisedItem.off('beforeItemDestroyed', this._$cleanupBeforeMaximisedItemDestroyed, this);

        this._maximisedItem = null;
      }
    }
    /**
     * This method is used to get around sandboxed iframe restrictions.
     * If 'allow-top-navigation' is not specified in the iframe's 'sandbox' attribute
     * (as is the case with codepens) the parent window is forbidden from calling certain
     * methods on the child, such as window.close() or setting document.location.href.
     *
     * This prevented GoldenLayout popouts from popping in in codepens. The fix is to call
     * _$closeWindow on the child window's gl instance which (after a timeout to disconnect
     * the invoking method from the close call) closes itself.
     *
     * @packagePrivate
     *
     * @returns {void}
     */

  }, {
    key: "_$closeWindow",
    value: function _$closeWindow() {
      window.setTimeout(function () {
        window.close();
      }, 1);
    }
  }, {
    key: "_$getArea",
    value: function _$getArea(x, y) {
      var i,
          area,
          smallestSurface = Infinity,
          mathingArea = null;

      for (i = 0; i < this._itemAreas.length; i++) {
        area = this._itemAreas[i];

        if (x > area.x1 && x < area.x2 && y > area.y1 && y < area.y2 && smallestSurface > area.surface) {
          smallestSurface = area.surface;
          mathingArea = area;
        }
      }

      return mathingArea;
    }
  }, {
    key: "_$createRootItemAreas",
    value: function _$createRootItemAreas() {
      var areaSize = 50;
      var sides = {
        y2: 'y1',
        x2: 'x1',
        y1: 'y2',
        x1: 'x2'
      };

      for (var side in sides) {
        var area = this.root._$getArea();

        area.side = side;
        if (sides[side][1] === '2') area[side] = area[sides[side]] - areaSize;else area[side] = area[sides[side]] + areaSize;
        area.surface = (area.x2 - area.x1) * (area.y2 - area.y1);

        this._itemAreas.push(area);
      }
    }
  }, {
    key: "_$calculateItemAreas",
    value: function _$calculateItemAreas() {
      var i,
          area,
          allContentItems = this._getAllContentItems();

      this._itemAreas = [];
      /**
       * If the last item is dragged out, highlight the entire container size to
       * allow to re-drop it. allContentItems[ 0 ] === this.root at this point
       *
       * Don't include root into the possible drop areas though otherwise since it
       * will used for every gap in the layout, e.g. splitters
       */

      if (allContentItems.length === 1) {
        this._itemAreas.push(this.root._$getArea());

        return;
      }

      this._$createRootItemAreas();

      for (i = 0; i < allContentItems.length; i++) {
        if (!allContentItems[i].isStack) {
          continue;
        }

        area = allContentItems[i]._$getArea();

        if (area === null) {
          continue;
        } else if (area instanceof Array) {
          this._itemAreas = this._itemAreas.concat(area);
        } else {
          this._itemAreas.push(area);

          var header = {};
          Object(_utils_utils__WEBPACK_IMPORTED_MODULE_14__["copy"])(header, area);
          Object(_utils_utils__WEBPACK_IMPORTED_MODULE_14__["copy"])(header, area.contentItem._contentAreaDimensions.header.highlightArea);
          header.surface = (header.x2 - header.x1) * (header.y2 - header.y1);

          this._itemAreas.push(header);
        }
      }
    }
    /**
     * Takes a contentItem or a configuration and optionally a parent
     * item and returns an initialised instance of the contentItem.
     * If the contentItem is a function, it is first called
     *
     * @packagePrivate
     *
     * @param   {AbtractContentItem|Object|Function} contentItemOrConfig
     * @param   {AbtractContentItem} parent Only necessary when passing in config
     *
     * @returns {AbtractContentItem}
     */

  }, {
    key: "_$normalizeContentItem",
    value: function _$normalizeContentItem(contentItemOrConfig, parent) {
      if (!contentItemOrConfig) {
        throw new Error('No content item defined');
      }

      if (Object(_utils_utils__WEBPACK_IMPORTED_MODULE_14__["isFunction"])(contentItemOrConfig)) {
        contentItemOrConfig = contentItemOrConfig();
      }

      if (contentItemOrConfig instanceof _items_AbstractContentItem__WEBPACK_IMPORTED_MODULE_7__["default"]) {
        return contentItemOrConfig;
      }

      if (jquery__WEBPACK_IMPORTED_MODULE_15___default.a.isPlainObject(contentItemOrConfig) && contentItemOrConfig.type) {
        var newContentItem = this.createContentItem(contentItemOrConfig, parent);
        newContentItem.callDownwards('_$init');
        return newContentItem;
      } else {
        throw new Error('Invalid contentItem');
      }
    }
    /**
     * Iterates through the array of open popout windows and removes the ones
     * that are effectively closed. This is necessary due to the lack of reliably
     * listening for window.close / unload events in a cross browser compatible fashion.
     *
     * @packagePrivate
     *
     * @returns {void}
     */

  }, {
    key: "_$reconcilePopoutWindows",
    value: function _$reconcilePopoutWindows() {
      var openPopouts = [],
          i;

      for (i = 0; i < this.openPopouts.length; i++) {
        if (this.openPopouts[i].getWindow().closed === false) {
          openPopouts.push(this.openPopouts[i]);
        } else {
          this.emit('windowClosed', this.openPopouts[i]);
        }
      }

      if (this.openPopouts.length !== openPopouts.length) {
        this.openPopouts = openPopouts;
        this.emit('stateChanged');
      }
    }
    /***************************
     * PRIVATE
     ***************************/

    /**
     * Returns a flattened array of all content items,
     * regardles of level or type
     *
     * @private
     *
     * @returns {void}
     */

  }, {
    key: "_getAllContentItems",
    value: function _getAllContentItems() {
      var allContentItems = [];

      var addChildren = function addChildren(contentItem) {
        allContentItems.push(contentItem);

        if (contentItem.contentItems instanceof Array) {
          for (var i = 0; i < contentItem.contentItems.length; i++) {
            addChildren(contentItem.contentItems[i]);
          }
        }
      };

      addChildren(this.root);
      return allContentItems;
    }
    /**
     * Binds to DOM/BOM events on init
     *
     * @private
     *
     * @returns {void}
     */

  }, {
    key: "_bindEvents",
    value: function _bindEvents() {
      if (this._isFullPage) {
        jquery__WEBPACK_IMPORTED_MODULE_15___default()(window).resize(this._resizeFunction);
      }

      jquery__WEBPACK_IMPORTED_MODULE_15___default()(window).on('unload beforeunload', this._unloadFunction);
    }
    /**
     * Debounces resize events
     *
     * @private
     *
     * @returns {void}
     */

  }, {
    key: "_onResize",
    value: function _onResize() {
      clearTimeout(this._resizeTimeoutId);
      this._resizeTimeoutId = setTimeout(Object(_utils_utils__WEBPACK_IMPORTED_MODULE_14__["fnBind"])(this.updateSize, this), 100);
    }
    /**
     * Extends the default config with the user specific settings and applies
     * derivations. Please note that there's a separate method (AbstractContentItem._extendItemNode)
     * that deals with the extension of item configs
     *
     * @param   {Object} config
     * @static
     * @returns {Object} config
     */

  }, {
    key: "_createConfig",
    value: function _createConfig(config) {
      var _this2 = this;

      var windowConfigKey = Object(_utils_utils__WEBPACK_IMPORTED_MODULE_14__["getQueryStringParam"])('gl-window');

      if (windowConfigKey) {
        this.isSubWindow = true;
        config = localStorage.getItem(windowConfigKey);
        config = JSON.parse(config);
        config = new _utils_ConfigMinifier__WEBPACK_IMPORTED_MODULE_1__["default"]().unminifyConfig(config);
        localStorage.removeItem(windowConfigKey);
      }

      config = jquery__WEBPACK_IMPORTED_MODULE_15___default.a.extend(true, {}, _config_defaultConfig__WEBPACK_IMPORTED_MODULE_13__["default"], config);

      var nextNode = function nextNode(node) {
        for (var key in node) {
          if (key !== 'props' && _typeof(node[key]) === 'object') {
            nextNode(node[key]);
          } else if (key === 'type' && _this2.isReactConfig(node)) {
            node.type = 'component';
            node.componentName = REACT_COMPONENT_ID;
          }
        }
      };

      nextNode(config);

      if (config.settings.hasHeaders === false) {
        config.dimensions.headerHeight = 0;
      }

      return config;
    }
    /**
     * This is executed when GoldenLayout detects that it is run
     * within a previously opened popout window.
     *
     * @private
     *
     * @returns {void}
     */

  }, {
    key: "_adjustToWindowMode",
    value: function _adjustToWindowMode() {
      var popInButton = jquery__WEBPACK_IMPORTED_MODULE_15___default()('<div class="lm_popin" title="' + this.config.labels.popin + '">' + '<div class="lm_icon"></div>' + '<div class="lm_bg"></div>' + '</div>');
      popInButton.click(Object(_utils_utils__WEBPACK_IMPORTED_MODULE_14__["fnBind"])(function () {
        this.emit('popIn');
      }, this));
      document.title = Object(_utils_utils__WEBPACK_IMPORTED_MODULE_14__["stripTags"])(this.config.content[0].title);
      jquery__WEBPACK_IMPORTED_MODULE_15___default()('head').append(jquery__WEBPACK_IMPORTED_MODULE_15___default()('body link, body style, template, .gl_keep'));
      this.container = jquery__WEBPACK_IMPORTED_MODULE_15___default()('body').html('').css('visibility', 'visible').append(popInButton);
      /*
       * This seems a bit pointless, but actually causes a reflow/re-evaluation getting around
       * slickgrid's "Cannot find stylesheet." bug in chrome
       */

      var x = document.body.offsetHeight; // jshint ignore:line

      /*
       * Expose this instance on the window object
       * to allow the opening window to interact with
       * it
       */

      window.__glInstance = this;
    }
    /**
     * Creates Subwindows (if there are any). Throws an error
     * if popouts are blocked.
     *
     * @returns {void}
     */

  }, {
    key: "_createSubWindows",
    value: function _createSubWindows() {
      var i, popout;

      for (i = 0; i < this.config.openPopouts.length; i++) {
        popout = this.config.openPopouts[i];
        this.createPopout(popout.content, popout.dimensions, popout.parentId, popout.indexInParent);
      }
    }
    /**
     * Determines what element the layout will be created in
     *
     * @private
     *
     * @returns {void}
     */

  }, {
    key: "_setContainer",
    value: function _setContainer() {
      var container = jquery__WEBPACK_IMPORTED_MODULE_15___default()(this.container || 'body');

      if (container.length === 0) {
        throw new Error('GoldenLayout container not found');
      }

      if (container.length > 1) {
        throw new Error('GoldenLayout more than one container element specified');
      }

      if (container[0] === document.body) {
        this._isFullPage = true;
        jquery__WEBPACK_IMPORTED_MODULE_15___default()('html, body').css({
          height: '100%',
          margin: 0,
          padding: 0,
          overflow: 'hidden'
        });
      }

      this.container = container;
    }
    /**
     * Kicks of the initial, recursive creation chain
     *
     * @param   {Object} config GoldenLayout Config
     *
     * @returns {void}
     */

  }, {
    key: "_create",
    value: function _create(config) {
      var errorMsg;

      if (!(config.content instanceof Array)) {
        if (config.content === undefined) {
          errorMsg = 'Missing setting \'content\' on top level of configuration';
        } else {
          errorMsg = 'Configuration parameter \'content\' must be an array';
        }

        throw new _errors_ConfigurationError__WEBPACK_IMPORTED_MODULE_12__["default"](errorMsg, config);
      }

      if (config.content.length > 1) {
        errorMsg = 'Top level content can\'t contain more then one element.';
        throw new _errors_ConfigurationError__WEBPACK_IMPORTED_MODULE_12__["default"](errorMsg, config);
      }

      this.root = new _items_Root__WEBPACK_IMPORTED_MODULE_3__["default"](this, {
        content: config.content
      }, this.container);
      this.root.callDownwards('_$init');

      if (config.maximisedItemId === '__glMaximised') {
        this.root.getItemsById(config.maximisedItemId)[0].toggleMaximise();
      }
    }
    /**
     * Called when the window is closed or the user navigates away
     * from the page
     *
     * @returns {void}
     */

  }, {
    key: "_onUnload",
    value: function _onUnload() {
      if (this.config.settings.closePopoutsOnUnload === true) {
        for (var i = 0; i < this.openPopouts.length; i++) {
          this.openPopouts[i].close();
        }
      }
    }
    /**
     * Adjusts the number of columns to be lower to fit the screen and still maintain minItemWidth.
     *
     * @returns {void}
     */

  }, {
    key: "_adjustColumnsResponsive",
    value: function _adjustColumnsResponsive() {
      // If there is no min width set, or not content items, do nothing.
      if (!this._useResponsiveLayout() || this._updatingColumnsResponsive || !this.config.dimensions || !this.config.dimensions.minItemWidth || this.root.contentItems.length === 0 || !this.root.contentItems[0].isRow) {
        this._firstLoad = false;
        return;
      }

      this._firstLoad = false; // If there is only one column, do nothing.

      var columnCount = this.root.contentItems[0].contentItems.length;

      if (columnCount <= 1) {
        return;
      } // If they all still fit, do nothing.


      var minItemWidth = this.config.dimensions.minItemWidth;
      var totalMinWidth = columnCount * minItemWidth;

      if (totalMinWidth <= this.width) {
        return;
      } // Prevent updates while it is already happening.


      this._updatingColumnsResponsive = true; // Figure out how many columns to stack, and put them all in the first stack container.

      var finalColumnCount = Math.max(Math.floor(this.width / minItemWidth), 1);
      var stackColumnCount = columnCount - finalColumnCount;
      var rootContentItem = this.root.contentItems[0];

      var firstStackContainer = this._findAllStackContainers()[0];

      for (var i = 0; i < stackColumnCount; i++) {
        // Stack from right.
        var column = rootContentItem.contentItems[rootContentItem.contentItems.length - 1];

        this._addChildContentItemsToContainer(firstStackContainer, column);
      }

      this._updatingColumnsResponsive = false;
    }
    /**
     * Determines if responsive layout should be used.
     *
     * @returns {bool} - True if responsive layout should be used; otherwise false.
     */

  }, {
    key: "_useResponsiveLayout",
    value: function _useResponsiveLayout() {
      return this.config.settings && (this.config.settings.responsiveMode == 'always' || this.config.settings.responsiveMode == 'onload' && this._firstLoad);
    }
    /**
     * Adds all children of a node to another container recursively.
     * @param {object} container - Container to add child content items to.
     * @param {object} node - Node to search for content items.
     * @returns {void}
     */

  }, {
    key: "_addChildContentItemsToContainer",
    value: function _addChildContentItemsToContainer(container, node) {
      if (node.type === 'stack') {
        node.contentItems.forEach(function (item) {
          container.addChild(item);
          node.removeChild(item, true);
        });
      } else {
        node.contentItems.forEach(Object(_utils_utils__WEBPACK_IMPORTED_MODULE_14__["fnBind"])(function (item) {
          this._addChildContentItemsToContainer(container, item);
        }, this));
      }
    }
    /**
     * Finds all the stack containers.
     * @returns {array} - The found stack containers.
     */

  }, {
    key: "_findAllStackContainers",
    value: function _findAllStackContainers() {
      var stackContainers = [];

      this._findAllStackContainersRecursive(stackContainers, this.root);

      return stackContainers;
    }
    /**
     * Finds all the stack containers.
     *
     * @param {array} - Set of containers to populate.
     * @param {object} - Current node to process.
     *
     * @returns {void}
     */

  }, {
    key: "_findAllStackContainersRecursive",
    value: function _findAllStackContainersRecursive(stackContainers, node) {
      node.contentItems.forEach(Object(_utils_utils__WEBPACK_IMPORTED_MODULE_14__["fnBind"])(function (item) {
        if (item.type == 'stack') {
          stackContainers.push(item);
        } else if (!item.isComponent) {
          this._findAllStackContainersRecursive(stackContainers, item);
        }
      }, this));
    }
  }]);

  return LayoutManager;
}(_utils_EventEmitter__WEBPACK_IMPORTED_MODULE_0__["default"]);
/**
 * Hook that allows to access private classes
 */
// LayoutManager.__lm = lm;




/***/ }),

/***/ "./src/js_es6/config/ItemDefaultConfig.js":
/*!************************************************!*\
  !*** ./src/js_es6/config/ItemDefaultConfig.js ***!
  \************************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
var itemDefaultConfig = {
  isClosable: true,
  reorderEnabled: true,
  title: ''
};
/* harmony default export */ __webpack_exports__["default"] = (itemDefaultConfig);

/***/ }),

/***/ "./src/js_es6/config/defaultConfig.js":
/*!********************************************!*\
  !*** ./src/js_es6/config/defaultConfig.js ***!
  \********************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
var defaultConfig = {
  openPopouts: [],
  settings: {
    hasHeaders: true,
    constrainDragToContainer: true,
    reorderEnabled: true,
    selectionEnabled: false,
    popoutWholeStack: false,
    blockedPopoutsThrowError: true,
    closePopoutsOnUnload: true,
    showPopoutIcon: true,
    showMaximiseIcon: true,
    showCloseIcon: true,
    responsiveMode: 'onload',
    // Can be onload, always, or none.
    tabOverlapAllowance: 0,
    // maximum pixel overlap per tab
    reorderOnTabMenuClick: true,
    tabControlOffset: 10
  },
  dimensions: {
    borderWidth: 5,
    borderGrabWidth: 15,
    minItemHeight: 10,
    minItemWidth: 10,
    headerHeight: 20,
    dragProxyWidth: 300,
    dragProxyHeight: 200
  },
  labels: {
    close: 'close',
    maximise: 'maximise',
    minimise: 'minimise',
    popout: 'open in new window',
    popin: 'pop in',
    tabDropdown: 'additional tabs'
  }
};
/* harmony default export */ __webpack_exports__["default"] = (defaultConfig);

/***/ }),

/***/ "./src/js_es6/container/ItemContainer.js":
/*!***********************************************!*\
  !*** ./src/js_es6/container/ItemContainer.js ***!
  \***********************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "default", function() { return ItemContainer; });
/* harmony import */ var _utils_EventEmitter__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../utils/EventEmitter */ "./src/js_es6/utils/EventEmitter.js");
/* harmony import */ var jquery__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! jquery */ "jquery");
/* harmony import */ var jquery__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(jquery__WEBPACK_IMPORTED_MODULE_1__);
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
    _this._element = jquery__WEBPACK_IMPORTED_MODULE_1___default()(['<div class="lm_item_container">', '<div class="lm_content"></div>', '</div>'].join(''));
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
      this.setState(jquery__WEBPACK_IMPORTED_MODULE_1___default.a.extend(true, this.getState(), state));
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
        jquery__WEBPACK_IMPORTED_MODULE_1___default.a.zepto ? this._contentElement.width(width) : this._contentElement.outerWidth(width);
        jquery__WEBPACK_IMPORTED_MODULE_1___default.a.zepto ? this._contentElement.height(height) : this._contentElement.outerHeight(height);
        this.emit('resize');
      }
    }
  }]);

  return ItemContainer;
}(_utils_EventEmitter__WEBPACK_IMPORTED_MODULE_0__["default"]);



/***/ }),

/***/ "./src/js_es6/controls/BrowserPopout.js":
/*!**********************************************!*\
  !*** ./src/js_es6/controls/BrowserPopout.js ***!
  \**********************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "default", function() { return BrowserPopout; });
/* harmony import */ var _utils_EventEmitter__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../utils/EventEmitter */ "./src/js_es6/utils/EventEmitter.js");
/* harmony import */ var _utils_ConfigMinifier__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../utils/ConfigMinifier */ "./src/js_es6/utils/ConfigMinifier.js");
/* harmony import */ var _utils_utils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../utils/utils */ "./src/js_es6/utils/utils.js");
/* harmony import */ var jquery__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! jquery */ "jquery");
/* harmony import */ var jquery__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(jquery__WEBPACK_IMPORTED_MODULE_3__);
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





/**
 * Pops a content item out into a new browser window.
 * This is achieved by
 *
 *    - Creating a new configuration with the content item as root element
 *    - Serializing and minifying the configuration
 *    - Opening the current window's URL with the configuration as a GET parameter
 *    - GoldenLayout when opened in the new window will look for the GET parameter
 *      and use it instead of the provided configuration
 *
 * @param {Object} config GoldenLayout item config
 * @param {Object} dimensions A map with width, height, top and left
 * @param {String} parentId The id of the element the item will be appended to on popIn
 * @param {Number} indexInParent The position of this element within its parent
 * @param {lm.LayoutManager} layoutManager
 */

var BrowserPopout = /*#__PURE__*/function (_EventEmitter) {
  _inherits(BrowserPopout, _EventEmitter);

  var _super = _createSuper(BrowserPopout);

  function BrowserPopout(config, dimensions, parentId, indexInParent, layoutManager) {
    var _this;

    _classCallCheck(this, BrowserPopout);

    _this = _super.call(this);
    _this.isInitialised = false;
    _this._config = config;
    _this._dimensions = dimensions;
    _this._parentId = parentId;
    _this._indexInParent = indexInParent;
    _this._layoutManager = layoutManager;
    _this._popoutWindow = null;
    _this._id = null;

    _this._createWindow();

    return _this;
  }

  _createClass(BrowserPopout, [{
    key: "toConfig",
    value: function toConfig() {
      if (this.isInitialised === false) {
        throw new Error('Can\'t create config, layout not yet initialised');
      }

      return {
        dimensions: {
          width: this.getGlInstance().width,
          height: this.getGlInstance().height,
          left: this._popoutWindow.screenX || this._popoutWindow.screenLeft,
          top: this._popoutWindow.screenY || this._popoutWindow.screenTop
        },
        content: this.getGlInstance().toConfig().content,
        parentId: this._parentId,
        indexInParent: this._indexInParent
      };
    }
  }, {
    key: "getGlInstance",
    value: function getGlInstance() {
      return this._popoutWindow.__glInstance;
    }
  }, {
    key: "getWindow",
    value: function getWindow() {
      return this._popoutWindow;
    }
  }, {
    key: "close",
    value: function close() {
      if (this.getGlInstance()) {
        this.getGlInstance()._$closeWindow();
      } else {
        try {
          this.getWindow().close();
        } catch (e) {//
        }
      }
    }
    /**
     * Returns the popped out item to its original position. If the original
     * parent isn't available anymore it falls back to the layout's topmost element
     */

  }, {
    key: "popIn",
    value: function popIn() {
      var childConfig,
          parentItem,
          index = this._indexInParent;

      if (this._parentId) {
        /*
         * The $.extend call seems a bit pointless, but it's crucial to
         * copy the config returned by this.getGlInstance().toConfig()
         * onto a new object. Internet Explorer keeps the references
         * to objects on the child window, resulting in the following error
         * once the child window is closed:
         *
         * The callee (server [not server application]) is not available and disappeared
         */
        childConfig = jquery__WEBPACK_IMPORTED_MODULE_3___default.a.extend(true, {}, this.getGlInstance().toConfig()).content[0];
        parentItem = this._layoutManager.root.getItemsById(this._parentId)[0];
        /*
         * Fallback if parentItem is not available. Either add it to the topmost
         * item or make it the topmost item if the layout is empty
         */

        if (!parentItem) {
          if (this._layoutManager.root.contentItems.length > 0) {
            parentItem = this._layoutManager.root.contentItems[0];
          } else {
            parentItem = this._layoutManager.root;
          }

          index = 0;
        }
      }

      parentItem.addChild(childConfig, this._indexInParent);
      this.close();
    }
    /**
     * Creates the URL and window parameter
     * and opens a new window
     *
     * @private
     *
     * @returns {void}
     */

  }, {
    key: "_createWindow",
    value: function _createWindow() {
      var checkReadyInterval,
          url = this._createUrl(),

      /**
       * Bogus title to prevent re-usage of existing window with the
       * same title. The actual title will be set by the new window's
       * GoldenLayout instance if it detects that it is in subWindowMode
       */
      title = Math.floor(Math.random() * 1000000).toString(36),

      /**
       * The options as used in the window.open string
       */
      options = this._serializeWindowOptions({
        width: this._dimensions.width,
        height: this._dimensions.height,
        innerWidth: this._dimensions.width,
        innerHeight: this._dimensions.height,
        menubar: 'no',
        toolbar: 'no',
        location: 'no',
        personalbar: 'no',
        resizable: 'yes',
        scrollbars: 'no',
        status: 'no'
      });

      this._popoutWindow = window.open(url, title, options);

      if (!this._popoutWindow) {
        if (this._layoutManager.config.settings.blockedPopoutsThrowError === true) {
          var error = new Error('Popout blocked');
          error.type = 'popoutBlocked';
          throw error;
        } else {
          return;
        }
      }

      jquery__WEBPACK_IMPORTED_MODULE_3___default()(this._popoutWindow).on('load', Object(_utils_utils__WEBPACK_IMPORTED_MODULE_2__["fnBind"])(this._positionWindow, this)).on('unload beforeunload', Object(_utils_utils__WEBPACK_IMPORTED_MODULE_2__["fnBind"])(this._onClose, this));
      /**
       * Polling the childwindow to find out if GoldenLayout has been initialised
       * doesn't seem optimal, but the alternatives - adding a callback to the parent
       * window or raising an event on the window object - both would introduce knowledge
       * about the parent to the child window which we'd rather avoid
       */

      checkReadyInterval = setInterval(Object(_utils_utils__WEBPACK_IMPORTED_MODULE_2__["fnBind"])(function () {
        if (this._popoutWindow.__glInstance && this._popoutWindow.__glInstance.isInitialised) {
          this._onInitialised();

          clearInterval(checkReadyInterval);
        }
      }, this), 10);
    }
    /**
     * Serialises a map of key:values to a window options string
     *
     * @param   {Object} windowOptions
     *
     * @returns {String} serialised window options
     */

  }, {
    key: "_serializeWindowOptions",
    value: function _serializeWindowOptions(windowOptions) {
      var windowOptionsString = [],
          key;

      for (key in windowOptions) {
        windowOptionsString.push(key + '=' + windowOptions[key]);
      }

      return windowOptionsString.join(',');
    }
    /**
     * Creates the URL for the new window, including the
     * config GET parameter
     *
     * @returns {String} URL
     */

  }, {
    key: "_createUrl",
    value: function _createUrl() {
      var config = {
        content: this._config
      },
          storageKey = 'gl-window-config-' + Object(_utils_utils__WEBPACK_IMPORTED_MODULE_2__["getUniqueId"])(),
          urlParts;
      config = new _utils_ConfigMinifier__WEBPACK_IMPORTED_MODULE_1__["default"]().minifyConfig(config);

      try {
        localStorage.setItem(storageKey, JSON.stringify(config));
      } catch (e) {
        throw new Error('Error while writing to localStorage ' + e.toString());
      }

      urlParts = document.location.href.split('?'); // URL doesn't contain GET-parameters

      if (urlParts.length === 1) {
        return urlParts[0] + '?gl-window=' + storageKey; // URL contains GET-parameters
      } else {
        return document.location.href + '&gl-window=' + storageKey;
      }
    }
    /**
     * Move the newly created window roughly to
     * where the component used to be.
     *
     * @private
     *
     * @returns {void}
     */

  }, {
    key: "_positionWindow",
    value: function _positionWindow() {
      this._popoutWindow.moveTo(this._dimensions.left, this._dimensions.top);

      this._popoutWindow.focus();
    }
    /**
     * Callback when the new window is opened and the GoldenLayout instance
     * within it is initialised
     *
     * @returns {void}
     */

  }, {
    key: "_onInitialised",
    value: function _onInitialised() {
      this.isInitialised = true;
      this.getGlInstance().on('popIn', this.popIn, this);
      this.emit('initialised');
    }
    /**
     * Invoked 50ms after the window unload event
     *
     * @private
     *
     * @returns {void}
     */

  }, {
    key: "_onClose",
    value: function _onClose() {
      setTimeout(Object(_utils_utils__WEBPACK_IMPORTED_MODULE_2__["fnBind"])(this.emit, this, ['closed']), 50);
    }
  }]);

  return BrowserPopout;
}(_utils_EventEmitter__WEBPACK_IMPORTED_MODULE_0__["default"]);



/***/ }),

/***/ "./src/js_es6/controls/DragProxy.js":
/*!******************************************!*\
  !*** ./src/js_es6/controls/DragProxy.js ***!
  \******************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "default", function() { return DragProxy; });
/* harmony import */ var _utils_EventEmitter__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../utils/EventEmitter */ "./src/js_es6/utils/EventEmitter.js");
/* harmony import */ var _utils_utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../utils/utils */ "./src/js_es6/utils/utils.js");
/* harmony import */ var jquery__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! jquery */ "jquery");
/* harmony import */ var jquery__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(jquery__WEBPACK_IMPORTED_MODULE_2__);
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

    _this.element = jquery__WEBPACK_IMPORTED_MODULE_2___default()(_template);

    if (originalParent && originalParent._side) {
      _this._sided = originalParent._sided;

      _this.element.addClass('lm_' + originalParent._side);

      if (['right', 'bottom'].indexOf(originalParent._side) >= 0) _this.element.find('.lm_content').after(_this.element.find('.lm_header'));
    }

    _this.element.css({
      left: x,
      top: y
    });

    _this.element.find('.lm_tab').attr('title', Object(_utils_utils__WEBPACK_IMPORTED_MODULE_1__["stripTags"])(_this._contentItem.config.title));

    _this.element.find('.lm_title').html(_this._contentItem.config.title);

    _this.childElementContainer = _this.element.find('.lm_content');

    _this.childElementContainer.append(contentItem.element);

    _this._undisplayTree();

    _this._layoutManager._$calculateItemAreas();

    _this._setDimensions();

    jquery__WEBPACK_IMPORTED_MODULE_2___default()(document.body).append(_this.element);

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
      event = Object(_utils_utils__WEBPACK_IMPORTED_MODULE_1__["getTouchEvent"])(event);
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
}(_utils_EventEmitter__WEBPACK_IMPORTED_MODULE_0__["default"]);



/***/ }),

/***/ "./src/js_es6/controls/DragSource.js":
/*!*******************************************!*\
  !*** ./src/js_es6/controls/DragSource.js ***!
  \*******************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "default", function() { return DragSource; });
/* harmony import */ var _utils_DragListener__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../utils/DragListener */ "./src/js_es6/utils/DragListener.js");
/* harmony import */ var _controls_DragProxy__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../controls/DragProxy */ "./src/js_es6/controls/DragProxy.js");
/* harmony import */ var _utils_utils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../utils/utils */ "./src/js_es6/utils/utils.js");
/* harmony import */ var jquery__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! jquery */ "jquery");
/* harmony import */ var jquery__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(jquery__WEBPACK_IMPORTED_MODULE_3__);
function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }





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

      this._dragListener = new _utils_DragListener__WEBPACK_IMPORTED_MODULE_0__["default"](this._element);

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

      if (Object(_utils_utils__WEBPACK_IMPORTED_MODULE_2__["isFunction"])(itemConfig)) {
        itemConfig = itemConfig();
      }

      var contentItem = this._layoutManager._$normalizeContentItem(jquery__WEBPACK_IMPORTED_MODULE_3___default.a.extend(true, {}, itemConfig)),
          dragProxy = new _controls_DragProxy__WEBPACK_IMPORTED_MODULE_1__["default"](x, y, this._dragListener, this._layoutManager, contentItem, null);

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



/***/ }),

/***/ "./src/js_es6/controls/DropTargetIndicator.js":
/*!****************************************************!*\
  !*** ./src/js_es6/controls/DropTargetIndicator.js ***!
  \****************************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "default", function() { return DropTargetIndicator; });
/* harmony import */ var jquery__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! jquery */ "jquery");
/* harmony import */ var jquery__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(jquery__WEBPACK_IMPORTED_MODULE_0__);
function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }


var _template = '<div class="lm_dropTargetIndicator"><div class="lm_inner"></div></div>';

var DropTargetIndicator = /*#__PURE__*/function () {
  function DropTargetIndicator() {
    _classCallCheck(this, DropTargetIndicator);

    this.element = jquery__WEBPACK_IMPORTED_MODULE_0___default()(_template);
    jquery__WEBPACK_IMPORTED_MODULE_0___default()(document.body).append(this.element);
  }

  _createClass(DropTargetIndicator, [{
    key: "destroy",
    value: function destroy() {
      this.element.remove();
    }
  }, {
    key: "highlight",
    value: function highlight(x1, y1, x2, y2) {
      this.highlightArea({
        x1: x1,
        y1: y1,
        x2: x2,
        y2: y2
      });
    }
  }, {
    key: "highlightArea",
    value: function highlightArea(area) {
      this.element.css({
        left: area.x1,
        top: area.y1,
        width: area.x2 - area.x1,
        height: area.y2 - area.y1
      }).show();
    }
  }, {
    key: "hide",
    value: function hide() {
      this.element.hide();
    }
  }]);

  return DropTargetIndicator;
}();



/***/ }),

/***/ "./src/js_es6/controls/Header.js":
/*!***************************************!*\
  !*** ./src/js_es6/controls/Header.js ***!
  \***************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "default", function() { return Header; });
/* harmony import */ var _utils_EventEmitter__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../utils/EventEmitter */ "./src/js_es6/utils/EventEmitter.js");
/* harmony import */ var _controls_Tab__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../controls/Tab */ "./src/js_es6/controls/Tab.js");
/* harmony import */ var _controls_HeaderButton__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../controls/HeaderButton */ "./src/js_es6/controls/HeaderButton.js");
/* harmony import */ var _utils_utils__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../utils/utils */ "./src/js_es6/utils/utils.js");
/* harmony import */ var jquery__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! jquery */ "jquery");
/* harmony import */ var jquery__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(jquery__WEBPACK_IMPORTED_MODULE_4__);
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







var _template = ['<div class="lm_header">', '<ul class="lm_tabs"></ul>', '<ul class="lm_controls"></ul>', '<ul class="lm_tabdropdown_list"></ul>', '</div>'].join('');
/**
 * This class represents a header above a Stack ContentItem.
 *
 * @param {lm.LayoutManager} layoutManager
 * @param {AbstractContentItem} parent
 */


var Header = /*#__PURE__*/function (_EventEmitter) {
  _inherits(Header, _EventEmitter);

  var _super = _createSuper(Header);

  function Header(layoutManager, parent) {
    var _this;

    _classCallCheck(this, Header);

    _this = _super.call(this);
    _this.layoutManager = layoutManager;
    _this.element = jquery__WEBPACK_IMPORTED_MODULE_4___default()(_template);

    if (_this.layoutManager.config.settings.selectionEnabled === true) {
      _this.element.addClass('lm_selectable');

      _this.element.on('click touchstart', Object(_utils_utils__WEBPACK_IMPORTED_MODULE_3__["fnBind"])(_this._onHeaderClick, _assertThisInitialized(_this)));
    }

    _this.tabsContainer = _this.element.find('.lm_tabs');
    _this.tabDropdownContainer = _this.element.find('.lm_tabdropdown_list');

    _this.tabDropdownContainer.hide();

    _this.controlsContainer = _this.element.find('.lm_controls');
    _this.parent = parent;

    _this.parent.on('resize', _this._updateTabSizes, _assertThisInitialized(_this));

    _this.tabs = [];
    _this.tabsMarkedForRemoval = [];
    _this.activeContentItem = null;
    _this.closeButton = null;
    _this.dockButton = null;
    _this.tabDropdownButton = null;
    _this.hideAdditionalTabsDropdown = Object(_utils_utils__WEBPACK_IMPORTED_MODULE_3__["fnBind"])(_this._hideAdditionalTabsDropdown, _assertThisInitialized(_this));
    jquery__WEBPACK_IMPORTED_MODULE_4___default()(document).mouseup(_this.hideAdditionalTabsDropdown);
    _this._lastVisibleTabIndex = -1;
    _this._tabControlOffset = _this.layoutManager.config.settings.tabControlOffset;

    _this._createControls();

    return _this;
  }
  /**
   * Creates a new tab and associates it with a contentItem
   *
   * @param    {AbstractContentItem} contentItem
   * @param    {Integer} index The position of the tab
   *
   * @returns {void}
   */


  _createClass(Header, [{
    key: "createTab",
    value: function createTab(contentItem, index) {
      var tab, i; //If there's already a tab relating to the
      //content item, don't do anything

      for (i = 0; i < this.tabs.length; i++) {
        if (this.tabs[i].contentItem === contentItem) {
          return;
        }
      }

      tab = new _controls_Tab__WEBPACK_IMPORTED_MODULE_1__["default"](this, contentItem);

      if (this.tabs.length === 0) {
        this.tabs.push(tab);
        this.tabsContainer.append(tab.element);
        return;
      }

      if (index === undefined) {
        index = this.tabs.length;
      }

      if (index > 0) {
        this.tabs[index - 1].element.after(tab.element);
      } else {
        this.tabs[0].element.before(tab.element);
      }

      this.tabs.splice(index, 0, tab);

      this._updateTabSizes();
    }
    /**
     * Finds a tab based on the contentItem its associated with and removes it.
     *
     * @param    {AbstractContentItem} contentItem
     *
     * @returns {void}
     */

  }, {
    key: "removeTab",
    value: function removeTab(contentItem) {
      for (var i = 0; i < this.tabs.length; i++) {
        if (this.tabs[i].contentItem === contentItem) {
          this.tabs[i]._$destroy();

          this.tabs.splice(i, 1);
          return;
        }
      }

      for (i = 0; i < this.tabsMarkedForRemoval.length; i++) {
        if (this.tabsMarkedForRemoval[i].contentItem === contentItem) {
          this.tabsMarkedForRemoval[i]._$destroy();

          this.tabsMarkedForRemoval.splice(i, 1);
          return;
        }
      }

      throw new Error('contentItem is not controlled by this header');
    }
    /**
     * Finds a tab based on the contentItem its associated with and marks it
     * for removal, hiding it too.
     *
     * @param    {AbstractContentItem} contentItem
     *
     * @returns {void}
     */

  }, {
    key: "hideTab",
    value: function hideTab(contentItem) {
      for (var i = 0; i < this.tabs.length; i++) {
        if (this.tabs[i].contentItem === contentItem) {
          this.tabs[i].element.hide();
          this.tabsMarkedForRemoval.push(this.tabs[i]);
          this.tabs.splice(i, 1);
          return;
        }
      }

      throw new Error('contentItem is not controlled by this header');
    }
    /**
     * The programmatical equivalent of clicking a Tab.
     *
     * @param {AbstractContentItem} contentItem
     */

  }, {
    key: "setActiveContentItem",
    value: function setActiveContentItem(contentItem) {
      var i, j, isActive, activeTab;
      if (this.activeContentItem === contentItem) return;

      for (i = 0; i < this.tabs.length; i++) {
        isActive = this.tabs[i].contentItem === contentItem;
        this.tabs[i].setActive(isActive);

        if (isActive === true) {
          this.activeContentItem = contentItem;
          this.parent.config.activeItemIndex = i;
        }
      }

      if (this.layoutManager.config.settings.reorderOnTabMenuClick) {
        /**
         * If the tab selected was in the dropdown, move everything down one to make way for this one to be the first.
         * This will make sure the most used tabs stay visible.
         */
        if (this._lastVisibleTabIndex !== -1 && this.parent.config.activeItemIndex > this._lastVisibleTabIndex) {
          activeTab = this.tabs[this.parent.config.activeItemIndex];

          for (j = this.parent.config.activeItemIndex; j > 0; j--) {
            this.tabs[j] = this.tabs[j - 1];
          }

          this.tabs[0] = activeTab;
          this.parent.config.activeItemIndex = 0;
        }
      }

      this._updateTabSizes();

      this.parent.emitBubblingEvent('stateChanged');
    }
    /**
     * Programmatically operate with header position.
     *
     * @param {string} position one of ('top','left','right','bottom') to set or empty to get it.
     *
     * @returns {string} previous header position
     */

  }, {
    key: "position",
    value: function position(_position) {
      var previous = this.parent._header.show;
      if (this.parent._docker && this.parent._docker.docked) throw new Error('Can\'t change header position in docked stack');
      if (previous && !this.parent._side) previous = 'top';

      if (_position !== undefined && this.parent._header.show != _position) {
        this.parent._header.show = _position;
        this.parent.config.header ? this.parent.config.header.show = _position : this.parent.config.header = {
          show: _position
        };

        this.parent._setupHeaderPosition();
      }

      return previous;
    }
    /**
     * Programmatically set closability.
     *
     * @package private
     * @param {Boolean} isClosable Whether to enable/disable closability.
     *
     * @returns {Boolean} Whether the action was successful
     */

  }, {
    key: "_$setClosable",
    value: function _$setClosable(isClosable) {
      this._canDestroy = isClosable || this.tabs.length > 1;

      if (this.closeButton && this._isClosable()) {
        this.closeButton.element[isClosable ? "show" : "hide"]();
        return true;
      }

      return false;
    }
    /**
     * Programmatically set ability to dock.
     *
     * @package private
     * @param {Boolean} isDockable Whether to enable/disable ability to dock.
     *
     * @returns {Boolean} Whether the action was successful
     */

  }, {
    key: "_setDockable",
    value: function _setDockable(isDockable) {
      if (this.dockButton && this.parent._header && this.parent._header.dock) {
        this.dockButton.element.toggle(!!isDockable);
        return true;
      }

      return false;
    }
    /**
     * Destroys the entire header
     *
     * @package private
     *
     * @returns {void}
     */

  }, {
    key: "_$destroy",
    value: function _$destroy() {
      this.emit('destroy', this);

      for (var i = 0; i < this.tabs.length; i++) {
        this.tabs[i]._$destroy();
      }

      jquery__WEBPACK_IMPORTED_MODULE_4___default()(document).off('mouseup', this.hideAdditionalTabsDropdown);
      this.element.remove();
    }
    /**
     * get settings from header
     *
     * @returns {string} when exists
     */

  }, {
    key: "_getHeaderSetting",
    value: function _getHeaderSetting(name) {
      if (name in this.parent._header) return this.parent._header[name];
    }
    /**
     * Creates the popout, maximise and close buttons in the header's top right corner
     *
     * @returns {void}
     */

  }, {
    key: "_createControls",
    value: function _createControls() {
      var closeStack, popout, label, maximiseLabel, minimiseLabel, maximise, maximiseButton, tabDropdownLabel, showTabDropdown;
      /**
       * Dropdown to show additional tabs.
       */

      showTabDropdown = Object(_utils_utils__WEBPACK_IMPORTED_MODULE_3__["fnBind"])(this._showAdditionalTabsDropdown, this);
      tabDropdownLabel = this.layoutManager.config.labels.tabDropdown;
      this.tabDropdownButton = new _controls_HeaderButton__WEBPACK_IMPORTED_MODULE_2__["default"](this, tabDropdownLabel, 'lm_tabdropdown', showTabDropdown);
      this.tabDropdownButton.element.hide();

      if (this.parent._header && this.parent._header.dock) {
        var button = Object(_utils_utils__WEBPACK_IMPORTED_MODULE_3__["fnBind"])(this.parent.dock, this.parent);
        label = this._getHeaderSetting('dock');
        this.dockButton = new _controls_HeaderButton__WEBPACK_IMPORTED_MODULE_2__["default"](this, label, 'lm_dock', button);
      }
      /**
       * Popout control to launch component in new window.
       */


      if (this._getHeaderSetting('popout')) {
        popout = Object(_utils_utils__WEBPACK_IMPORTED_MODULE_3__["fnBind"])(this._onPopoutClick, this);
        label = this._getHeaderSetting('popout');
        new _controls_HeaderButton__WEBPACK_IMPORTED_MODULE_2__["default"](this, label, 'lm_popout', popout);
      }
      /**
       * Maximise control - set the component to the full size of the layout
       */


      if (this._getHeaderSetting('maximise')) {
        maximise = Object(_utils_utils__WEBPACK_IMPORTED_MODULE_3__["fnBind"])(this.parent.toggleMaximise, this.parent);
        maximiseLabel = this._getHeaderSetting('maximise');
        minimiseLabel = this._getHeaderSetting('minimise');
        maximiseButton = new _controls_HeaderButton__WEBPACK_IMPORTED_MODULE_2__["default"](this, maximiseLabel, 'lm_maximise', maximise);
        this.parent.on('maximised', function () {
          maximiseButton.element.attr('title', minimiseLabel);
        });
        this.parent.on('minimised', function () {
          maximiseButton.element.attr('title', maximiseLabel);
        });
      }
      /**
       * Close button
       */


      if (this._isClosable()) {
        closeStack = Object(_utils_utils__WEBPACK_IMPORTED_MODULE_3__["fnBind"])(this.parent.remove, this.parent);
        label = this._getHeaderSetting('close');
        this.closeButton = new _controls_HeaderButton__WEBPACK_IMPORTED_MODULE_2__["default"](this, label, 'lm_close', closeStack);
      }
    }
    /**
     * Shows drop down for additional tabs when there are too many to display.
     *
     * @returns {void}
     */

  }, {
    key: "_showAdditionalTabsDropdown",
    value: function _showAdditionalTabsDropdown() {
      this.tabDropdownContainer.show();
    }
    /**
     * Hides drop down for additional tabs when there are too many to display.
     *
     * @returns {void}
     */

  }, {
    key: "_hideAdditionalTabsDropdown",
    value: function _hideAdditionalTabsDropdown(e) {
      this.tabDropdownContainer.hide();
    }
    /**
     * Checks whether the header is closable based on the parent config and
     * the global config.
     *
     * @returns {Boolean} Whether the header is closable.
     */

  }, {
    key: "_isClosable",
    value: function _isClosable() {
      return this.parent.config.isClosable && this.layoutManager.config.settings.showCloseIcon;
    }
  }, {
    key: "_onPopoutClick",
    value: function _onPopoutClick() {
      if (this.layoutManager.config.settings.popoutWholeStack === true) {
        this.parent.popout();
      } else {
        this.activeContentItem.popout();
      }
    }
    /**
     * Invoked when the header's background is clicked (not it's tabs or controls)
     *
     * @param    {jQuery DOM event} event
     *
     * @returns {void}
     */

  }, {
    key: "_onHeaderClick",
    value: function _onHeaderClick(event) {
      if (event.target === this.element[0]) {
        this.parent.select();
      }
    }
    /**
     * Pushes the tabs to the tab dropdown if the available space is not sufficient
     *
     * @returns {void}
     */

  }, {
    key: "_updateTabSizes",
    value: function _updateTabSizes(showTabMenu) {
      if (this.tabs.length === 0) {
        return;
      } //Show the menu based on function argument


      this.tabDropdownButton.element.toggle(showTabMenu === true);

      var size = function size(val) {
        return val ? 'width' : 'height';
      };

      this.element.css(size(!this.parent._sided), '');
      this.element[size(this.parent._sided)](this.layoutManager.config.dimensions.headerHeight);

      var availableWidth = this.element.outerWidth() - this.controlsContainer.outerWidth() - this._tabControlOffset,
          cumulativeTabWidth = 0,
          visibleTabWidth = 0,
          tabElement,
          i,
          j,
          marginLeft,
          overlap = 0,
          tabWidth,
          tabOverlapAllowance = this.layoutManager.config.settings.tabOverlapAllowance,
          tabOverlapAllowanceExceeded = false,
          activeIndex = this.activeContentItem ? this.tabs.indexOf(this.activeContentItem.tab) : 0,
          activeTab = this.tabs[activeIndex];

      if (this.parent._sided) availableWidth = this.element.outerHeight() - this.controlsContainer.outerHeight() - this._tabControlOffset;
      this._lastVisibleTabIndex = -1;

      for (i = 0; i < this.tabs.length; i++) {
        tabElement = this.tabs[i].element; //Put the tab in the tabContainer so its true width can be checked

        this.tabsContainer.append(tabElement);
        tabWidth = tabElement.outerWidth() + parseInt(tabElement.css('margin-right'), 10);
        cumulativeTabWidth += tabWidth; //Include the active tab's width if it isn't already
        //This is to ensure there is room to show the active tab

        if (activeIndex <= i) {
          visibleTabWidth = cumulativeTabWidth;
        } else {
          visibleTabWidth = cumulativeTabWidth + activeTab.element.outerWidth() + parseInt(activeTab.element.css('margin-right'), 10);
        } // If the tabs won't fit, check the overlap allowance.


        if (visibleTabWidth > availableWidth) {
          //Once allowance is exceeded, all remaining tabs go to menu.
          if (!tabOverlapAllowanceExceeded) {
            //No overlap for first tab or active tab
            //Overlap spreads among non-active, non-first tabs
            if (activeIndex > 0 && activeIndex <= i) {
              overlap = (visibleTabWidth - availableWidth) / (i - 1);
            } else {
              overlap = (visibleTabWidth - availableWidth) / i;
            } //Check overlap against allowance.


            if (overlap < tabOverlapAllowance) {
              for (j = 0; j <= i; j++) {
                marginLeft = j !== activeIndex && j !== 0 ? '-' + overlap + 'px' : '';
                this.tabs[j].element.css({
                  'z-index': i - j,
                  'margin-left': marginLeft
                });
              }

              this._lastVisibleTabIndex = i;
              this.tabsContainer.append(tabElement);
            } else {
              tabOverlapAllowanceExceeded = true;
            }
          } else if (i === activeIndex) {
            //Active tab should show even if allowance exceeded. (We left room.)
            tabElement.css({
              'z-index': 'auto',
              'margin-left': ''
            });
            this.tabsContainer.append(tabElement);
          }

          if (tabOverlapAllowanceExceeded && i !== activeIndex) {
            if (showTabMenu) {
              //Tab menu already shown, so we just add to it.
              tabElement.css({
                'z-index': 'auto',
                'margin-left': ''
              });
              this.tabDropdownContainer.append(tabElement);
            } else {
              //We now know the tab menu must be shown, so we have to recalculate everything.
              this._updateTabSizes(true);

              return;
            }
          }
        } else {
          this._lastVisibleTabIndex = i;
          tabElement.css({
            'z-index': 'auto',
            'margin-left': ''
          });
          this.tabsContainer.append(tabElement);
        }
      }
    }
  }]);

  return Header;
}(_utils_EventEmitter__WEBPACK_IMPORTED_MODULE_0__["default"]);



/***/ }),

/***/ "./src/js_es6/controls/HeaderButton.js":
/*!*********************************************!*\
  !*** ./src/js_es6/controls/HeaderButton.js ***!
  \*********************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "default", function() { return HeaderButton; });
/* harmony import */ var jquery__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! jquery */ "jquery");
/* harmony import */ var jquery__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(jquery__WEBPACK_IMPORTED_MODULE_0__);
function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }



var HeaderButton = /*#__PURE__*/function () {
  function HeaderButton(header, label, cssClass, action) {
    _classCallCheck(this, HeaderButton);

    this._header = header;
    this.element = jquery__WEBPACK_IMPORTED_MODULE_0___default()('<li class="' + cssClass + '" title="' + label + '"></li>');

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



/***/ }),

/***/ "./src/js_es6/controls/Splitter.js":
/*!*****************************************!*\
  !*** ./src/js_es6/controls/Splitter.js ***!
  \*****************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "default", function() { return Splitter; });
/* harmony import */ var _utils_DragListener__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../utils/DragListener */ "./src/js_es6/utils/DragListener.js");
/* harmony import */ var jquery__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! jquery */ "jquery");
/* harmony import */ var jquery__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(jquery__WEBPACK_IMPORTED_MODULE_1__);
function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }




var Splitter = /*#__PURE__*/function () {
  function Splitter(isVertical, size, grabSize) {
    _classCallCheck(this, Splitter);

    this._isVertical = isVertical;
    this._size = size;
    this._grabSize = grabSize < size ? size : grabSize;
    this.element = this._createElement();
    this._dragListener = new _utils_DragListener__WEBPACK_IMPORTED_MODULE_0__["default"](this.element);
  }

  _createClass(Splitter, [{
    key: "on",
    value: function on(event, callback, context) {
      this._dragListener.on(event, callback, context);
    }
  }, {
    key: "_$destroy",
    value: function _$destroy() {
      this.element.remove();
    }
  }, {
    key: "_createElement",
    value: function _createElement() {
      var dragHandle = jquery__WEBPACK_IMPORTED_MODULE_1___default()('<div class="lm_drag_handle"></div>');
      var element = jquery__WEBPACK_IMPORTED_MODULE_1___default()('<div class="lm_splitter"></div>');
      element.append(dragHandle);
      var handleExcessSize = this._grabSize - this._size;
      var handleExcessPos = handleExcessSize / 2;

      if (this._isVertical) {
        dragHandle.css('top', -handleExcessPos);
        dragHandle.css('height', this._size + handleExcessSize);
        element.addClass('lm_vertical');
        element['height'](this._size);
      } else {
        dragHandle.css('left', -handleExcessPos);
        dragHandle.css('width', this._size + handleExcessSize);
        element.addClass('lm_horizontal');
        element['width'](this._size);
      }

      return element;
    }
  }]);

  return Splitter;
}();



/***/ }),

/***/ "./src/js_es6/controls/Tab.js":
/*!************************************!*\
  !*** ./src/js_es6/controls/Tab.js ***!
  \************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "default", function() { return Tab; });
/* harmony import */ var _utils_DragListener__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../utils/DragListener */ "./src/js_es6/utils/DragListener.js");
/* harmony import */ var _controls_DragProxy__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../controls/DragProxy */ "./src/js_es6/controls/DragProxy.js");
/* harmony import */ var _utils_utils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../utils/utils */ "./src/js_es6/utils/utils.js");
/* harmony import */ var jquery__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! jquery */ "jquery");
/* harmony import */ var jquery__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(jquery__WEBPACK_IMPORTED_MODULE_3__);
function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }





/**
 * Represents an individual tab within a Stack's header
 *
 * @param {Header} header
 * @param {AbstractContentItem} contentItem
 *
 * @constructor
 */

var _template = '<li class="lm_tab"><i class="lm_left"></i>' + '<span class="lm_title"></span><div class="lm_close_tab"></div>' + '<i class="lm_right"></i></li>';

var Tab = /*#__PURE__*/function () {
  function Tab(header, contentItem) {
    _classCallCheck(this, Tab);

    this.header = header;
    this.contentItem = contentItem;
    this.element = jquery__WEBPACK_IMPORTED_MODULE_3___default()(_template);
    this.titleElement = this.element.find('.lm_title');
    this.closeElement = this.element.find('.lm_close_tab');
    this.closeElement[contentItem.config.isClosable ? 'show' : 'hide']();
    this.isActive = false;
    this.setTitle(contentItem.config.title);
    this.contentItem.on('titleChanged', this.setTitle, this);
    this._layoutManager = this.contentItem.layoutManager;

    if (this._layoutManager.config.settings.reorderEnabled === true && contentItem.config.reorderEnabled === true) {
      this._dragListener = new _utils_DragListener__WEBPACK_IMPORTED_MODULE_0__["default"](this.element);

      this._dragListener.on('dragStart', this._onDragStart, this);

      this.contentItem.on('destroy', this._dragListener.destroy, this._dragListener);
    }

    this._onTabClickFn = Object(_utils_utils__WEBPACK_IMPORTED_MODULE_2__["fnBind"])(this._onTabClick, this);
    this._onCloseClickFn = Object(_utils_utils__WEBPACK_IMPORTED_MODULE_2__["fnBind"])(this._onCloseClick, this);
    this.element.on('mousedown touchstart', this._onTabClickFn);

    if (this.contentItem.config.isClosable) {
      this.closeElement.on('click touchstart', this._onCloseClickFn);
      this.closeElement.on('mousedown', this._onCloseMousedown);
    } else {
      this.closeElement.remove();
    }

    this.contentItem.tab = this;
    this.contentItem.emit('tab', this);
    this.contentItem.layoutManager.emit('tabCreated', this);

    if (this.contentItem.isComponent) {
      this.contentItem.container.tab = this;
      this.contentItem.container.emit('tab', this);
    }
  }
  /**
   * Sets the tab's title to the provided string and sets
   * its title attribute to a pure text representation (without
   * html tags) of the same string.
   *
   * @public
   * @param {String} title can contain html
   */


  _createClass(Tab, [{
    key: "setTitle",
    value: function setTitle(title) {
      this.element.attr('title', Object(_utils_utils__WEBPACK_IMPORTED_MODULE_2__["stripTags"])(title));
      this.titleElement.html(title);
    }
    /**
     * Sets this tab's active state. To programmatically
     * switch tabs, use header.setActiveContentItem( item ) instead.
     *
     * @public
     * @param {Boolean} isActive
     */

  }, {
    key: "setActive",
    value: function setActive(isActive) {
      if (isActive === this.isActive) {
        return;
      }

      this.isActive = isActive;

      if (isActive) {
        this.element.addClass('lm_active');
      } else {
        this.element.removeClass('lm_active');
      }
    }
    /**
     * Destroys the tab
     *
     * @private
     * @returns {void}
     */

  }, {
    key: "_$destroy",
    value: function _$destroy() {
      this.element.off('mousedown touchstart', this._onTabClickFn);
      this.closeElement.off('click touchstart', this._onCloseClickFn);

      if (this._dragListener) {
        this.contentItem.off('destroy', this._dragListener.destroy, this._dragListener);

        this._dragListener.off('dragStart', this._onDragStart);

        this._dragListener = null;
      }

      this.element.remove();
    }
    /**
     * Callback for the DragListener
     *
     * @param   {Number} x The tabs absolute x position
     * @param   {Number} y The tabs absolute y position
     *
     * @private
     * @returns {void}
     */

  }, {
    key: "_onDragStart",
    value: function _onDragStart(x, y) {
      if (!this.header._canDestroy) return null;

      if (this.contentItem.parent.isMaximised === true) {
        this.contentItem.parent.toggleMaximise();
      }

      new _controls_DragProxy__WEBPACK_IMPORTED_MODULE_1__["default"](x, y, this._dragListener, this._layoutManager, this.contentItem, this.header.parent);
    }
    /**
     * Callback when the tab is clicked
     *
     * @param {jQuery DOM event} event
     *
     * @private
     * @returns {void}
     */

  }, {
    key: "_onTabClick",
    value: function _onTabClick(event) {
      // left mouse button or tap
      if (event.button === 0 || event.type === 'touchstart') {
        this.header.parent.setActiveContentItem(this.contentItem); // middle mouse button
      } else if (event.button === 1 && this.contentItem.config.isClosable) {
        this._onCloseClick(event);
      }
    }
    /**
     * Callback when the tab's close button is
     * clicked
     *
     * @param   {jQuery DOM event} event
     *
     * @private
     * @returns {void}
     */

  }, {
    key: "_onCloseClick",
    value: function _onCloseClick(event) {
      event.stopPropagation();
      if (!this.header._canDestroy) return;
      this.header.parent.removeChild(this.contentItem);
    }
    /**
     * Callback to capture tab close button mousedown
     * to prevent tab from activating.
     *
     * @param (jQuery DOM event) event
     *
     * @private
     * @returns {void}
     */

  }, {
    key: "_onCloseMousedown",
    value: function _onCloseMousedown(event) {
      event.stopPropagation();
    }
  }]);

  return Tab;
}();



/***/ }),

/***/ "./src/js_es6/controls/TransitionIndicator.js":
/*!****************************************************!*\
  !*** ./src/js_es6/controls/TransitionIndicator.js ***!
  \****************************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "default", function() { return TransitionIndicator; });
/* harmony import */ var _utils_utils__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../utils/utils */ "./src/js_es6/utils/utils.js");
/* harmony import */ var jquery__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! jquery */ "jquery");
/* harmony import */ var jquery__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(jquery__WEBPACK_IMPORTED_MODULE_1__);
function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }




var TransitionIndicator = /*#__PURE__*/function () {
  function TransitionIndicator() {
    _classCallCheck(this, TransitionIndicator);

    this._element = jquery__WEBPACK_IMPORTED_MODULE_1___default()('<div class="lm_transition_indicator"></div>');
    jquery__WEBPACK_IMPORTED_MODULE_1___default()(document.body).append(this._element);
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
          animationProgress = (Object(_utils_utils__WEBPACK_IMPORTED_MODULE_0__["now"])() - this._animationStartTime) / this._totalAnimationDuration,
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

      Object(_utils_utils__WEBPACK_IMPORTED_MODULE_0__["animFrame"])(Object(_utils_utils__WEBPACK_IMPORTED_MODULE_0__["fnBind"])(this._nextAnimationFrame, this));
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



/***/ }),

/***/ "./src/js_es6/errors/ConfigurationError.js":
/*!*************************************************!*\
  !*** ./src/js_es6/errors/ConfigurationError.js ***!
  \*************************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "default", function() { return ConfigurationError; });
function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf(subClass, superClass); }

function _createSuper(Derived) { return function () { var Super = _getPrototypeOf(Derived), result; if (_isNativeReflectConstruct()) { var NewTarget = _getPrototypeOf(this).constructor; result = Reflect.construct(Super, arguments, NewTarget); } else { result = Super.apply(this, arguments); } return _possibleConstructorReturn(this, result); }; }

function _possibleConstructorReturn(self, call) { if (call && (_typeof(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized(self); }

function _assertThisInitialized(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

function _wrapNativeSuper(Class) { var _cache = typeof Map === "function" ? new Map() : undefined; _wrapNativeSuper = function _wrapNativeSuper(Class) { if (Class === null || !_isNativeFunction(Class)) return Class; if (typeof Class !== "function") { throw new TypeError("Super expression must either be null or a function"); } if (typeof _cache !== "undefined") { if (_cache.has(Class)) return _cache.get(Class); _cache.set(Class, Wrapper); } function Wrapper() { return _construct(Class, arguments, _getPrototypeOf(this).constructor); } Wrapper.prototype = Object.create(Class.prototype, { constructor: { value: Wrapper, enumerable: false, writable: true, configurable: true } }); return _setPrototypeOf(Wrapper, Class); }; return _wrapNativeSuper(Class); }

function _construct(Parent, args, Class) { if (_isNativeReflectConstruct()) { _construct = Reflect.construct; } else { _construct = function _construct(Parent, args, Class) { var a = [null]; a.push.apply(a, args); var Constructor = Function.bind.apply(Parent, a); var instance = new Constructor(); if (Class) _setPrototypeOf(instance, Class.prototype); return instance; }; } return _construct.apply(null, arguments); }

function _isNativeReflectConstruct() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Date.prototype.toString.call(Reflect.construct(Date, [], function () {})); return true; } catch (e) { return false; } }

function _isNativeFunction(fn) { return Function.toString.call(fn).indexOf("[native code]") !== -1; }

function _setPrototypeOf(o, p) { _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf(o, p); }

function _getPrototypeOf(o) { _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf(o); }

var ConfigurationError = /*#__PURE__*/function (_Error) {
  _inherits(ConfigurationError, _Error);

  var _super = _createSuper(ConfigurationError);

  function ConfigurationError(message, node) {
    var _this;

    _classCallCheck(this, ConfigurationError);

    _this = _super.call(this);
    _this.name = 'Configuration Error';
    _this.message = message;
    _this.node = node;
    return _this;
  }

  return ConfigurationError;
}( /*#__PURE__*/_wrapNativeSuper(Error));



/***/ }),

/***/ "./src/js_es6/items/AbstractContentItem.js":
/*!*************************************************!*\
  !*** ./src/js_es6/items/AbstractContentItem.js ***!
  \*************************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "default", function() { return AbstractContentItem; });
/* harmony import */ var _utils_EventEmitter__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../utils/EventEmitter */ "./src/js_es6/utils/EventEmitter.js");
/* harmony import */ var _utils_BubblingEvent__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../utils/BubblingEvent */ "./src/js_es6/utils/BubblingEvent.js");
/* harmony import */ var _Root__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./Root */ "./src/js_es6/items/Root.js");
/* harmony import */ var _errors_ConfigurationError__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../errors/ConfigurationError */ "./src/js_es6/errors/ConfigurationError.js");
/* harmony import */ var _config_ItemDefaultConfig__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../config/ItemDefaultConfig */ "./src/js_es6/config/ItemDefaultConfig.js");
/* harmony import */ var _utils_utils__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../utils/utils */ "./src/js_es6/utils/utils.js");
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








/**
 * This is the baseclass that all content items inherit from.
 * Most methods provide a subset of what the sub-classes do.
 *
 * It also provides a number of functions for tree traversal
 *
 * @param {lm.LayoutManager} layoutManager
 * @param {item node configuration} config
 * @param {lm.item} parent
 *
 * @event stateChanged
 * @event beforeItemDestroyed
 * @event itemDestroyed
 * @event itemCreated
 * @event componentCreated
 * @event rowCreated
 * @event columnCreated
 * @event stackCreated
 *
 * @constructor
 */

var AbstractContentItem = /*#__PURE__*/function (_EventEmitter) {
  _inherits(AbstractContentItem, _EventEmitter);

  var _super = _createSuper(AbstractContentItem);

  function AbstractContentItem(layoutManager, config, parent) {
    var _this;

    _classCallCheck(this, AbstractContentItem);

    _this = _super.call(this);
    _this.config = _this._extendItemNode(config);
    _this.type = config.type;
    _this.contentItems = [];
    _this.parent = parent;
    _this.isInitialised = false;
    _this.isMaximised = false;
    _this.isRoot = false;
    _this.isRow = false;
    _this.isColumn = false;
    _this.isStack = false;
    _this.isComponent = false;
    _this.layoutManager = layoutManager;
    _this._pendingEventPropagations = {};
    _this._throttledEvents = ['stateChanged'];

    _this.on(_utils_EventEmitter__WEBPACK_IMPORTED_MODULE_0__["ALL_EVENT"], _this._propagateEvent, _assertThisInitialized(_this));

    if (config.content) {
      _this._createContentItems(config);
    }

    return _this;
  }
  /**
   * Set the size of the component and its children, called recursively
   *
   * @abstract
   * @returns void
   */


  _createClass(AbstractContentItem, [{
    key: "setSize",
    value: function setSize() {
      throw new Error('Abstract Method');
    }
    /**
     * Calls a method recursively downwards on the tree
     *
     * @param   {String} functionName      the name of the function to be called
     * @param   {[Array]}functionArguments optional arguments that are passed to every function
     * @param   {[bool]} bottomUp          Call methods from bottom to top, defaults to false
     * @param   {[bool]} skipSelf          Don't invoke the method on the class that calls it, defaults to false
     *
     * @returns {void}
     */

  }, {
    key: "callDownwards",
    value: function callDownwards(functionName, functionArguments, bottomUp, skipSelf) {
      var i;

      if (bottomUp !== true && skipSelf !== true) {
        this[functionName].apply(this, functionArguments || []);
      }

      for (i = 0; i < this.contentItems.length; i++) {
        this.contentItems[i].callDownwards(functionName, functionArguments, bottomUp);
      }

      if (bottomUp === true && skipSelf !== true) {
        this[functionName].apply(this, functionArguments || []);
      }
    }
    /**
     * Removes a child node (and its children) from the tree
     *
     * @param   {ContentItem} contentItem
     *
     * @returns {void}
     */

  }, {
    key: "removeChild",
    value: function removeChild(contentItem, keepChild) {
      /*
       * Get the position of the item that's to be removed within all content items this node contains
       */
      var index = Object(_utils_utils__WEBPACK_IMPORTED_MODULE_5__["indexOf"])(contentItem, this.contentItems);
      /*
       * Make sure the content item to be removed is actually a child of this item
       */

      if (index === -1) {
        throw new Error('Can\'t remove child item. Unknown content item');
      }
      /**
      * Call ._$destroy on the content item. 
      * Then use 'callDownwards' to destroy any children
      */


      if (keepChild !== true) {
        this.contentItems[index]._$destroy();

        this.contentItems[index].callDownwards('_$destroy', [], true, true);
      }
      /**
       * Remove the content item from this nodes array of children
       */


      this.contentItems.splice(index, 1);
      /**
       * Remove the item from the configuration
       */

      this.config.content.splice(index, 1);
      /**
       * If this node still contains other content items, adjust their size
       */

      if (this.contentItems.length > 0) {
        this.callDownwards('setSize');
        /**
         * If this was the last content item, remove this node as well
         */
      } else if (!(this instanceof _Root__WEBPACK_IMPORTED_MODULE_2__["default"]) && this.config.isClosable === true) {
        this.parent.removeChild(this);
      }
    }
    /**
     * Hides a child node (and its children) from the tree reclaiming its space in the layout
     *
     * @param   {ContentItem} contentItem
     *
     * @returns {void}
     */

  }, {
    key: "undisplayChild",
    value: function undisplayChild(contentItem) {
      /*
       * Get the position of the item that's to be removed within all content items this node contains
       */
      var index = Object(_utils_utils__WEBPACK_IMPORTED_MODULE_5__["indexOf"])(contentItem, this.contentItems);
      /*
       * Make sure the content item to be removed is actually a child of this item
       */

      if (index === -1) {
        throw new Error('Can\'t remove child item. Unknown content item');
      }

      if (!(this instanceof _Root__WEBPACK_IMPORTED_MODULE_2__["default"]) && this.config.isClosable === true) {
        this.parent.undisplayChild(this);
      }
    }
    /**
     * Sets up the tree structure for the newly added child
     * The responsibility for the actual DOM manipulations lies
     * with the concrete item
     *
     * @param {AbstractContentItem} contentItem
     * @param {[Int]} index If omitted item will be appended
     */

  }, {
    key: "addChild",
    value: function addChild(contentItem, index) {
      if (index === undefined) {
        index = this.contentItems.length;
      }

      this.contentItems.splice(index, 0, contentItem);

      if (this.config.content === undefined) {
        this.config.content = [];
      }

      this.config.content.splice(index, 0, contentItem.config);
      contentItem.parent = this;

      if (contentItem.parent.isInitialised === true && contentItem.isInitialised === false) {
        contentItem._$init();
      }
    }
    /**
     * Replaces oldChild with newChild. This used to use jQuery.replaceWith... which for
     * some reason removes all event listeners, so isn't really an option.
     *
     * @param   {AbstractContentItem} oldChild
     * @param   {AbstractContentItem} newChild
     *
     * @returns {void}
     */

  }, {
    key: "replaceChild",
    value: function replaceChild(oldChild, newChild, _$destroyOldChild) {
      newChild = this.layoutManager._$normalizeContentItem(newChild);
      var index = Object(_utils_utils__WEBPACK_IMPORTED_MODULE_5__["indexOf"])(oldChild, this.contentItems),
          parentNode = oldChild.element[0].parentNode;

      if (index === -1) {
        throw new Error('Can\'t replace child. oldChild is not child of this');
      }

      parentNode.replaceChild(newChild.element[0], oldChild.element[0]);
      /*
       * Optionally destroy the old content item
       */

      if (_$destroyOldChild === true) {
        oldChild.parent = null;

        oldChild._$destroy();
      }
      /*
       * Wire the new contentItem into the tree
       */


      this.contentItems[index] = newChild;
      newChild.parent = this;
      /*
       * Update tab reference
       */

      if (this.isStack) {
        this.header.tabs[index].contentItem = newChild;
      } //TODO This doesn't update the config... refactor to leave item nodes untouched after creation


      if (newChild.parent.isInitialised === true && newChild.isInitialised === false) {
        newChild._$init();
      }

      this.callDownwards('setSize');
    }
    /**
     * Convenience method.
     * Shorthand for this.parent.removeChild( this )
     *
     * @returns {void}
     */

  }, {
    key: "remove",
    value: function remove() {
      this.parent.removeChild(this);
    }
    /**
     * Removes the component from the layout and creates a new
     * browser window with the component and its children inside
     *
     * @returns {BrowserPopout}
     */

  }, {
    key: "popout",
    value: function popout() {
      var browserPopout = this.layoutManager.createPopout(this);
      this.emitBubblingEvent('stateChanged');
      return browserPopout;
    }
    /**
     * Maximises the Item or minimises it if it is already maximised
     *
     * @returns {void}
     */

  }, {
    key: "toggleMaximise",
    value: function toggleMaximise(e) {
      e && e.preventDefault();

      if (this.isMaximised === true) {
        this.layoutManager._$minimiseItem(this);
      } else {
        this.layoutManager._$maximiseItem(this);
      }

      this.isMaximised = !this.isMaximised;
      this.emitBubblingEvent('stateChanged');
    }
    /**
     * Selects the item if it is not already selected
     *
     * @returns {void}
     */

  }, {
    key: "select",
    value: function select() {
      if (this.layoutManager.selectedItem !== this) {
        this.layoutManager.selectItem(this, true);
        this.element.addClass('lm_selected');
      }
    }
    /**
     * De-selects the item if it is selected
     *
     * @returns {void}
     */

  }, {
    key: "deselect",
    value: function deselect() {
      if (this.layoutManager.selectedItem === this) {
        this.layoutManager.selectedItem = null;
        this.element.removeClass('lm_selected');
      }
    }
    /**
     * Set this component's title
     *
     * @public
     * @param {String} title
     *
     * @returns {void}
     */

  }, {
    key: "setTitle",
    value: function setTitle(title) {
      this.config.title = title;
      this.emit('titleChanged', title);
      this.emit('stateChanged');
    }
    /**
     * Checks whether a provided id is present
     *
     * @public
     * @param   {String}  id
     *
     * @returns {Boolean} isPresent
     */

  }, {
    key: "hasId",
    value: function hasId(id) {
      if (!this.config.id) {
        return false;
      } else if (typeof this.config.id === 'string') {
        return this.config.id === id;
      } else if (this.config.id instanceof Array) {
        return Object(_utils_utils__WEBPACK_IMPORTED_MODULE_5__["indexOf"])(id, this.config.id) !== -1;
      }
    }
    /**
     * Adds an id. Adds it as a string if the component doesn't
     * have an id yet or creates/uses an array
     *
     * @public
     * @param {String} id
     *
     * @returns {void}
     */

  }, {
    key: "addId",
    value: function addId(id) {
      if (this.hasId(id)) {
        return;
      }

      if (!this.config.id) {
        this.config.id = id;
      } else if (typeof this.config.id === 'string') {
        this.config.id = [this.config.id, id];
      } else if (this.config.id instanceof Array) {
        this.config.id.push(id);
      }
    }
    /**
     * Removes an existing id. Throws an error
     * if the id is not present
     *
     * @public
     * @param   {String} id
     *
     * @returns {void}
     */

  }, {
    key: "removeId",
    value: function removeId(id) {
      if (!this.hasId(id)) {
        throw new Error('Id not found');
      }

      if (typeof this.config.id === 'string') {
        delete this.config.id;
      } else if (this.config.id instanceof Array) {
        var index = Object(_utils_utils__WEBPACK_IMPORTED_MODULE_5__["indexOf"])(id, this.config.id);
        this.config.id.splice(index, 1);
      }
    }
    /****************************************
     * SELECTOR
     ****************************************/

  }, {
    key: "getItemsByFilter",
    value: function getItemsByFilter(filter) {
      var result = [],
          next = function next(contentItem) {
        for (var i = 0; i < contentItem.contentItems.length; i++) {
          if (filter(contentItem.contentItems[i]) === true) {
            result.push(contentItem.contentItems[i]);
          }

          next(contentItem.contentItems[i]);
        }
      };

      next(this);
      return result;
    }
  }, {
    key: "getItemsById",
    value: function getItemsById(id) {
      return this.getItemsByFilter(function (item) {
        if (item.config.id instanceof Array) {
          return Object(_utils_utils__WEBPACK_IMPORTED_MODULE_5__["indexOf"])(id, item.config.id) !== -1;
        } else {
          return item.config.id === id;
        }
      });
    }
  }, {
    key: "getItemsByType",
    value: function getItemsByType(type) {
      return this._$getItemsByProperty('type', type);
    }
  }, {
    key: "getComponentsByName",
    value: function getComponentsByName(componentName) {
      var components = this._$getItemsByProperty('componentName', componentName),
          instances = [],
          i;

      for (i = 0; i < components.length; i++) {
        instances.push(components[i].instance);
      }

      return instances;
    }
    /****************************************
     * PACKAGE PRIVATE
     ****************************************/

  }, {
    key: "_$getItemsByProperty",
    value: function _$getItemsByProperty(key, value) {
      return this.getItemsByFilter(function (item) {
        return item[key] === value;
      });
    }
  }, {
    key: "_$setParent",
    value: function _$setParent(parent) {
      this.parent = parent;
    }
  }, {
    key: "_$highlightDropZone",
    value: function _$highlightDropZone(x, y, area) {
      this.layoutManager.dropTargetIndicator.highlightArea(area);
    }
  }, {
    key: "_$onDrop",
    value: function _$onDrop(contentItem) {
      this.addChild(contentItem);
    }
  }, {
    key: "_$hide",
    value: function _$hide() {
      this._callOnActiveComponents('hide');

      this.element.hide();
      this.layoutManager.updateSize();
    }
  }, {
    key: "_$show",
    value: function _$show() {
      this._callOnActiveComponents('show');

      this.element.show();
      this.layoutManager.updateSize();
    }
  }, {
    key: "_callOnActiveComponents",
    value: function _callOnActiveComponents(methodName) {
      var stacks = this.getItemsByType('stack'),
          activeContentItem,
          i;

      for (i = 0; i < stacks.length; i++) {
        activeContentItem = stacks[i].getActiveContentItem();

        if (activeContentItem && activeContentItem.isComponent) {
          activeContentItem.container[methodName]();
        }
      }
    }
    /**
     * Destroys this item ands its children
     *
     * @returns {void}
     */

  }, {
    key: "_$destroy",
    value: function _$destroy() {
      this.emitBubblingEvent('beforeItemDestroyed');
      this.element.remove();
      this.emitBubblingEvent('itemDestroyed');
    }
    /**
     * Returns the area the component currently occupies in the format
     *
     * {
     *		x1: int
     *		xy: int
     *		y1: int
     *		y2: int
     *		contentItem: contentItem
     * }
     */

  }, {
    key: "_$getArea",
    value: function _$getArea(element) {
      element = element || this.element;
      var offset = element.offset(),
          width = element.width(),
          height = element.height();
      return {
        x1: offset.left,
        y1: offset.top,
        x2: offset.left + width,
        y2: offset.top + height,
        surface: width * height,
        contentItem: this
      };
    }
    /**
     * The tree of content items is created in two steps: First all content items are instantiated,
     * then init is called recursively from top to bottem. This is the basic init function,
     * it can be used, extended or overwritten by the content items
     *
     * Its behaviour depends on the content item
     *
     * @package private
     *
     * @returns {void}
     */

  }, {
    key: "_$init",
    value: function _$init() {
      var i;
      this.setSize();

      for (i = 0; i < this.contentItems.length; i++) {
        this.childElementContainer.append(this.contentItems[i].element);
      }

      this.isInitialised = true;
      this.emitBubblingEvent('itemCreated');
      this.emitBubblingEvent(this.type + 'Created');
    }
    /**
     * Emit an event that bubbles up the item tree.
     *
     * @param   {String} name The name of the event
     *
     * @returns {void}
     */

  }, {
    key: "emitBubblingEvent",
    value: function emitBubblingEvent(name) {
      var event = new _utils_BubblingEvent__WEBPACK_IMPORTED_MODULE_1__["default"](name, this);
      this.emit(name, event);
    }
    /**
     * Private method, creates all content items for this node at initialisation time
     * PLEASE NOTE, please see addChild for adding contentItems add runtime
     * @private
     * @param   {configuration item node} config
     *
     * @returns {void}
     */

  }, {
    key: "_createContentItems",
    value: function _createContentItems(config) {
      var oContentItem, i;

      if (!(config.content instanceof Array)) {
        throw new _errors_ConfigurationError__WEBPACK_IMPORTED_MODULE_3__["default"]('content must be an Array', config);
      }

      for (i = 0; i < config.content.length; i++) {
        oContentItem = this.layoutManager.createContentItem(config.content[i], this);
        this.contentItems.push(oContentItem);
      }
    }
    /**
     * Extends an item configuration node with default settings
     * @private
     * @param   {configuration item node} config
     *
     * @returns {configuration item node} extended config
     */

  }, {
    key: "_extendItemNode",
    value: function _extendItemNode(config) {
      for (var key in _config_ItemDefaultConfig__WEBPACK_IMPORTED_MODULE_4__["default"]) {
        if (config[key] === undefined) {
          config[key] = _config_ItemDefaultConfig__WEBPACK_IMPORTED_MODULE_4__["default"][key];
        }
      }

      return config;
    }
    /**
     * Called for every event on the item tree. Decides whether the event is a bubbling
     * event and propagates it to its parent
     *
     * @param    {String} name the name of the event
     * @param   {BubblingEvent} event
     *
     * @returns {void}
     */

  }, {
    key: "_propagateEvent",
    value: function _propagateEvent(name, event) {
      if (event instanceof _utils_BubblingEvent__WEBPACK_IMPORTED_MODULE_1__["default"] && event.isPropagationStopped === false && this.isInitialised === true) {
        /**
         * In some cases (e.g. if an element is created from a DragSource) it
         * doesn't have a parent and is not below root. If that's the case
         * propagate the bubbling event from the top level of the substree directly
         * to the layoutManager
         */
        if (this.isRoot === false && this.parent) {
          this.parent.emit.apply(this.parent, Array.prototype.slice.call(arguments, 0));
        } else {
          this._scheduleEventPropagationToLayoutManager(name, event);
        }
      }
    }
    /**
     * All raw events bubble up to the root element. Some events that
     * are propagated to - and emitted by - the layoutManager however are
     * only string-based, batched and sanitized to make them more usable
     *
     * @param {String} name the name of the event
     *
     * @private
     * @returns {void}
     */

  }, {
    key: "_scheduleEventPropagationToLayoutManager",
    value: function _scheduleEventPropagationToLayoutManager(name, event) {
      if (Object(_utils_utils__WEBPACK_IMPORTED_MODULE_5__["indexOf"])(name, this._throttledEvents) === -1) {
        this.layoutManager.emit(name, event.origin);
      } else {
        if (this._pendingEventPropagations[name] !== true) {
          this._pendingEventPropagations[name] = true;
          Object(_utils_utils__WEBPACK_IMPORTED_MODULE_5__["animFrame"])(Object(_utils_utils__WEBPACK_IMPORTED_MODULE_5__["fnBind"])(this._propagateEventToLayoutManager, this, [name, event]));
        }
      }
    }
    /**
     * Callback for events scheduled by _scheduleEventPropagationToLayoutManager
     *
     * @param {String} name the name of the event
     *
     * @private
     * @returns {void}
     */

  }, {
    key: "_propagateEventToLayoutManager",
    value: function _propagateEventToLayoutManager(name, event) {
      this._pendingEventPropagations[name] = false;
      this.layoutManager.emit(name, event);
    }
  }]);

  return AbstractContentItem;
}(_utils_EventEmitter__WEBPACK_IMPORTED_MODULE_0__["default"]);



/***/ }),

/***/ "./src/js_es6/items/Component.js":
/*!***************************************!*\
  !*** ./src/js_es6/items/Component.js ***!
  \***************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "default", function() { return Component; });
/* harmony import */ var _items_AbstractContentItem__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../items/AbstractContentItem */ "./src/js_es6/items/AbstractContentItem.js");
/* harmony import */ var _container_ItemContainer__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../container/ItemContainer */ "./src/js_es6/container/ItemContainer.js");
/* harmony import */ var _utils_ReactComponentHandler__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../utils/ReactComponentHandler */ "./src/js_es6/utils/ReactComponentHandler.js");
/* harmony import */ var jquery__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! jquery */ "jquery");
/* harmony import */ var jquery__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(jquery__WEBPACK_IMPORTED_MODULE_3__);
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
    var ComponentConstructor = layoutManager.isReactConfig(config) ? _utils_ReactComponentHandler__WEBPACK_IMPORTED_MODULE_2__["default"] : layoutManager.getComponent(config),
        componentConfig = jquery__WEBPACK_IMPORTED_MODULE_3___default.a.extend(true, {}, _this.config.componentState || {});
    componentConfig.componentName = _this.config.componentName;
    _this.componentName = _this.config.componentName;

    if (_this.config.title === '') {
      _this.config.title = _this.config.componentName;
    }

    _this.isComponent = true;
    _this.container = new _container_ItemContainer__WEBPACK_IMPORTED_MODULE_1__["default"](_this.config, _assertThisInitialized(_this), layoutManager);
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
      _items_AbstractContentItem__WEBPACK_IMPORTED_MODULE_0__["default"].prototype._$init.call(this);

      this.container.emit('open');
    }
  }, {
    key: "_$hide",
    value: function _$hide() {
      this.container.hide();

      _items_AbstractContentItem__WEBPACK_IMPORTED_MODULE_0__["default"].prototype._$hide.call(this);
    }
  }, {
    key: "_$show",
    value: function _$show() {
      this.container.show();

      _items_AbstractContentItem__WEBPACK_IMPORTED_MODULE_0__["default"].prototype._$show.call(this);
    }
  }, {
    key: "_$shown",
    value: function _$shown() {
      this.container.shown();

      _items_AbstractContentItem__WEBPACK_IMPORTED_MODULE_0__["default"].prototype._$shown.call(this);
    }
  }, {
    key: "_$destroy",
    value: function _$destroy() {
      this.container.emit('destroy', this);

      _items_AbstractContentItem__WEBPACK_IMPORTED_MODULE_0__["default"].prototype._$destroy.call(this);
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
}(_items_AbstractContentItem__WEBPACK_IMPORTED_MODULE_0__["default"]);



/***/ }),

/***/ "./src/js_es6/items/Root.js":
/*!**********************************!*\
  !*** ./src/js_es6/items/Root.js ***!
  \**********************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "default", function() { return Root; });
/* harmony import */ var _items_AbstractContentItem__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../items/AbstractContentItem */ "./src/js_es6/items/AbstractContentItem.js");
/* harmony import */ var _items_RowOrColumn__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../items/RowOrColumn */ "./src/js_es6/items/RowOrColumn.js");
/* harmony import */ var jquery__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! jquery */ "jquery");
/* harmony import */ var jquery__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(jquery__WEBPACK_IMPORTED_MODULE_2__);
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





var Root = /*#__PURE__*/function (_AbstractContentItem) {
  _inherits(Root, _AbstractContentItem);

  var _super = _createSuper(Root);

  function Root(layoutManager, config, containerElement) {
    var _this;

    _classCallCheck(this, Root);

    _this = _super.call(this, layoutManager, config, null);
    _this.isRoot = true;
    _this.type = 'root';
    _this.element = jquery__WEBPACK_IMPORTED_MODULE_2___default()('<div class="lm_goldenlayout lm_item lm_root"></div>');
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
      _items_AbstractContentItem__WEBPACK_IMPORTED_MODULE_0__["default"].prototype.addChild.call(this, contentItem);
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

      _items_AbstractContentItem__WEBPACK_IMPORTED_MODULE_0__["default"].prototype._$highlightDropZone.apply(this, arguments);
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

        if (!(column instanceof _items_RowOrColumn__WEBPACK_IMPORTED_MODULE_1__["default"]) || column.type != type) {
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
}(_items_AbstractContentItem__WEBPACK_IMPORTED_MODULE_0__["default"]);



/***/ }),

/***/ "./src/js_es6/items/RowOrColumn.js":
/*!*****************************************!*\
  !*** ./src/js_es6/items/RowOrColumn.js ***!
  \*****************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "default", function() { return RowOrColumn; });
/* harmony import */ var _items_AbstractContentItem__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../items/AbstractContentItem */ "./src/js_es6/items/AbstractContentItem.js");
/* harmony import */ var _items_Stack__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../items/Stack */ "./src/js_es6/items/Stack.js");
/* harmony import */ var _controls_Splitter__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../controls/Splitter */ "./src/js_es6/controls/Splitter.js");
/* harmony import */ var _utils_utils__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../utils/utils */ "./src/js_es6/utils/utils.js");
/* harmony import */ var jquery__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! jquery */ "jquery");
/* harmony import */ var jquery__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(jquery__WEBPACK_IMPORTED_MODULE_4__);
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







var RowOrColumn = /*#__PURE__*/function (_AbstractContentItem) {
  _inherits(RowOrColumn, _AbstractContentItem);

  var _super = _createSuper(RowOrColumn);

  function RowOrColumn(isColumn, layoutManager, config, parent) {
    var _this;

    _classCallCheck(this, RowOrColumn);

    _this = _super.call(this, layoutManager, config, parent);
    _this.isRow = !isColumn;
    _this.isColumn = isColumn;
    _this.element = jquery__WEBPACK_IMPORTED_MODULE_4___default()('<div class="lm_item lm_' + (isColumn ? 'column' : 'row') + '"></div>');
    _this.childElementContainer = _this.element;
    _this._splitterSize = layoutManager.config.dimensions.borderWidth;
    _this._splitterGrabSize = layoutManager.config.dimensions.borderGrabWidth;
    _this._isColumn = isColumn;
    _this._dimension = isColumn ? 'height' : 'width';
    _this._splitter = [];
    _this._splitterPosition = null;
    _this._splitterMinPosition = null;
    _this._splitterMaxPosition = null;
    return _this;
  }
  /**
   * Add a new contentItem to the Row or Column
   *
   * @param {AbstractContentItem} contentItem
   * @param {[int]} index The position of the new item within the Row or Column.
   *                      If no index is provided the item will be added to the end
   * @param {[bool]} _$suspendResize If true the items won't be resized. This will leave the item in
   *                                 an inconsistent state and is only intended to be used if multiple
   *                                 children need to be added in one go and resize is called afterwards
   *
   * @returns {void}
   */


  _createClass(RowOrColumn, [{
    key: "addChild",
    value: function addChild(contentItem, index, _$suspendResize) {
      var newItemSize, itemSize, i, splitterElement;
      contentItem = this.layoutManager._$normalizeContentItem(contentItem, this);

      if (index === undefined) {
        index = this.contentItems.length;
      }

      if (this.contentItems.length > 0) {
        splitterElement = this._createSplitter(Math.max(0, index - 1)).element;

        if (index > 0) {
          this.contentItems[index - 1].element.after(splitterElement);
          splitterElement.after(contentItem.element);

          if (this._isDocked(index - 1)) {
            this._splitter[index - 1].element.hide();

            this._splitter[index].element.show();
          }
        } else {
          this.contentItems[0].element.before(splitterElement);
          splitterElement.before(contentItem.element);
        }
      } else {
        this.childElementContainer.append(contentItem.element);
      }

      _items_AbstractContentItem__WEBPACK_IMPORTED_MODULE_0__["default"].prototype.addChild.call(this, contentItem, index);
      newItemSize = 1 / this.contentItems.length * 100;

      if (_$suspendResize === true) {
        this.emitBubblingEvent('stateChanged');
        return;
      }

      for (i = 0; i < this.contentItems.length; i++) {
        if (this.contentItems[i] === contentItem) {
          contentItem.config[this._dimension] = newItemSize;
        } else {
          itemSize = this.contentItems[i].config[this._dimension] *= (100 - newItemSize) / 100;
          this.contentItems[i].config[this._dimension] = itemSize;
        }
      }

      this.callDownwards('setSize');
      this.emitBubblingEvent('stateChanged');

      this._validateDocking();
    }
    /**
     * Undisplays a child of this element
     *
     * @param   {AbstractContentItem} contentItem
     *
     * @returns {void}
     */

  }, {
    key: "undisplayChild",
    value: function undisplayChild(contentItem) {
      var undisplayedItemSize = contentItem.config[this._dimension],
          index = Object(_utils_utils__WEBPACK_IMPORTED_MODULE_3__["indexOf"])(contentItem, this.contentItems),
          splitterIndex = Math.max(index - 1, 0),
          i,
          childItem;

      if (index === -1) {
        throw new Error('Can\'t undisplay child. ContentItem is not child of this Row or Column');
      }
      /**
       * Hide the splitter before the item or after if the item happens
       * to be the first in the row/column
       */


      if (this._splitter[splitterIndex]) {
        this._splitter[splitterIndex].element.hide();
      }

      if (splitterIndex < this._splitter.length) {
        if (this._isDocked(splitterIndex)) this._splitter[splitterIndex].element.hide();
      }
      /**
       * Allocate the space that the hidden item occupied to the remaining items
       */


      var docked = this._isDocked();

      for (i = 0; i < this.contentItems.length; i++) {
        if (this.contentItems[i] !== contentItem) {
          if (!this._isDocked(i)) this.contentItems[i].config[this._dimension] += undisplayedItemSize / (this.contentItems.length - 1 - docked);
        } else {
          this.contentItems[i].config[this._dimension] = 0;
        }
      }

      if (this.contentItems.length === 1) {
        _items_AbstractContentItem__WEBPACK_IMPORTED_MODULE_0__["default"].prototype.undisplayChild.call(this, contentItem);
      }

      this.callDownwards('setSize');
      this.emitBubblingEvent('stateChanged');
    }
    /**
     * Removes a child of this element
     *
     * @param   {AbstractContentItem} contentItem
     * @param   {boolean} keepChild   If true the child will be removed, but not destroyed
     *
     * @returns {void}
     */

  }, {
    key: "removeChild",
    value: function removeChild(contentItem, keepChild) {
      var removedItemSize = contentItem.config[this._dimension],
          index = Object(_utils_utils__WEBPACK_IMPORTED_MODULE_3__["indexOf"])(contentItem, this.contentItems),
          splitterIndex = Math.max(index - 1, 0),
          i,
          childItem;

      if (index === -1) {
        throw new Error('Can\'t remove child. ContentItem is not child of this Row or Column');
      }
      /**
       * Remove the splitter before the item or after if the item happens
       * to be the first in the row/column
       */


      if (this._splitter[splitterIndex]) {
        this._splitter[splitterIndex]._$destroy();

        this._splitter.splice(splitterIndex, 1);
      }

      if (splitterIndex < this._splitter.length) {
        if (this._isDocked(splitterIndex)) this._splitter[splitterIndex].element.hide();
      }
      /**
       * Allocate the space that the removed item occupied to the remaining items
       */


      var docked = this._isDocked();

      for (i = 0; i < this.contentItems.length; i++) {
        if (this.contentItems[i] !== contentItem) {
          if (!this._isDocked(i)) this.contentItems[i].config[this._dimension] += removedItemSize / (this.contentItems.length - 1 - docked);
        }
      }

      _items_AbstractContentItem__WEBPACK_IMPORTED_MODULE_0__["default"].prototype.removeChild.call(this, contentItem, keepChild);

      if (this.contentItems.length === 1 && this.config.isClosable === true) {
        childItem = this.contentItems[0];
        this.contentItems = [];
        this.parent.replaceChild(this, childItem, true);

        this._validateDocking(this.parent);
      } else {
        this.callDownwards('setSize');
        this.emitBubblingEvent('stateChanged');

        this._validateDocking();
      }
    }
    /**
     * Replaces a child of this Row or Column with another contentItem
     *
     * @param   {AbstractContentItem} oldChild
     * @param   {AbstractContentItem} newChild
     *
     * @returns {void}
     */

  }, {
    key: "replaceChild",
    value: function replaceChild(oldChild, newChild) {
      var size = oldChild.config[this._dimension];
      _items_AbstractContentItem__WEBPACK_IMPORTED_MODULE_0__["default"].prototype.replaceChild.call(this, oldChild, newChild);
      newChild.config[this._dimension] = size;
      this.callDownwards('setSize');
      this.emitBubblingEvent('stateChanged');
    }
    /**
     * Called whenever the dimensions of this item or one of its parents change
     *
     * @returns {void}
     */

  }, {
    key: "setSize",
    value: function setSize() {
      if (this.contentItems.length > 0) {
        this._calculateRelativeSizes();

        this._setAbsoluteSizes();
      }

      this.emitBubblingEvent('stateChanged');
      this.emit('resize');
    }
    /**
     * Dock or undock a child if it posiible
     *
     * @param   {AbstractContentItem} contentItem
     * @param   {Boolean} mode or toggle if undefined
     * @param   {Boolean} collapsed after docking
     *
     * @returns {void}
     */

  }, {
    key: "dock",
    value: function dock(contentItem, mode, collapsed) {
      if (this.contentItems.length === 1) throw new Error('Can\'t dock child when it single');
      var removedItemSize = contentItem.config[this._dimension],
          headerSize = this.layoutManager.config.dimensions.headerHeight,
          index = Object(_utils_utils__WEBPACK_IMPORTED_MODULE_3__["indexOf"])(contentItem, this.contentItems),
          splitterIndex = Math.max(index - 1, 0);

      if (index === -1) {
        throw new Error('Can\'t dock child. ContentItem is not child of this Row or Column');
      }

      var isDocked = contentItem._docker && contentItem._docker.docked;
      var i;
      if (typeof mode != 'undefined') if (mode == isDocked) return;

      if (isDocked) {
        // undock it
        this._splitter[splitterIndex].element.show();

        for (i = 0; i < this.contentItems.length; i++) {
          var newItemSize = contentItem._docker.size;

          if (this.contentItems[i] === contentItem) {
            contentItem.config[this._dimension] = newItemSize;
          } else {
            itemSize = this.contentItems[i].config[this._dimension] *= (100 - newItemSize) / 100;
            this.contentItems[i].config[this._dimension] = itemSize;
          }
        }

        contentItem._docker = {
          docked: false
        };
      } else {
        // dock
        if (this.contentItems.length - this._isDocked() < 2) throw new Error('Can\'t dock child when it is last in ' + this.config.type);
        var autoside = {
          column: {
            first: 'top',
            last: 'bottom'
          },
          row: {
            first: 'left',
            last: 'right'
          }
        };
        var required = autoside[this.config.type][index ? 'last' : 'first'];
        if (contentItem.header.position() != required) contentItem.header.position(required);

        if (this._splitter[splitterIndex]) {
          this._splitter[splitterIndex].element.hide();
        }

        var docked = this._isDocked();

        for (i = 0; i < this.contentItems.length; i++) {
          if (this.contentItems[i] !== contentItem) {
            if (!this._isDocked(i)) this.contentItems[i].config[this._dimension] += removedItemSize / (this.contentItems.length - 1 - docked);
          } else this.contentItems[i].config[this._dimension] = 0;
        }

        contentItem._docker = {
          dimension: this._dimension,
          size: removedItemSize,
          realSize: contentItem.element[this._dimension]() - headerSize,
          docked: true
        };
        if (collapsed) contentItem.childElementContainer[this._dimension](0);
      }

      contentItem.element.toggleClass('lm_docked', contentItem._docker.docked);
      this.callDownwards('setSize');
      this.emitBubblingEvent('stateChanged');

      this._validateDocking();
    }
    /**
     * Invoked recursively by the layout manager. AbstractContentItem.init appends
     * the contentItem's DOM elements to the container, RowOrColumn init adds splitters
     * in between them
     *
     * @package private
     * @override AbstractContentItem._$init
     * @returns {void}
     */

  }, {
    key: "_$init",
    value: function _$init() {
      if (this.isInitialised === true) return;
      var i;

      _items_AbstractContentItem__WEBPACK_IMPORTED_MODULE_0__["default"].prototype._$init.call(this);

      for (i = 0; i < this.contentItems.length - 1; i++) {
        this.contentItems[i].element.after(this._createSplitter(i).element);
      }

      for (i = 0; i < this.contentItems.length; i++) {
        if (this.contentItems[i]._header && this.contentItems[i]._header.docked) this.dock(this.contentItems[i], true, true);
      }
    }
    /**
     * Turns the relative sizes calculated by _calculateRelativeSizes into
     * absolute pixel values and applies them to the children's DOM elements
     *
     * Assigns additional pixels to counteract Math.floor
     *
     * @private
     * @returns {void}
     */

  }, {
    key: "_setAbsoluteSizes",
    value: function _setAbsoluteSizes() {
      var i,
          sizeData = this._calculateAbsoluteSizes();

      for (i = 0; i < this.contentItems.length; i++) {
        if (sizeData.additionalPixel - i > 0) {
          sizeData.itemSizes[i]++;
        }

        if (this._isColumn) {
          this.contentItems[i].element.width(sizeData.totalWidth);
          this.contentItems[i].element.height(sizeData.itemSizes[i]);
        } else {
          this.contentItems[i].element.width(sizeData.itemSizes[i]);
          this.contentItems[i].element.height(sizeData.totalHeight);
        }
      }
    }
    /**
     * Calculates the absolute sizes of all of the children of this Item.
     * @returns {object} - Set with absolute sizes and additional pixels.
     */

  }, {
    key: "_calculateAbsoluteSizes",
    value: function _calculateAbsoluteSizes() {
      var i,
          totalSplitterSize = (this.contentItems.length - 1) * this._splitterSize,
          headerSize = this.layoutManager.config.dimensions.headerHeight,
          totalWidth = this.element.width(),
          totalHeight = this.element.height(),
          totalAssigned = 0,
          additionalPixel,
          itemSize,
          itemSizes = [];

      if (this._isColumn) {
        totalHeight -= totalSplitterSize;
      } else {
        totalWidth -= totalSplitterSize;
      }

      for (i = 0; i < this.contentItems.length; i++) {
        if (this._isDocked(i)) if (this._isColumn) {
          totalHeight -= headerSize - this._splitterSize;
        } else {
          totalWidth -= headerSize - this._splitterSize;
        }
      }

      for (i = 0; i < this.contentItems.length; i++) {
        if (this._isColumn) {
          itemSize = Math.floor(totalHeight * (this.contentItems[i].config.height / 100));
        } else {
          itemSize = Math.floor(totalWidth * (this.contentItems[i].config.width / 100));
        }

        if (this._isDocked(i)) itemSize = headerSize;
        totalAssigned += itemSize;
        itemSizes.push(itemSize);
      }

      additionalPixel = Math.floor((this._isColumn ? totalHeight : totalWidth) - totalAssigned);
      return {
        itemSizes: itemSizes,
        additionalPixel: additionalPixel,
        totalWidth: totalWidth,
        totalHeight: totalHeight
      };
    }
    /**
     * Calculates the relative sizes of all children of this Item. The logic
     * is as follows:
     *
     * - Add up the total size of all items that have a configured size
     *
     * - If the total == 100 (check for floating point errors)
     *        Excellent, job done
     *
     * - If the total is > 100,
     *        set the size of items without set dimensions to 1/3 and add this to the total
     *        set the size off all items so that the total is hundred relative to their original size
     *
     * - If the total is < 100
     *        If there are items without set dimensions, distribute the remainder to 100 evenly between them
     *        If there are no items without set dimensions, increase all items sizes relative to
     *        their original size so that they add up to 100
     *
     * @private
     * @returns {void}
     */

  }, {
    key: "_calculateRelativeSizes",
    value: function _calculateRelativeSizes() {
      var i,
          total = 0,
          itemsWithoutSetDimension = [],
          dimension = this._isColumn ? 'height' : 'width';

      for (i = 0; i < this.contentItems.length; i++) {
        if (this.contentItems[i].config[dimension] !== undefined) {
          total += this.contentItems[i].config[dimension];
        } else {
          itemsWithoutSetDimension.push(this.contentItems[i]);
        }
      }
      /**
       * Everything adds up to hundred, all good :-)
       */


      if (Math.round(total) === 100) {
        this._respectMinItemWidth();

        return;
      }
      /**
       * Allocate the remaining size to the items without a set dimension
       */


      if (Math.round(total) < 100 && itemsWithoutSetDimension.length > 0) {
        for (i = 0; i < itemsWithoutSetDimension.length; i++) {
          itemsWithoutSetDimension[i].config[dimension] = (100 - total) / itemsWithoutSetDimension.length;
        }

        this._respectMinItemWidth();

        return;
      }
      /**
       * If the total is > 100, but there are also items without a set dimension left, assing 50
       * as their dimension and add it to the total
       *
       * This will be reset in the next step
       */


      if (Math.round(total) > 100) {
        for (i = 0; i < itemsWithoutSetDimension.length; i++) {
          itemsWithoutSetDimension[i].config[dimension] = 50;
          total += 50;
        }
      }
      /**
       * Set every items size relative to 100 relative to its size to total
       */


      for (i = 0; i < this.contentItems.length; i++) {
        this.contentItems[i].config[dimension] = this.contentItems[i].config[dimension] / total * 100;
      }

      this._respectMinItemWidth();
    }
    /**
     * Adjusts the column widths to respect the dimensions minItemWidth if set.
     * @returns {}
     */

  }, {
    key: "_respectMinItemWidth",
    value: function _respectMinItemWidth() {
      var minItemWidth = this.layoutManager.config.dimensions ? this.layoutManager.config.dimensions.minItemWidth || 0 : 0,
          sizeData = null,
          entriesOverMin = [],
          totalOverMin = 0,
          totalUnderMin = 0,
          remainingWidth = 0,
          itemSize = 0,
          contentItem = null,
          reducePercent,
          reducedWidth,
          allEntries = [],
          entry;

      if (this._isColumn || !minItemWidth || this.contentItems.length <= 1) {
        return;
      }

      sizeData = this._calculateAbsoluteSizes();
      /**
       * Figure out how much we are under the min item size total and how much room we have to use.
       */

      for (var i = 0; i < this.contentItems.length; i++) {
        contentItem = this.contentItems[i];
        itemSize = sizeData.itemSizes[i];

        if (itemSize < minItemWidth) {
          totalUnderMin += minItemWidth - itemSize;
          entry = {
            width: minItemWidth
          };
        } else {
          totalOverMin += itemSize - minItemWidth;
          entry = {
            width: itemSize
          };
          entriesOverMin.push(entry);
        }

        allEntries.push(entry);
      }
      /**
       * If there is nothing under min, or there is not enough over to make up the difference, do nothing.
       */


      if (totalUnderMin === 0 || totalUnderMin > totalOverMin) {
        return;
      }
      /**
       * Evenly reduce all columns that are over the min item width to make up the difference.
       */


      reducePercent = totalUnderMin / totalOverMin;
      remainingWidth = totalUnderMin;

      for (i = 0; i < entriesOverMin.length; i++) {
        entry = entriesOverMin[i];
        reducedWidth = Math.round((entry.width - minItemWidth) * reducePercent);
        remainingWidth -= reducedWidth;
        entry.width -= reducedWidth;
      }
      /**
       * Take anything remaining from the last item.
       */


      if (remainingWidth !== 0) {
        allEntries[allEntries.length - 1].width -= remainingWidth;
      }
      /**
       * Set every items size relative to 100 relative to its size to total
       */


      for (i = 0; i < this.contentItems.length; i++) {
        this.contentItems[i].config.width = allEntries[i].width / sizeData.totalWidth * 100;
      }
    }
    /**
     * Instantiates a new Splitter, binds events to it and adds
     * it to the array of splitters at the position specified as the index argument
     *
     * What it doesn't do though is append the splitter to the DOM
     *
     * @param   {Int} index The position of the splitter
     *
     * @returns {Splitter}
     */

  }, {
    key: "_createSplitter",
    value: function _createSplitter(index) {
      var splitter;
      splitter = new _controls_Splitter__WEBPACK_IMPORTED_MODULE_2__["default"](this._isColumn, this._splitterSize, this._splitterGrabSize);
      splitter.on('drag', Object(_utils_utils__WEBPACK_IMPORTED_MODULE_3__["fnBind"])(this._onSplitterDrag, this, [splitter]), this);
      splitter.on('dragStop', Object(_utils_utils__WEBPACK_IMPORTED_MODULE_3__["fnBind"])(this._onSplitterDragStop, this, [splitter]), this);
      splitter.on('dragStart', Object(_utils_utils__WEBPACK_IMPORTED_MODULE_3__["fnBind"])(this._onSplitterDragStart, this, [splitter]), this);

      this._splitter.splice(index, 0, splitter);

      return splitter;
    }
    /**
     * Locates the instance of Splitter in the array of
     * registered splitters and returns a map containing the contentItem
     * before and after the splitters, both of which are affected if the
     * splitter is moved
     *
     * @param   {Splitter} splitter
     *
     * @returns {Object} A map of contentItems that the splitter affects
     */

  }, {
    key: "_getItemsForSplitter",
    value: function _getItemsForSplitter(splitter) {
      var index = Object(_utils_utils__WEBPACK_IMPORTED_MODULE_3__["indexOf"])(splitter, this._splitter);
      return {
        before: this.contentItems[index],
        after: this.contentItems[index + 1]
      };
    }
    /**
     * Gets docking information
     * @private
     */

  }, {
    key: "_isDocked",
    value: function _isDocked(index) {
      if (typeof index == 'undefined') {
        var count = 0;

        for (var i = 0; i < this.contentItems.length; ++i) {
          if (this._isDocked(i)) count++;
        }

        return count;
      }

      if (index < this.contentItems.length) return this.contentItems[index]._docker && this.contentItems[index]._docker.docked;
    }
    /**
     * Validate if row or column has ability to dock
     * @private
     */

  }, {
    key: "_validateDocking",
    value: function _validateDocking(that) {
      that = that || this;
      var can = that.contentItems.length - that._isDocked() > 1;

      for (var i = 0; i < that.contentItems.length; ++i) {
        if (that.contentItems[i] instanceof _items_Stack__WEBPACK_IMPORTED_MODULE_1__["default"]) {
          that.contentItems[i].header._setDockable(that._isDocked(i) || can);

          that.contentItems[i].header._$setClosable(can);
        }
      }
    }
    /**
     * Gets the minimum dimensions for the given item configuration array
     * @param item
     * @private
     */

  }, {
    key: "_getMinimumDimensions",
    value: function _getMinimumDimensions(arr) {
      var minWidth = 0,
          minHeight = 0;

      for (var i = 0; i < arr.length; ++i) {
        minWidth = Math.max(arr[i].minWidth || 0, minWidth);
        minHeight = Math.max(arr[i].minHeight || 0, minHeight);
      }

      return {
        horizontal: minWidth,
        vertical: minHeight
      };
    }
    /**
     * Invoked when a splitter's dragListener fires dragStart. Calculates the splitters
     * movement area once (so that it doesn't need calculating on every mousemove event)
     *
     * @param   {Splitter} splitter
     *
     * @returns {void}
     */

  }, {
    key: "_onSplitterDragStart",
    value: function _onSplitterDragStart(splitter) {
      var items = this._getItemsForSplitter(splitter),
          minSize = this.layoutManager.config.dimensions[this._isColumn ? 'minItemHeight' : 'minItemWidth'];

      var beforeMinDim = this._getMinimumDimensions(items.before.config.content);

      var beforeMinSize = this._isColumn ? beforeMinDim.vertical : beforeMinDim.horizontal;

      var afterMinDim = this._getMinimumDimensions(items.after.config.content);

      var afterMinSize = this._isColumn ? afterMinDim.vertical : afterMinDim.horizontal;
      this._splitterPosition = 0;
      this._splitterMinPosition = -1 * (items.before.element[this._dimension]() - (beforeMinSize || minSize));
      this._splitterMaxPosition = items.after.element[this._dimension]() - (afterMinSize || minSize);
    }
    /**
     * Invoked when a splitter's DragListener fires drag. Updates the splitters DOM position,
     * but not the sizes of the elements the splitter controls in order to minimize resize events
     *
     * @param   {Splitter} splitter
     * @param   {Int} offsetX  Relative pixel values to the splitters original position. Can be negative
     * @param   {Int} offsetY  Relative pixel values to the splitters original position. Can be negative
     *
     * @returns {void}
     */

  }, {
    key: "_onSplitterDrag",
    value: function _onSplitterDrag(splitter, offsetX, offsetY) {
      var offset = this._isColumn ? offsetY : offsetX;

      if (offset > this._splitterMinPosition && offset < this._splitterMaxPosition) {
        this._splitterPosition = offset;
        splitter.element.css(this._isColumn ? 'top' : 'left', offset);
      }
    }
    /**
     * Invoked when a splitter's DragListener fires dragStop. Resets the splitters DOM position,
     * and applies the new sizes to the elements before and after the splitter and their children
     * on the next animation frame
     *
     * @param   {Splitter} splitter
     *
     * @returns {void}
     */

  }, {
    key: "_onSplitterDragStop",
    value: function _onSplitterDragStop(splitter) {
      var items = this._getItemsForSplitter(splitter),
          sizeBefore = items.before.element[this._dimension](),
          sizeAfter = items.after.element[this._dimension](),
          splitterPositionInRange = (this._splitterPosition + sizeBefore) / (sizeBefore + sizeAfter),
          totalRelativeSize = items.before.config[this._dimension] + items.after.config[this._dimension];

      items.before.config[this._dimension] = splitterPositionInRange * totalRelativeSize;
      items.after.config[this._dimension] = (1 - splitterPositionInRange) * totalRelativeSize;
      splitter.element.css({
        'top': 0,
        'left': 0
      });
      Object(_utils_utils__WEBPACK_IMPORTED_MODULE_3__["animFrame"])(Object(_utils_utils__WEBPACK_IMPORTED_MODULE_3__["fnBind"])(this.callDownwards, this, ['setSize']));
    }
  }]);

  return RowOrColumn;
}(_items_AbstractContentItem__WEBPACK_IMPORTED_MODULE_0__["default"]);



/***/ }),

/***/ "./src/js_es6/items/Stack.js":
/*!***********************************!*\
  !*** ./src/js_es6/items/Stack.js ***!
  \***********************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "default", function() { return Stack; });
/* harmony import */ var _items_AbstractContentItem__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../items/AbstractContentItem */ "./src/js_es6/items/AbstractContentItem.js");
/* harmony import */ var _items_RowOrColumn__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../items/RowOrColumn */ "./src/js_es6/items/RowOrColumn.js");
/* harmony import */ var _controls_Header__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../controls/Header */ "./src/js_es6/controls/Header.js");
/* harmony import */ var _utils_utils__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../utils/utils */ "./src/js_es6/utils/utils.js");
/* harmony import */ var jquery__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! jquery */ "jquery");
/* harmony import */ var jquery__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(jquery__WEBPACK_IMPORTED_MODULE_4__);
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







var Stack = /*#__PURE__*/function (_AbstractContentItem) {
  _inherits(Stack, _AbstractContentItem);

  var _super = _createSuper(Stack);

  function Stack(layoutManager, config, parent) {
    var _this;

    _classCallCheck(this, Stack);

    _this = _super.call(this, layoutManager, config, parent);
    _this.element = jquery__WEBPACK_IMPORTED_MODULE_4___default()('<div class="lm_item lm_stack"></div>');
    _this._activeContentItem = null;
    var cfg = layoutManager.config;
    _this._header = {
      // defaults' reconstruction from old configuration style
      show: cfg.settings.hasHeaders === true && config.hasHeaders !== false,
      popout: cfg.settings.showPopoutIcon && cfg.labels.popout,
      maximise: cfg.settings.showMaximiseIcon && cfg.labels.maximise,
      close: cfg.settings.showCloseIcon && cfg.labels.close,
      minimise: cfg.labels.minimise
    };
    if (cfg.header) // load simplified version of header configuration (https://github.com/deepstreamIO/golden-layout/pull/245)
      Object(_utils_utils__WEBPACK_IMPORTED_MODULE_3__["copy"])(_this._header, cfg.header);
    if (config.header) // load from stack
      Object(_utils_utils__WEBPACK_IMPORTED_MODULE_3__["copy"])(_this._header, config.header);
    if (config.content && config.content[0] && config.content[0].header) // load from component if stack omitted
      Object(_utils_utils__WEBPACK_IMPORTED_MODULE_3__["copy"])(_this._header, config.content[0].header);
    _this._dropZones = {};
    _this._dropSegment = null;
    _this._contentAreaDimensions = null;
    _this._dropIndex = null;
    _this.isStack = true;
    _this.childElementContainer = jquery__WEBPACK_IMPORTED_MODULE_4___default()('<div class="lm_items"></div>');
    _this.header = new _controls_Header__WEBPACK_IMPORTED_MODULE_2__["default"](layoutManager, _assertThisInitialized(_this));

    _this.element.on('mouseleave mouseenter', Object(_utils_utils__WEBPACK_IMPORTED_MODULE_3__["fnBind"])(function (event) {
      if (this._docker && this._docker.docked) this.childElementContainer[this._docker.dimension](event.type == 'mouseenter' ? this._docker.realSize : 0);
    }, _assertThisInitialized(_this)));

    _this.element.append(_this.header.element);

    _this.element.append(_this.childElementContainer);

    _this._setupHeaderPosition();

    _this._$validateClosability();

    return _this;
  }

  _createClass(Stack, [{
    key: "dock",
    value: function dock(mode) {
      if (this._header.dock) if (this.parent instanceof _items_RowOrColumn__WEBPACK_IMPORTED_MODULE_1__["default"]) this.parent.dock(this, mode);
    }
  }, {
    key: "setSize",
    value: function setSize() {
      if (this.element.css('display') === 'none') return;
      var isDocked = this._docker && this._docker.docked,
          content = {
        width: this.element.width(),
        height: this.element.height()
      };
      if (this._header.show) content[this._sided ? 'width' : 'height'] -= this.layoutManager.config.dimensions.headerHeight;
      if (isDocked) content[this._docker.dimension] = this._docker.realSize;
      if (!isDocked || this._docker.dimension == 'height') this.childElementContainer.width(content.width);
      if (!isDocked || this._docker.dimension == 'width') this.childElementContainer.height(content.height);

      for (var i = 0; i < this.contentItems.length; i++) {
        this.contentItems[i].element.width(content.width);
        this.contentItems[i].element.height(content.height);
      }

      this.emit('resize');
      this.emitBubblingEvent('stateChanged');
    }
  }, {
    key: "_$init",
    value: function _$init() {
      var i, initialItem;
      if (this.isInitialised === true) return;

      _items_AbstractContentItem__WEBPACK_IMPORTED_MODULE_0__["default"].prototype._$init.call(this);

      for (i = 0; i < this.contentItems.length; i++) {
        this.header.createTab(this.contentItems[i]);

        this.contentItems[i]._$hide();
      }

      if (this.contentItems.length > 0) {
        initialItem = this.contentItems[this.config.activeItemIndex || 0];

        if (!initialItem) {
          throw new Error('Configured activeItemIndex out of bounds');
        }

        this.setActiveContentItem(initialItem);
      }

      this._$validateClosability();

      if (this.parent instanceof _items_RowOrColumn__WEBPACK_IMPORTED_MODULE_1__["default"]) {
        this.parent._validateDocking();
      }
    }
  }, {
    key: "setActiveContentItem",
    value: function setActiveContentItem(contentItem) {
      if (this._activeContentItem === contentItem) return;

      if (Object(_utils_utils__WEBPACK_IMPORTED_MODULE_3__["indexOf"])(contentItem, this.contentItems) === -1) {
        throw new Error('contentItem is not a child of this stack');
      }

      if (this._activeContentItem !== null) {
        this._activeContentItem._$hide();
      }

      this._activeContentItem = contentItem;
      this.header.setActiveContentItem(contentItem);

      contentItem._$show();

      this.emit('activeContentItemChanged', contentItem);
      this.layoutManager.emit('activeContentItemChanged', contentItem);
      this.emitBubblingEvent('stateChanged');
    }
  }, {
    key: "getActiveContentItem",
    value: function getActiveContentItem() {
      return this.header.activeContentItem;
    }
  }, {
    key: "addChild",
    value: function addChild(contentItem, index) {
      if (index > this.contentItems.length) {
        /* 
         * UGLY PATCH: PR #428, commit a4e84ec5 fixed a bug appearing on touchscreens during the drag of a panel. 
         * The bug was caused by the physical removal of the element on drag: partial documentation is at issue #425. 
         * The fix introduced the function undisplayChild() (called 'undisplay' to differentiate it from jQuery.hide), 
         * which doesn't remove the element but only hides it: that's why when a tab is dragged & dropped into its 
         * original container (at the end), the index here could be off by one.
         */
        index -= 1;
      }

      contentItem = this.layoutManager._$normalizeContentItem(contentItem, this);
      _items_AbstractContentItem__WEBPACK_IMPORTED_MODULE_0__["default"].prototype.addChild.call(this, contentItem, index);
      this.childElementContainer.append(contentItem.element);
      this.header.createTab(contentItem, index);
      this.setActiveContentItem(contentItem);
      this.callDownwards('setSize');

      this._$validateClosability();

      if (this.parent instanceof _items_RowOrColumn__WEBPACK_IMPORTED_MODULE_1__["default"]) this.parent._validateDocking();
      this.emitBubblingEvent('stateChanged');
    }
  }, {
    key: "removeChild",
    value: function removeChild(contentItem, keepChild) {
      var index = Object(_utils_utils__WEBPACK_IMPORTED_MODULE_3__["indexOf"])(contentItem, this.contentItems);
      _items_AbstractContentItem__WEBPACK_IMPORTED_MODULE_0__["default"].prototype.removeChild.call(this, contentItem, keepChild);
      this.header.removeTab(contentItem);

      if (this.header.activeContentItem === contentItem) {
        if (this.contentItems.length > 0) {
          this.setActiveContentItem(this.contentItems[Math.max(index - 1, 0)]);
        } else {
          this._activeContentItem = null;
        }
      } else if (this.config.activeItemIndex >= this.contentItems.length) {
        if (this.contentItems.length > 0) {
          var activeIndex = Object(_utils_utils__WEBPACK_IMPORTED_MODULE_3__["indexOf"])(this.getActiveContentItem(), this.contentItems);
          this.config.activeItemIndex = Math.max(activeIndex, 0);
        }
      }

      this._$validateClosability();

      if (this.parent instanceof _items_RowOrColumn__WEBPACK_IMPORTED_MODULE_1__["default"]) this.parent._validateDocking();
      this.emitBubblingEvent('stateChanged');
    }
  }, {
    key: "undisplayChild",
    value: function undisplayChild(contentItem) {
      if (this.contentItems.length > 1) {
        var index = Object(_utils_utils__WEBPACK_IMPORTED_MODULE_3__["indexOf"])(contentItem, this.contentItems);
        contentItem._$hide && contentItem._$hide();
        this.setActiveContentItem(this.contentItems[index === 0 ? index + 1 : index - 1]);
      } else {
        this.header.hideTab(contentItem);
        contentItem._$hide && contentItem._$hide();
        _items_AbstractContentItem__WEBPACK_IMPORTED_MODULE_0__["default"].prototype.undisplayChild.call(this, contentItem);
        if (this.parent instanceof _items_RowOrColumn__WEBPACK_IMPORTED_MODULE_1__["default"]) this.parent._validateDocking();
      }

      this.emitBubblingEvent('stateChanged');
    }
    /**
     * Validates that the stack is still closable or not. If a stack is able
     * to close, but has a non closable component added to it, the stack is no
     * longer closable until all components are closable.
     *
     * @returns {void}
     */

  }, {
    key: "_$validateClosability",
    value: function _$validateClosability() {
      var contentItem, isClosable, len, i;
      isClosable = this.header._isClosable();

      for (i = 0, len = this.contentItems.length; i < len; i++) {
        if (!isClosable) {
          break;
        }

        isClosable = this.contentItems[i].config.isClosable;
      }

      this.header._$setClosable(isClosable);
    }
  }, {
    key: "_$destroy",
    value: function _$destroy() {
      _items_AbstractContentItem__WEBPACK_IMPORTED_MODULE_0__["default"].prototype._$destroy.call(this);

      this.header._$destroy();

      this.element.off('mouseenter mouseleave');
    }
    /**
     * Ok, this one is going to be the tricky one: The user has dropped {contentItem} onto this stack.
     *
     * It was dropped on either the stacks header or the top, right, bottom or left bit of the content area
     * (which one of those is stored in this._dropSegment). Now, if the user has dropped on the header the case
     * is relatively clear: We add the item to the existing stack... job done (might be good to have
     * tab reordering at some point, but lets not sweat it right now)
     *
     * If the item was dropped on the content part things are a bit more complicated. If it was dropped on either the
     * top or bottom region we need to create a new column and place the items accordingly.
     * Unless, of course if the stack is already within a column... in which case we want
     * to add the newly created item to the existing column...
     * either prepend or append it, depending on wether its top or bottom.
     *
     * Same thing for rows and left / right drop segments... so in total there are 9 things that can potentially happen
     * (left, top, right, bottom) * is child of the right parent (row, column) + header drop
     *
     * @param    {lm.item} contentItem
     *
     * @returns {void}
     */

  }, {
    key: "_$onDrop",
    value: function _$onDrop(contentItem) {
      /*
       * The item was dropped on the header area. Just add it as a child of this stack and
       * get the hell out of this logic
       */
      if (this._dropSegment === 'header') {
        this._resetHeaderDropZone();

        this.addChild(contentItem, this._dropIndex);
        return;
      }
      /*
       * The stack is empty. Let's just add the element.
       */


      if (this._dropSegment === 'body') {
        this.addChild(contentItem);
        return;
      }
      /*
       * The item was dropped on the top-, left-, bottom- or right- part of the content. Let's
       * aggregate some conditions to make the if statements later on more readable
       */


      var isVertical = this._dropSegment === 'top' || this._dropSegment === 'bottom',
          isHorizontal = this._dropSegment === 'left' || this._dropSegment === 'right',
          insertBefore = this._dropSegment === 'top' || this._dropSegment === 'left',
          hasCorrectParent = isVertical && this.parent.isColumn || isHorizontal && this.parent.isRow,
          type = isVertical ? 'column' : 'row',
          dimension = isVertical ? 'height' : 'width',
          index,
          stack,
          rowOrColumn;
      /*
       * The content item can be either a component or a stack. If it is a component, wrap it into a stack
       */

      if (contentItem.isComponent) {
        stack = this.layoutManager.createContentItem({
          type: 'stack',
          header: contentItem.config.header || {}
        }, this);

        stack._$init();

        stack.addChild(contentItem);
        contentItem = stack;
      }
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
      /*
       * If the item is dropped on top or bottom of a column or left and right of a row, it's already
       * layd out in the correct way. Just add it as a child
       */


      if (hasCorrectParent) {
        index = Object(_utils_utils__WEBPACK_IMPORTED_MODULE_3__["indexOf"])(this, this.parent.contentItems);
        this.parent.addChild(contentItem, insertBefore ? index : index + 1, true);
        this.config[dimension] *= 0.5;
        contentItem.config[dimension] = this.config[dimension];
        this.parent.callDownwards('setSize');
        /*
         * This handles items that are dropped on top or bottom of a row or left / right of a column. We need
         * to create the appropriate contentItem for them to live in
         */
      } else {
        type = isVertical ? 'column' : 'row';
        rowOrColumn = this.layoutManager.createContentItem({
          type: type
        }, this);
        this.parent.replaceChild(this, rowOrColumn);
        rowOrColumn.addChild(contentItem, insertBefore ? 0 : undefined, true);
        rowOrColumn.addChild(this, insertBefore ? undefined : 0, true);
        this.config[dimension] = 50;
        contentItem.config[dimension] = 50;
        rowOrColumn.callDownwards('setSize');
      }

      this.parent._validateDocking();
    }
    /**
     * If the user hovers above the header part of the stack, indicate drop positions for tabs.
     * otherwise indicate which segment of the body the dragged item would be dropped on
     *
     * @param    {Int} x Absolute Screen X
     * @param    {Int} y Absolute Screen Y
     *
     * @returns {void}
     */

  }, {
    key: "_$highlightDropZone",
    value: function _$highlightDropZone(x, y) {
      var segment, area;

      for (segment in this._contentAreaDimensions) {
        area = this._contentAreaDimensions[segment].hoverArea;

        if (area.x1 < x && area.x2 > x && area.y1 < y && area.y2 > y) {
          if (segment === 'header') {
            this._dropSegment = 'header';

            this._highlightHeaderDropZone(this._sided ? y : x);
          } else {
            this._resetHeaderDropZone();

            this._highlightBodyDropZone(segment);
          }

          return;
        }
      }
    }
  }, {
    key: "_$getArea",
    value: function _$getArea() {
      if (this.element.css('display') === 'none') {
        return null;
      }

      var getArea = _items_AbstractContentItem__WEBPACK_IMPORTED_MODULE_0__["default"].prototype._$getArea,
          headerArea = getArea.call(this, this.header.element),
          contentArea = getArea.call(this, this.childElementContainer),
          contentWidth = contentArea.x2 - contentArea.x1,
          contentHeight = contentArea.y2 - contentArea.y1;
      this._contentAreaDimensions = {
        header: {
          hoverArea: {
            x1: headerArea.x1,
            y1: headerArea.y1,
            x2: headerArea.x2,
            y2: headerArea.y2
          },
          highlightArea: {
            x1: headerArea.x1,
            y1: headerArea.y1,
            x2: headerArea.x2,
            y2: headerArea.y2
          }
        }
      };
      /**
       * If this Stack is a parent to rows, columns or other stacks only its
       * header is a valid dropzone.
       */

      if (this._activeContentItem && this._activeContentItem.isComponent === false) {
        return headerArea;
      }
      /**
       * Highlight the entire body if the stack is empty
       */


      if (this.contentItems.length === 0) {
        this._contentAreaDimensions.body = {
          hoverArea: {
            x1: contentArea.x1,
            y1: contentArea.y1,
            x2: contentArea.x2,
            y2: contentArea.y2
          },
          highlightArea: {
            x1: contentArea.x1,
            y1: contentArea.y1,
            x2: contentArea.x2,
            y2: contentArea.y2
          }
        };
        return getArea.call(this, this.element);
      }

      this._contentAreaDimensions.left = {
        hoverArea: {
          x1: contentArea.x1,
          y1: contentArea.y1,
          x2: contentArea.x1 + contentWidth * 0.25,
          y2: contentArea.y2
        },
        highlightArea: {
          x1: contentArea.x1,
          y1: contentArea.y1,
          x2: contentArea.x1 + contentWidth * 0.5,
          y2: contentArea.y2
        }
      };
      this._contentAreaDimensions.top = {
        hoverArea: {
          x1: contentArea.x1 + contentWidth * 0.25,
          y1: contentArea.y1,
          x2: contentArea.x1 + contentWidth * 0.75,
          y2: contentArea.y1 + contentHeight * 0.5
        },
        highlightArea: {
          x1: contentArea.x1,
          y1: contentArea.y1,
          x2: contentArea.x2,
          y2: contentArea.y1 + contentHeight * 0.5
        }
      };
      this._contentAreaDimensions.right = {
        hoverArea: {
          x1: contentArea.x1 + contentWidth * 0.75,
          y1: contentArea.y1,
          x2: contentArea.x2,
          y2: contentArea.y2
        },
        highlightArea: {
          x1: contentArea.x1 + contentWidth * 0.5,
          y1: contentArea.y1,
          x2: contentArea.x2,
          y2: contentArea.y2
        }
      };
      this._contentAreaDimensions.bottom = {
        hoverArea: {
          x1: contentArea.x1 + contentWidth * 0.25,
          y1: contentArea.y1 + contentHeight * 0.5,
          x2: contentArea.x1 + contentWidth * 0.75,
          y2: contentArea.y2
        },
        highlightArea: {
          x1: contentArea.x1,
          y1: contentArea.y1 + contentHeight * 0.5,
          x2: contentArea.x2,
          y2: contentArea.y2
        }
      };
      return getArea.call(this, this.element);
    }
  }, {
    key: "_highlightHeaderDropZone",
    value: function _highlightHeaderDropZone(x) {
      var i,
          tabElement,
          tabsLength = this.header.tabs.length,
          isAboveTab = false,
          tabTop,
          tabLeft,
          offset,
          placeHolderLeft,
          headerOffset,
          tabWidth,
          halfX; // Empty stack

      if (tabsLength === 0) {
        headerOffset = this.header.element.offset();
        this.layoutManager.dropTargetIndicator.highlightArea({
          x1: headerOffset.left,
          x2: headerOffset.left + 100,
          y1: headerOffset.top + this.header.element.height() - 20,
          y2: headerOffset.top + this.header.element.height()
        });
        return;
      }

      for (i = 0; i < tabsLength; i++) {
        tabElement = this.header.tabs[i].element;
        offset = tabElement.offset();

        if (this._sided) {
          tabLeft = offset.top;
          tabTop = offset.left;
          tabWidth = tabElement.height();
        } else {
          tabLeft = offset.left;
          tabTop = offset.top;
          tabWidth = tabElement.width();
        }

        if (x > tabLeft && x < tabLeft + tabWidth) {
          isAboveTab = true;
          break;
        }
      }

      if (isAboveTab === false && x < tabLeft) {
        return;
      }

      halfX = tabLeft + tabWidth / 2;

      if (x < halfX) {
        this._dropIndex = i;
        tabElement.before(this.layoutManager.tabDropPlaceholder);
      } else {
        this._dropIndex = Math.min(i + 1, tabsLength);
        tabElement.after(this.layoutManager.tabDropPlaceholder);
      }

      if (this._sided) {
        var placeHolderTop = this.layoutManager.tabDropPlaceholder.offset().top;
        this.layoutManager.dropTargetIndicator.highlightArea({
          x1: tabTop,
          x2: tabTop + tabElement.innerHeight(),
          y1: placeHolderTop,
          y2: placeHolderTop + this.layoutManager.tabDropPlaceholder.width()
        });
        return;
      }

      placeHolderLeft = this.layoutManager.tabDropPlaceholder.offset().left;
      this.layoutManager.dropTargetIndicator.highlightArea({
        x1: placeHolderLeft,
        x2: placeHolderLeft + this.layoutManager.tabDropPlaceholder.width(),
        y1: tabTop,
        y2: tabTop + tabElement.innerHeight()
      });
    }
  }, {
    key: "_resetHeaderDropZone",
    value: function _resetHeaderDropZone() {
      this.layoutManager.tabDropPlaceholder.remove();
    }
  }, {
    key: "toggleMaximise",
    value: function toggleMaximise(e) {
      if (!this.isMaximised) this.dock(false);
      _items_AbstractContentItem__WEBPACK_IMPORTED_MODULE_0__["default"].prototype.toggleMaximise.call(this, e);
    }
  }, {
    key: "_setupHeaderPosition",
    value: function _setupHeaderPosition() {
      var side = ['right', 'left', 'bottom'].indexOf(this._header.show) >= 0 && this._header.show;

      this.header.element.toggle(!!this._header.show);
      this._side = side;
      this._sided = ['right', 'left'].indexOf(this._side) >= 0;
      this.element.removeClass('lm_left lm_right lm_bottom');
      if (this._side) this.element.addClass('lm_' + this._side);

      if (this.element.find('.lm_header').length && this.childElementContainer) {
        var headerPosition = ['right', 'bottom'].indexOf(this._side) >= 0 ? 'before' : 'after';
        this.header.element[headerPosition](this.childElementContainer);
        this.callDownwards('setSize');
      }
    }
  }, {
    key: "_highlightBodyDropZone",
    value: function _highlightBodyDropZone(segment) {
      var highlightArea = this._contentAreaDimensions[segment].highlightArea;
      this.layoutManager.dropTargetIndicator.highlightArea(highlightArea);
      this._dropSegment = segment;
    }
  }]);

  return Stack;
}(_items_AbstractContentItem__WEBPACK_IMPORTED_MODULE_0__["default"]);



/***/ }),

/***/ "./src/js_es6/utils/BubblingEvent.js":
/*!*******************************************!*\
  !*** ./src/js_es6/utils/BubblingEvent.js ***!
  \*******************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "default", function() { return BubblingEvent; });
function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

var BubblingEvent = /*#__PURE__*/function () {
  function BubblingEvent(name, origin) {
    _classCallCheck(this, BubblingEvent);

    this.name = name;
    this.origin = origin;
    this.isPropagationStopped = false;
  }

  _createClass(BubblingEvent, [{
    key: "stopPropagation",
    value: function stopPropagation() {
      this.isPropagationStopped = true;
    }
  }]);

  return BubblingEvent;
}();



/***/ }),

/***/ "./src/js_es6/utils/ConfigMinifier.js":
/*!********************************************!*\
  !*** ./src/js_es6/utils/ConfigMinifier.js ***!
  \********************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "default", function() { return ConfigMinifier; });
/* harmony import */ var _utils_utils__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../utils/utils */ "./src/js_es6/utils/utils.js");
function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }


/**
 * Minifies and unminifies configs by replacing frequent keys
 * and values with one letter substitutes. Config options must
 * retain array position/index, add new options at the end.
 *
 * @constructor
 */

var ConfigMinifier = /*#__PURE__*/function () {
  function ConfigMinifier() {
    _classCallCheck(this, ConfigMinifier);

    this._keys = ['settings', 'hasHeaders', 'constrainDragToContainer', 'selectionEnabled', 'dimensions', 'borderWidth', 'minItemHeight', 'minItemWidth', 'headerHeight', 'dragProxyWidth', 'dragProxyHeight', 'labels', 'close', 'maximise', 'minimise', 'popout', 'content', 'componentName', 'componentState', 'id', 'width', 'type', 'height', 'isClosable', 'title', 'popoutWholeStack', 'openPopouts', 'parentId', 'activeItemIndex', 'reorderEnabled', 'borderGrabWidth' //Maximum 36 entries, do not cross this line!
    ];

    if (this._keys.length > 36) {
      throw new Error('Too many keys in config minifier map');
    }

    this._values = [true, false, 'row', 'column', 'stack', 'component', 'close', 'maximise', 'minimise', 'open in new window'];
  }
  /**
   * Takes a GoldenLayout configuration object and
   * replaces its keys and values recursively with
   * one letter counterparts
   *
   * @param   {Object} config A GoldenLayout config object
   *
   * @returns {Object} minified config
   */


  _createClass(ConfigMinifier, [{
    key: "minifyConfig",
    value: function minifyConfig(config) {
      var min = {};

      this._nextLevel(config, min, '_min');

      return min;
    }
    /**
     * Takes a configuration Object that was previously minified
     * using minifyConfig and returns its original version
     *
     * @param   {Object} minifiedConfig
     *
     * @returns {Object} the original configuration
     */

  }, {
    key: "unminifyConfig",
    value: function unminifyConfig(minifiedConfig) {
      var orig = {};

      this._nextLevel(minifiedConfig, orig, '_max');

      return orig;
    }
    /**
     * Recursive function, called for every level of the config structure
     *
     * @param   {Array|Object} orig
     * @param   {Array|Object} min
     * @param    {String} translationFn
     *
     * @returns {void}
     */

  }, {
    key: "_nextLevel",
    value: function _nextLevel(from, to, translationFn) {
      var key, minKey;

      for (key in from) {
        /**
         * For in returns array indices as keys, so let's cast them to numbers
         */
        if (from instanceof Array) key = parseInt(key, 10);
        /**
         * In case something has extended Object prototypes
         */

        if (!from.hasOwnProperty(key)) continue;
        /**
         * Translate the key to a one letter substitute
         */

        minKey = this[translationFn](key, this._keys);
        /**
         * For Arrays and Objects, create a new Array/Object
         * on the minified object and recurse into it
         */

        if (_typeof(from[key]) === 'object') {
          to[minKey] = from[key] instanceof Array ? [] : {};

          this._nextLevel(from[key], to[minKey], translationFn);
          /**
           * For primitive values (Strings, Numbers, Boolean etc.)
           * minify the value
           */

        } else {
          to[minKey] = this[translationFn](from[key], this._values);
        }
      }
    }
    /**
     * Minifies value based on a dictionary
     *
     * @param   {String|Boolean} value
     * @param   {Array<String|Boolean>} dictionary
     *
     * @returns {String} The minified version
     */

  }, {
    key: "_min",
    value: function _min(value, dictionary) {
      /**
       * If a value actually is a single character, prefix it
       * with ___ to avoid mistaking it for a minification code
       */
      if (typeof value === 'string' && value.length === 1) {
        return '___' + value;
      }

      var index = Object(_utils_utils__WEBPACK_IMPORTED_MODULE_0__["indexOf"])(value, dictionary);
      /**
       * value not found in the dictionary, return it unmodified
       */

      if (index === -1) {
        return value;
        /**
         * value found in dictionary, return its base36 counterpart
         */
      } else {
        return index.toString(36);
      }
    }
  }, {
    key: "_max",
    value: function _max(value, dictionary) {
      /**
       * value is a single character. Assume that it's a translation
       * and return the original value from the dictionary
       */
      if (typeof value === 'string' && value.length === 1) {
        return dictionary[parseInt(value, 36)];
      }
      /**
       * value originally was a single character and was prefixed with ___
       * to avoid mistaking it for a translation. Remove the prefix
       * and return the original character
       */


      if (typeof value === 'string' && value.substr(0, 3) === '___') {
        return value[3];
      }
      /**
       * value was not minified
       */


      return value;
    }
  }]);

  return ConfigMinifier;
}();



/***/ }),

/***/ "./src/js_es6/utils/DragListener.js":
/*!******************************************!*\
  !*** ./src/js_es6/utils/DragListener.js ***!
  \******************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "default", function() { return DragListener; });
/* harmony import */ var _utils_EventEmitter__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../utils/EventEmitter */ "./src/js_es6/utils/EventEmitter.js");
/* harmony import */ var _utils_utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../utils/utils */ "./src/js_es6/utils/utils.js");
/* harmony import */ var jquery__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! jquery */ "jquery");
/* harmony import */ var jquery__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(jquery__WEBPACK_IMPORTED_MODULE_2__);
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





var DragListener = /*#__PURE__*/function (_EventEmitter) {
  _inherits(DragListener, _EventEmitter);

  var _super = _createSuper(DragListener);

  function DragListener(eElement, nButtonCode) {
    var _this;

    _classCallCheck(this, DragListener);

    _this = _super.call(this);
    _this._timeout = null;
    _this._eElement = jquery__WEBPACK_IMPORTED_MODULE_2___default()(eElement);
    _this._oDocument = jquery__WEBPACK_IMPORTED_MODULE_2___default()(document);
    _this._eBody = jquery__WEBPACK_IMPORTED_MODULE_2___default()(document.body);
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
    _this._fMove = Object(_utils_utils__WEBPACK_IMPORTED_MODULE_1__["fnBind"])(_this.onMouseMove, _assertThisInitialized(_this));
    _this._fUp = Object(_utils_utils__WEBPACK_IMPORTED_MODULE_1__["fnBind"])(_this.onMouseUp, _assertThisInitialized(_this));
    _this._fDown = Object(_utils_utils__WEBPACK_IMPORTED_MODULE_1__["fnBind"])(_this.onMouseDown, _assertThisInitialized(_this));

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

        this._timeout = setTimeout(Object(_utils_utils__WEBPACK_IMPORTED_MODULE_1__["fnBind"])(this._startDrag, this), this._nDelay);
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
      event = Object(_utils_utils__WEBPACK_IMPORTED_MODULE_1__["getTouchEvent"])(event);
      return {
        x: event.pageX,
        y: event.pageY
      };
    }
  }]);

  return DragListener;
}(_utils_EventEmitter__WEBPACK_IMPORTED_MODULE_0__["default"]);



/***/ }),

/***/ "./src/js_es6/utils/EventEmitter.js":
/*!******************************************!*\
  !*** ./src/js_es6/utils/EventEmitter.js ***!
  \******************************************/
/*! exports provided: ALL_EVENT, default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "ALL_EVENT", function() { return ALL_EVENT; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "default", function() { return EventEmitter; });
/* harmony import */ var _utils_utils__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../utils/utils */ "./src/js_es6/utils/utils.js");
function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }


/**
 * The name of the event that's triggered for every other event
 *
 * usage
 *
 * myEmitter.on( EventEmitter.ALL_EVENT, function( eventName, argsArray ){
 *  //do stuff
 * });
 *
 * @type {String}
 */

var ALL_EVENT = '__all';
/**
 * A generic and very fast EventEmitter
 * implementation. On top of emitting the
 * actual event it emits an
 *
 * EventEmitter.ALL_EVENT
 *
 * event for every event triggered. This allows
 * to hook into it and proxy events forwards
 *
 * @constructor
 */

var EventEmitter = function EventEmitter() {
  _classCallCheck(this, EventEmitter);

  this._mSubscriptions = {};
  this._mSubscriptions[ALL_EVENT] = [];
  /**
   * Listen for events
   *
   * @param   {String} sEvent    The name of the event to listen to
   * @param   {Function} fCallback The callback to execute when the event occurs
   * @param   {[Object]} oContext The value of the this pointer within the callback function
   *
   * @returns {void}
   */

  this.on = function (sEvent, fCallback, oContext) {
    if (!Object(_utils_utils__WEBPACK_IMPORTED_MODULE_0__["isFunction"])(fCallback)) {
      throw new Error('Tried to listen to event ' + sEvent + ' with non-function callback ' + fCallback);
    }

    if (!this._mSubscriptions[sEvent]) {
      this._mSubscriptions[sEvent] = [];
    }

    this._mSubscriptions[sEvent].push({
      fn: fCallback,
      ctx: oContext
    });
  };
  /**
   * Emit an event and notify listeners
   *
   * @param   {String} sEvent The name of the event
   * @param    {Mixed}  various additional arguments that will be passed to the listener
   *
   * @returns {void}
   */


  this.emit = function (sEvent) {
    var i, ctx, args;
    args = Array.prototype.slice.call(arguments, 1);
    var subs = this._mSubscriptions[sEvent];

    if (subs) {
      subs = subs.slice();

      for (i = 0; i < subs.length; i++) {
        ctx = subs[i].ctx || {};
        subs[i].fn.apply(ctx, args);
      }
    }

    args.unshift(sEvent);

    var allEventSubs = this._mSubscriptions[ALL_EVENT].slice();

    for (i = 0; i < allEventSubs.length; i++) {
      ctx = allEventSubs[i].ctx || {};
      allEventSubs[i].fn.apply(ctx, args);
    }
  };
  /**
   * Removes a listener for an event, or all listeners if no callback and context is provided.
   *
   * @param   {String} sEvent    The name of the event
   * @param   {Function} fCallback The previously registered callback method (optional)
   * @param   {Object} oContext  The previously registered context (optional)
   *
   * @returns {void}
   */


  this.unbind = function (sEvent, fCallback, oContext) {
    if (!this._mSubscriptions[sEvent]) {
      throw new Error('No subscribtions to unsubscribe for event ' + sEvent);
    }

    var i,
        bUnbound = false;

    for (i = 0; i < this._mSubscriptions[sEvent].length; i++) {
      if ((!fCallback || this._mSubscriptions[sEvent][i].fn === fCallback) && (!oContext || oContext === this._mSubscriptions[sEvent][i].ctx)) {
        this._mSubscriptions[sEvent].splice(i, 1);

        bUnbound = true;
      }
    }

    if (bUnbound === false) {
      throw new Error('Nothing to unbind for ' + sEvent);
    }
  };
  /**
   * Alias for unbind
   */


  this.off = this.unbind;
  /**
   * Alias for emit
   */

  this.trigger = this.emit;
};



/***/ }),

/***/ "./src/js_es6/utils/EventHub.js":
/*!**************************************!*\
  !*** ./src/js_es6/utils/EventHub.js ***!
  \**************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "default", function() { return EventHub; });
/* harmony import */ var _utils_EventEmitter__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../utils/EventEmitter */ "./src/js_es6/utils/EventEmitter.js");
/* harmony import */ var _utils_utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../utils/utils */ "./src/js_es6/utils/utils.js");
/* harmony import */ var jquery__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! jquery */ "jquery");
/* harmony import */ var jquery__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(jquery__WEBPACK_IMPORTED_MODULE_2__);
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

    _this.on(_utils_EventEmitter__WEBPACK_IMPORTED_MODULE_0__["ALL_EVENT"], Object(_utils_utils__WEBPACK_IMPORTED_MODULE_1__["fnBind"])(_this._onEventFromThis, _assertThisInitialized(_this)));

    _this._boundOnEventFromChild = Object(_utils_utils__WEBPACK_IMPORTED_MODULE_1__["fnBind"])(_this._onEventFromChild, _assertThisInitialized(_this));
    jquery__WEBPACK_IMPORTED_MODULE_2___default()(window).on('gl_child_event', _this._boundOnEventFromChild);
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
      jquery__WEBPACK_IMPORTED_MODULE_2___default()(window).off('gl_child_event', this._boundOnEventFromChild);
    }
  }]);

  return EventHub;
}(_utils_EventEmitter__WEBPACK_IMPORTED_MODULE_0__["default"]);



/***/ }),

/***/ "./src/js_es6/utils/ReactComponentHandler.js":
/*!***************************************************!*\
  !*** ./src/js_es6/utils/ReactComponentHandler.js ***!
  \***************************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "default", function() { return ReactComponentHandler; });
/* harmony import */ var jquery__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! jquery */ "jquery");
/* harmony import */ var jquery__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(jquery__WEBPACK_IMPORTED_MODULE_0__);
function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }


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
      var props = jquery__WEBPACK_IMPORTED_MODULE_0___default.a.extend(defaultProps, this._container._config.props);
      return React.createElement(this._reactClass, props);
    }
  }]);

  return ReactComponentHandler;
}();



/***/ }),

/***/ "./src/js_es6/utils/utils.js":
/*!***********************************!*\
  !*** ./src/js_es6/utils/utils.js ***!
  \***********************************/
/*! exports provided: F, getTouchEvent, extend, createObject, objectKeys, getHashValue, getQueryStringParam, copy, animFrame, indexOf, isFunction, fnBind, removeFromArray, now, getUniqueId, filterXss, stripTags */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "F", function() { return F; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "getTouchEvent", function() { return getTouchEvent; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "extend", function() { return extend; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "createObject", function() { return createObject; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "objectKeys", function() { return objectKeys; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "getHashValue", function() { return getHashValue; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "getQueryStringParam", function() { return getQueryStringParam; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "copy", function() { return copy; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "animFrame", function() { return animFrame; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "indexOf", function() { return indexOf; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "isFunction", function() { return isFunction; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "fnBind", function() { return fnBind; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "removeFromArray", function() { return removeFromArray; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "now", function() { return now; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "getUniqueId", function() { return getUniqueId; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "filterXss", function() { return filterXss; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "stripTags", function() { return stripTags; });
/* harmony import */ var jquery__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! jquery */ "jquery");
/* harmony import */ var jquery__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(jquery__WEBPACK_IMPORTED_MODULE_0__);
function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }


function F() {}
function getTouchEvent(event) {
  if (jquery__WEBPACK_IMPORTED_MODULE_0___default.a.zepto) {
    return event.touches ? event.targetTouches[0] : event;
  } else {
    return event.originalEvent && event.originalEvent.touches ? event.originalEvent.touches[0] : event;
  }
}
function extend(subClass, superClass) {
  subClass.prototype = createObject(superClass.prototype);
  subClass.prototype.contructor = subClass;
}
function createObject(prototype) {
  if (typeof Object.create === 'function') {
    return Object.create(prototype);
  } else {
    F.prototype = prototype;
    return new F();
  }
}
function objectKeys(object) {
  var keys, key;

  if (typeof Object.keys === 'function') {
    return Object.keys(object);
  } else {
    keys = [];

    for (key in object) {
      keys.push(key);
    }

    return keys;
  }
}
function getHashValue(key) {
  var matches = location.hash.match(new RegExp(key + '=([^&]*)'));
  return matches ? matches[1] : null;
}
function getQueryStringParam(param) {
  if (window.location.hash) {
    return getHashValue(param);
  } else if (!window.location.search) {
    return null;
  }

  var keyValuePairs = window.location.search.substr(1).split('&'),
      params = {},
      pair,
      i;

  for (i = 0; i < keyValuePairs.length; i++) {
    pair = keyValuePairs[i].split('=');
    params[pair[0]] = pair[1];
  }

  return params[param] || null;
}
function copy(target, source) {
  for (var key in source) {
    target[key] = source[key];
  }

  return target;
}
/**
 * This is based on Paul Irish's shim, but looks quite odd in comparison. Why?
 * Because
 * a) it shouldn't affect the global requestAnimationFrame function
 * b) it shouldn't pass on the time that has passed
 *
 * @param   {Function} fn
 *
 * @returns {void}
 */

function animFrame(fn) {
  return (window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || function (callback) {
    window.setTimeout(callback, 1000 / 60);
  })(function () {
    fn();
  });
}
function indexOf(needle, haystack) {
  if (!(haystack instanceof Array)) {
    throw new Error('Haystack is not an Array');
  }

  if (haystack.indexOf) {
    return haystack.indexOf(needle);
  } else {
    for (var i = 0; i < haystack.length; i++) {
      if (haystack[i] === needle) {
        return i;
      }
    }

    return -1;
  }
}
var isFunction =  true && (typeof Int8Array === "undefined" ? "undefined" : _typeof(Int8Array)) != 'object' ? function isFunction(obj) {
  return typeof obj == 'function' || false;
} : function isFunction(obj) {
  return toString.call(obj) === '[object Function]';
};
function fnBind(fn, context, boundArgs) {
  if (Function.prototype.bind !== undefined) {
    return Function.prototype.bind.apply(fn, [context].concat(boundArgs || []));
  }

  var bound = function bound() {
    // Join the already applied arguments to the now called ones (after converting to an array again).
    var args = (boundArgs || []).concat(Array.prototype.slice.call(arguments, 0)); // If not being called as a constructor

    if (!(this instanceof bound)) {
      // return the result of the function called bound to target and partially applied.
      return fn.apply(context, args);
    } // If being called as a constructor, apply the function bound to self.


    fn.apply(this, args);
  }; // Attach the prototype of the function to our newly created function.


  bound.prototype = fn.prototype;
  return bound;
}
function removeFromArray(item, array) {
  var index = indexOf(item, array);

  if (index === -1) {
    throw new Error('Can\'t remove item from array. Item is not in the array');
  }

  array.splice(index, 1);
}
function now() {
  if (typeof Date.now === 'function') {
    return Date.now();
  } else {
    return new Date().getTime();
  }
}
function getUniqueId() {
  return (Math.random() * 1000000000000000).toString(36).replace('.', '');
}
/**
 * A basic XSS filter. It is ultimately up to the
 * implementing developer to make sure their particular
 * applications and usecases are save from cross site scripting attacks
 *
 * @param   {String} input
 * @param    {Boolean} keepTags
 *
 * @returns {String} filtered input
 */

function filterXss(input, keepTags) {
  var output = input.replace(/javascript/gi, 'j&#97;vascript').replace(/expression/gi, 'expr&#101;ssion').replace(/onload/gi, 'onlo&#97;d').replace(/script/gi, '&#115;cript').replace(/onerror/gi, 'on&#101;rror');

  if (keepTags === true) {
    return output;
  } else {
    return output.replace(/>/g, '&gt;').replace(/</g, '&lt;');
  }
}
/**
 * Removes html tags from a string
 *
 * @param   {String} input
 *
 * @returns {String} input without tags
 */

function stripTags(input) {
  return jquery__WEBPACK_IMPORTED_MODULE_0___default.a.trim(input.replace(/(<([^>]+)>)/ig, ''));
}

/***/ }),

/***/ "jquery":
/*!*************************************************************************************!*\
  !*** external {"commonjs":"jquery","commonjs2":"jquery","amd":"jquery","root":"$"} ***!
  \*************************************************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = __WEBPACK_EXTERNAL_MODULE_jquery__;

/***/ })

/******/ });
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly9Hb2xkZW5MYXlvdXQvd2VicGFjay91bml2ZXJzYWxNb2R1bGVEZWZpbml0aW9uIiwid2VicGFjazovL0dvbGRlbkxheW91dC93ZWJwYWNrL2Jvb3RzdHJhcCIsIndlYnBhY2s6Ly9Hb2xkZW5MYXlvdXQvLi9zcmMvaW5kZXguanMiLCJ3ZWJwYWNrOi8vR29sZGVuTGF5b3V0Ly4vc3JjL2pzX2VzNi9MYXlvdXRNYW5hZ2VyLmpzIiwid2VicGFjazovL0dvbGRlbkxheW91dC8uL3NyYy9qc19lczYvY29uZmlnL0l0ZW1EZWZhdWx0Q29uZmlnLmpzIiwid2VicGFjazovL0dvbGRlbkxheW91dC8uL3NyYy9qc19lczYvY29uZmlnL2RlZmF1bHRDb25maWcuanMiLCJ3ZWJwYWNrOi8vR29sZGVuTGF5b3V0Ly4vc3JjL2pzX2VzNi9jb250YWluZXIvSXRlbUNvbnRhaW5lci5qcyIsIndlYnBhY2s6Ly9Hb2xkZW5MYXlvdXQvLi9zcmMvanNfZXM2L2NvbnRyb2xzL0Jyb3dzZXJQb3BvdXQuanMiLCJ3ZWJwYWNrOi8vR29sZGVuTGF5b3V0Ly4vc3JjL2pzX2VzNi9jb250cm9scy9EcmFnUHJveHkuanMiLCJ3ZWJwYWNrOi8vR29sZGVuTGF5b3V0Ly4vc3JjL2pzX2VzNi9jb250cm9scy9EcmFnU291cmNlLmpzIiwid2VicGFjazovL0dvbGRlbkxheW91dC8uL3NyYy9qc19lczYvY29udHJvbHMvRHJvcFRhcmdldEluZGljYXRvci5qcyIsIndlYnBhY2s6Ly9Hb2xkZW5MYXlvdXQvLi9zcmMvanNfZXM2L2NvbnRyb2xzL0hlYWRlci5qcyIsIndlYnBhY2s6Ly9Hb2xkZW5MYXlvdXQvLi9zcmMvanNfZXM2L2NvbnRyb2xzL0hlYWRlckJ1dHRvbi5qcyIsIndlYnBhY2s6Ly9Hb2xkZW5MYXlvdXQvLi9zcmMvanNfZXM2L2NvbnRyb2xzL1NwbGl0dGVyLmpzIiwid2VicGFjazovL0dvbGRlbkxheW91dC8uL3NyYy9qc19lczYvY29udHJvbHMvVGFiLmpzIiwid2VicGFjazovL0dvbGRlbkxheW91dC8uL3NyYy9qc19lczYvY29udHJvbHMvVHJhbnNpdGlvbkluZGljYXRvci5qcyIsIndlYnBhY2s6Ly9Hb2xkZW5MYXlvdXQvLi9zcmMvanNfZXM2L2Vycm9ycy9Db25maWd1cmF0aW9uRXJyb3IuanMiLCJ3ZWJwYWNrOi8vR29sZGVuTGF5b3V0Ly4vc3JjL2pzX2VzNi9pdGVtcy9BYnN0cmFjdENvbnRlbnRJdGVtLmpzIiwid2VicGFjazovL0dvbGRlbkxheW91dC8uL3NyYy9qc19lczYvaXRlbXMvQ29tcG9uZW50LmpzIiwid2VicGFjazovL0dvbGRlbkxheW91dC8uL3NyYy9qc19lczYvaXRlbXMvUm9vdC5qcyIsIndlYnBhY2s6Ly9Hb2xkZW5MYXlvdXQvLi9zcmMvanNfZXM2L2l0ZW1zL1Jvd09yQ29sdW1uLmpzIiwid2VicGFjazovL0dvbGRlbkxheW91dC8uL3NyYy9qc19lczYvaXRlbXMvU3RhY2suanMiLCJ3ZWJwYWNrOi8vR29sZGVuTGF5b3V0Ly4vc3JjL2pzX2VzNi91dGlscy9CdWJibGluZ0V2ZW50LmpzIiwid2VicGFjazovL0dvbGRlbkxheW91dC8uL3NyYy9qc19lczYvdXRpbHMvQ29uZmlnTWluaWZpZXIuanMiLCJ3ZWJwYWNrOi8vR29sZGVuTGF5b3V0Ly4vc3JjL2pzX2VzNi91dGlscy9EcmFnTGlzdGVuZXIuanMiLCJ3ZWJwYWNrOi8vR29sZGVuTGF5b3V0Ly4vc3JjL2pzX2VzNi91dGlscy9FdmVudEVtaXR0ZXIuanMiLCJ3ZWJwYWNrOi8vR29sZGVuTGF5b3V0Ly4vc3JjL2pzX2VzNi91dGlscy9FdmVudEh1Yi5qcyIsIndlYnBhY2s6Ly9Hb2xkZW5MYXlvdXQvLi9zcmMvanNfZXM2L3V0aWxzL1JlYWN0Q29tcG9uZW50SGFuZGxlci5qcyIsIndlYnBhY2s6Ly9Hb2xkZW5MYXlvdXQvLi9zcmMvanNfZXM2L3V0aWxzL3V0aWxzLmpzIiwid2VicGFjazovL0dvbGRlbkxheW91dC9leHRlcm5hbCB7XCJjb21tb25qc1wiOlwianF1ZXJ5XCIsXCJjb21tb25qczJcIjpcImpxdWVyeVwiLFwiYW1kXCI6XCJqcXVlcnlcIixcInJvb3RcIjpcIiRcIn0iXSwibmFtZXMiOlsiUkVBQ1RfQ09NUE9ORU5UX0lEIiwiTGF5b3V0TWFuYWdlciIsImNvbmZpZyIsImNvbnRhaW5lciIsImlzSW5pdGlhbGlzZWQiLCJfaXNGdWxsUGFnZSIsIl9yZXNpemVUaW1lb3V0SWQiLCJfY29tcG9uZW50cyIsIl9pdGVtQXJlYXMiLCJfcmVzaXplRnVuY3Rpb24iLCJmbkJpbmQiLCJfb25SZXNpemUiLCJfdW5sb2FkRnVuY3Rpb24iLCJfb25VbmxvYWQiLCJfbWF4aW1pc2VkSXRlbSIsIl9tYXhpbWlzZVBsYWNlaG9sZGVyIiwiJCIsIl9jcmVhdGlvblRpbWVvdXRQYXNzZWQiLCJfc3ViV2luZG93c0NyZWF0ZWQiLCJfZHJhZ1NvdXJjZXMiLCJfdXBkYXRpbmdDb2x1bW5zUmVzcG9uc2l2ZSIsIl9maXJzdExvYWQiLCJ3aWR0aCIsImhlaWdodCIsInJvb3QiLCJvcGVuUG9wb3V0cyIsInNlbGVjdGVkSXRlbSIsImlzU3ViV2luZG93IiwiZXZlbnRIdWIiLCJFdmVudEh1YiIsIl9jcmVhdGVDb25maWciLCJkcm9wVGFyZ2V0SW5kaWNhdG9yIiwidHJhbnNpdGlvbkluZGljYXRvciIsInRhYkRyb3BQbGFjZWhvbGRlciIsImNzcyIsIl90eXBlVG9JdGVtIiwiUm93T3JDb2x1bW4iLCJTdGFjayIsIkNvbXBvbmVudCIsIkNvbmZpZ01pbmlmaWVyIiwibWluaWZ5Q29uZmlnIiwidW5taW5pZnlDb25maWciLCJuYW1lIiwiY29uc3RydWN0b3IiLCJFcnJvciIsInVuZGVmaW5lZCIsImNhbGxiYWNrIiwiX2NvbXBvbmVudEZ1bmN0aW9uIiwiY29uc29sZSIsIndhcm4iLCJuZXh0IiwiaSIsIkFic3RyYWN0Q29udGVudEl0ZW0iLCJzZXR0aW5ncyIsImNvcHkiLCJkaW1lbnNpb25zIiwibGFiZWxzIiwiY29udGVudCIsImNvbmZpZ05vZGUiLCJpdGVtIiwia2V5IiwiY29udGVudEl0ZW1zIiwibGVuZ3RoIiwiXyRyZWNvbmNpbGVQb3BvdXRXaW5kb3dzIiwicHVzaCIsInRvQ29uZmlnIiwibWF4aW1pc2VkSXRlbUlkIiwiZ2V0Q29tcG9uZW50TmFtZUZyb21Db25maWciLCJjb21wb25lbnRUb1VzZSIsIkNvbmZpZ3VyYXRpb25FcnJvciIsIl9jcmVhdGVTdWJXaW5kb3dzIiwiZG9jdW1lbnQiLCJyZWFkeVN0YXRlIiwiYm9keSIsInJlYWR5IiwiaW5pdCIsInNldFRpbWVvdXQiLCJfYWRqdXN0VG9XaW5kb3dNb2RlIiwiX3NldENvbnRhaW5lciIsIkRyb3BUYXJnZXRJbmRpY2F0b3IiLCJUcmFuc2l0aW9uSW5kaWNhdG9yIiwidXBkYXRlU2l6ZSIsIl9jcmVhdGUiLCJfYmluZEV2ZW50cyIsIl9hZGp1c3RDb2x1bW5zUmVzcG9uc2l2ZSIsImVtaXQiLCJhcmd1bWVudHMiLCJjYWxsRG93bndhcmRzIiwiZWxlbWVudCIsIndpbmRvdyIsIm9mZiIsInJlbW92ZSIsImRlc3Ryb3kiLCJmb3JFYWNoIiwiZHJhZ1NvdXJjZSIsIl9kcmFnTGlzdGVuZXIiLCJfZWxlbWVudCIsIl9pdGVtQ29uZmlnIiwidHlwZSIsImNvbXBvbmVudE5hbWUiLCJpc1JlYWN0Q29uZmlnIiwiY29tcG9uZW50IiwicGFyZW50IiwidHlwZUVycm9yTXNnIiwiY29udGVudEl0ZW0iLCJvYmplY3RLZXlzIiwiam9pbiIsIlJvb3QiLCJjb25maWdPckNvbnRlbnRJdGVtIiwicGFyZW50SWQiLCJpbmRleEluUGFyZW50IiwiaXNJdGVtIiwic2VsZiIsIndpbmRvd0xlZnQiLCJ3aW5kb3dUb3AiLCJvZmZzZXQiLCJjaGlsZCIsImJyb3dzZXJQb3BvdXQiLCJnZXRVbmlxdWVJZCIsImlzUm9vdCIsImFkZElkIiwiaXNOYU4iLCJpbmRleE9mIiwiQXJyYXkiLCJzY3JlZW5YIiwic2NyZWVuTGVmdCIsInNjcmVlblkiLCJzY3JlZW5Ub3AiLCJsZWZ0IiwidG9wIiwiQnJvd3NlclBvcG91dCIsIm9uIiwiaXRlbUNvbmZpZyIsImNvbnN0cmFpbkRyYWdUb0NvbnRhaW5lciIsIkRyYWdTb3VyY2UiLCJsbSIsInV0aWxzIiwicmVtb3ZlRnJvbUFycmF5IiwiXyRzaWxlbnQiLCJzZWxlY3Rpb25FbmFibGVkIiwiZGVzZWxlY3QiLCJzZWxlY3QiLCJfJG1pbmltaXNlSXRlbSIsIl8kY2xlYW51cEJlZm9yZU1heGltaXNlZEl0ZW1EZXN0cm95ZWQiLCJhZGRDbGFzcyIsImFmdGVyIiwicHJlcGVuZCIsInJlbW92ZUNsYXNzIiwicmVtb3ZlSWQiLCJldmVudCIsIm9yaWdpbiIsImNsb3NlIiwieCIsInkiLCJhcmVhIiwic21hbGxlc3RTdXJmYWNlIiwiSW5maW5pdHkiLCJtYXRoaW5nQXJlYSIsIngxIiwieDIiLCJ5MSIsInkyIiwic3VyZmFjZSIsImFyZWFTaXplIiwic2lkZXMiLCJzaWRlIiwiXyRnZXRBcmVhIiwiYWxsQ29udGVudEl0ZW1zIiwiX2dldEFsbENvbnRlbnRJdGVtcyIsIl8kY3JlYXRlUm9vdEl0ZW1BcmVhcyIsImlzU3RhY2siLCJjb25jYXQiLCJoZWFkZXIiLCJfY29udGVudEFyZWFEaW1lbnNpb25zIiwiaGlnaGxpZ2h0QXJlYSIsImNvbnRlbnRJdGVtT3JDb25maWciLCJpc0Z1bmN0aW9uIiwiaXNQbGFpbk9iamVjdCIsIm5ld0NvbnRlbnRJdGVtIiwiY3JlYXRlQ29udGVudEl0ZW0iLCJnZXRXaW5kb3ciLCJjbG9zZWQiLCJhZGRDaGlsZHJlbiIsInJlc2l6ZSIsImNsZWFyVGltZW91dCIsIndpbmRvd0NvbmZpZ0tleSIsImdldFF1ZXJ5U3RyaW5nUGFyYW0iLCJsb2NhbFN0b3JhZ2UiLCJnZXRJdGVtIiwiSlNPTiIsInBhcnNlIiwicmVtb3ZlSXRlbSIsImV4dGVuZCIsImRlZmF1bHRDb25maWciLCJuZXh0Tm9kZSIsIm5vZGUiLCJoYXNIZWFkZXJzIiwiaGVhZGVySGVpZ2h0IiwicG9wSW5CdXR0b24iLCJwb3BpbiIsImNsaWNrIiwidGl0bGUiLCJzdHJpcFRhZ3MiLCJhcHBlbmQiLCJodG1sIiwib2Zmc2V0SGVpZ2h0IiwiX19nbEluc3RhbmNlIiwicG9wb3V0IiwiY3JlYXRlUG9wb3V0IiwibWFyZ2luIiwicGFkZGluZyIsIm92ZXJmbG93IiwiZXJyb3JNc2ciLCJnZXRJdGVtc0J5SWQiLCJ0b2dnbGVNYXhpbWlzZSIsImNsb3NlUG9wb3V0c09uVW5sb2FkIiwiX3VzZVJlc3BvbnNpdmVMYXlvdXQiLCJtaW5JdGVtV2lkdGgiLCJpc1JvdyIsImNvbHVtbkNvdW50IiwidG90YWxNaW5XaWR0aCIsImZpbmFsQ29sdW1uQ291bnQiLCJNYXRoIiwibWF4IiwiZmxvb3IiLCJzdGFja0NvbHVtbkNvdW50Iiwicm9vdENvbnRlbnRJdGVtIiwiZmlyc3RTdGFja0NvbnRhaW5lciIsIl9maW5kQWxsU3RhY2tDb250YWluZXJzIiwiY29sdW1uIiwiX2FkZENoaWxkQ29udGVudEl0ZW1zVG9Db250YWluZXIiLCJyZXNwb25zaXZlTW9kZSIsImFkZENoaWxkIiwicmVtb3ZlQ2hpbGQiLCJzdGFja0NvbnRhaW5lcnMiLCJfZmluZEFsbFN0YWNrQ29udGFpbmVyc1JlY3Vyc2l2ZSIsImlzQ29tcG9uZW50IiwiRXZlbnRFbWl0dGVyIiwiaXRlbURlZmF1bHRDb25maWciLCJpc0Nsb3NhYmxlIiwicmVvcmRlckVuYWJsZWQiLCJwb3BvdXRXaG9sZVN0YWNrIiwiYmxvY2tlZFBvcG91dHNUaHJvd0Vycm9yIiwic2hvd1BvcG91dEljb24iLCJzaG93TWF4aW1pc2VJY29uIiwic2hvd0Nsb3NlSWNvbiIsInRhYk92ZXJsYXBBbGxvd2FuY2UiLCJyZW9yZGVyT25UYWJNZW51Q2xpY2siLCJ0YWJDb250cm9sT2Zmc2V0IiwiYm9yZGVyV2lkdGgiLCJib3JkZXJHcmFiV2lkdGgiLCJtaW5JdGVtSGVpZ2h0IiwiZHJhZ1Byb3h5V2lkdGgiLCJkcmFnUHJveHlIZWlnaHQiLCJtYXhpbWlzZSIsIm1pbmltaXNlIiwidGFiRHJvcGRvd24iLCJJdGVtQ29udGFpbmVyIiwibGF5b3V0TWFuYWdlciIsImlzSGlkZGVuIiwiX2NvbmZpZyIsIl9jb250ZW50RWxlbWVudCIsImZpbmQiLCJoaWRlIiwic2hvdyIsInJvd09yQ29sdW1uIiwicm93T3JDb2x1bW5DaGlsZCIsInRvdGFsUGl4ZWwiLCJwZXJjZW50YWdlIiwiZGlyZWN0aW9uIiwibmV3U2l6ZSIsImRlbHRhIiwiaXNDb2x1bW4iLCJjb21wb25lbnRTdGF0ZSIsInN0YXRlIiwic2V0U3RhdGUiLCJnZXRTdGF0ZSIsImVtaXRCdWJibGluZ0V2ZW50Iiwic2V0VGl0bGUiLCJ6ZXB0byIsIm91dGVyV2lkdGgiLCJvdXRlckhlaWdodCIsIl9kaW1lbnNpb25zIiwiX3BhcmVudElkIiwiX2luZGV4SW5QYXJlbnQiLCJfbGF5b3V0TWFuYWdlciIsIl9wb3BvdXRXaW5kb3ciLCJfaWQiLCJfY3JlYXRlV2luZG93IiwiZ2V0R2xJbnN0YW5jZSIsIl8kY2xvc2VXaW5kb3ciLCJlIiwiY2hpbGRDb25maWciLCJwYXJlbnRJdGVtIiwiaW5kZXgiLCJjaGVja1JlYWR5SW50ZXJ2YWwiLCJ1cmwiLCJfY3JlYXRlVXJsIiwicmFuZG9tIiwidG9TdHJpbmciLCJvcHRpb25zIiwiX3NlcmlhbGl6ZVdpbmRvd09wdGlvbnMiLCJpbm5lcldpZHRoIiwiaW5uZXJIZWlnaHQiLCJtZW51YmFyIiwidG9vbGJhciIsImxvY2F0aW9uIiwicGVyc29uYWxiYXIiLCJyZXNpemFibGUiLCJzY3JvbGxiYXJzIiwic3RhdHVzIiwib3BlbiIsImVycm9yIiwiX3Bvc2l0aW9uV2luZG93IiwiX29uQ2xvc2UiLCJzZXRJbnRlcnZhbCIsIl9vbkluaXRpYWxpc2VkIiwiY2xlYXJJbnRlcnZhbCIsIndpbmRvd09wdGlvbnMiLCJ3aW5kb3dPcHRpb25zU3RyaW5nIiwic3RvcmFnZUtleSIsInVybFBhcnRzIiwic2V0SXRlbSIsInN0cmluZ2lmeSIsImhyZWYiLCJzcGxpdCIsIm1vdmVUbyIsImZvY3VzIiwicG9wSW4iLCJfdGVtcGxhdGUiLCJEcmFnUHJveHkiLCJkcmFnTGlzdGVuZXIiLCJvcmlnaW5hbFBhcmVudCIsIl9jb250ZW50SXRlbSIsIl9vcmlnaW5hbFBhcmVudCIsIl9hcmVhIiwiX2xhc3RWYWxpZEFyZWEiLCJfb25EcmFnIiwiX29uRHJvcCIsIl9zaWRlIiwiX3NpZGVkIiwiYXR0ciIsImNoaWxkRWxlbWVudENvbnRhaW5lciIsIl91bmRpc3BsYXlUcmVlIiwiXyRjYWxjdWxhdGVJdGVtQXJlYXMiLCJfc2V0RGltZW5zaW9ucyIsIl9taW5YIiwiX21pblkiLCJfbWF4WCIsIl9tYXhZIiwiX3dpZHRoIiwiX2hlaWdodCIsIl9zZXREcm9wUG9zaXRpb24iLCJvZmZzZXRYIiwib2Zmc2V0WSIsImdldFRvdWNoRXZlbnQiLCJwYWdlWCIsInBhZ2VZIiwiaXNXaXRoaW5Db250YWluZXIiLCJfJGhpZ2hsaWdodERyb3Bab25lIiwiX3VwZGF0ZVRyZWUiLCJfJG9uRHJvcCIsIl8kZGVzdHJveSIsInVuZGlzcGxheUNoaWxkIiwiXyRzZXRQYXJlbnQiLCJfY3JlYXRlRHJhZ0xpc3RlbmVyIiwiX3JlbW92ZURyYWdMaXN0ZW5lciIsIkRyYWdMaXN0ZW5lciIsIl9vbkRyYWdTdGFydCIsIl8kbm9ybWFsaXplQ29udGVudEl0ZW0iLCJkcmFnUHJveHkiLCJ0cmFuc2l0aW9uRWxlbWVudHMiLCJIZWFkZXIiLCJfb25IZWFkZXJDbGljayIsInRhYnNDb250YWluZXIiLCJ0YWJEcm9wZG93bkNvbnRhaW5lciIsImNvbnRyb2xzQ29udGFpbmVyIiwiX3VwZGF0ZVRhYlNpemVzIiwidGFicyIsInRhYnNNYXJrZWRGb3JSZW1vdmFsIiwiYWN0aXZlQ29udGVudEl0ZW0iLCJjbG9zZUJ1dHRvbiIsImRvY2tCdXR0b24iLCJ0YWJEcm9wZG93bkJ1dHRvbiIsImhpZGVBZGRpdGlvbmFsVGFic0Ryb3Bkb3duIiwiX2hpZGVBZGRpdGlvbmFsVGFic0Ryb3Bkb3duIiwibW91c2V1cCIsIl9sYXN0VmlzaWJsZVRhYkluZGV4IiwiX3RhYkNvbnRyb2xPZmZzZXQiLCJfY3JlYXRlQ29udHJvbHMiLCJ0YWIiLCJUYWIiLCJiZWZvcmUiLCJzcGxpY2UiLCJqIiwiaXNBY3RpdmUiLCJhY3RpdmVUYWIiLCJzZXRBY3RpdmUiLCJhY3RpdmVJdGVtSW5kZXgiLCJwb3NpdGlvbiIsInByZXZpb3VzIiwiX2hlYWRlciIsIl9kb2NrZXIiLCJkb2NrZWQiLCJfc2V0dXBIZWFkZXJQb3NpdGlvbiIsIl9jYW5EZXN0cm95IiwiX2lzQ2xvc2FibGUiLCJpc0RvY2thYmxlIiwiZG9jayIsInRvZ2dsZSIsImNsb3NlU3RhY2siLCJsYWJlbCIsIm1heGltaXNlTGFiZWwiLCJtaW5pbWlzZUxhYmVsIiwibWF4aW1pc2VCdXR0b24iLCJ0YWJEcm9wZG93bkxhYmVsIiwic2hvd1RhYkRyb3Bkb3duIiwiX3Nob3dBZGRpdGlvbmFsVGFic0Ryb3Bkb3duIiwiSGVhZGVyQnV0dG9uIiwiYnV0dG9uIiwiX2dldEhlYWRlclNldHRpbmciLCJfb25Qb3BvdXRDbGljayIsInRhcmdldCIsInNob3dUYWJNZW51Iiwic2l6ZSIsInZhbCIsImF2YWlsYWJsZVdpZHRoIiwiY3VtdWxhdGl2ZVRhYldpZHRoIiwidmlzaWJsZVRhYldpZHRoIiwidGFiRWxlbWVudCIsIm1hcmdpbkxlZnQiLCJvdmVybGFwIiwidGFiV2lkdGgiLCJ0YWJPdmVybGFwQWxsb3dhbmNlRXhjZWVkZWQiLCJhY3RpdmVJbmRleCIsInBhcnNlSW50IiwiY3NzQ2xhc3MiLCJhY3Rpb24iLCJfYWN0aW9uIiwiU3BsaXR0ZXIiLCJpc1ZlcnRpY2FsIiwiZ3JhYlNpemUiLCJfaXNWZXJ0aWNhbCIsIl9zaXplIiwiX2dyYWJTaXplIiwiX2NyZWF0ZUVsZW1lbnQiLCJjb250ZXh0IiwiZHJhZ0hhbmRsZSIsImhhbmRsZUV4Y2Vzc1NpemUiLCJoYW5kbGVFeGNlc3NQb3MiLCJ0aXRsZUVsZW1lbnQiLCJjbG9zZUVsZW1lbnQiLCJfb25UYWJDbGlja0ZuIiwiX29uVGFiQ2xpY2siLCJfb25DbG9zZUNsaWNrRm4iLCJfb25DbG9zZUNsaWNrIiwiX29uQ2xvc2VNb3VzZWRvd24iLCJpc01heGltaXNlZCIsInNldEFjdGl2ZUNvbnRlbnRJdGVtIiwic3RvcFByb3BhZ2F0aW9uIiwiX3RvRWxlbWVudCIsIl9mcm9tRGltZW5zaW9ucyIsIl90b3RhbEFuaW1hdGlvbkR1cmF0aW9uIiwiX2FuaW1hdGlvblN0YXJ0VGltZSIsImZyb21FbGVtZW50IiwidG9FbGVtZW50IiwidG9EaW1lbnNpb25zIiwiX21lYXN1cmUiLCJhbmltYXRpb25Qcm9ncmVzcyIsIm5vdyIsImN1cnJlbnRGcmFtZVN0eWxlcyIsImNzc1Byb3BlcnR5Iiwib3BhY2l0eSIsImFuaW1GcmFtZSIsIl9uZXh0QW5pbWF0aW9uRnJhbWUiLCJtZXNzYWdlIiwiX2V4dGVuZEl0ZW1Ob2RlIiwiX3BlbmRpbmdFdmVudFByb3BhZ2F0aW9ucyIsIl90aHJvdHRsZWRFdmVudHMiLCJBTExfRVZFTlQiLCJfcHJvcGFnYXRlRXZlbnQiLCJfY3JlYXRlQ29udGVudEl0ZW1zIiwiZnVuY3Rpb25OYW1lIiwiZnVuY3Rpb25Bcmd1bWVudHMiLCJib3R0b21VcCIsInNraXBTZWxmIiwiYXBwbHkiLCJrZWVwQ2hpbGQiLCJfJGluaXQiLCJvbGRDaGlsZCIsIm5ld0NoaWxkIiwiXyRkZXN0cm95T2xkQ2hpbGQiLCJwYXJlbnROb2RlIiwicmVwbGFjZUNoaWxkIiwicHJldmVudERlZmF1bHQiLCJfJG1heGltaXNlSXRlbSIsInNlbGVjdEl0ZW0iLCJpZCIsImhhc0lkIiwiZmlsdGVyIiwicmVzdWx0IiwiZ2V0SXRlbXNCeUZpbHRlciIsIl8kZ2V0SXRlbXNCeVByb3BlcnR5IiwiY29tcG9uZW50cyIsImluc3RhbmNlcyIsImluc3RhbmNlIiwidmFsdWUiLCJfY2FsbE9uQWN0aXZlQ29tcG9uZW50cyIsIm1ldGhvZE5hbWUiLCJzdGFja3MiLCJnZXRJdGVtc0J5VHlwZSIsImdldEFjdGl2ZUNvbnRlbnRJdGVtIiwic2V0U2l6ZSIsIkJ1YmJsaW5nRXZlbnQiLCJvQ29udGVudEl0ZW0iLCJpc1Byb3BhZ2F0aW9uU3RvcHBlZCIsInByb3RvdHlwZSIsInNsaWNlIiwiY2FsbCIsIl9zY2hlZHVsZUV2ZW50UHJvcGFnYXRpb25Ub0xheW91dE1hbmFnZXIiLCJfcHJvcGFnYXRlRXZlbnRUb0xheW91dE1hbmFnZXIiLCJDb21wb25lbnRDb25zdHJ1Y3RvciIsIlJlYWN0Q29tcG9uZW50SGFuZGxlciIsImdldENvbXBvbmVudCIsImNvbXBvbmVudENvbmZpZyIsIl8kc2V0U2l6ZSIsIl8kaGlkZSIsIl8kc2hvdyIsInNob3duIiwiXyRzaG93biIsImNvbnRhaW5lckVsZW1lbnQiLCJfY29udGFpbmVyRWxlbWVudCIsInN0YWNrIiwiZGltZW5zaW9uIiwiaW5zZXJ0QmVmb3JlIiwic2liYmxpbmciLCJfc3BsaXR0ZXJTaXplIiwiX3NwbGl0dGVyR3JhYlNpemUiLCJfaXNDb2x1bW4iLCJfZGltZW5zaW9uIiwiX3NwbGl0dGVyIiwiX3NwbGl0dGVyUG9zaXRpb24iLCJfc3BsaXR0ZXJNaW5Qb3NpdGlvbiIsIl9zcGxpdHRlck1heFBvc2l0aW9uIiwiXyRzdXNwZW5kUmVzaXplIiwibmV3SXRlbVNpemUiLCJpdGVtU2l6ZSIsInNwbGl0dGVyRWxlbWVudCIsIl9jcmVhdGVTcGxpdHRlciIsIl9pc0RvY2tlZCIsIl92YWxpZGF0ZURvY2tpbmciLCJ1bmRpc3BsYXllZEl0ZW1TaXplIiwic3BsaXR0ZXJJbmRleCIsImNoaWxkSXRlbSIsInJlbW92ZWRJdGVtU2l6ZSIsIl9jYWxjdWxhdGVSZWxhdGl2ZVNpemVzIiwiX3NldEFic29sdXRlU2l6ZXMiLCJtb2RlIiwiY29sbGFwc2VkIiwiaGVhZGVyU2l6ZSIsImlzRG9ja2VkIiwiYXV0b3NpZGUiLCJmaXJzdCIsImxhc3QiLCJyb3ciLCJyZXF1aXJlZCIsInJlYWxTaXplIiwidG9nZ2xlQ2xhc3MiLCJzaXplRGF0YSIsIl9jYWxjdWxhdGVBYnNvbHV0ZVNpemVzIiwiYWRkaXRpb25hbFBpeGVsIiwiaXRlbVNpemVzIiwidG90YWxXaWR0aCIsInRvdGFsSGVpZ2h0IiwidG90YWxTcGxpdHRlclNpemUiLCJ0b3RhbEFzc2lnbmVkIiwidG90YWwiLCJpdGVtc1dpdGhvdXRTZXREaW1lbnNpb24iLCJyb3VuZCIsIl9yZXNwZWN0TWluSXRlbVdpZHRoIiwiZW50cmllc092ZXJNaW4iLCJ0b3RhbE92ZXJNaW4iLCJ0b3RhbFVuZGVyTWluIiwicmVtYWluaW5nV2lkdGgiLCJyZWR1Y2VQZXJjZW50IiwicmVkdWNlZFdpZHRoIiwiYWxsRW50cmllcyIsImVudHJ5Iiwic3BsaXR0ZXIiLCJfb25TcGxpdHRlckRyYWciLCJfb25TcGxpdHRlckRyYWdTdG9wIiwiX29uU3BsaXR0ZXJEcmFnU3RhcnQiLCJjb3VudCIsInRoYXQiLCJjYW4iLCJfc2V0RG9ja2FibGUiLCJfJHNldENsb3NhYmxlIiwiYXJyIiwibWluV2lkdGgiLCJtaW5IZWlnaHQiLCJob3Jpem9udGFsIiwidmVydGljYWwiLCJpdGVtcyIsIl9nZXRJdGVtc0ZvclNwbGl0dGVyIiwibWluU2l6ZSIsImJlZm9yZU1pbkRpbSIsIl9nZXRNaW5pbXVtRGltZW5zaW9ucyIsImJlZm9yZU1pblNpemUiLCJhZnRlck1pbkRpbSIsImFmdGVyTWluU2l6ZSIsInNpemVCZWZvcmUiLCJzaXplQWZ0ZXIiLCJzcGxpdHRlclBvc2l0aW9uSW5SYW5nZSIsInRvdGFsUmVsYXRpdmVTaXplIiwiX2FjdGl2ZUNvbnRlbnRJdGVtIiwiY2ZnIiwiX2Ryb3Bab25lcyIsIl9kcm9wU2VnbWVudCIsIl9kcm9wSW5kZXgiLCJfJHZhbGlkYXRlQ2xvc2FiaWxpdHkiLCJpbml0aWFsSXRlbSIsImNyZWF0ZVRhYiIsInJlbW92ZVRhYiIsImhpZGVUYWIiLCJsZW4iLCJfcmVzZXRIZWFkZXJEcm9wWm9uZSIsImlzSG9yaXpvbnRhbCIsImhhc0NvcnJlY3RQYXJlbnQiLCJzZWdtZW50IiwiaG92ZXJBcmVhIiwiX2hpZ2hsaWdodEhlYWRlckRyb3Bab25lIiwiX2hpZ2hsaWdodEJvZHlEcm9wWm9uZSIsImdldEFyZWEiLCJoZWFkZXJBcmVhIiwiY29udGVudEFyZWEiLCJjb250ZW50V2lkdGgiLCJjb250ZW50SGVpZ2h0IiwicmlnaHQiLCJib3R0b20iLCJ0YWJzTGVuZ3RoIiwiaXNBYm92ZVRhYiIsInRhYlRvcCIsInRhYkxlZnQiLCJwbGFjZUhvbGRlckxlZnQiLCJoZWFkZXJPZmZzZXQiLCJoYWxmWCIsIm1pbiIsInBsYWNlSG9sZGVyVG9wIiwiaGVhZGVyUG9zaXRpb24iLCJfa2V5cyIsIl92YWx1ZXMiLCJfbmV4dExldmVsIiwibWluaWZpZWRDb25maWciLCJvcmlnIiwiZnJvbSIsInRvIiwidHJhbnNsYXRpb25GbiIsIm1pbktleSIsImhhc093blByb3BlcnR5IiwiZGljdGlvbmFyeSIsInN1YnN0ciIsImVFbGVtZW50IiwibkJ1dHRvbkNvZGUiLCJfdGltZW91dCIsIl9lRWxlbWVudCIsIl9vRG9jdW1lbnQiLCJfZUJvZHkiLCJfbkJ1dHRvbkNvZGUiLCJfbkRlbGF5IiwiX25EaXN0YW5jZSIsIl9uWCIsIl9uWSIsIl9uT3JpZ2luYWxYIiwiX25PcmlnaW5hbFkiLCJfYkRyYWdnaW5nIiwiX2ZNb3ZlIiwib25Nb3VzZU1vdmUiLCJfZlVwIiwib25Nb3VzZVVwIiwiX2ZEb3duIiwib25Nb3VzZURvd24iLCJ1bmJpbmQiLCJvRXZlbnQiLCJjb29yZGluYXRlcyIsIl9nZXRDb29yZGluYXRlcyIsIm9uZSIsIl9zdGFydERyYWciLCJhYnMiLCJfbVN1YnNjcmlwdGlvbnMiLCJzRXZlbnQiLCJmQ2FsbGJhY2siLCJvQ29udGV4dCIsImZuIiwiY3R4IiwiYXJncyIsInN1YnMiLCJ1bnNoaWZ0IiwiYWxsRXZlbnRTdWJzIiwiYlVuYm91bmQiLCJ0cmlnZ2VyIiwiX2RvbnRQcm9wYWdhdGVUb1BhcmVudCIsIl9jaGlsZEV2ZW50U291cmNlIiwiX29uRXZlbnRGcm9tVGhpcyIsIl9ib3VuZE9uRXZlbnRGcm9tQ2hpbGQiLCJfb25FdmVudEZyb21DaGlsZCIsIl9wcm9wYWdhdGVUb1BhcmVudCIsIl9wcm9wYWdhdGVUb0NoaWxkcmVuIiwib3JpZ2luYWxFdmVudCIsIl9fZ2wiLCJfX2dsQXJncyIsImV2ZW50TmFtZSIsImNyZWF0ZUV2ZW50Iiwib3BlbmVyIiwiaW5pdEV2ZW50IiwiY3JlYXRlRXZlbnRPYmplY3QiLCJldmVudFR5cGUiLCJkaXNwYXRjaEV2ZW50IiwiZmlyZUV2ZW50IiwiY2hpbGRHbCIsIl8kb25FdmVudEZyb21QYXJlbnQiLCJfcmVhY3RDb21wb25lbnQiLCJfb3JpZ2luYWxDb21wb25lbnRXaWxsVXBkYXRlIiwiX2NvbnRhaW5lciIsIl9pbml0aWFsU3RhdGUiLCJfcmVhY3RDbGFzcyIsIl9nZXRSZWFjdENsYXNzIiwiX3JlbmRlciIsIl9kZXN0cm95IiwiUmVhY3RET00iLCJyZW5kZXIiLCJfZ2V0UmVhY3RDb21wb25lbnQiLCJnZXRFbGVtZW50IiwiY29tcG9uZW50V2lsbFVwZGF0ZSIsIl9vblVwZGF0ZSIsImJpbmQiLCJ1bm1vdW50Q29tcG9uZW50QXROb2RlIiwibmV4dFByb3BzIiwibmV4dFN0YXRlIiwicmVhY3RDbGFzcyIsImRlZmF1bHRQcm9wcyIsImdsRXZlbnRIdWIiLCJnbENvbnRhaW5lciIsInJlZiIsIl9nb3RSZWFjdENvbXBvbmVudCIsInByb3BzIiwiUmVhY3QiLCJjcmVhdGVFbGVtZW50IiwiRiIsInRvdWNoZXMiLCJ0YXJnZXRUb3VjaGVzIiwic3ViQ2xhc3MiLCJzdXBlckNsYXNzIiwiY3JlYXRlT2JqZWN0IiwiY29udHJ1Y3RvciIsIk9iamVjdCIsImNyZWF0ZSIsIm9iamVjdCIsImtleXMiLCJnZXRIYXNoVmFsdWUiLCJtYXRjaGVzIiwiaGFzaCIsIm1hdGNoIiwiUmVnRXhwIiwicGFyYW0iLCJzZWFyY2giLCJrZXlWYWx1ZVBhaXJzIiwicGFyYW1zIiwicGFpciIsInNvdXJjZSIsInJlcXVlc3RBbmltYXRpb25GcmFtZSIsIndlYmtpdFJlcXVlc3RBbmltYXRpb25GcmFtZSIsIm1velJlcXVlc3RBbmltYXRpb25GcmFtZSIsIm5lZWRsZSIsImhheXN0YWNrIiwiSW50OEFycmF5Iiwib2JqIiwiYm91bmRBcmdzIiwiRnVuY3Rpb24iLCJib3VuZCIsImFycmF5IiwiRGF0ZSIsImdldFRpbWUiLCJy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Q0FBQyxDQUFDbXdCLElBQUYsQ0FBT0gsS0FBSyxDQUFDRixPQUFOLENBQWMsZUFBZCxFQUErQixFQUEvQixDQUFQLENBQVA7QUFDSCxDOzs7Ozs7Ozs7OztBQzNNRCxvRCIsImZpbGUiOiJnb2xkZW4tbGF5b3V0LmpzIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIHdlYnBhY2tVbml2ZXJzYWxNb2R1bGVEZWZpbml0aW9uKHJvb3QsIGZhY3RvcnkpIHtcblx0aWYodHlwZW9mIGV4cG9ydHMgPT09ICdvYmplY3QnICYmIHR5cGVvZiBtb2R1bGUgPT09ICdvYmplY3QnKVxuXHRcdG1vZHVsZS5leHBvcnRzID0gZmFjdG9yeShyZXF1aXJlKFwianF1ZXJ5XCIpKTtcblx0ZWxzZSBpZih0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQpXG5cdFx0ZGVmaW5lKFtcImpxdWVyeVwiXSwgZmFjdG9yeSk7XG5cdGVsc2UgaWYodHlwZW9mIGV4cG9ydHMgPT09ICdvYmplY3QnKVxuXHRcdGV4cG9ydHNbXCJHb2xkZW5MYXlvdXRcIl0gPSBmYWN0b3J5KHJlcXVpcmUoXCJqcXVlcnlcIikpO1xuXHRlbHNlXG5cdFx0cm9vdFtcIkdvbGRlbkxheW91dFwiXSA9IGZhY3Rvcnkocm9vdFtcIiRcIl0pO1xufSkod2luZG93LCBmdW5jdGlvbihfX1dFQlBBQ0tfRVhURVJOQUxfTU9EVUxFX2pxdWVyeV9fKSB7XG5yZXR1cm4gIiwiIFx0Ly8gVGhlIG1vZHVsZSBjYWNoZVxuIFx0dmFyIGluc3RhbGxlZE1vZHVsZXMgPSB7fTtcblxuIFx0Ly8gVGhlIHJlcXVpcmUgZnVuY3Rpb25cbiBcdGZ1bmN0aW9uIF9fd2VicGFja19yZXF1aXJlX18obW9kdWxlSWQpIHtcblxuIFx0XHQvLyBDaGVjayBpZiBtb2R1bGUgaXMgaW4gY2FjaGVcbiBcdFx0aWYoaW5zdGFsbGVkTW9kdWxlc1ttb2R1bGVJZF0pIHtcbiBcdFx0XHRyZXR1cm4gaW5zdGFsbGVkTW9kdWxlc1ttb2R1bGVJZF0uZXhwb3J0cztcbiBcdFx0fVxuIFx0XHQvLyBDcmVhdGUgYSBuZXcgbW9kdWxlIChhbmQgcHV0IGl0IGludG8gdGhlIGNhY2hlKVxuIFx0XHR2YXIgbW9kdWxlID0gaW5zdGFsbGVkTW9kdWxlc1ttb2R1bGVJZF0gPSB7XG4gXHRcdFx0aTogbW9kdWxlSWQsXG4gXHRcdFx0bDogZmFsc2UsXG4gXHRcdFx0ZXhwb3J0czoge31cbiBcdFx0fTtcblxuIFx0XHQvLyBFeGVjdXRlIHRoZSBtb2R1bGUgZnVuY3Rpb25cbiBcdFx0bW9kdWxlc1ttb2R1bGVJZF0uY2FsbChtb2R1bGUuZXhwb3J0cywgbW9kdWxlLCBtb2R1bGUuZXhwb3J0cywgX193ZWJwYWNrX3JlcXVpcmVfXyk7XG5cbiBcdFx0Ly8gRmxhZyB0aGUgbW9kdWxlIGFzIGxvYWRlZFxuIFx0XHRtb2R1bGUubCA9IHRydWU7XG5cbiBcdFx0Ly8gUmV0dXJuIHRoZSBleHBvcnRzIG9mIHRoZSBtb2R1bGVcbiBcdFx0cmV0dXJuIG1vZHVsZS5leHBvcnRzO1xuIFx0fVxuXG5cbiBcdC8vIGV4cG9zZSB0aGUgbW9kdWxlcyBvYmplY3QgKF9fd2VicGFja19tb2R1bGVzX18pXG4gXHRfX3dlYnBhY2tfcmVxdWlyZV9fLm0gPSBtb2R1bGVzO1xuXG4gXHQvLyBleHBvc2UgdGhlIG1vZHVsZSBjYWNoZVxuIFx0X193ZWJwYWNrX3JlcXVpcmVfXy5jID0gaW5zdGFsbGVkTW9kdWxlcztcblxuIFx0Ly8gZGVmaW5lIGdldHRlciBmdW5jdGlvbiBmb3IgaGFybW9ueSBleHBvcnRzXG4gXHRfX3dlYnBhY2tfcmVxdWlyZV9fLmQgPSBmdW5jdGlvbihleHBvcnRzLCBuYW1lLCBnZXR0ZXIpIHtcbiBcdFx0aWYoIV9fd2VicGFja19yZXF1aXJlX18ubyhleHBvcnRzLCBuYW1lKSkge1xuIFx0XHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBuYW1lLCB7IGVudW1lcmFibGU6IHRydWUsIGdldDogZ2V0dGVyIH0pO1xuIFx0XHR9XG4gXHR9O1xuXG4gXHQvLyBkZWZpbmUgX19lc01vZHVsZSBvbiBleHBvcnRzXG4gXHRfX3dlYnBhY2tfcmVxdWlyZV9fLnIgPSBmdW5jdGlvbihleHBvcnRzKSB7XG4gXHRcdGlmKHR5cGVvZiBTeW1ib2wgIT09ICd1bmRlZmluZWQnICYmIFN5bWJvbC50b1N0cmluZ1RhZykge1xuIFx0XHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBTeW1ib2wudG9TdHJpbmdUYWcsIHsgdmFsdWU6ICdNb2R1bGUnIH0pO1xuIFx0XHR9XG4gXHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCAnX19lc01vZHVsZScsIHsgdmFsdWU6IHRydWUgfSk7XG4gXHR9O1xuXG4gXHQvLyBjcmVhdGUgYSBmYWtlIG5hbWVzcGFjZSBvYmplY3RcbiBcdC8vIG1vZGUgJiAxOiB2YWx1ZSBpcyBhIG1vZHVsZSBpZCwgcmVxdWlyZSBpdFxuIFx0Ly8gbW9kZSAmIDI6IG1lcmdlIGFsbCBwcm9wZXJ0aWVzIG9mIHZhbHVlIGludG8gdGhlIG5zXG4gXHQvLyBtb2RlICYgNDogcmV0dXJuIHZhbHVlIHdoZW4gYWxyZWFkeSBucyBvYmplY3RcbiBcdC8vIG1vZGUgJiA4fDE6IGJlaGF2ZSBsaWtlIHJlcXVpcmVcbiBcdF9fd2VicGFja19yZXF1aXJlX18udCA9IGZ1bmN0aW9uKHZhbHVlLCBtb2RlKSB7XG4gXHRcdGlmKG1vZGUgJiAxKSB2YWx1ZSA9IF9fd2VicGFja19yZXF1aXJlX18odmFsdWUpO1xuIFx0XHRpZihtb2RlICYgOCkgcmV0dXJuIHZhbHVlO1xuIFx0XHRpZigobW9kZSAmIDQpICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiYgdmFsdWUgJiYgdmFsdWUuX19lc01vZHVsZSkgcmV0dXJuIHZhbHVlO1xuIFx0XHR2YXIgbnMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuIFx0XHRfX3dlYnBhY2tfcmVxdWlyZV9fLnIobnMpO1xuIFx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkobnMsICdkZWZhdWx0JywgeyBlbnVtZXJhYmxlOiB0cnVlLCB2YWx1ZTogdmFsdWUgfSk7XG4gXHRcdGlmKG1vZGUgJiAyICYmIHR5cGVvZiB2YWx1ZSAhPSAnc3RyaW5nJykgZm9yKHZhciBrZXkgaW4gdmFsdWUpIF9fd2VicGFja19yZXF1aXJlX18uZChucywga2V5LCBmdW5jdGlvbihrZXkpIHsgcmV0dXJuIHZhbHVlW2tleV07IH0uYmluZChudWxsLCBrZXkpKTtcbiBcdFx0cmV0dXJuIG5zO1xuIFx0fTtcblxuIFx0Ly8gZ2V0RGVmYXVsdEV4cG9ydCBmdW5jdGlvbiBmb3IgY29tcGF0aWJpbGl0eSB3aXRoIG5vbi1oYXJtb255IG1vZHVsZXNcbiBcdF9fd2VicGFja19yZXF1aXJlX18ubiA9IGZ1bmN0aW9uKG1vZHVsZSkge1xuIFx0XHR2YXIgZ2V0dGVyID0gbW9kdWxlICYmIG1vZHVsZS5fX2VzTW9kdWxlID9cbiBcdFx0XHRmdW5jdGlvbiBnZXREZWZhdWx0KCkgeyByZXR1cm4gbW9kdWxlWydkZWZhdWx0J107IH0gOlxuIFx0XHRcdGZ1bmN0aW9uIGdldE1vZHVsZUV4cG9ydHMoKSB7IHJldHVybiBtb2R1bGU7IH07XG4gXHRcdF9fd2VicGFja19yZXF1aXJlX18uZChnZXR0ZXIsICdhJywgZ2V0dGVyKTtcbiBcdFx0cmV0dXJuIGdldHRlcjtcbiBcdH07XG5cbiBcdC8vIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbFxuIFx0X193ZWJwYWNrX3JlcXVpcmVfXy5vID0gZnVuY3Rpb24ob2JqZWN0LCBwcm9wZXJ0eSkgeyByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iamVjdCwgcHJvcGVydHkpOyB9O1xuXG4gXHQvLyBfX3dlYnBhY2tfcHVibGljX3BhdGhfX1xuIFx0X193ZWJwYWNrX3JlcXVpcmVfXy5wID0gXCJcIjtcblxuXG4gXHQvLyBMb2FkIGVudHJ5IG1vZHVsZSBhbmQgcmV0dXJuIGV4cG9ydHNcbiBcdHJldHVybiBfX3dlYnBhY2tfcmVxdWlyZV9fKF9fd2VicGFja19yZXF1aXJlX18ucyA9IFwiLi9zcmMvaW5kZXguanNcIik7XG4iLCIvLyBoZWxwZXIgZmlsZSBmb3Igd2VicGFjayBidWlsZCBzeXN0ZW1cclxuLy8gd2hhdGV2ZXIgaXMgaW1wb3J0ZWQvZXhwb3J0ZWQgaGVyZSB3aWxsIGJlIGluY2x1ZGVkIGluIHRoZSBidWlsZFxyXG4vL2ltcG9ydCAnbGVzcy90ZXN0Lmxlc3MnXHJcbi8vaW1wb3J0ICcuL2xlc3MvZ29sZGVubGF5b3V0LWJhc2UubGVzcydcclxuLy9pbXBvcnQgJy4vbGVzcy9nb2xkZW5sYXlvdXQtZGFyay10aGVtZS5sZXNzJ1xyXG4vL1xyXG4vLyBMYXlvdXRcclxuZXhwb3J0IHsgZGVmYXVsdCB9IGZyb20gJy4vanNfZXM2L0xheW91dE1hbmFnZXInXHJcbi8vXHJcbi8vIGNvbnRhaW5lclxyXG5leHBvcnQgeyBkZWZhdWx0IGFzIEl0ZW1Db250YWluZXIgfSBmcm9tICcuL2pzX2VzNi9jb250YWluZXIvSXRlbUNvbnRhaW5lcidcclxuLy9cclxuLy8gY29udHJvbHNcclxuZXhwb3J0IHsgZGVmYXVsdCBhcyBCcm93c2VyUG9wb3V0IH0gZnJvbSAnLi9qc19lczYvY29udHJvbHMvQnJvd3NlclBvcG91dCdcclxuZXhwb3J0IHsgZGVmYXVsdCBhcyBIZWFkZXIgfSBmcm9tICcuL2pzX2VzNi9jb250cm9scy9IZWFkZXInXHJcbmV4cG9ydCB7IGRlZmF1bHQgYXMgSGVhZGVyQnV0dG9uIH0gZnJvbSAnLi9qc19lczYvY29udHJvbHMvSGVhZGVyQnV0dG9uJ1xyXG5leHBvcnQgeyBkZWZhdWx0IGFzIFRhYiB9IGZyb20gJy4vanNfZXM2L2NvbnRyb2xzL1RhYidcclxuLy9cclxuLy8gaXRlbXNcclxuZXhwb3J0IHsgZGVmYXVsdCBhcyBDb21wb25lbnQgfSBmcm9tICcuL2pzX2VzNi9pdGVtcy9Db21wb25lbnQnXHJcbmV4cG9ydCB7IGRlZmF1bHQgYXMgUm9vdCB9IGZyb20gJy4vanNfZXM2L2l0ZW1zL1Jvb3QnXHJcbmV4cG9ydCB7IGRlZmF1bHQgYXMgUm93T3JDb2x1bW4gfSBmcm9tICcuL2pzX2VzNi9pdGVtcy9Sb3dPckNvbHVtbidcclxuZXhwb3J0IHsgZGVmYXVsdCBhcyBTdGFjayB9IGZyb20gJy4vanNfZXM2L2l0ZW1zL1N0YWNrJ1xyXG4vL1xyXG4vLyB1dGlsc1xyXG5leHBvcnQgeyBkZWZhdWx0IGFzIEJ1YmJsaW5nRXZlbnQgfSBmcm9tICcuL2pzX2VzNi91dGlscy9CdWJibGluZ0V2ZW50J1xyXG5leHBvcnQgeyBkZWZhdWx0IGFzIENvbmZpZ01pbmlmaWVyIH0gZnJvbSAnLi9qc19lczYvdXRpbHMvQ29uZmlnTWluaWZpZXInXHJcbmV4cG9ydCB7IGRlZmF1bHQgYXMgRHJhZ0xpc3RlbmVyIH0gZnJvbSAnLi9qc19lczYvdXRpbHMvRHJhZ0xpc3RlbmVyJ1xyXG5leHBvcnQgeyBkZWZhdWx0IGFzIEV2ZW50RW1pdHRlciB9IGZyb20gJy4vanNfZXM2L3V0aWxzL0V2ZW50RW1pdHRlcidcclxuZXhwb3J0IHsgZGVmYXVsdCBhcyBFdmVudEh1YiB9IGZyb20gJy4vanNfZXM2L3V0aWxzL0V2ZW50SHViJ1xyXG5leHBvcnQgeyBkZWZhdWx0IGFzIFJlYWN0Q29tcG9uZW50SGFuZGxlciB9IGZyb20gJy4vanNfZXM2L3V0aWxzL1JlYWN0Q29tcG9uZW50SGFuZGxlcidcclxuIiwiaW1wb3J0IEV2ZW50RW1pdHRlciBmcm9tICcuL3V0aWxzL0V2ZW50RW1pdHRlcidcclxuaW1wb3J0IENvbmZpZ01pbmlmaWVyIGZyb20gJy4vdXRpbHMvQ29uZmlnTWluaWZpZXInXHJcbmltcG9ydCBFdmVudEh1YiBmcm9tICcuL3V0aWxzL0V2ZW50SHViJ1xyXG5cclxuaW1wb3J0IFJvb3QgZnJvbSAnLi9pdGVtcy9Sb290J1xyXG5pbXBvcnQgUm93T3JDb2x1bW4gZnJvbSAnLi9pdGVtcy9Sb3dPckNvbHVtbidcclxuaW1wb3J0IFN0YWNrIGZyb20gJy4vaXRlbXMvU3RhY2snXHJcbmltcG9ydCBDb21wb25lbnQgZnJvbSAnLi9pdGVtcy9Db21wb25lbnQnXHJcbmltcG9ydCBBYnN0cmFjdENvbnRlbnRJdGVtIGZyb20gJy4vaXRlbXMvQWJzdHJhY3RDb250ZW50SXRlbSdcclxuXHJcbmltcG9ydCBCcm93c2VyUG9wb3V0IGZyb20gJy4vY29udHJvbHMvQnJvd3NlclBvcG91dCdcclxuaW1wb3J0IERyYWdTb3VyY2UgZnJvbSAnLi9jb250cm9scy9EcmFnU291cmNlJ1xyXG5pbXBvcnQgRHJvcFRhcmdldEluZGljYXRvciBmcm9tICcuL2NvbnRyb2xzL0Ryb3BUYXJnZXRJbmRpY2F0b3InXHJcbmltcG9ydCBUcmFuc2l0aW9uSW5kaWNhdG9yIGZyb20gJy4vY29udHJvbHMvVHJhbnNpdGlvbkluZGljYXRvcidcclxuXHJcbmltcG9ydCBDb25maWd1cmF0aW9uRXJyb3IgZnJvbSAnLi9lcnJvcnMvQ29uZmlndXJhdGlvbkVycm9yJ1xyXG5pbXBvcnQgZGVmYXVsdENvbmZpZyBmcm9tICcuL2NvbmZpZy9kZWZhdWx0Q29uZmlnJ1xyXG5cclxuaW1wb3J0IHtcclxuICAgIGZuQmluZCxcclxuICAgIG9iamVjdEtleXMsXHJcbiAgICBjb3B5LFxyXG4gICAgZ2V0VW5pcXVlSWQsXHJcbiAgICBpbmRleE9mLFxyXG4gICAgaXNGdW5jdGlvbixcclxuICAgIHN0cmlwVGFncyxcclxuICAgIGdldFF1ZXJ5U3RyaW5nUGFyYW1cclxufSBmcm9tICcuL3V0aWxzL3V0aWxzJ1xyXG5cclxuaW1wb3J0ICQgZnJvbSAnanF1ZXJ5J1xyXG5cclxuZXhwb3J0IGNvbnN0IFJFQUNUX0NPTVBPTkVOVF9JRCA9ICdsbS1yZWFjdC1jb21wb25lbnQnXHJcblxyXG4vKipcclxuICogVGhlIG1haW4gY2xhc3MgdGhhdCB3aWxsIGJlIGV4cG9zZWQgYXMgR29sZGVuTGF5b3V0LlxyXG4gKlxyXG4gKiBAcHVibGljXHJcbiAqIEBjb25zdHJ1Y3RvclxyXG4gKiBAcGFyYW0ge0dvbGRlbkxheW91dCBjb25maWd9IGNvbmZpZ1xyXG4gKiBAcGFyYW0ge1tET00gZWxlbWVudCBjb250YWluZXJdfSBjb250YWluZXIgQ2FuIGJlIGEgalF1ZXJ5IHNlbGVjdG9yIHN0cmluZyBvciBhIERvbSBlbGVtZW50LiBEZWZhdWx0cyB0byBib2R5XHJcbiAqXHJcbiAqIEByZXR1cm5zIHtWT0lEfVxyXG4gKi9cclxuXHJcblxyXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBMYXlvdXRNYW5hZ2VyIGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcclxuICAgIGNvbnN0cnVjdG9yKGNvbmZpZywgY29udGFpbmVyKSB7ICAgICAgICBcclxuICAgICAgICBzdXBlcigpO1xyXG5cclxuICAgICAgICB0aGlzLmlzSW5pdGlhbGlzZWQgPSBmYWxzZTtcclxuICAgICAgICB0aGlzLl9pc0Z1bGxQYWdlID0gZmFsc2U7XHJcbiAgICAgICAgdGhpcy5fcmVzaXplVGltZW91dElkID0gbnVsbDtcclxuICAgICAgICB0aGlzLl9jb21wb25lbnRzID0ge307XHJcbiAgICAgICAgdGhpcy5faXRlbUFyZWFzID0gW107XHJcbiAgICAgICAgdGhpcy5fcmVzaXplRnVuY3Rpb24gPSBmbkJpbmQodGhpcy5fb25SZXNpemUsIHRoaXMpO1xyXG4gICAgICAgIHRoaXMuX3VubG9hZEZ1bmN0aW9uID0gZm5CaW5kKHRoaXMuX29uVW5sb2FkLCB0aGlzKTtcclxuICAgICAgICB0aGlzLl9tYXhpbWlzZWRJdGVtID0gbnVsbDtcclxuICAgICAgICB0aGlzLl9tYXhpbWlzZVBsYWNlaG9sZGVyID0gJCgnPGRpdiBjbGFzcz1cImxtX21heGltaXNlX3BsYWNlXCI+PC9kaXY+Jyk7XHJcbiAgICAgICAgdGhpcy5fY3JlYXRpb25UaW1lb3V0UGFzc2VkID0gZmFsc2U7XHJcbiAgICAgICAgdGhpcy5fc3ViV2luZG93c0NyZWF0ZWQgPSBmYWxzZTtcclxuICAgICAgICB0aGlzLl9kcmFnU291cmNlcyA9IFtdO1xyXG4gICAgICAgIHRoaXMuX3VwZGF0aW5nQ29sdW1uc1Jlc3BvbnNpdmUgPSBmYWxzZTtcclxuICAgICAgICB0aGlzLl9maXJzdExvYWQgPSB0cnVlO1xyXG5cclxuICAgICAgICB0aGlzLndpZHRoID0gbnVsbDtcclxuICAgICAgICB0aGlzLmhlaWdodCA9IG51bGw7XHJcbiAgICAgICAgdGhpcy5yb290ID0gbnVsbDtcclxuICAgICAgICB0aGlzLm9wZW5Qb3BvdXRzID0gW107XHJcbiAgICAgICAgdGhpcy5zZWxlY3RlZEl0ZW0gPSBudWxsO1xyXG4gICAgICAgIHRoaXMuaXNTdWJXaW5kb3cgPSBmYWxzZTtcclxuICAgICAgICB0aGlzLmV2ZW50SHViID0gbmV3IEV2ZW50SHViKHRoaXMpO1xyXG4gICAgICAgIHRoaXMuY29uZmlnID0gdGhpcy5fY3JlYXRlQ29uZmlnKGNvbmZpZyk7XHJcbiAgICAgICAgdGhpcy5jb250YWluZXIgPSBjb250YWluZXI7XHJcbiAgICAgICAgdGhpcy5kcm9wVGFyZ2V0SW5kaWNhdG9yID0gbnVsbDtcclxuICAgICAgICB0aGlzLnRyYW5zaXRpb25JbmRpY2F0b3IgPSBudWxsO1xyXG4gICAgICAgIHRoaXMudGFiRHJvcFBsYWNlaG9sZGVyID0gJCgnPGRpdiBjbGFzcz1cImxtX2Ryb3BfdGFiX3BsYWNlaG9sZGVyXCI+PC9kaXY+Jyk7XHJcblxyXG4gICAgICAgIGlmICh0aGlzLmlzU3ViV2luZG93ID09PSB0cnVlKSB7XHJcbiAgICAgICAgICAgICQoJ2JvZHknKS5jc3MoJ3Zpc2liaWxpdHknLCAnaGlkZGVuJyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLl90eXBlVG9JdGVtID0ge1xyXG4gICAgICAgICAgICAnY29sdW1uJzogZm5CaW5kKFJvd09yQ29sdW1uLCB0aGlzLCBbdHJ1ZV0pLFxyXG4gICAgICAgICAgICAncm93JzogZm5CaW5kKFJvd09yQ29sdW1uLCB0aGlzLCBbZmFsc2VdKSxcclxuICAgICAgICAgICAgJ3N0YWNrJzogU3RhY2ssXHJcbiAgICAgICAgICAgICdjb21wb25lbnQnOiBDb21wb25lbnRcclxuICAgICAgICB9O1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogVGFrZXMgYSBHb2xkZW5MYXlvdXQgY29uZmlndXJhdGlvbiBvYmplY3QgYW5kXHJcbiAgICAgKiByZXBsYWNlcyBpdHMga2V5cyBhbmQgdmFsdWVzIHJlY3Vyc2l2ZWx5IHdpdGhcclxuICAgICAqIG9uZSBsZXR0ZXIgY29kZXNcclxuICAgICAqXHJcbiAgICAgKiBAc3RhdGljXHJcbiAgICAgKiBAcHVibGljXHJcbiAgICAgKiBAcGFyYW0gICB7T2JqZWN0fSBjb25maWcgQSBHb2xkZW5MYXlvdXQgY29uZmlnIG9iamVjdFxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHtPYmplY3R9IG1pbmlmaWVkIGNvbmZpZ1xyXG4gICAgICovXHJcbiAgICBtaW5pZnlDb25maWcoY29uZmlnKSB7XHJcbiAgICAgICAgcmV0dXJuIChuZXcgQ29uZmlnTWluaWZpZXIoKSkubWluaWZ5Q29uZmlnKGNvbmZpZyk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBUYWtlcyBhIGNvbmZpZ3VyYXRpb24gT2JqZWN0IHRoYXQgd2FzIHByZXZpb3VzbHkgbWluaWZpZWRcclxuICAgICAqIHVzaW5nIG1pbmlmeUNvbmZpZyBhbmQgcmV0dXJucyBpdHMgb3JpZ2luYWwgdmVyc2lvblxyXG4gICAgICpcclxuICAgICAqIEBzdGF0aWNcclxuICAgICAqIEBwdWJsaWNcclxuICAgICAqIEBwYXJhbSAgIHtPYmplY3R9IG1pbmlmaWVkQ29uZmlnXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge09iamVjdH0gdGhlIG9yaWdpbmFsIGNvbmZpZ3VyYXRpb25cclxuICAgICAqL1xyXG4gICAgdW5taW5pZnlDb25maWcoY29uZmlnKSB7XHJcbiAgICAgICAgcmV0dXJuIChuZXcgQ29uZmlnTWluaWZpZXIoKSkudW5taW5pZnlDb25maWcoY29uZmlnKTtcclxuICAgIH1cclxuXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSZWdpc3RlciBhIGNvbXBvbmVudCB3aXRoIHRoZSBsYXlvdXQgbWFuYWdlci4gSWYgYSBjb25maWd1cmF0aW9uIG5vZGVcclxuICAgICAqIG9mIHR5cGUgY29tcG9uZW50IGlzIHJlYWNoZWQgaXQgd2lsbCBsb29rIHVwIGNvbXBvbmVudE5hbWUgYW5kIGNyZWF0ZSB0aGVcclxuICAgICAqIGFzc29jaWF0ZWQgY29tcG9uZW50XHJcbiAgICAgKlxyXG4gICAgICogIHtcclxuICAgICAqICAgIHR5cGU6IFwiY29tcG9uZW50XCIsXHJcbiAgICAgKiAgICBjb21wb25lbnROYW1lOiBcIkVxdWl0eU5ld3NGZWVkXCIsXHJcbiAgICAgKiAgICBjb21wb25lbnRTdGF0ZTogeyBcImZlZWRUb3BpY1wiOiBcInVzLWJsdWVjaGlwc1wiIH1cclxuICAgICAqICB9XHJcbiAgICAgKlxyXG4gICAgICogQHB1YmxpY1xyXG4gICAgICogQHBhcmFtICAge1N0cmluZ30gbmFtZVxyXG4gICAgICogQHBhcmFtICAge0Z1bmN0aW9ufSBjb25zdHJ1Y3RvclxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHt2b2lkfVxyXG4gICAgICovXHJcbiAgICByZWdpc3RlckNvbXBvbmVudChuYW1lLCBjb25zdHJ1Y3Rvcikge1xyXG4gICAgICAgIGlmICh0eXBlb2YgY29uc3RydWN0b3IgIT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdQbGVhc2UgcmVnaXN0ZXIgYSBjb25zdHJ1Y3RvciBmdW5jdGlvbicpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKHRoaXMuX2NvbXBvbmVudHNbbmFtZV0gIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NvbXBvbmVudCAnICsgbmFtZSArICcgaXMgYWxyZWFkeSByZWdpc3RlcmVkJyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLl9jb21wb25lbnRzW25hbWVdID0gY29uc3RydWN0b3I7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSZWdpc3RlciBhIGNvbXBvbmVudCBmdW5jdGlvbiB3aXRoIHRoZSBsYXlvdXQgbWFuYWdlci4gVGhpcyBmdW5jdGlvbiBzaG91bGRcclxuICAgICAqIHJldHVybiBhIGNvbnN0cnVjdG9yIGZvciBhIGNvbXBvbmVudCBiYXNlZCBvbiBhIGNvbmZpZy4gIElmIHVuZGVmaW5lZCBpcyByZXR1cm5lZCwgXHJcbiAgICAgKiBhbmQgbm8gY29tcG9uZW50IGhhcyBiZWVuIHJlZ2lzdGVyZWQgdW5kZXIgdGhhdCBuYW1lIHVzaW5nIHJlZ2lzdGVyQ29tcG9uZW50LCBhbiBcclxuICAgICAqIGVycm9yIHdpbGwgYmUgdGhyb3duLlxyXG4gICAgICpcclxuICAgICAqIEBwdWJsaWNcclxuICAgICAqIEBwYXJhbSAgIHtGdW5jdGlvbn0gY2FsbGJhY2tcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJucyB7dm9pZH1cclxuICAgICAqL1xyXG4gICAgcmVnaXN0ZXJDb21wb25lbnRGdW5jdGlvbihjYWxsYmFjaykge1xyXG4gICAgICAgIGlmICh0eXBlb2YgY2FsbGJhY2sgIT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdQbGVhc2UgcmVnaXN0ZXIgYSBjYWxsYmFjayBmdW5jdGlvbicpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKHRoaXMuX2NvbXBvbmVudEZ1bmN0aW9uICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgY29uc29sZS53YXJuKCdNdWx0aXBsZSBjb21wb25lbnQgZnVuY3Rpb25zIGFyZSBiZWluZyByZWdpc3RlcmVkLiAgT25seSB0aGUgZmluYWwgcmVnaXN0ZXJlZCBmdW5jdGlvbiB3aWxsIGJlIHVzZWQuJylcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMuX2NvbXBvbmVudEZ1bmN0aW9uID0gY2FsbGJhY2s7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGVzIGEgbGF5b3V0IGNvbmZpZ3VyYXRpb24gb2JqZWN0IGJhc2VkIG9uIHRoZSB0aGUgY3VycmVudCBzdGF0ZVxyXG4gICAgICpcclxuICAgICAqIEBwdWJsaWNcclxuICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEdvbGRlbkxheW91dCBjb25maWd1cmF0aW9uXHJcbiAgICAgKi9cclxuICAgIHRvQ29uZmlnKHJvb3QpIHtcclxuICAgICAgICB2YXIgY29uZmlnLCBuZXh0LCBpO1xyXG5cclxuICAgICAgICBpZiAodGhpcy5pc0luaXRpYWxpc2VkID09PSBmYWxzZSkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NhblxcJ3QgY3JlYXRlIGNvbmZpZywgbGF5b3V0IG5vdCB5ZXQgaW5pdGlhbGlzZWQnKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmIChyb290ICYmICEocm9vdCBpbnN0YW5jZW9mIEFic3RyYWN0Q29udGVudEl0ZW0pKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignUm9vdCBtdXN0IGJlIGEgQ29udGVudEl0ZW0nKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8qXHJcbiAgICAgICAgICogc2V0dGluZ3MgJiBsYWJlbHNcclxuICAgICAgICAgKi9cclxuICAgICAgICBjb25maWcgPSB7XHJcbiAgICAgICAgICAgIHNldHRpbmdzOiBjb3B5KHt9LCB0aGlzLmNvbmZpZy5zZXR0aW5ncyksXHJcbiAgICAgICAgICAgIGRpbWVuc2lvbnM6IGNvcHkoe30sIHRoaXMuY29uZmlnLmRpbWVuc2lvbnMpLFxyXG4gICAgICAgICAgICBsYWJlbHM6IGNvcHkoe30sIHRoaXMuY29uZmlnLmxhYmVscylcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICAvKlxyXG4gICAgICAgICAqIENvbnRlbnRcclxuICAgICAgICAgKi9cclxuICAgICAgICBjb25maWcuY29udGVudCA9IFtdO1xyXG4gICAgICAgIG5leHQgPSBmdW5jdGlvbihjb25maWdOb2RlLCBpdGVtKSB7XHJcbiAgICAgICAgICAgIHZhciBrZXksIGk7XHJcblxyXG4gICAgICAgICAgICBmb3IgKGtleSBpbiBpdGVtLmNvbmZpZykge1xyXG4gICAgICAgICAgICAgICAgaWYgKGtleSAhPT0gJ2NvbnRlbnQnKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uZmlnTm9kZVtrZXldID0gaXRlbS5jb25maWdba2V5XTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgaWYgKGl0ZW0uY29udGVudEl0ZW1zLmxlbmd0aCkge1xyXG4gICAgICAgICAgICAgICAgY29uZmlnTm9kZS5jb250ZW50ID0gW107XHJcblxyXG4gICAgICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IGl0ZW0uY29udGVudEl0ZW1zLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uZmlnTm9kZS5jb250ZW50W2ldID0ge307XHJcbiAgICAgICAgICAgICAgICAgICAgbmV4dChjb25maWdOb2RlLmNvbnRlbnRbaV0sIGl0ZW0uY29udGVudEl0ZW1zW2ldKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIGlmIChyb290KSB7XHJcbiAgICAgICAgICAgIG5leHQoY29uZmlnLCB7XHJcbiAgICAgICAgICAgICAgICBjb250ZW50SXRlbXM6IFtyb290XVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBuZXh0KGNvbmZpZywgdGhpcy5yb290KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8qXHJcbiAgICAgICAgICogUmV0cmlldmUgY29uZmlnIGZvciBzdWJ3aW5kb3dzXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgdGhpcy5fJHJlY29uY2lsZVBvcG91dFdpbmRvd3MoKTtcclxuICAgICAgICBjb25maWcub3BlblBvcG91dHMgPSBbXTtcclxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgdGhpcy5vcGVuUG9wb3V0cy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICBjb25maWcub3BlblBvcG91dHMucHVzaCh0aGlzLm9wZW5Qb3BvdXRzW2ldLnRvQ29uZmlnKCkpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLypcclxuICAgICAgICAgKiBBZGQgbWF4aW1pc2VkIGl0ZW1cclxuICAgICAgICAgKi9cclxuICAgICAgICBjb25maWcubWF4aW1pc2VkSXRlbUlkID0gdGhpcy5fbWF4aW1pc2VkSXRlbSA/ICdfX2dsTWF4aW1pc2VkJyA6IG51bGw7XHJcbiAgICAgICAgcmV0dXJuIGNvbmZpZztcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFJldHVybnMgYSBwcmV2aW91c2x5IHJlZ2lzdGVyZWQgY29tcG9uZW50LiAgQXR0ZW1wdHMgdG8gdXRpbGl6ZSByZWdpc3RlcmVkIFxyXG4gICAgICogY29tcG9uZW50IGJ5IG5hbWUgZmlyc3QsIHRoZW4gZmFsbHMgYmFjayB0byB0aGUgY29tcG9uZW50IGZ1bmN0aW9uLiAgSWYgZWl0aGVyXHJcbiAgICAgKiBsYWNrIGEgcmVzcG9uc2UgZm9yIHdoYXQgdGhlIGNvbXBvbmVudCBzaG91bGQgYmUsIGl0IHRocm93cyBhbiBlcnJvci5cclxuICAgICAqXHJcbiAgICAgKiBAcHVibGljXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gY29uZmlnIC0gVGhlIGl0ZW0gY29uZmlnXHJcbiAgICAgKiBcclxuICAgICAqIEByZXR1cm5zIHtGdW5jdGlvbn1cclxuICAgICAqL1xyXG4gICAgZ2V0Q29tcG9uZW50KGNvbmZpZykge1xyXG4gICAgICAgIGNvbnN0IG5hbWUgPSB0aGlzLmdldENvbXBvbmVudE5hbWVGcm9tQ29uZmlnKGNvbmZpZylcclxuICAgICAgICBsZXQgY29tcG9uZW50VG9Vc2UgPSB0aGlzLl9jb21wb25lbnRzW25hbWVdXHJcbiAgICAgICAgaWYgKHRoaXMuX2NvbXBvbmVudEZ1bmN0aW9uICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgY29tcG9uZW50VG9Vc2UgPSBjb21wb25lbnRUb1VzZSB8fCB0aGlzLl9jb21wb25lbnRGdW5jdGlvbih7Y29uZmlnfSlcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKGNvbXBvbmVudFRvVXNlID09PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IENvbmZpZ3VyYXRpb25FcnJvcignVW5rbm93biBjb21wb25lbnQgXCInICsgbmFtZSArICdcIicpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIGNvbXBvbmVudFRvVXNlO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ3JlYXRlcyB0aGUgYWN0dWFsIGxheW91dC4gTXVzdCBiZSBjYWxsZWQgYWZ0ZXIgYWxsIGluaXRpYWwgY29tcG9uZW50c1xyXG4gICAgICogYXJlIHJlZ2lzdGVyZWQuIFJlY3Vyc2VzIHRocm91Z2ggdGhlIGNvbmZpZ3VyYXRpb24gYW5kIHNldHMgdXBcclxuICAgICAqIHRoZSBpdGVtIHRyZWUuXHJcbiAgICAgKlxyXG4gICAgICogSWYgY2FsbGVkIGJlZm9yZSB0aGUgZG9jdW1lbnQgaXMgcmVhZHkgaXQgYWRkcyBpdHNlbGYgYXMgYSBsaXN0ZW5lclxyXG4gICAgICogdG8gdGhlIGRvY3VtZW50LnJlYWR5IGV2ZW50XHJcbiAgICAgKlxyXG4gICAgICogQHB1YmxpY1xyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHt2b2lkfVxyXG4gICAgICovXHJcbiAgICBpbml0KCkge1xyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBDcmVhdGUgdGhlIHBvcG91dCB3aW5kb3dzIHN0cmFpZ2h0IGF3YXkuIElmIHBvcG91dHMgYXJlIGJsb2NrZWRcclxuICAgICAgICAgKiBhbiBlcnJvciBpcyB0aHJvd24gb24gdGhlIHNhbWUgJ3RocmVhZCcgcmF0aGVyIHRoYW4gYSB0aW1lb3V0IGFuZCBjYW5cclxuICAgICAgICAgKiBiZSBjYXVnaHQuIFRoaXMgYWxzbyBwcmV2ZW50cyBhbnkgZnVydGhlciBpbml0aWxpc2F0aW9uIGZyb20gdGFraW5nIHBsYWNlLlxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGlmICh0aGlzLl9zdWJXaW5kb3dzQ3JlYXRlZCA9PT0gZmFsc2UpIHtcclxuICAgICAgICAgICAgdGhpcy5fY3JlYXRlU3ViV2luZG93cygpO1xyXG4gICAgICAgICAgICB0aGlzLl9zdWJXaW5kb3dzQ3JlYXRlZCA9IHRydWU7XHJcbiAgICAgICAgfVxyXG5cclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogSWYgdGhlIGRvY3VtZW50IGlzbid0IHJlYWR5IHlldCwgd2FpdCBmb3IgaXQuXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgaWYgKGRvY3VtZW50LnJlYWR5U3RhdGUgPT09ICdsb2FkaW5nJyB8fCBkb2N1bWVudC5ib2R5ID09PSBudWxsKSB7XHJcbiAgICAgICAgICAgICQoZG9jdW1lbnQpLnJlYWR5KGZuQmluZCh0aGlzLmluaXQsIHRoaXMpKTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogSWYgdGhpcyBpcyBhIHN1YndpbmRvdywgd2FpdCBhIGZldyBtaWxsaXNlY29uZHMgZm9yIHRoZSBvcmlnaW5hbFxyXG4gICAgICAgICAqIHBhZ2UncyBqcyBjYWxscyB0byBiZSBleGVjdXRlZCwgdGhlbiByZXBsYWNlIHRoZSBib2RpZXMgY29udGVudFxyXG4gICAgICAgICAqIHdpdGggR29sZGVuTGF5b3V0XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgaWYgKHRoaXMuaXNTdWJXaW5kb3cgPT09IHRydWUgJiYgdGhpcy5fY3JlYXRpb25UaW1lb3V0UGFzc2VkID09PSBmYWxzZSkge1xyXG4gICAgICAgICAgICBzZXRUaW1lb3V0KGZuQmluZCh0aGlzLmluaXQsIHRoaXMpLCA3KTtcclxuICAgICAgICAgICAgdGhpcy5fY3JlYXRpb25UaW1lb3V0UGFzc2VkID0gdHJ1ZTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKHRoaXMuaXNTdWJXaW5kb3cgPT09IHRydWUpIHtcclxuICAgICAgICAgICAgdGhpcy5fYWRqdXN0VG9XaW5kb3dNb2RlKCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLl9zZXRDb250YWluZXIoKTtcclxuICAgICAgICB0aGlzLmRyb3BUYXJnZXRJbmRpY2F0b3IgPSBuZXcgRHJvcFRhcmdldEluZGljYXRvcih0aGlzLmNvbnRhaW5lcik7XHJcbiAgICAgICAgdGhpcy50cmFuc2l0aW9uSW5kaWNhdG9yID0gbmV3IFRyYW5zaXRpb25JbmRpY2F0b3IoKTtcclxuICAgICAgICB0aGlzLnVwZGF0ZVNpemUoKTtcclxuICAgICAgICB0aGlzLl9jcmVhdGUodGhpcy5jb25maWcpO1xyXG4gICAgICAgIHRoaXMuX2JpbmRFdmVudHMoKTtcclxuICAgICAgICB0aGlzLmlzSW5pdGlhbGlzZWQgPSB0cnVlO1xyXG4gICAgICAgIHRoaXMuX2FkanVzdENvbHVtbnNSZXNwb25zaXZlKCk7XHJcbiAgICAgICAgdGhpcy5lbWl0KCdpbml0aWFsaXNlZCcpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogVXBkYXRlcyB0aGUgbGF5b3V0IG1hbmFnZXJzIHNpemVcclxuICAgICAqXHJcbiAgICAgKiBAcHVibGljXHJcbiAgICAgKiBAcGFyYW0gICB7W2ludF19IHdpZHRoICBoZWlnaHQgaW4gcGl4ZWxzXHJcbiAgICAgKiBAcGFyYW0gICB7W2ludF19IGhlaWdodCB3aWR0aCBpbiBwaXhlbHNcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJucyB7dm9pZH1cclxuICAgICAqL1xyXG4gICAgdXBkYXRlU2l6ZSh3aWR0aCwgaGVpZ2h0KSB7XHJcbiAgICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDIpIHtcclxuICAgICAgICAgICAgdGhpcy53aWR0aCA9IHdpZHRoO1xyXG4gICAgICAgICAgICB0aGlzLmhlaWdodCA9IGhlaWdodDtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICB0aGlzLndpZHRoID0gdGhpcy5jb250YWluZXIud2lkdGgoKTtcclxuICAgICAgICAgICAgdGhpcy5oZWlnaHQgPSB0aGlzLmNvbnRhaW5lci5oZWlnaHQoKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICh0aGlzLmlzSW5pdGlhbGlzZWQgPT09IHRydWUpIHtcclxuICAgICAgICAgICAgdGhpcy5yb290LmNhbGxEb3dud2FyZHMoJ3NldFNpemUnLCBbdGhpcy53aWR0aCwgdGhpcy5oZWlnaHRdKTtcclxuXHJcbiAgICAgICAgICAgIGlmICh0aGlzLl9tYXhpbWlzZWRJdGVtKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9tYXhpbWlzZWRJdGVtLmVsZW1lbnQud2lkdGgodGhpcy5jb250YWluZXIud2lkdGgoKSk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9tYXhpbWlzZWRJdGVtLmVsZW1lbnQuaGVpZ2h0KHRoaXMuY29udGFpbmVyLmhlaWdodCgpKTtcclxuICAgICAgICAgICAgICAgIHRoaXMuX21heGltaXNlZEl0ZW0uY2FsbERvd253YXJkcygnc2V0U2l6ZScpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB0aGlzLl9hZGp1c3RDb2x1bW5zUmVzcG9uc2l2ZSgpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIERlc3Ryb3lzIHRoZSBMYXlvdXRNYW5hZ2VyIGluc3RhbmNlIGl0c2VsZiBhcyB3ZWxsIGFzIGV2ZXJ5IENvbnRlbnRJdGVtXHJcbiAgICAgKiB3aXRoaW4gaXQuIEFmdGVyIHRoaXMgaXMgY2FsbGVkIG5vdGhpbmcgc2hvdWxkIGJlIGxlZnQgb2YgdGhlIExheW91dE1hbmFnZXIuXHJcbiAgICAgKlxyXG4gICAgICogQHB1YmxpY1xyXG4gICAgICogQHJldHVybnMge3ZvaWR9XHJcbiAgICAgKi9cclxuICAgIGRlc3Ryb3koKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuaXNJbml0aWFsaXNlZCA9PT0gZmFsc2UpIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLl9vblVubG9hZCgpO1xyXG4gICAgICAgICQod2luZG93KS5vZmYoJ3Jlc2l6ZScsIHRoaXMuX3Jlc2l6ZUZ1bmN0aW9uKTtcclxuICAgICAgICAkKHdpbmRvdykub2ZmKCd1bmxvYWQgYmVmb3JldW5sb2FkJywgdGhpcy5fdW5sb2FkRnVuY3Rpb24pO1xyXG4gICAgICAgIHRoaXMucm9vdC5jYWxsRG93bndhcmRzKCdfJGRlc3Ryb3knLCBbXSwgdHJ1ZSk7XHJcbiAgICAgICAgdGhpcy5yb290LmNvbnRlbnRJdGVtcyA9IFtdO1xyXG4gICAgICAgIHRoaXMudGFiRHJvcFBsYWNlaG9sZGVyLnJlbW92ZSgpO1xyXG4gICAgICAgIHRoaXMuZHJvcFRhcmdldEluZGljYXRvci5kZXN0cm95KCk7XHJcbiAgICAgICAgdGhpcy50cmFuc2l0aW9uSW5kaWNhdG9yLmRlc3Ryb3koKTtcclxuICAgICAgICB0aGlzLmV2ZW50SHViLmRlc3Ryb3koKTtcclxuXHJcbiAgICAgICAgdGhpcy5fZHJhZ1NvdXJjZXMuZm9yRWFjaChmdW5jdGlvbihkcmFnU291cmNlKSB7XHJcbiAgICAgICAgICAgIGRyYWdTb3VyY2UuX2RyYWdMaXN0ZW5lci5kZXN0cm95KCk7XHJcbiAgICAgICAgICAgIGRyYWdTb3VyY2UuX2VsZW1lbnQgPSBudWxsO1xyXG4gICAgICAgICAgICBkcmFnU291cmNlLl9pdGVtQ29uZmlnID0gbnVsbDtcclxuICAgICAgICAgICAgZHJhZ1NvdXJjZS5fZHJhZ0xpc3RlbmVyID0gbnVsbDtcclxuICAgICAgICB9KTtcclxuICAgICAgICB0aGlzLl9kcmFnU291cmNlcyA9IFtdO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUmV0dXJucyB3aGV0aGVyIG9yIG5vdCB0aGUgY29uZmlnIGNvcnJlc3BvbmRzIHRvIGEgcmVhY3QgY29tcG9uZW50IG9yIGEgbm9ybWFsIGNvbXBvbmVudC5cclxuICAgICAqIFxyXG4gICAgICogQXQgc29tZSBwb2ludCB0aGUgdHlwZSBpcyBtdXRhdGVkLCBidXQgdGhlIGNvbXBvbmVudE5hbWUgc2hvdWxkIHRoZW4gY29ycmVzcG9uZCB0byB0aGVcclxuICAgICAqIFJFQUNUX0NPTVBPTkVOVF9JRC5cclxuICAgICAqIFxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZyBJdGVtQ29uZmlnXHJcbiAgICAgKiBcclxuICAgICAqIEByZXR1cm5zIHtCb29sZWFufVxyXG4gICAgICovXHJcblxyXG4gICAgaXNSZWFjdENvbmZpZyhjb25maWcpIHtcclxuICAgICAgICByZXR1cm4gY29uZmlnLnR5cGUgPT09ICdyZWFjdC1jb21wb25lbnQnIHx8IGNvbmZpZy5jb21wb25lbnROYW1lID09PSBSRUFDVF9DT01QT05FTlRfSURcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFJldHVybnMgdGhlIG5hbWUgb2YgdGhlIGNvbXBvbmVudCBmb3IgdGhlIGNvbmZpZywgdGFraW5nIGludG8gYWNjb3VudCB3aGV0aGVyIGl0J3MgYSByZWFjdCBjb21wb25lbnQgb3Igbm90LlxyXG4gICAgICogXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gY29uZmlnIEl0ZW1Db25maWdcclxuICAgICAqIFxyXG4gICAgICogQHJldHVybnMge1N0cmluZ31cclxuICAgICAqL1xyXG5cclxuICAgIGdldENvbXBvbmVudE5hbWVGcm9tQ29uZmlnKGNvbmZpZykge1xyXG4gICAgICAgIGlmICh0aGlzLmlzUmVhY3RDb25maWcoY29uZmlnKSkge1xyXG4gICAgICAgICAgICByZXR1cm4gY29uZmlnLmNvbXBvbmVudFxyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gY29uZmlnLmNvbXBvbmVudE5hbWVcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFJlY3Vyc2l2ZWx5IGNyZWF0ZXMgbmV3IGl0ZW0gdHJlZSBzdHJ1Y3R1cmVzIGJhc2VkIG9uIGEgcHJvdmlkZWRcclxuICAgICAqIEl0ZW1Db25maWd1cmF0aW9uIG9iamVjdFxyXG4gICAgICpcclxuICAgICAqIEBwdWJsaWNcclxuICAgICAqIEBwYXJhbSAgIHtPYmplY3R9IGNvbmZpZyBJdGVtQ29uZmlnXHJcbiAgICAgKiBAcGFyYW0gICB7W0NvbnRlbnRJdGVtXX0gcGFyZW50IFRoZSBpdGVtIHRoZSBuZXdseSBjcmVhdGVkIGl0ZW0gc2hvdWxkIGJlIGEgY2hpbGQgb2ZcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJucyB7Q29udGVudEl0ZW19XHJcbiAgICAgKi9cclxuICAgIGNyZWF0ZUNvbnRlbnRJdGVtKGNvbmZpZywgcGFyZW50KSB7XHJcbiAgICAgICAgdmFyIHR5cGVFcnJvck1zZywgY29udGVudEl0ZW07XHJcblxyXG4gICAgICAgIGlmICh0eXBlb2YgY29uZmlnLnR5cGUgIT09ICdzdHJpbmcnKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBDb25maWd1cmF0aW9uRXJyb3IoJ01pc3NpbmcgcGFyYW1ldGVyIFxcJ3R5cGVcXCcnLCBjb25maWcpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKHRoaXMuaXNSZWFjdENvbmZpZyhjb25maWcpKSB7XHJcbiAgICAgICAgICAgIGNvbmZpZy50eXBlID0gJ2NvbXBvbmVudCc7XHJcbiAgICAgICAgICAgIGNvbmZpZy5jb21wb25lbnROYW1lID0gUkVBQ1RfQ09NUE9ORU5UX0lEO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKCF0aGlzLl90eXBlVG9JdGVtW2NvbmZpZy50eXBlXSkge1xyXG4gICAgICAgICAgICB0eXBlRXJyb3JNc2cgPSAnVW5rbm93biB0eXBlIFxcJycgKyBjb25maWcudHlwZSArICdcXCcuICcgK1xyXG4gICAgICAgICAgICAgICAgJ1ZhbGlkIHR5cGVzIGFyZSAnICsgb2JqZWN0S2V5cyh0aGlzLl90eXBlVG9JdGVtKS5qb2luKCcsJyk7XHJcblxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgQ29uZmlndXJhdGlvbkVycm9yKHR5cGVFcnJvck1zZyk7XHJcbiAgICAgICAgfVxyXG5cclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogV2UgYWRkIGFuIGFkZGl0aW9uYWwgc3RhY2sgYXJvdW5kIGV2ZXJ5IGNvbXBvbmVudCB0aGF0J3Mgbm90IHdpdGhpbiBhIHN0YWNrIGFueXdheXMuXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgaWYgKFxyXG4gICAgICAgICAgICAvLyBJZiB0aGlzIGlzIGEgY29tcG9uZW50XHJcbiAgICAgICAgICAgIGNvbmZpZy50eXBlID09PSAnY29tcG9uZW50JyAmJlxyXG5cclxuICAgICAgICAgICAgLy8gYW5kIGl0J3Mgbm90IGFscmVhZHkgd2l0aGluIGEgc3RhY2tcclxuICAgICAgICAgICAgIShwYXJlbnQgaW5zdGFuY2VvZiBTdGFjaykgJiZcclxuXHJcbiAgICAgICAgICAgIC8vIGFuZCB3ZSBoYXZlIGEgcGFyZW50XHJcbiAgICAgICAgICAgICEhcGFyZW50ICYmXHJcblxyXG4gICAgICAgICAgICAvLyBhbmQgaXQncyBub3QgdGhlIHRvcG1vc3QgaXRlbSBpbiBhIG5ldyB3aW5kb3dcclxuICAgICAgICAgICAgISh0aGlzLmlzU3ViV2luZG93ID09PSB0cnVlICYmIHBhcmVudCBpbnN0YW5jZW9mIFJvb3QpXHJcbiAgICAgICAgKSB7XHJcbiAgICAgICAgICAgIGNvbmZpZyA9IHtcclxuICAgICAgICAgICAgICAgIHR5cGU6ICdzdGFjaycsXHJcbiAgICAgICAgICAgICAgICB3aWR0aDogY29uZmlnLndpZHRoLFxyXG4gICAgICAgICAgICAgICAgaGVpZ2h0OiBjb25maWcuaGVpZ2h0LFxyXG4gICAgICAgICAgICAgICAgY29udGVudDogW2NvbmZpZ11cclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNvbnRlbnRJdGVtID0gbmV3IHRoaXMuX3R5cGVUb0l0ZW1bY29uZmlnLnR5cGVdKHRoaXMsIGNvbmZpZywgcGFyZW50KTtcclxuICAgICAgICByZXR1cm4gY29udGVudEl0ZW07XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGVzIGEgcG9wb3V0IHdpbmRvdyB3aXRoIHRoZSBzcGVjaWZpZWQgY29udGVudCBhbmQgZGltZW5zaW9uc1xyXG4gICAgICpcclxuICAgICAqIEBwYXJhbSAgIHtPYmplY3R8bG0uaXRlbXNBYnN0cmFjdENvbnRlbnRJdGVtfSBjb25maWdPckNvbnRlbnRJdGVtXHJcbiAgICAgKiBAcGFyYW0gICB7W09iamVjdF19IGRpbWVuc2lvbnMgQSBtYXAgd2l0aCB3aWR0aCwgaGVpZ2h0LCBsZWZ0IGFuZCB0b3BcclxuICAgICAqIEBwYXJhbSAgICB7W1N0cmluZ119IHBhcmVudElkIHRoZSBpZCBvZiB0aGUgZWxlbWVudCB0aGlzIGl0ZW0gd2lsbCBiZSBhcHBlbmRlZCB0b1xyXG4gICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdoZW4gcG9wSW4gaXMgY2FsbGVkXHJcbiAgICAgKiBAcGFyYW0gICAge1tOdW1iZXJdfSBpbmRleEluUGFyZW50IFRoZSBwb3NpdGlvbiBvZiB0aGlzIGl0ZW0gd2l0aGluIGl0cyBwYXJlbnQgZWxlbWVudFxyXG4gICAgIFxyXG4gICAgICogQHJldHVybnMge0Jyb3dzZXJQb3BvdXR9XHJcbiAgICAgKi9cclxuICAgIGNyZWF0ZVBvcG91dChjb25maWdPckNvbnRlbnRJdGVtLCBkaW1lbnNpb25zLCBwYXJlbnRJZCwgaW5kZXhJblBhcmVudCkge1xyXG4gICAgICAgIHZhciBjb25maWcgPSBjb25maWdPckNvbnRlbnRJdGVtLFxyXG4gICAgICAgICAgICBpc0l0ZW0gPSBjb25maWdPckNvbnRlbnRJdGVtIGluc3RhbmNlb2YgQWJzdHJhY3RDb250ZW50SXRlbSxcclxuICAgICAgICAgICAgc2VsZiA9IHRoaXMsXHJcbiAgICAgICAgICAgIHdpbmRvd0xlZnQsXHJcbiAgICAgICAgICAgIHdpbmRvd1RvcCxcclxuICAgICAgICAgICAgb2Zmc2V0LFxyXG4gICAgICAgICAgICBwYXJlbnQsXHJcbiAgICAgICAgICAgIGNoaWxkLFxyXG4gICAgICAgICAgICBicm93c2VyUG9wb3V0O1xyXG5cclxuICAgICAgICBwYXJlbnRJZCA9IHBhcmVudElkIHx8IG51bGw7XHJcblxyXG4gICAgICAgIGlmIChpc0l0ZW0pIHtcclxuICAgICAgICAgICAgY29uZmlnID0gdGhpcy50b0NvbmZpZyhjb25maWdPckNvbnRlbnRJdGVtKS5jb250ZW50O1xyXG4gICAgICAgICAgICBwYXJlbnRJZCA9IGdldFVuaXF1ZUlkKCk7XHJcblxyXG4gICAgICAgICAgICAvKipcclxuICAgICAgICAgICAgICogSWYgdGhlIGl0ZW0gaXMgdGhlIG9ubHkgY29tcG9uZW50IHdpdGhpbiBhIHN0YWNrIG9yIGZvciBzb21lXHJcbiAgICAgICAgICAgICAqIG90aGVyIHJlYXNvbiB0aGUgb25seSBjaGlsZCBvZiBpdHMgcGFyZW50IHRoZSBwYXJlbnQgd2lsbCBiZSBkZXN0cm95ZWRcclxuICAgICAgICAgICAgICogd2hlbiB0aGUgY2hpbGQgaXMgcmVtb3ZlZC5cclxuICAgICAgICAgICAgICpcclxuICAgICAgICAgICAgICogSW4gb3JkZXIgdG8gc3VwcG9ydCB0aGlzIHdlIG1vdmUgdXAgdGhlIHRyZWUgdW50aWwgd2UgZmluZCBzb21ldGhpbmdcclxuICAgICAgICAgICAgICogdGhhdCB3aWxsIHJlbWFpbiBhZnRlciB0aGUgaXRlbSBpcyBiZWluZyBwb3BwZWQgb3V0XHJcbiAgICAgICAgICAgICAqL1xyXG4gICAgICAgICAgICBwYXJlbnQgPSBjb25maWdPckNvbnRlbnRJdGVtLnBhcmVudDtcclxuICAgICAgICAgICAgY2hpbGQgPSBjb25maWdPckNvbnRlbnRJdGVtO1xyXG4gICAgICAgICAgICB3aGlsZSAocGFyZW50LmNvbnRlbnRJdGVtcy5sZW5ndGggPT09IDEgJiYgIXBhcmVudC5pc1Jvb3QpIHtcclxuICAgICAgICAgICAgICAgIHBhcmVudCA9IHBhcmVudC5wYXJlbnQ7XHJcbiAgICAgICAgICAgICAgICBjaGlsZCA9IGNoaWxkLnBhcmVudDtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgcGFyZW50LmFkZElkKHBhcmVudElkKTtcclxuICAgICAgICAgICAgaWYgKGlzTmFOKGluZGV4SW5QYXJlbnQpKSB7XHJcbiAgICAgICAgICAgICAgICBpbmRleEluUGFyZW50ID0gaW5kZXhPZihjaGlsZCwgcGFyZW50LmNvbnRlbnRJdGVtcyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBpZiAoIShjb25maWcgaW5zdGFuY2VvZiBBcnJheSkpIHtcclxuICAgICAgICAgICAgICAgIGNvbmZpZyA9IFtjb25maWddO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuXHJcbiAgICAgICAgaWYgKCFkaW1lbnNpb25zICYmIGlzSXRlbSkge1xyXG4gICAgICAgICAgICB3aW5kb3dMZWZ0ID0gd2luZG93LnNjcmVlblggfHwgd2luZG93LnNjcmVlbkxlZnQ7XHJcbiAgICAgICAgICAgIHdpbmRvd1RvcCA9IHdpbmRvdy5zY3JlZW5ZIHx8IHdpbmRvdy5zY3JlZW5Ub3A7XHJcbiAgICAgICAgICAgIG9mZnNldCA9IGNvbmZpZ09yQ29udGVudEl0ZW0uZWxlbWVudC5vZmZzZXQoKTtcclxuXHJcbiAgICAgICAgICAgIGRpbWVuc2lvbnMgPSB7XHJcbiAgICAgICAgICAgICAgICBsZWZ0OiB3aW5kb3dMZWZ0ICsgb2Zmc2V0LmxlZnQsXHJcbiAgICAgICAgICAgICAgICB0b3A6IHdpbmRvd1RvcCArIG9mZnNldC50b3AsXHJcbiAgICAgICAgICAgICAgICB3aWR0aDogY29uZmlnT3JDb250ZW50SXRlbS5lbGVtZW50LndpZHRoKCksXHJcbiAgICAgICAgICAgICAgICBoZWlnaHQ6IGNvbmZpZ09yQ29udGVudEl0ZW0uZWxlbWVudC5oZWlnaHQoKVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKCFkaW1lbnNpb25zICYmICFpc0l0ZW0pIHtcclxuICAgICAgICAgICAgZGltZW5zaW9ucyA9IHtcclxuICAgICAgICAgICAgICAgIGxlZnQ6IHdpbmRvdy5zY3JlZW5YIHx8IHdpbmRvdy5zY3JlZW5MZWZ0ICsgMjAsXHJcbiAgICAgICAgICAgICAgICB0b3A6IHdpbmRvdy5zY3JlZW5ZIHx8IHdpbmRvdy5zY3JlZW5Ub3AgKyAyMCxcclxuICAgICAgICAgICAgICAgIHdpZHRoOiA1MDAsXHJcbiAgICAgICAgICAgICAgICBoZWlnaHQ6IDMwOVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKGlzSXRlbSkge1xyXG4gICAgICAgICAgICBjb25maWdPckNvbnRlbnRJdGVtLnJlbW92ZSgpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgYnJvd3NlclBvcG91dCA9IG5ldyBCcm93c2VyUG9wb3V0KGNvbmZpZywgZGltZW5zaW9ucywgcGFyZW50SWQsIGluZGV4SW5QYXJlbnQsIHRoaXMpO1xyXG5cclxuICAgICAgICBicm93c2VyUG9wb3V0Lm9uKCdpbml0aWFsaXNlZCcsIGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICBzZWxmLmVtaXQoJ3dpbmRvd09wZW5lZCcsIGJyb3dzZXJQb3BvdXQpO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBicm93c2VyUG9wb3V0Lm9uKCdjbG9zZWQnLCBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgc2VsZi5fJHJlY29uY2lsZVBvcG91dFdpbmRvd3MoKTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgdGhpcy5vcGVuUG9wb3V0cy5wdXNoKGJyb3dzZXJQb3BvdXQpO1xyXG5cclxuICAgICAgICByZXR1cm4gYnJvd3NlclBvcG91dDtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEF0dGFjaGVzIERyYWdMaXN0ZW5lciB0byBhbnkgZ2l2ZW4gRE9NIGVsZW1lbnRcclxuICAgICAqIGFuZCB0dXJucyBpdCBpbnRvIGEgd2F5IG9mIGNyZWF0aW5nIG5ldyBDb250ZW50SXRlbXNcclxuICAgICAqIGJ5ICdkcmFnZ2luZycgdGhlIERPTSBlbGVtZW50IGludG8gdGhlIGxheW91dFxyXG4gICAgICpcclxuICAgICAqIEBwYXJhbSAgIHtqUXVlcnkgRE9NIGVsZW1lbnR9IGVsZW1lbnRcclxuICAgICAqIEBwYXJhbSAgIHtPYmplY3R8RnVuY3Rpb259IGl0ZW1Db25maWcgZm9yIHRoZSBuZXcgaXRlbSB0byBiZSBjcmVhdGVkLCBvciBhIGZ1bmN0aW9uIHdoaWNoIHdpbGwgcHJvdmlkZSBpdFxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHtEcmFnU291cmNlfSAgYW4gb3BhcXVlIG9iamVjdCB0aGF0IGlkZW50aWZpZXMgdGhlIERPTSBlbGVtZW50XHJcblx0ICogICAgICAgICAgYW5kIHRoZSBhdHRhY2hlZCBpdGVtQ29uZmlnLiBUaGlzIGNhbiBiZSB1c2VkIGluXHJcblx0ICogICAgICAgICAgcmVtb3ZlRHJhZ1NvdXJjZSgpIGxhdGVyIHRvIGdldCByaWQgb2YgdGhlIGRyYWcgbGlzdGVuZXJzLlxyXG4gICAgICovXHJcbiAgICBjcmVhdGVEcmFnU291cmNlKGVsZW1lbnQsIGl0ZW1Db25maWcpIHtcclxuICAgICAgICB0aGlzLmNvbmZpZy5zZXR0aW5ncy5jb25zdHJhaW5EcmFnVG9Db250YWluZXIgPSBmYWxzZTtcclxuICAgICAgICB2YXIgZHJhZ1NvdXJjZSA9IG5ldyBEcmFnU291cmNlKCQoZWxlbWVudCksIGl0ZW1Db25maWcsIHRoaXMpO1xyXG4gICAgICAgIHRoaXMuX2RyYWdTb3VyY2VzLnB1c2goZHJhZ1NvdXJjZSk7XHJcblxyXG4gICAgICAgIHJldHVybiBkcmFnU291cmNlO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG5cdCAqIFJlbW92ZXMgYSBEcmFnTGlzdGVuZXIgYWRkZWQgYnkgY3JlYXRlRHJhZ1NvdXJjZSgpIHNvIHRoZSBjb3JyZXNwb25kaW5nXHJcblx0ICogRE9NIGVsZW1lbnQgaXMgbm90IGEgZHJhZyBzb3VyY2UgYW55IG1vcmUuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gICB7alF1ZXJ5IERPTSBlbGVtZW50fSBlbGVtZW50XHJcblx0ICpcclxuXHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHQgKi9cclxuXHRyZW1vdmVEcmFnU291cmNlKGRyYWdTb3VyY2UpIHtcclxuXHRcdGRyYWdTb3VyY2UuZGVzdHJveSgpO1xyXG5cdFx0bG0udXRpbHMucmVtb3ZlRnJvbUFycmF5KCBkcmFnU291cmNlLCB0aGlzLl9kcmFnU291cmNlcyApO1xyXG5cdH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFByb2dyYW1tYXRpY2FsbHkgc2VsZWN0cyBhbiBpdGVtLiBUaGlzIGRlc2VsZWN0c1xyXG4gICAgICogdGhlIGN1cnJlbnRseSBzZWxlY3RlZCBpdGVtLCBzZWxlY3RzIHRoZSBzcGVjaWZpZWQgaXRlbVxyXG4gICAgICogYW5kIGVtaXRzIGEgc2VsZWN0aW9uQ2hhbmdlZCBldmVudFxyXG4gICAgICpcclxuICAgICAqIEBwYXJhbSAgIHtBYnN0cmFjdENvbnRlbnRJdGVtfSBpdGVtI1xyXG4gICAgICogQHBhcmFtICAge1tCb29sZWFuXX0gXyRzaWxlbnQgV2hlYXRoZXIgdG8gbm90aWZ5IHRoZSBpdGVtIG9mIGl0cyBzZWxlY3Rpb25cclxuICAgICAqIEBldmVudCAgICBzZWxlY3Rpb25DaGFuZ2VkXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge1ZPSUR9XHJcbiAgICAgKi9cclxuICAgIHNlbGVjdEl0ZW0oaXRlbSwgXyRzaWxlbnQpIHtcclxuXHJcbiAgICAgICAgaWYgKHRoaXMuY29uZmlnLnNldHRpbmdzLnNlbGVjdGlvbkVuYWJsZWQgIT09IHRydWUpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdQbGVhc2Ugc2V0IHNlbGVjdGlvbkVuYWJsZWQgdG8gdHJ1ZSB0byB1c2UgdGhpcyBmZWF0dXJlJyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoaXRlbSA9PT0gdGhpcy5zZWxlY3RlZEl0ZW0pIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKHRoaXMuc2VsZWN0ZWRJdGVtICE9PSBudWxsKSB7XHJcbiAgICAgICAgICAgIHRoaXMuc2VsZWN0ZWRJdGVtLmRlc2VsZWN0KCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoaXRlbSAmJiBfJHNpbGVudCAhPT0gdHJ1ZSkge1xyXG4gICAgICAgICAgICBpdGVtLnNlbGVjdCgpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5zZWxlY3RlZEl0ZW0gPSBpdGVtO1xyXG5cclxuICAgICAgICB0aGlzLmVtaXQoJ3NlbGVjdGlvbkNoYW5nZWQnLCBpdGVtKTtcclxuICAgIH1cclxuXHJcbiAgICAvKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG4gICAgICogUEFDS0FHRSBQUklWQVRFXHJcbiAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKi9cclxuICAgIF8kbWF4aW1pc2VJdGVtKGNvbnRlbnRJdGVtKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuX21heGltaXNlZEl0ZW0gIT09IG51bGwpIHtcclxuICAgICAgICAgICAgdGhpcy5fJG1pbmltaXNlSXRlbSh0aGlzLl9tYXhpbWlzZWRJdGVtKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5fbWF4aW1pc2VkSXRlbSA9IGNvbnRlbnRJdGVtO1xyXG4gICAgICAgIGNvbnRlbnRJdGVtLm9uKCAnYmVmb3JlSXRlbURlc3Ryb3llZCcsIHRoaXMuXyRjbGVhbnVwQmVmb3JlTWF4aW1pc2VkSXRlbURlc3Ryb3llZCwgdGhpcyApO1xyXG4gICAgICAgIHRoaXMuX21heGltaXNlZEl0ZW0uYWRkSWQoJ19fZ2xNYXhpbWlzZWQnKTtcclxuICAgICAgICBjb250ZW50SXRlbS5lbGVtZW50LmFkZENsYXNzKCdsbV9tYXhpbWlzZWQnKTtcclxuICAgICAgICBjb250ZW50SXRlbS5lbGVtZW50LmFmdGVyKHRoaXMuX21heGltaXNlUGxhY2Vob2xkZXIpO1xyXG4gICAgICAgIHRoaXMucm9vdC5lbGVtZW50LnByZXBlbmQoY29udGVudEl0ZW0uZWxlbWVudCk7XHJcbiAgICAgICAgY29udGVudEl0ZW0uZWxlbWVudC53aWR0aCh0aGlzLmNvbnRhaW5lci53aWR0aCgpKTtcclxuICAgICAgICBjb250ZW50SXRlbS5lbGVtZW50LmhlaWdodCh0aGlzLmNvbnRhaW5lci5oZWlnaHQoKSk7XHJcbiAgICAgICAgY29udGVudEl0ZW0uY2FsbERvd253YXJkcygnc2V0U2l6ZScpO1xyXG4gICAgICAgIHRoaXMuX21heGltaXNlZEl0ZW0uZW1pdCgnbWF4aW1pc2VkJyk7XHJcbiAgICAgICAgdGhpcy5lbWl0KCdzdGF0ZUNoYW5nZWQnKTtcclxuICAgIH1cclxuXHJcbiAgICBfJG1pbmltaXNlSXRlbShjb250ZW50SXRlbSkge1xyXG4gICAgICAgIGNvbnRlbnRJdGVtLmVsZW1lbnQucmVtb3ZlQ2xhc3MoJ2xtX21heGltaXNlZCcpO1xyXG4gICAgICAgIGNvbnRlbnRJdGVtLnJlbW92ZUlkKCdfX2dsTWF4aW1pc2VkJyk7XHJcbiAgICAgICAgdGhpcy5fbWF4aW1pc2VQbGFjZWhvbGRlci5hZnRlcihjb250ZW50SXRlbS5lbGVtZW50KTtcclxuICAgICAgICB0aGlzLl9tYXhpbWlzZVBsYWNlaG9sZGVyLnJlbW92ZSgpO1xyXG4gICAgICAgIGNvbnRlbnRJdGVtLnBhcmVudC5jYWxsRG93bndhcmRzKCdzZXRTaXplJyk7XHJcbiAgICAgICAgdGhpcy5fbWF4aW1pc2VkSXRlbSA9IG51bGw7XHJcbiAgICAgICAgY29udGVudEl0ZW0ub2ZmKCAnYmVmb3JlSXRlbURlc3Ryb3llZCcsIHRoaXMuXyRjbGVhbnVwQmVmb3JlTWF4aW1pc2VkSXRlbURlc3Ryb3llZCwgdGhpcyApO1xyXG4gICAgICAgIGNvbnRlbnRJdGVtLmVtaXQoJ21pbmltaXNlZCcpO1xyXG4gICAgICAgIHRoaXMuZW1pdCgnc3RhdGVDaGFuZ2VkJyk7XHJcbiAgICB9XHJcblxyXG4gICAgXyRjbGVhbnVwQmVmb3JlTWF4aW1pc2VkSXRlbURlc3Ryb3llZCgpIHtcclxuXHRcdGlmICh0aGlzLl9tYXhpbWlzZWRJdGVtID09PSBldmVudC5vcmlnaW4pIHtcclxuXHRcdFx0dGhpcy5fbWF4aW1pc2VkSXRlbS5vZmYoICdiZWZvcmVJdGVtRGVzdHJveWVkJywgdGhpcy5fJGNsZWFudXBCZWZvcmVNYXhpbWlzZWRJdGVtRGVzdHJveWVkLCB0aGlzICk7XHJcblx0XHRcdHRoaXMuX21heGltaXNlZEl0ZW0gPSBudWxsO1xyXG5cdFx0fVxyXG4gICAgfVxyXG4gICAgXHJcbiAgICAvKipcclxuICAgICAqIFRoaXMgbWV0aG9kIGlzIHVzZWQgdG8gZ2V0IGFyb3VuZCBzYW5kYm94ZWQgaWZyYW1lIHJlc3RyaWN0aW9ucy5cclxuICAgICAqIElmICdhbGxvdy10b3AtbmF2aWdhdGlvbicgaXMgbm90IHNwZWNpZmllZCBpbiB0aGUgaWZyYW1lJ3MgJ3NhbmRib3gnIGF0dHJpYnV0ZVxyXG4gICAgICogKGFzIGlzIHRoZSBjYXNlIHdpdGggY29kZXBlbnMpIHRoZSBwYXJlbnQgd2luZG93IGlzIGZvcmJpZGRlbiBmcm9tIGNhbGxpbmcgY2VydGFpblxyXG4gICAgICogbWV0aG9kcyBvbiB0aGUgY2hpbGQsIHN1Y2ggYXMgd2luZG93LmNsb3NlKCkgb3Igc2V0dGluZyBkb2N1bWVudC5sb2NhdGlvbi5ocmVmLlxyXG4gICAgICpcclxuICAgICAqIFRoaXMgcHJldmVudGVkIEdvbGRlbkxheW91dCBwb3BvdXRzIGZyb20gcG9wcGluZyBpbiBpbiBjb2RlcGVucy4gVGhlIGZpeCBpcyB0byBjYWxsXHJcbiAgICAgKiBfJGNsb3NlV2luZG93IG9uIHRoZSBjaGlsZCB3aW5kb3cncyBnbCBpbnN0YW5jZSB3aGljaCAoYWZ0ZXIgYSB0aW1lb3V0IHRvIGRpc2Nvbm5lY3RcclxuICAgICAqIHRoZSBpbnZva2luZyBtZXRob2QgZnJvbSB0aGUgY2xvc2UgY2FsbCkgY2xvc2VzIGl0c2VsZi5cclxuICAgICAqXHJcbiAgICAgKiBAcGFja2FnZVByaXZhdGVcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJucyB7dm9pZH1cclxuICAgICAqL1xyXG4gICAgXyRjbG9zZVdpbmRvdygpIHtcclxuICAgICAgICB3aW5kb3cuc2V0VGltZW91dChmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgd2luZG93LmNsb3NlKCk7XHJcbiAgICAgICAgfSwgMSk7XHJcbiAgICB9XHJcblxyXG4gICAgXyRnZXRBcmVhKHgsIHkpIHtcclxuICAgICAgICB2YXIgaSwgYXJlYSwgc21hbGxlc3RTdXJmYWNlID0gSW5maW5pdHksXHJcbiAgICAgICAgICAgIG1hdGhpbmdBcmVhID0gbnVsbDtcclxuXHJcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IHRoaXMuX2l0ZW1BcmVhcy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICBhcmVhID0gdGhpcy5faXRlbUFyZWFzW2ldO1xyXG5cclxuICAgICAgICAgICAgaWYgKFxyXG4gICAgICAgICAgICAgICAgeCA+IGFyZWEueDEgJiZcclxuICAgICAgICAgICAgICAgIHggPCBhcmVhLngyICYmXHJcbiAgICAgICAgICAgICAgICB5ID4gYXJlYS55MSAmJlxyXG4gICAgICAgICAgICAgICAgeSA8IGFyZWEueTIgJiZcclxuICAgICAgICAgICAgICAgIHNtYWxsZXN0U3VyZmFjZSA+IGFyZWEuc3VyZmFjZVxyXG4gICAgICAgICAgICApIHtcclxuICAgICAgICAgICAgICAgIHNtYWxsZXN0U3VyZmFjZSA9IGFyZWEuc3VyZmFjZTtcclxuICAgICAgICAgICAgICAgIG1hdGhpbmdBcmVhID0gYXJlYTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIG1hdGhpbmdBcmVhO1xyXG4gICAgfVxyXG5cclxuICAgIF8kY3JlYXRlUm9vdEl0ZW1BcmVhcygpIHtcclxuICAgICAgICB2YXIgYXJlYVNpemUgPSA1MDtcclxuICAgICAgICB2YXIgc2lkZXMgPSB7XHJcbiAgICAgICAgICAgIHkyOiAneTEnLFxyXG4gICAgICAgICAgICB4MjogJ3gxJyxcclxuICAgICAgICAgICAgeTE6ICd5MicsXHJcbiAgICAgICAgICAgIHgxOiAneDInXHJcbiAgICAgICAgfTtcclxuICAgICAgICBmb3IgKHZhciBzaWRlIGluIHNpZGVzKSB7XHJcbiAgICAgICAgICAgIHZhciBhcmVhID0gdGhpcy5yb290Ll8kZ2V0QXJlYSgpO1xyXG4gICAgICAgICAgICBhcmVhLnNpZGUgPSBzaWRlO1xyXG4gICAgICAgICAgICBpZiAoc2lkZXNbc2lkZV1bMV0gPT09ICcyJyApXHJcbiAgICAgICAgICAgICAgICBhcmVhW3NpZGVdID0gYXJlYVtzaWRlc1tzaWRlXV0gLSBhcmVhU2l6ZTtcclxuICAgICAgICAgICAgZWxzZVxyXG4gICAgICAgICAgICAgICAgYXJlYVtzaWRlXSA9IGFyZWFbc2lkZXNbc2lkZV1dICsgYXJlYVNpemU7XHJcbiAgICAgICAgICAgIGFyZWEuc3VyZmFjZSA9IChhcmVhLngyIC0gYXJlYS54MSkgKiAoYXJlYS55MiAtIGFyZWEueTEpO1xyXG4gICAgICAgICAgICB0aGlzLl9pdGVtQXJlYXMucHVzaChhcmVhKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgXyRjYWxjdWxhdGVJdGVtQXJlYXMoKSB7XHJcbiAgICAgICAgdmFyIGksIGFyZWEsIGFsbENvbnRlbnRJdGVtcyA9IHRoaXMuX2dldEFsbENvbnRlbnRJdGVtcygpO1xyXG4gICAgICAgIHRoaXMuX2l0ZW1BcmVhcyA9IFtdO1xyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBJZiB0aGUgbGFzdCBpdGVtIGlzIGRyYWdnZWQgb3V0LCBoaWdobGlnaHQgdGhlIGVudGlyZSBjb250YWluZXIgc2l6ZSB0b1xyXG4gICAgICAgICAqIGFsbG93IHRvIHJlLWRyb3AgaXQuIGFsbENvbnRlbnRJdGVtc1sgMCBdID09PSB0aGlzLnJvb3QgYXQgdGhpcyBwb2ludFxyXG4gICAgICAgICAqXHJcbiAgICAgICAgICogRG9uJ3QgaW5jbHVkZSByb290IGludG8gdGhlIHBvc3NpYmxlIGRyb3AgYXJlYXMgdGhvdWdoIG90aGVyd2lzZSBzaW5jZSBpdFxyXG4gICAgICAgICAqIHdpbGwgdXNlZCBmb3IgZXZlcnkgZ2FwIGluIHRoZSBsYXlvdXQsIGUuZy4gc3BsaXR0ZXJzXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgaWYgKGFsbENvbnRlbnRJdGVtcy5sZW5ndGggPT09IDEpIHtcclxuICAgICAgICAgICAgdGhpcy5faXRlbUFyZWFzLnB1c2godGhpcy5yb290Ll8kZ2V0QXJlYSgpKTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLl8kY3JlYXRlUm9vdEl0ZW1BcmVhcygpO1xyXG5cclxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgYWxsQ29udGVudEl0ZW1zLmxlbmd0aDsgaSsrKSB7XHJcblxyXG4gICAgICAgICAgICBpZiAoIShhbGxDb250ZW50SXRlbXNbaV0uaXNTdGFjaykpIHtcclxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBhcmVhID0gYWxsQ29udGVudEl0ZW1zW2ldLl8kZ2V0QXJlYSgpO1xyXG5cclxuICAgICAgICAgICAgaWYgKGFyZWEgPT09IG51bGwpIHtcclxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICB9IGVsc2UgaWYgKGFyZWEgaW5zdGFuY2VvZiBBcnJheSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5faXRlbUFyZWFzID0gdGhpcy5faXRlbUFyZWFzLmNvbmNhdChhcmVhKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuX2l0ZW1BcmVhcy5wdXNoKGFyZWEpO1xyXG4gICAgICAgICAgICAgICAgdmFyIGhlYWRlciA9IHt9O1xyXG4gICAgICAgICAgICAgICAgY29weShoZWFkZXIsIGFyZWEpO1xyXG4gICAgICAgICAgICAgICAgY29weShoZWFkZXIsIGFyZWEuY29udGVudEl0ZW0uX2NvbnRlbnRBcmVhRGltZW5zaW9ucy5oZWFkZXIuaGlnaGxpZ2h0QXJlYSk7XHJcbiAgICAgICAgICAgICAgICBoZWFkZXIuc3VyZmFjZSA9IChoZWFkZXIueDIgLSBoZWFkZXIueDEpICogKGhlYWRlci55MiAtIGhlYWRlci55MSk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9pdGVtQXJlYXMucHVzaChoZWFkZXIpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogVGFrZXMgYSBjb250ZW50SXRlbSBvciBhIGNvbmZpZ3VyYXRpb24gYW5kIG9wdGlvbmFsbHkgYSBwYXJlbnRcclxuICAgICAqIGl0ZW0gYW5kIHJldHVybnMgYW4gaW5pdGlhbGlzZWQgaW5zdGFuY2Ugb2YgdGhlIGNvbnRlbnRJdGVtLlxyXG4gICAgICogSWYgdGhlIGNvbnRlbnRJdGVtIGlzIGEgZnVuY3Rpb24sIGl0IGlzIGZpcnN0IGNhbGxlZFxyXG4gICAgICpcclxuICAgICAqIEBwYWNrYWdlUHJpdmF0ZVxyXG4gICAgICpcclxuICAgICAqIEBwYXJhbSAgIHtBYnRyYWN0Q29udGVudEl0ZW18T2JqZWN0fEZ1bmN0aW9ufSBjb250ZW50SXRlbU9yQ29uZmlnXHJcbiAgICAgKiBAcGFyYW0gICB7QWJ0cmFjdENvbnRlbnRJdGVtfSBwYXJlbnQgT25seSBuZWNlc3Nhcnkgd2hlbiBwYXNzaW5nIGluIGNvbmZpZ1xyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHtBYnRyYWN0Q29udGVudEl0ZW19XHJcbiAgICAgKi9cclxuICAgIF8kbm9ybWFsaXplQ29udGVudEl0ZW0oY29udGVudEl0ZW1PckNvbmZpZywgcGFyZW50KSB7XHJcbiAgICAgICAgaWYgKCFjb250ZW50SXRlbU9yQ29uZmlnKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignTm8gY29udGVudCBpdGVtIGRlZmluZWQnKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmIChpc0Z1bmN0aW9uKGNvbnRlbnRJdGVtT3JDb25maWcpKSB7XHJcbiAgICAgICAgICAgIGNvbnRlbnRJdGVtT3JDb25maWcgPSBjb250ZW50SXRlbU9yQ29uZmlnKCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoY29udGVudEl0ZW1PckNvbmZpZyBpbnN0YW5jZW9mIEFic3RyYWN0Q29udGVudEl0ZW0pIHtcclxuICAgICAgICAgICAgcmV0dXJuIGNvbnRlbnRJdGVtT3JDb25maWc7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoJC5pc1BsYWluT2JqZWN0KGNvbnRlbnRJdGVtT3JDb25maWcpICYmIGNvbnRlbnRJdGVtT3JDb25maWcudHlwZSkge1xyXG4gICAgICAgICAgICB2YXIgbmV3Q29udGVudEl0ZW0gPSB0aGlzLmNyZWF0ZUNvbnRlbnRJdGVtKGNvbnRlbnRJdGVtT3JDb25maWcsIHBhcmVudCk7XHJcbiAgICAgICAgICAgIG5ld0NvbnRlbnRJdGVtLmNhbGxEb3dud2FyZHMoJ18kaW5pdCcpO1xyXG4gICAgICAgICAgICByZXR1cm4gbmV3Q29udGVudEl0ZW07XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGNvbnRlbnRJdGVtJyk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogSXRlcmF0ZXMgdGhyb3VnaCB0aGUgYXJyYXkgb2Ygb3BlbiBwb3BvdXQgd2luZG93cyBhbmQgcmVtb3ZlcyB0aGUgb25lc1xyXG4gICAgICogdGhhdCBhcmUgZWZmZWN0aXZlbHkgY2xvc2VkLiBUaGlzIGlzIG5lY2Vzc2FyeSBkdWUgdG8gdGhlIGxhY2sgb2YgcmVsaWFibHlcclxuICAgICAqIGxpc3RlbmluZyBmb3Igd2luZG93LmNsb3NlIC8gdW5sb2FkIGV2ZW50cyBpbiBhIGNyb3NzIGJyb3dzZXIgY29tcGF0aWJsZSBmYXNoaW9uLlxyXG4gICAgICpcclxuICAgICAqIEBwYWNrYWdlUHJpdmF0ZVxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHt2b2lkfVxyXG4gICAgICovXHJcbiAgICBfJHJlY29uY2lsZVBvcG91dFdpbmRvd3MoKSB7XHJcbiAgICAgICAgdmFyIG9wZW5Qb3BvdXRzID0gW10sXHJcbiAgICAgICAgICAgIGk7XHJcblxyXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCB0aGlzLm9wZW5Qb3BvdXRzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLm9wZW5Qb3BvdXRzW2ldLmdldFdpbmRvdygpLmNsb3NlZCA9PT0gZmFsc2UpIHtcclxuICAgICAgICAgICAgICAgIG9wZW5Qb3BvdXRzLnB1c2godGhpcy5vcGVuUG9wb3V0c1tpXSk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmVtaXQoJ3dpbmRvd0Nsb3NlZCcsIHRoaXMub3BlblBvcG91dHNbaV0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAodGhpcy5vcGVuUG9wb3V0cy5sZW5ndGggIT09IG9wZW5Qb3BvdXRzLmxlbmd0aCkge1xyXG4gICAgICAgICAgICB0aGlzLm9wZW5Qb3BvdXRzID0gb3BlblBvcG91dHM7XHJcbiAgICAgICAgICAgIHRoaXMuZW1pdCgnc3RhdGVDaGFuZ2VkJyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgIH1cclxuXHJcbiAgICAvKioqKioqKioqKioqKioqKioqKioqKioqKioqXHJcbiAgICAgKiBQUklWQVRFXHJcbiAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xyXG4gICAgLyoqXHJcbiAgICAgKiBSZXR1cm5zIGEgZmxhdHRlbmVkIGFycmF5IG9mIGFsbCBjb250ZW50IGl0ZW1zLFxyXG4gICAgICogcmVnYXJkbGVzIG9mIGxldmVsIG9yIHR5cGVcclxuICAgICAqXHJcbiAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHt2b2lkfVxyXG4gICAgICovXHJcbiAgICBfZ2V0QWxsQ29udGVudEl0ZW1zKCkge1xyXG4gICAgICAgIHZhciBhbGxDb250ZW50SXRlbXMgPSBbXTtcclxuXHJcbiAgICAgICAgdmFyIGFkZENoaWxkcmVuID0gZnVuY3Rpb24oY29udGVudEl0ZW0pIHtcclxuICAgICAgICAgICAgYWxsQ29udGVudEl0ZW1zLnB1c2goY29udGVudEl0ZW0pO1xyXG5cclxuICAgICAgICAgICAgaWYgKGNvbnRlbnRJdGVtLmNvbnRlbnRJdGVtcyBpbnN0YW5jZW9mIEFycmF5KSB7XHJcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNvbnRlbnRJdGVtLmNvbnRlbnRJdGVtcy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICAgICAgICAgIGFkZENoaWxkcmVuKGNvbnRlbnRJdGVtLmNvbnRlbnRJdGVtc1tpXSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICBhZGRDaGlsZHJlbih0aGlzLnJvb3QpO1xyXG5cclxuICAgICAgICByZXR1cm4gYWxsQ29udGVudEl0ZW1zO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQmluZHMgdG8gRE9NL0JPTSBldmVudHMgb24gaW5pdFxyXG4gICAgICpcclxuICAgICAqIEBwcml2YXRlXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge3ZvaWR9XHJcbiAgICAgKi9cclxuICAgIF9iaW5kRXZlbnRzKCkge1xyXG4gICAgICAgIGlmICh0aGlzLl9pc0Z1bGxQYWdlKSB7XHJcbiAgICAgICAgICAgICQod2luZG93KS5yZXNpemUodGhpcy5fcmVzaXplRnVuY3Rpb24pO1xyXG4gICAgICAgIH1cclxuICAgICAgICAkKHdpbmRvdykub24oJ3VubG9hZCBiZWZvcmV1bmxvYWQnLCB0aGlzLl91bmxvYWRGdW5jdGlvbik7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBEZWJvdW5jZXMgcmVzaXplIGV2ZW50c1xyXG4gICAgICpcclxuICAgICAqIEBwcml2YXRlXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge3ZvaWR9XHJcbiAgICAgKi9cclxuICAgIF9vblJlc2l6ZSgpIHtcclxuICAgICAgICBjbGVhclRpbWVvdXQodGhpcy5fcmVzaXplVGltZW91dElkKTtcclxuICAgICAgICB0aGlzLl9yZXNpemVUaW1lb3V0SWQgPSBzZXRUaW1lb3V0KGZuQmluZCh0aGlzLnVwZGF0ZVNpemUsIHRoaXMpLCAxMDApO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogRXh0ZW5kcyB0aGUgZGVmYXVsdCBjb25maWcgd2l0aCB0aGUgdXNlciBzcGVjaWZpYyBzZXR0aW5ncyBhbmQgYXBwbGllc1xyXG4gICAgICogZGVyaXZhdGlvbnMuIFBsZWFzZSBub3RlIHRoYXQgdGhlcmUncyBhIHNlcGFyYXRlIG1ldGhvZCAoQWJzdHJhY3RDb250ZW50SXRlbS5fZXh0ZW5kSXRlbU5vZGUpXHJcbiAgICAgKiB0aGF0IGRlYWxzIHdpdGggdGhlIGV4dGVuc2lvbiBvZiBpdGVtIGNvbmZpZ3NcclxuICAgICAqXHJcbiAgICAgKiBAcGFyYW0gICB7T2JqZWN0fSBjb25maWdcclxuICAgICAqIEBzdGF0aWNcclxuICAgICAqIEByZXR1cm5zIHtPYmplY3R9IGNvbmZpZ1xyXG4gICAgICovXHJcbiAgICBfY3JlYXRlQ29uZmlnKGNvbmZpZykge1xyXG4gICAgICAgIHZhciB3aW5kb3dDb25maWdLZXkgPSBnZXRRdWVyeVN0cmluZ1BhcmFtKCdnbC13aW5kb3cnKTtcclxuXHJcbiAgICAgICAgaWYgKHdpbmRvd0NvbmZpZ0tleSkge1xyXG4gICAgICAgICAgICB0aGlzLmlzU3ViV2luZG93ID0gdHJ1ZTtcclxuICAgICAgICAgICAgY29uZmlnID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0od2luZG93Q29uZmlnS2V5KTtcclxuICAgICAgICAgICAgY29uZmlnID0gSlNPTi5wYXJzZShjb25maWcpO1xyXG4gICAgICAgICAgICBjb25maWcgPSAobmV3IENvbmZpZ01pbmlmaWVyKCkpLnVubWluaWZ5Q29uZmlnKGNvbmZpZyk7XHJcbiAgICAgICAgICAgIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKHdpbmRvd0NvbmZpZ0tleSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25maWcgPSAkLmV4dGVuZCh0cnVlLCB7fSwgZGVmYXVsdENvbmZpZywgY29uZmlnKTtcclxuXHJcbiAgICAgICAgdmFyIG5leHROb2RlID0gKG5vZGUpID0+IHtcclxuICAgICAgICAgICAgZm9yICh2YXIga2V5IGluIG5vZGUpIHtcclxuICAgICAgICAgICAgICAgIGlmIChrZXkgIT09ICdwcm9wcycgJiYgdHlwZW9mIG5vZGVba2V5XSA9PT0gJ29iamVjdCcpIHtcclxuICAgICAgICAgICAgICAgICAgICBuZXh0Tm9kZShub2RlW2tleV0pO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChrZXkgPT09ICd0eXBlJyAmJiB0aGlzLmlzUmVhY3RDb25maWcobm9kZSkpIHtcclxuICAgICAgICAgICAgICAgICAgICBub2RlLnR5cGUgPSAnY29tcG9uZW50JztcclxuICAgICAgICAgICAgICAgICAgICBub2RlLmNvbXBvbmVudE5hbWUgPSBSRUFDVF9DT01QT05FTlRfSUQ7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIG5leHROb2RlKGNvbmZpZyk7XHJcblxyXG4gICAgICAgIGlmIChjb25maWcuc2V0dGluZ3MuaGFzSGVhZGVycyA9PT0gZmFsc2UpIHtcclxuICAgICAgICAgICAgY29uZmlnLmRpbWVuc2lvbnMuaGVhZGVySGVpZ2h0ID0gMDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBjb25maWc7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBUaGlzIGlzIGV4ZWN1dGVkIHdoZW4gR29sZGVuTGF5b3V0IGRldGVjdHMgdGhhdCBpdCBpcyBydW5cclxuICAgICAqIHdpdGhpbiBhIHByZXZpb3VzbHkgb3BlbmVkIHBvcG91dCB3aW5kb3cuXHJcbiAgICAgKlxyXG4gICAgICogQHByaXZhdGVcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJucyB7dm9pZH1cclxuICAgICAqL1xyXG4gICAgX2FkanVzdFRvV2luZG93TW9kZSgpIHtcclxuICAgICAgICB2YXIgcG9wSW5CdXR0b24gPSAkKCc8ZGl2IGNsYXNzPVwibG1fcG9waW5cIiB0aXRsZT1cIicgKyB0aGlzLmNvbmZpZy5sYWJlbHMucG9waW4gKyAnXCI+JyArXHJcbiAgICAgICAgICAgICc8ZGl2IGNsYXNzPVwibG1faWNvblwiPjwvZGl2PicgK1xyXG4gICAgICAgICAgICAnPGRpdiBjbGFzcz1cImxtX2JnXCI+PC9kaXY+JyArXHJcbiAgICAgICAgICAgICc8L2Rpdj4nKTtcclxuXHJcbiAgICAgICAgcG9wSW5CdXR0b24uY2xpY2soZm5CaW5kKGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICB0aGlzLmVtaXQoJ3BvcEluJyk7XHJcbiAgICAgICAgfSwgdGhpcykpO1xyXG5cclxuICAgICAgICBkb2N1bWVudC50aXRsZSA9IHN0cmlwVGFncyh0aGlzLmNvbmZpZy5jb250ZW50WzBdLnRpdGxlKTtcclxuXHJcbiAgICAgICAgJCgnaGVhZCcpLmFwcGVuZCgkKCdib2R5IGxpbmssIGJvZHkgc3R5bGUsIHRlbXBsYXRlLCAuZ2xfa2VlcCcpKTtcclxuXHJcbiAgICAgICAgdGhpcy5jb250YWluZXIgPSAkKCdib2R5JylcclxuICAgICAgICAgICAgLmh0bWwoJycpXHJcbiAgICAgICAgICAgIC5jc3MoJ3Zpc2liaWxpdHknLCAndmlzaWJsZScpXHJcbiAgICAgICAgICAgIC5hcHBlbmQocG9wSW5CdXR0b24pO1xyXG5cclxuICAgICAgICAvKlxyXG4gICAgICAgICAqIFRoaXMgc2VlbXMgYSBiaXQgcG9pbnRsZXNzLCBidXQgYWN0dWFsbHkgY2F1c2VzIGEgcmVmbG93L3JlLWV2YWx1YXRpb24gZ2V0dGluZyBhcm91bmRcclxuICAgICAgICAgKiBzbGlja2dyaWQncyBcIkNhbm5vdCBmaW5kIHN0eWxlc2hlZXQuXCIgYnVnIGluIGNocm9tZVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHZhciB4ID0gZG9jdW1lbnQuYm9keS5vZmZzZXRIZWlnaHQ7IC8vIGpzaGludCBpZ25vcmU6bGluZVxyXG5cclxuICAgICAgICAvKlxyXG4gICAgICAgICAqIEV4cG9zZSB0aGlzIGluc3RhbmNlIG9uIHRoZSB3aW5kb3cgb2JqZWN0XHJcbiAgICAgICAgICogdG8gYWxsb3cgdGhlIG9wZW5pbmcgd2luZG93IHRvIGludGVyYWN0IHdpdGhcclxuICAgICAgICAgKiBpdFxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHdpbmRvdy5fX2dsSW5zdGFuY2UgPSB0aGlzO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ3JlYXRlcyBTdWJ3aW5kb3dzIChpZiB0aGVyZSBhcmUgYW55KS4gVGhyb3dzIGFuIGVycm9yXHJcbiAgICAgKiBpZiBwb3BvdXRzIGFyZSBibG9ja2VkLlxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHt2b2lkfVxyXG4gICAgICovXHJcbiAgICBfY3JlYXRlU3ViV2luZG93cygpIHtcclxuICAgICAgICB2YXIgaSwgcG9wb3V0O1xyXG5cclxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgdGhpcy5jb25maWcub3BlblBvcG91dHMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgcG9wb3V0ID0gdGhpcy5jb25maWcub3BlblBvcG91dHNbaV07XHJcblxyXG4gICAgICAgICAgICB0aGlzLmNyZWF0ZVBvcG91dChcclxuICAgICAgICAgICAgICAgIHBvcG91dC5jb250ZW50LFxyXG4gICAgICAgICAgICAgICAgcG9wb3V0LmRpbWVuc2lvbnMsXHJcbiAgICAgICAgICAgICAgICBwb3BvdXQucGFyZW50SWQsXHJcbiAgICAgICAgICAgICAgICBwb3BvdXQuaW5kZXhJblBhcmVudFxyXG4gICAgICAgICAgICApO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIERldGVybWluZXMgd2hhdCBlbGVtZW50IHRoZSBsYXlvdXQgd2lsbCBiZSBjcmVhdGVkIGluXHJcbiAgICAgKlxyXG4gICAgICogQHByaXZhdGVcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJucyB7dm9pZH1cclxuICAgICAqL1xyXG4gICAgX3NldENvbnRhaW5lcigpIHtcclxuICAgICAgICB2YXIgY29udGFpbmVyID0gJCh0aGlzLmNvbnRhaW5lciB8fCAnYm9keScpO1xyXG5cclxuICAgICAgICBpZiAoY29udGFpbmVyLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0dvbGRlbkxheW91dCBjb250YWluZXIgbm90IGZvdW5kJyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoY29udGFpbmVyLmxlbmd0aCA+IDEpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdHb2xkZW5MYXlvdXQgbW9yZSB0aGFuIG9uZSBjb250YWluZXIgZWxlbWVudCBzcGVjaWZpZWQnKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmIChjb250YWluZXJbMF0gPT09IGRvY3VtZW50LmJvZHkpIHtcclxuICAgICAgICAgICAgdGhpcy5faXNGdWxsUGFnZSA9IHRydWU7XHJcblxyXG4gICAgICAgICAgICAkKCdodG1sLCBib2R5JykuY3NzKHtcclxuICAgICAgICAgICAgICAgIGhlaWdodDogJzEwMCUnLFxyXG4gICAgICAgICAgICAgICAgbWFyZ2luOiAwLFxyXG4gICAgICAgICAgICAgICAgcGFkZGluZzogMCxcclxuICAgICAgICAgICAgICAgIG92ZXJmbG93OiAnaGlkZGVuJ1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMuY29udGFpbmVyID0gY29udGFpbmVyO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogS2lja3Mgb2YgdGhlIGluaXRpYWwsIHJlY3Vyc2l2ZSBjcmVhdGlvbiBjaGFpblxyXG4gICAgICpcclxuICAgICAqIEBwYXJhbSAgIHtPYmplY3R9IGNvbmZpZyBHb2xkZW5MYXlvdXQgQ29uZmlnXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge3ZvaWR9XHJcbiAgICAgKi9cclxuICAgIF9jcmVhdGUoY29uZmlnKSB7XHJcbiAgICAgICAgdmFyIGVycm9yTXNnO1xyXG5cclxuICAgICAgICBpZiAoIShjb25maWcuY29udGVudCBpbnN0YW5jZW9mIEFycmF5KSkge1xyXG4gICAgICAgICAgICBpZiAoY29uZmlnLmNvbnRlbnQgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgICAgZXJyb3JNc2cgPSAnTWlzc2luZyBzZXR0aW5nIFxcJ2NvbnRlbnRcXCcgb24gdG9wIGxldmVsIG9mIGNvbmZpZ3VyYXRpb24nO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgZXJyb3JNc2cgPSAnQ29uZmlndXJhdGlvbiBwYXJhbWV0ZXIgXFwnY29udGVudFxcJyBtdXN0IGJlIGFuIGFycmF5JztcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgdGhyb3cgbmV3IENvbmZpZ3VyYXRpb25FcnJvcihlcnJvck1zZywgY29uZmlnKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmIChjb25maWcuY29udGVudC5sZW5ndGggPiAxKSB7XHJcbiAgICAgICAgICAgIGVycm9yTXNnID0gJ1RvcCBsZXZlbCBjb250ZW50IGNhblxcJ3QgY29udGFpbiBtb3JlIHRoZW4gb25lIGVsZW1lbnQuJztcclxuICAgICAgICAgICAgdGhyb3cgbmV3IENvbmZpZ3VyYXRpb25FcnJvcihlcnJvck1zZywgY29uZmlnKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMucm9vdCA9IG5ldyBSb290KHRoaXMsIHtcclxuICAgICAgICAgICAgY29udGVudDogY29uZmlnLmNvbnRlbnRcclxuICAgICAgICB9LCB0aGlzLmNvbnRhaW5lcik7XHJcbiAgICAgICAgdGhpcy5yb290LmNhbGxEb3dud2FyZHMoJ18kaW5pdCcpO1xyXG5cclxuICAgICAgICBpZiAoY29uZmlnLm1heGltaXNlZEl0ZW1JZCA9PT0gJ19fZ2xNYXhpbWlzZWQnKSB7XHJcbiAgICAgICAgICAgIHRoaXMucm9vdC5nZXRJdGVtc0J5SWQoY29uZmlnLm1heGltaXNlZEl0ZW1JZClbMF0udG9nZ2xlTWF4aW1pc2UoKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDYWxsZWQgd2hlbiB0aGUgd2luZG93IGlzIGNsb3NlZCBvciB0aGUgdXNlciBuYXZpZ2F0ZXMgYXdheVxyXG4gICAgICogZnJvbSB0aGUgcGFnZVxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHt2b2lkfVxyXG4gICAgICovXHJcbiAgICBfb25VbmxvYWQoKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuY29uZmlnLnNldHRpbmdzLmNsb3NlUG9wb3V0c09uVW5sb2FkID09PSB0cnVlKSB7XHJcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5vcGVuUG9wb3V0cy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5vcGVuUG9wb3V0c1tpXS5jbG9zZSgpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQWRqdXN0cyB0aGUgbnVtYmVyIG9mIGNvbHVtbnMgdG8gYmUgbG93ZXIgdG8gZml0IHRoZSBzY3JlZW4gYW5kIHN0aWxsIG1haW50YWluIG1pbkl0ZW1XaWR0aC5cclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJucyB7dm9pZH1cclxuICAgICAqL1xyXG4gICAgX2FkanVzdENvbHVtbnNSZXNwb25zaXZlKCkge1xyXG4gICAgICAgIC8vIElmIHRoZXJlIGlzIG5vIG1pbiB3aWR0aCBzZXQsIG9yIG5vdCBjb250ZW50IGl0ZW1zLCBkbyBub3RoaW5nLlxyXG4gICAgICAgIGlmICghdGhpcy5fdXNlUmVzcG9uc2l2ZUxheW91dCgpIHx8IHRoaXMuX3VwZGF0aW5nQ29sdW1uc1Jlc3BvbnNpdmUgfHwgIXRoaXMuY29uZmlnLmRpbWVuc2lvbnMgfHwgIXRoaXMuY29uZmlnLmRpbWVuc2lvbnMubWluSXRlbVdpZHRoIHx8IHRoaXMucm9vdC5jb250ZW50SXRlbXMubGVuZ3RoID09PSAwIHx8ICF0aGlzLnJvb3QuY29udGVudEl0ZW1zWzBdLmlzUm93KSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2ZpcnN0TG9hZCA9IGZhbHNlO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLl9maXJzdExvYWQgPSBmYWxzZTtcclxuXHJcbiAgICAgICAgLy8gSWYgdGhlcmUgaXMgb25seSBvbmUgY29sdW1uLCBkbyBub3RoaW5nLlxyXG4gICAgICAgIHZhciBjb2x1bW5Db3VudCA9IHRoaXMucm9vdC5jb250ZW50SXRlbXNbMF0uY29udGVudEl0ZW1zLmxlbmd0aDtcclxuICAgICAgICBpZiAoY29sdW1uQ291bnQgPD0gMSkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBJZiB0aGV5IGFsbCBzdGlsbCBmaXQsIGRvIG5vdGhpbmcuXHJcbiAgICAgICAgdmFyIG1pbkl0ZW1XaWR0aCA9IHRoaXMuY29uZmlnLmRpbWVuc2lvbnMubWluSXRlbVdpZHRoO1xyXG4gICAgICAgIHZhciB0b3RhbE1pbldpZHRoID0gY29sdW1uQ291bnQgKiBtaW5JdGVtV2lkdGg7XHJcbiAgICAgICAgaWYgKHRvdGFsTWluV2lkdGggPD0gdGhpcy53aWR0aCkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBQcmV2ZW50IHVwZGF0ZXMgd2hpbGUgaXQgaXMgYWxyZWFkeSBoYXBwZW5pbmcuXHJcbiAgICAgICAgdGhpcy5fdXBkYXRpbmdDb2x1bW5zUmVzcG9uc2l2ZSA9IHRydWU7XHJcblxyXG4gICAgICAgIC8vIEZpZ3VyZSBvdXQgaG93IG1hbnkgY29sdW1ucyB0byBzdGFjaywgYW5kIHB1dCB0aGVtIGFsbCBpbiB0aGUgZmlyc3Qgc3RhY2sgY29udGFpbmVyLlxyXG4gICAgICAgIHZhciBmaW5hbENvbHVtbkNvdW50ID0gTWF0aC5tYXgoTWF0aC5mbG9vcih0aGlzLndpZHRoIC8gbWluSXRlbVdpZHRoKSwgMSk7XHJcbiAgICAgICAgdmFyIHN0YWNrQ29sdW1uQ291bnQgPSBjb2x1bW5Db3VudCAtIGZpbmFsQ29sdW1uQ291bnQ7XHJcblxyXG4gICAgICAgIHZhciByb290Q29udGVudEl0ZW0gPSB0aGlzLnJvb3QuY29udGVudEl0ZW1zWzBdO1xyXG4gICAgICAgIHZhciBmaXJzdFN0YWNrQ29udGFpbmVyID0gdGhpcy5fZmluZEFsbFN0YWNrQ29udGFpbmVycygpWzBdO1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc3RhY2tDb2x1bW5Db3VudDsgaSsrKSB7XHJcbiAgICAgICAgICAgIC8vIFN0YWNrIGZyb20gcmlnaHQuXHJcbiAgICAgICAgICAgIHZhciBjb2x1bW4gPSByb290Q29udGVudEl0ZW0uY29udGVudEl0ZW1zW3Jvb3RDb250ZW50SXRlbS5jb250ZW50SXRlbXMubGVuZ3RoIC0gMV07XHJcbiAgICAgICAgICAgIHRoaXMuX2FkZENoaWxkQ29udGVudEl0ZW1zVG9Db250YWluZXIoZmlyc3RTdGFja0NvbnRhaW5lciwgY29sdW1uKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMuX3VwZGF0aW5nQ29sdW1uc1Jlc3BvbnNpdmUgPSBmYWxzZTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIERldGVybWluZXMgaWYgcmVzcG9uc2l2ZSBsYXlvdXQgc2hvdWxkIGJlIHVzZWQuXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge2Jvb2x9IC0gVHJ1ZSBpZiByZXNwb25zaXZlIGxheW91dCBzaG91bGQgYmUgdXNlZDsgb3RoZXJ3aXNlIGZhbHNlLlxyXG4gICAgICovXHJcbiAgICBfdXNlUmVzcG9uc2l2ZUxheW91dCgpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5jb25maWcuc2V0dGluZ3MgJiYgKHRoaXMuY29uZmlnLnNldHRpbmdzLnJlc3BvbnNpdmVNb2RlID09ICdhbHdheXMnIHx8ICh0aGlzLmNvbmZpZy5zZXR0aW5ncy5yZXNwb25zaXZlTW9kZSA9PSAnb25sb2FkJyAmJiB0aGlzLl9maXJzdExvYWQpKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEFkZHMgYWxsIGNoaWxkcmVuIG9mIGEgbm9kZSB0byBhbm90aGVyIGNvbnRhaW5lciByZWN1cnNpdmVseS5cclxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBjb250YWluZXIgLSBDb250YWluZXIgdG8gYWRkIGNoaWxkIGNvbnRlbnQgaXRlbXMgdG8uXHJcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gbm9kZSAtIE5vZGUgdG8gc2VhcmNoIGZvciBjb250ZW50IGl0ZW1zLlxyXG4gICAgICogQHJldHVybnMge3ZvaWR9XHJcbiAgICAgKi9cclxuICAgIF9hZGRDaGlsZENvbnRlbnRJdGVtc1RvQ29udGFpbmVyKGNvbnRhaW5lciwgbm9kZSkge1xyXG4gICAgICAgIGlmIChub2RlLnR5cGUgPT09ICdzdGFjaycpIHtcclxuICAgICAgICAgICAgbm9kZS5jb250ZW50SXRlbXMuZm9yRWFjaChmdW5jdGlvbihpdGVtKSB7XHJcbiAgICAgICAgICAgICAgICBjb250YWluZXIuYWRkQ2hpbGQoaXRlbSk7XHJcbiAgICAgICAgICAgICAgICBub2RlLnJlbW92ZUNoaWxkKGl0ZW0sIHRydWUpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBub2RlLmNvbnRlbnRJdGVtcy5mb3JFYWNoKGZuQmluZChmdW5jdGlvbihpdGVtKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9hZGRDaGlsZENvbnRlbnRJdGVtc1RvQ29udGFpbmVyKGNvbnRhaW5lciwgaXRlbSk7XHJcbiAgICAgICAgICAgIH0sIHRoaXMpKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBGaW5kcyBhbGwgdGhlIHN0YWNrIGNvbnRhaW5lcnMuXHJcbiAgICAgKiBAcmV0dXJucyB7YXJyYXl9IC0gVGhlIGZvdW5kIHN0YWNrIGNvbnRhaW5lcnMuXHJcbiAgICAgKi9cclxuICAgIF9maW5kQWxsU3RhY2tDb250YWluZXJzKCkge1xyXG4gICAgICAgIHZhciBzdGFja0NvbnRhaW5lcnMgPSBbXTtcclxuICAgICAgICB0aGlzLl9maW5kQWxsU3RhY2tDb250YWluZXJzUmVjdXJzaXZlKHN0YWNrQ29udGFpbmVycywgdGhpcy5yb290KTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHN0YWNrQ29udGFpbmVycztcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEZpbmRzIGFsbCB0aGUgc3RhY2sgY29udGFpbmVycy5cclxuICAgICAqXHJcbiAgICAgKiBAcGFyYW0ge2FycmF5fSAtIFNldCBvZiBjb250YWluZXJzIHRvIHBvcHVsYXRlLlxyXG4gICAgICogQHBhcmFtIHtvYmplY3R9IC0gQ3VycmVudCBub2RlIHRvIHByb2Nlc3MuXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge3ZvaWR9XHJcbiAgICAgKi9cclxuICAgIF9maW5kQWxsU3RhY2tDb250YWluZXJzUmVjdXJzaXZlKHN0YWNrQ29udGFpbmVycywgbm9kZSkge1xyXG4gICAgICAgIG5vZGUuY29udGVudEl0ZW1zLmZvckVhY2goZm5CaW5kKGZ1bmN0aW9uKGl0ZW0pIHtcclxuICAgICAgICAgICAgaWYgKGl0ZW0udHlwZSA9PSAnc3RhY2snKSB7XHJcbiAgICAgICAgICAgICAgICBzdGFja0NvbnRhaW5lcnMucHVzaChpdGVtKTtcclxuICAgICAgICAgICAgfSBlbHNlIGlmICghaXRlbS5pc0NvbXBvbmVudCkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fZmluZEFsbFN0YWNrQ29udGFpbmVyc1JlY3Vyc2l2ZShzdGFja0NvbnRhaW5lcnMsIGl0ZW0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSwgdGhpcykpO1xyXG4gICAgfVxyXG59XHJcblxyXG4vKipcclxuICogSG9vayB0aGF0IGFsbG93cyB0byBhY2Nlc3MgcHJpdmF0ZSBjbGFzc2VzXHJcbiAqL1xyXG4vLyBMYXlvdXRNYW5hZ2VyLl9fbG0gPSBsbTtcclxuIiwiY29uc3QgaXRlbURlZmF1bHRDb25maWcgPSB7XHJcbiAgICBpc0Nsb3NhYmxlOiB0cnVlLFxyXG4gICAgcmVvcmRlckVuYWJsZWQ6IHRydWUsXHJcbiAgICB0aXRsZTogJydcclxufVxyXG5cclxuZXhwb3J0IGRlZmF1bHQgaXRlbURlZmF1bHRDb25maWdcclxuIiwiY29uc3QgZGVmYXVsdENvbmZpZyA9IHtcclxuICAgIG9wZW5Qb3BvdXRzOiBbXSxcclxuICAgIHNldHRpbmdzOiB7XHJcbiAgICAgICAgaGFzSGVhZGVyczogdHJ1ZSxcclxuICAgICAgICBjb25zdHJhaW5EcmFnVG9Db250YWluZXI6IHRydWUsXHJcbiAgICAgICAgcmVvcmRlckVuYWJsZWQ6IHRydWUsXHJcbiAgICAgICAgc2VsZWN0aW9uRW5hYmxlZDogZmFsc2UsXHJcbiAgICAgICAgcG9wb3V0V2hvbGVTdGFjazogZmFsc2UsXHJcbiAgICAgICAgYmxvY2tlZFBvcG91dHNUaHJvd0Vycm9yOiB0cnVlLFxyXG4gICAgICAgIGNsb3NlUG9wb3V0c09uVW5sb2FkOiB0cnVlLFxyXG4gICAgICAgIHNob3dQb3BvdXRJY29uOiB0cnVlLFxyXG4gICAgICAgIHNob3dNYXhpbWlzZUljb246IHRydWUsXHJcbiAgICAgICAgc2hvd0Nsb3NlSWNvbjogdHJ1ZSxcclxuICAgICAgICByZXNwb25zaXZlTW9kZTogJ29ubG9hZCcsIC8vIENhbiBiZSBvbmxvYWQsIGFsd2F5cywgb3Igbm9uZS5cclxuICAgICAgICB0YWJPdmVybGFwQWxsb3dhbmNlOiAwLCAvLyBtYXhpbXVtIHBpeGVsIG92ZXJsYXAgcGVyIHRhYlxyXG4gICAgICAgIHJlb3JkZXJPblRhYk1lbnVDbGljazogdHJ1ZSxcclxuICAgICAgICB0YWJDb250cm9sT2Zmc2V0OiAxMFxyXG4gICAgfSxcclxuICAgIGRpbWVuc2lvbnM6IHtcclxuICAgICAgICBib3JkZXJXaWR0aDogNSxcclxuICAgICAgICBib3JkZXJHcmFiV2lkdGg6IDE1LFxyXG4gICAgICAgIG1pbkl0ZW1IZWlnaHQ6IDEwLFxyXG4gICAgICAgIG1pbkl0ZW1XaWR0aDogMTAsXHJcbiAgICAgICAgaGVhZGVySGVpZ2h0OiAyMCxcclxuICAgICAgICBkcmFnUHJveHlXaWR0aDogMzAwLFxyXG4gICAgICAgIGRyYWdQcm94eUhlaWdodDogMjAwXHJcbiAgICB9LFxyXG4gICAgbGFiZWxzOiB7XHJcbiAgICAgICAgY2xvc2U6ICdjbG9zZScsXHJcbiAgICAgICAgbWF4aW1pc2U6ICdtYXhpbWlzZScsXHJcbiAgICAgICAgbWluaW1pc2U6ICdtaW5pbWlzZScsXHJcbiAgICAgICAgcG9wb3V0OiAnb3BlbiBpbiBuZXcgd2luZG93JyxcclxuICAgICAgICBwb3BpbjogJ3BvcCBpbicsXHJcbiAgICAgICAgdGFiRHJvcGRvd246ICdhZGRpdGlvbmFsIHRhYnMnXHJcbiAgICB9XHJcbn1cclxuXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmF1bHRDb25maWdcclxuIiwiaW1wb3J0IEV2ZW50RW1pdHRlciBmcm9tICcuLi91dGlscy9FdmVudEVtaXR0ZXInXHJcbmltcG9ydCAkIGZyb20gJ2pxdWVyeSdcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEl0ZW1Db250YWluZXIgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xyXG4gICAgY29uc3RydWN0b3IoY29uZmlnLCBwYXJlbnQsIGxheW91dE1hbmFnZXIpIHtcclxuXHJcbiAgICAgICAgc3VwZXIoKTtcclxuXHJcbiAgICAgICAgdGhpcy53aWR0aCA9IG51bGw7XHJcbiAgICAgICAgdGhpcy5oZWlnaHQgPSBudWxsO1xyXG4gICAgICAgIHRoaXMudGl0bGUgPSBjb25maWcuY29tcG9uZW50TmFtZTtcclxuICAgICAgICB0aGlzLnBhcmVudCA9IHBhcmVudDtcclxuICAgICAgICB0aGlzLmxheW91dE1hbmFnZXIgPSBsYXlvdXRNYW5hZ2VyO1xyXG4gICAgICAgIHRoaXMuaXNIaWRkZW4gPSBmYWxzZTtcclxuXHJcbiAgICAgICAgdGhpcy5fY29uZmlnID0gY29uZmlnO1xyXG4gICAgICAgIHRoaXMuX2VsZW1lbnQgPSAkKFtcclxuICAgICAgICAgICAgJzxkaXYgY2xhc3M9XCJsbV9pdGVtX2NvbnRhaW5lclwiPicsXHJcbiAgICAgICAgICAgICc8ZGl2IGNsYXNzPVwibG1fY29udGVudFwiPjwvZGl2PicsXHJcbiAgICAgICAgICAgICc8L2Rpdj4nXHJcbiAgICAgICAgXS5qb2luKCcnKSk7XHJcblxyXG4gICAgICAgIHRoaXMuX2NvbnRlbnRFbGVtZW50ID0gdGhpcy5fZWxlbWVudC5maW5kKCcubG1fY29udGVudCcpO1xyXG4gICAgfVxyXG5cclxuXHJcbiAgICAvKipcclxuICAgICAqIEdldCB0aGUgaW5uZXIgRE9NIGVsZW1lbnQgdGhlIGNvbnRhaW5lcidzIGNvbnRlbnRcclxuICAgICAqIGlzIGludGVuZGVkIHRvIGxpdmUgaW5cclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJucyB7RE9NIGVsZW1lbnR9XHJcbiAgICAgKi9cclxuICAgIGdldEVsZW1lbnQoKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NvbnRlbnRFbGVtZW50O1xyXG4gICAgfVxyXG5cclxuXHJcbiAgICAvKipcclxuICAgICAqIEhpZGUgdGhlIGNvbnRhaW5lci4gTm90aWZpZXMgdGhlIGNvbnRhaW5lcnMgY29udGVudCBmaXJzdFxyXG4gICAgICogYW5kIHRoZW4gaGlkZXMgdGhlIERPTSBub2RlLiBJZiB0aGUgY29udGFpbmVyIGlzIGFscmVhZHkgaGlkZGVuXHJcbiAgICAgKiB0aGlzIHNob3VsZCBoYXZlIG5vIGVmZmVjdFxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHt2b2lkfVxyXG4gICAgICovXHJcbiAgICBoaWRlKCkge1xyXG4gICAgICAgIHRoaXMuZW1pdCgnaGlkZScpO1xyXG4gICAgICAgIHRoaXMuaXNIaWRkZW4gPSB0cnVlO1xyXG4gICAgICAgIHRoaXMuX2VsZW1lbnQuaGlkZSgpO1xyXG4gICAgfVxyXG5cclxuXHJcbiAgICAvKipcclxuICAgICAqIFNob3dzIGEgcHJldmlvdXNseSBoaWRkZW4gY29udGFpbmVyLiBOb3RpZmllcyB0aGVcclxuICAgICAqIGNvbnRhaW5lcnMgY29udGVudCBmaXJzdCBhbmQgdGhlbiBzaG93cyB0aGUgRE9NIGVsZW1lbnQuXHJcbiAgICAgKiBJZiB0aGUgY29udGFpbmVyIGlzIGFscmVhZHkgdmlzaWJsZSB0aGlzIGhhcyBubyBlZmZlY3QuXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge3ZvaWR9XHJcbiAgICAgKi9cclxuICAgIHNob3coKSB7XHJcbiAgICAgICAgdGhpcy5lbWl0KCdzaG93Jyk7XHJcbiAgICAgICAgdGhpcy5pc0hpZGRlbiA9IGZhbHNlO1xyXG4gICAgICAgIHRoaXMuX2VsZW1lbnQuc2hvdygpO1xyXG4gICAgICAgIC8vIGNhbGwgc2hvd24gb25seSBpZiB0aGUgY29udGFpbmVyIGhhcyBhIHZhbGlkIHNpemVcclxuICAgICAgICBpZiAodGhpcy5oZWlnaHQgIT0gMCB8fCB0aGlzLndpZHRoICE9IDApIHtcclxuICAgICAgICAgICAgdGhpcy5lbWl0KCdzaG93bicpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBTZXQgdGhlIHNpemUgZnJvbSB3aXRoaW4gdGhlIGNvbnRhaW5lci4gVHJhdmVyc2VzIHVwXHJcbiAgICAgKiB0aGUgaXRlbSB0cmVlIHVudGlsIGl0IGZpbmRzIGEgcm93IG9yIGNvbHVtbiBlbGVtZW50XHJcbiAgICAgKiBhbmQgcmVzaXplcyBpdHMgaXRlbXMgYWNjb3JkaW5nbHkuXHJcbiAgICAgKlxyXG4gICAgICogSWYgdGhpcyBjb250YWluZXIgaXNuJ3QgYSBkZXNjZW5kYW50IG9mIGEgcm93IG9yIGNvbHVtblxyXG4gICAgICogaXQgcmV0dXJucyBmYWxzZVxyXG4gICAgICogQHRvZG8gIFJld29yayEhIVxyXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHdpZHRoICBUaGUgbmV3IHdpZHRoIGluIHBpeGVsXHJcbiAgICAgKiBAcGFyYW0ge051bWJlcn0gaGVpZ2h0IFRoZSBuZXcgaGVpZ2h0IGluIHBpeGVsXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge0Jvb2xlYW59IHJlc2l6ZVN1Y2Nlc2Z1bFxyXG4gICAgICovXHJcbiAgICBzZXRTaXplKHdpZHRoLCBoZWlnaHQpIHtcclxuICAgICAgICB2YXIgcm93T3JDb2x1bW4gPSB0aGlzLnBhcmVudCxcclxuICAgICAgICAgICAgcm93T3JDb2x1bW5DaGlsZCA9IHRoaXMsXHJcbiAgICAgICAgICAgIHRvdGFsUGl4ZWwsXHJcbiAgICAgICAgICAgIHBlcmNlbnRhZ2UsXHJcbiAgICAgICAgICAgIGRpcmVjdGlvbixcclxuICAgICAgICAgICAgbmV3U2l6ZSxcclxuICAgICAgICAgICAgZGVsdGEsXHJcbiAgICAgICAgICAgIGk7XHJcblxyXG4gICAgICAgIHdoaWxlICghcm93T3JDb2x1bW4uaXNDb2x1bW4gJiYgIXJvd09yQ29sdW1uLmlzUm93KSB7XHJcbiAgICAgICAgICAgIHJvd09yQ29sdW1uQ2hpbGQgPSByb3dPckNvbHVtbjtcclxuICAgICAgICAgICAgcm93T3JDb2x1bW4gPSByb3dPckNvbHVtbi5wYXJlbnQ7XHJcblxyXG5cclxuICAgICAgICAgICAgLyoqXHJcbiAgICAgICAgICAgICAqIE5vIHJvdyBvciBjb2x1bW4gaGFzIGJlZW4gZm91bmRcclxuICAgICAgICAgICAgICovXHJcbiAgICAgICAgICAgIGlmIChyb3dPckNvbHVtbi5pc1Jvb3QpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZGlyZWN0aW9uID0gcm93T3JDb2x1bW4uaXNDb2x1bW4gPyBcImhlaWdodFwiIDogXCJ3aWR0aFwiO1xyXG4gICAgICAgIG5ld1NpemUgPSBkaXJlY3Rpb24gPT09IFwiaGVpZ2h0XCIgPyBoZWlnaHQgOiB3aWR0aDtcclxuXHJcbiAgICAgICAgdG90YWxQaXhlbCA9IHRoaXNbZGlyZWN0aW9uXSAqICgxIC8gKHJvd09yQ29sdW1uQ2hpbGQuY29uZmlnW2RpcmVjdGlvbl0gLyAxMDApKTtcclxuICAgICAgICBwZXJjZW50YWdlID0gKG5ld1NpemUgLyB0b3RhbFBpeGVsKSAqIDEwMDtcclxuICAgICAgICBkZWx0YSA9IChyb3dPckNvbHVtbkNoaWxkLmNvbmZpZ1tkaXJlY3Rpb25dIC0gcGVyY2VudGFnZSkgLyAocm93T3JDb2x1bW4uY29udGVudEl0ZW1zLmxlbmd0aCAtIDEpO1xyXG5cclxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgcm93T3JDb2x1bW4uY29udGVudEl0ZW1zLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIGlmIChyb3dPckNvbHVtbi5jb250ZW50SXRlbXNbaV0gPT09IHJvd09yQ29sdW1uQ2hpbGQpIHtcclxuICAgICAgICAgICAgICAgIHJvd09yQ29sdW1uLmNvbnRlbnRJdGVtc1tpXS5jb25maWdbZGlyZWN0aW9uXSA9IHBlcmNlbnRhZ2U7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICByb3dPckNvbHVtbi5jb250ZW50SXRlbXNbaV0uY29uZmlnW2RpcmVjdGlvbl0gKz0gZGVsdGE7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJvd09yQ29sdW1uLmNhbGxEb3dud2FyZHMoJ3NldFNpemUnKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9XHJcblxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ2xvc2VzIHRoZSBjb250YWluZXIgaWYgaXQgaXMgY2xvc2FibGUuIENhbiBiZSBjYWxsZWQgYnlcclxuICAgICAqIGJvdGggdGhlIGNvbXBvbmVudCB3aXRoaW4gYXQgYXMgd2VsbCBhcyB0aGUgY29udGVudEl0ZW0gY29udGFpbmluZ1xyXG4gICAgICogaXQuIEVtaXRzIGEgY2xvc2UgZXZlbnQgYmVmb3JlIHRoZSBjb250YWluZXIgaXRzZWxmIGlzIGNsb3NlZC5cclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJucyB7dm9pZH1cclxuICAgICAqL1xyXG4gICAgY2xvc2UoKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuX2NvbmZpZy5pc0Nsb3NhYmxlKSB7XHJcbiAgICAgICAgICAgIHRoaXMuZW1pdCgnY2xvc2UnKTtcclxuICAgICAgICAgICAgdGhpcy5wYXJlbnQuY2xvc2UoKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUmV0dXJucyB0aGUgY3VycmVudCBzdGF0ZSBvYmplY3RcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBzdGF0ZVxyXG4gICAgICovXHJcbiAgICBnZXRTdGF0ZSgpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5fY29uZmlnLmNvbXBvbmVudFN0YXRlO1xyXG4gICAgfVxyXG5cclxuXHJcbiAgICAvKipcclxuICAgICAqIE1lcmdlcyB0aGUgcHJvdmlkZWQgc3RhdGUgaW50byB0aGUgY3VycmVudCBvbmVcclxuICAgICAqXHJcbiAgICAgKiBAcGFyYW0gICB7T2JqZWN0fSBzdGF0ZVxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHt2b2lkfVxyXG4gICAgICovXHJcbiAgICBleHRlbmRTdGF0ZShzdGF0ZSkge1xyXG4gICAgICAgIHRoaXMuc2V0U3RhdGUoJC5leHRlbmQodHJ1ZSwgdGhpcy5nZXRTdGF0ZSgpLCBzdGF0ZSkpO1xyXG4gICAgfVxyXG5cclxuXHJcbiAgICAvKipcclxuICAgICAqIE5vdGlmaWVzIHRoZSBsYXlvdXQgbWFuYWdlciBvZiBhIHN0YXRldXBkYXRlXHJcbiAgICAgKlxyXG4gICAgICogQHBhcmFtIHtzZXJpYWxpc2FibGV9IHN0YXRlXHJcbiAgICAgKi9cclxuICAgIHNldFN0YXRlKHN0YXRlKSB7XHJcbiAgICAgICAgdGhpcy5fY29uZmlnLmNvbXBvbmVudFN0YXRlID0gc3RhdGU7XHJcbiAgICAgICAgdGhpcy5wYXJlbnQuZW1pdEJ1YmJsaW5nRXZlbnQoJ3N0YXRlQ2hhbmdlZCcpO1xyXG4gICAgfVxyXG5cclxuXHJcbiAgICAvKipcclxuICAgICAqIFNldCdzIHRoZSBjb21wb25lbnRzIHRpdGxlXHJcbiAgICAgKlxyXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IHRpdGxlXHJcbiAgICAgKi9cclxuICAgIHNldFRpdGxlKHRpdGxlKSB7XHJcbiAgICAgICAgdGhpcy5wYXJlbnQuc2V0VGl0bGUodGl0bGUpO1xyXG4gICAgfVxyXG5cclxuXHJcbiAgICAvKipcclxuICAgICAqIFNldCdzIHRoZSBjb250YWluZXJzIHNpemUuIENhbGxlZCBieSB0aGUgY29udGFpbmVyJ3MgY29tcG9uZW50LlxyXG4gICAgICogVG8gc2V0IHRoZSBzaXplIHByb2dyYW1tYXRpY2FsbHkgZnJvbSB3aXRoaW4gdGhlIGNvbnRhaW5lciBwbGVhc2VcclxuICAgICAqIHVzZSB0aGUgcHVibGljIHNldFNpemUgbWV0aG9kXHJcbiAgICAgKlxyXG4gICAgICogQHBhcmFtIHtbSW50XX0gd2lkdGggIGluIHB4XHJcbiAgICAgKiBAcGFyYW0ge1tJbnRdfSBoZWlnaHQgaW4gcHhcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJucyB7dm9pZH1cclxuICAgICAqL1xyXG4gICAgXyRzZXRTaXplKHdpZHRoLCBoZWlnaHQpIHtcclxuICAgICAgICBpZiAod2lkdGggIT09IHRoaXMud2lkdGggfHwgaGVpZ2h0ICE9PSB0aGlzLmhlaWdodCkge1xyXG4gICAgICAgICAgICB0aGlzLndpZHRoID0gd2lkdGg7XHJcbiAgICAgICAgICAgIHRoaXMuaGVpZ2h0ID0gaGVpZ2h0O1xyXG4gICAgICAgICAgICAkLnplcHRvID8gdGhpcy5fY29udGVudEVsZW1lbnQud2lkdGgod2lkdGgpIDogdGhpcy5fY29udGVudEVsZW1lbnQub3V0ZXJXaWR0aCh3aWR0aCk7XHJcbiAgICAgICAgICAgICQuemVwdG8gPyB0aGlzLl9jb250ZW50RWxlbWVudC5oZWlnaHQoaGVpZ2h0KSA6IHRoaXMuX2NvbnRlbnRFbGVtZW50Lm91dGVySGVpZ2h0KGhlaWdodCk7XHJcbiAgICAgICAgICAgIHRoaXMuZW1pdCgncmVzaXplJyk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59XHJcbiIsImltcG9ydCBFdmVudEVtaXR0ZXIgZnJvbSAnLi4vdXRpbHMvRXZlbnRFbWl0dGVyJ1xyXG5pbXBvcnQgQ29uZmlnTWluaWZpZXIgZnJvbSAnLi4vdXRpbHMvQ29uZmlnTWluaWZpZXInXHJcbmltcG9ydCB7XHJcbiAgICBmbkJpbmQsXHJcbiAgICBnZXRVbmlxdWVJZCxcclxufSBmcm9tICcuLi91dGlscy91dGlscydcclxuaW1wb3J0ICQgZnJvbSAnanF1ZXJ5J1xyXG5cclxuLyoqXHJcbiAqIFBvcHMgYSBjb250ZW50IGl0ZW0gb3V0IGludG8gYSBuZXcgYnJvd3NlciB3aW5kb3cuXHJcbiAqIFRoaXMgaXMgYWNoaWV2ZWQgYnlcclxuICpcclxuICogICAgLSBDcmVhdGluZyBhIG5ldyBjb25maWd1cmF0aW9uIHdpdGggdGhlIGNvbnRlbnQgaXRlbSBhcyByb290IGVsZW1lbnRcclxuICogICAgLSBTZXJpYWxpemluZyBhbmQgbWluaWZ5aW5nIHRoZSBjb25maWd1cmF0aW9uXHJcbiAqICAgIC0gT3BlbmluZyB0aGUgY3VycmVudCB3aW5kb3cncyBVUkwgd2l0aCB0aGUgY29uZmlndXJhdGlvbiBhcyBhIEdFVCBwYXJhbWV0ZXJcclxuICogICAgLSBHb2xkZW5MYXlvdXQgd2hlbiBvcGVuZWQgaW4gdGhlIG5ldyB3aW5kb3cgd2lsbCBsb29rIGZvciB0aGUgR0VUIHBhcmFtZXRlclxyXG4gKiAgICAgIGFuZCB1c2UgaXQgaW5zdGVhZCBvZiB0aGUgcHJvdmlkZWQgY29uZmlndXJhdGlvblxyXG4gKlxyXG4gKiBAcGFyYW0ge09iamVjdH0gY29uZmlnIEdvbGRlbkxheW91dCBpdGVtIGNvbmZpZ1xyXG4gKiBAcGFyYW0ge09iamVjdH0gZGltZW5zaW9ucyBBIG1hcCB3aXRoIHdpZHRoLCBoZWlnaHQsIHRvcCBhbmQgbGVmdFxyXG4gKiBAcGFyYW0ge1N0cmluZ30gcGFyZW50SWQgVGhlIGlkIG9mIHRoZSBlbGVtZW50IHRoZSBpdGVtIHdpbGwgYmUgYXBwZW5kZWQgdG8gb24gcG9wSW5cclxuICogQHBhcmFtIHtOdW1iZXJ9IGluZGV4SW5QYXJlbnQgVGhlIHBvc2l0aW9uIG9mIHRoaXMgZWxlbWVudCB3aXRoaW4gaXRzIHBhcmVudFxyXG4gKiBAcGFyYW0ge2xtLkxheW91dE1hbmFnZXJ9IGxheW91dE1hbmFnZXJcclxuICovXHJcblxyXG5cclxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgQnJvd3NlclBvcG91dCBleHRlbmRzIEV2ZW50RW1pdHRlciB7XHJcbiAgICBjb25zdHJ1Y3Rvcihjb25maWcsIGRpbWVuc2lvbnMsIHBhcmVudElkLCBpbmRleEluUGFyZW50LCBsYXlvdXRNYW5hZ2VyKSB7XHJcblxyXG4gICAgICAgIHN1cGVyKCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdGhpcy5pc0luaXRpYWxpc2VkID0gZmFsc2U7XHJcblxyXG4gICAgICAgIHRoaXMuX2NvbmZpZyA9IGNvbmZpZztcclxuICAgICAgICB0aGlzLl9kaW1lbnNpb25zID0gZGltZW5zaW9ucztcclxuICAgICAgICB0aGlzLl9wYXJlbnRJZCA9IHBhcmVudElkO1xyXG4gICAgICAgIHRoaXMuX2luZGV4SW5QYXJlbnQgPSBpbmRleEluUGFyZW50O1xyXG4gICAgICAgIHRoaXMuX2xheW91dE1hbmFnZXIgPSBsYXlvdXRNYW5hZ2VyO1xyXG4gICAgICAgIHRoaXMuX3BvcG91dFdpbmRvdyA9IG51bGw7XHJcbiAgICAgICAgdGhpcy5faWQgPSBudWxsO1xyXG4gICAgICAgIHRoaXMuX2NyZWF0ZVdpbmRvdygpO1xyXG4gICAgfVxyXG5cclxuICAgIHRvQ29uZmlnKCkge1xyXG4gICAgICAgIGlmICh0aGlzLmlzSW5pdGlhbGlzZWQgPT09IGZhbHNlKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignQ2FuXFwndCBjcmVhdGUgY29uZmlnLCBsYXlvdXQgbm90IHlldCBpbml0aWFsaXNlZCcpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICBkaW1lbnNpb25zOiB7XHJcbiAgICAgICAgICAgICAgICB3aWR0aDogdGhpcy5nZXRHbEluc3RhbmNlKCkud2lkdGgsXHJcbiAgICAgICAgICAgICAgICBoZWlnaHQ6IHRoaXMuZ2V0R2xJbnN0YW5jZSgpLmhlaWdodCxcclxuICAgICAgICAgICAgICAgIGxlZnQ6IHRoaXMuX3BvcG91dFdpbmRvdy5zY3JlZW5YIHx8IHRoaXMuX3BvcG91dFdpbmRvdy5zY3JlZW5MZWZ0LFxyXG4gICAgICAgICAgICAgICAgdG9wOiB0aGlzLl9wb3BvdXRXaW5kb3cuc2NyZWVuWSB8fCB0aGlzLl9wb3BvdXRXaW5kb3cuc2NyZWVuVG9wXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIGNvbnRlbnQ6IHRoaXMuZ2V0R2xJbnN0YW5jZSgpLnRvQ29uZmlnKCkuY29udGVudCxcclxuICAgICAgICAgICAgcGFyZW50SWQ6IHRoaXMuX3BhcmVudElkLFxyXG4gICAgICAgICAgICBpbmRleEluUGFyZW50OiB0aGlzLl9pbmRleEluUGFyZW50XHJcbiAgICAgICAgfTtcclxuICAgIH1cclxuXHJcbiAgICBnZXRHbEluc3RhbmNlKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLl9wb3BvdXRXaW5kb3cuX19nbEluc3RhbmNlO1xyXG4gICAgfVxyXG5cclxuICAgIGdldFdpbmRvdygpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5fcG9wb3V0V2luZG93O1xyXG4gICAgfVxyXG5cclxuICAgIGNsb3NlKCkge1xyXG4gICAgICAgIGlmICh0aGlzLmdldEdsSW5zdGFuY2UoKSkge1xyXG4gICAgICAgICAgICB0aGlzLmdldEdsSW5zdGFuY2UoKS5fJGNsb3NlV2luZG93KCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgIHRoaXMuZ2V0V2luZG93KCkuY2xvc2UoKTtcclxuICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICAgICAgICAgICAgLy9cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFJldHVybnMgdGhlIHBvcHBlZCBvdXQgaXRlbSB0byBpdHMgb3JpZ2luYWwgcG9zaXRpb24uIElmIHRoZSBvcmlnaW5hbFxyXG4gICAgICogcGFyZW50IGlzbid0IGF2YWlsYWJsZSBhbnltb3JlIGl0IGZhbGxzIGJhY2sgdG8gdGhlIGxheW91dCdzIHRvcG1vc3QgZWxlbWVudFxyXG4gICAgICovXHJcbiAgICBwb3BJbigpIHtcclxuICAgICAgICB2YXIgY2hpbGRDb25maWcsXHJcbiAgICAgICAgICAgIHBhcmVudEl0ZW0sXHJcbiAgICAgICAgICAgIGluZGV4ID0gdGhpcy5faW5kZXhJblBhcmVudDtcclxuXHJcbiAgICAgICAgaWYgKHRoaXMuX3BhcmVudElkKSB7XHJcblxyXG4gICAgICAgICAgICAvKlxyXG4gICAgICAgICAgICAgKiBUaGUgJC5leHRlbmQgY2FsbCBzZWVtcyBhIGJpdCBwb2ludGxlc3MsIGJ1dCBpdCdzIGNydWNpYWwgdG9cclxuICAgICAgICAgICAgICogY29weSB0aGUgY29uZmlnIHJldHVybmVkIGJ5IHRoaXMuZ2V0R2xJbnN0YW5jZSgpLnRvQ29uZmlnKClcclxuICAgICAgICAgICAgICogb250byBhIG5ldyBvYmplY3QuIEludGVybmV0IEV4cGxvcmVyIGtlZXBzIHRoZSByZWZlcmVuY2VzXHJcbiAgICAgICAgICAgICAqIHRvIG9iamVjdHMgb24gdGhlIGNoaWxkIHdpbmRvdywgcmVzdWx0aW5nIGluIHRoZSBmb2xsb3dpbmcgZXJyb3JcclxuICAgICAgICAgICAgICogb25jZSB0aGUgY2hpbGQgd2luZG93IGlzIGNsb3NlZDpcclxuICAgICAgICAgICAgICpcclxuICAgICAgICAgICAgICogVGhlIGNhbGxlZSAoc2VydmVyIFtub3Qgc2VydmVyIGFwcGxpY2F0aW9uXSkgaXMgbm90IGF2YWlsYWJsZSBhbmQgZGlzYXBwZWFyZWRcclxuICAgICAgICAgICAgICovXHJcbiAgICAgICAgICAgIGNoaWxkQ29uZmlnID0gJC5leHRlbmQodHJ1ZSwge30sIHRoaXMuZ2V0R2xJbnN0YW5jZSgpLnRvQ29uZmlnKCkpLmNvbnRlbnRbMF07XHJcbiAgICAgICAgICAgIHBhcmVudEl0ZW0gPSB0aGlzLl9sYXlvdXRNYW5hZ2VyLnJvb3QuZ2V0SXRlbXNCeUlkKHRoaXMuX3BhcmVudElkKVswXTtcclxuXHJcbiAgICAgICAgICAgIC8qXHJcbiAgICAgICAgICAgICAqIEZhbGxiYWNrIGlmIHBhcmVudEl0ZW0gaXMgbm90IGF2YWlsYWJsZS4gRWl0aGVyIGFkZCBpdCB0byB0aGUgdG9wbW9zdFxyXG4gICAgICAgICAgICAgKiBpdGVtIG9yIG1ha2UgaXQgdGhlIHRvcG1vc3QgaXRlbSBpZiB0aGUgbGF5b3V0IGlzIGVtcHR5XHJcbiAgICAgICAgICAgICAqL1xyXG4gICAgICAgICAgICBpZiAoIXBhcmVudEl0ZW0pIHtcclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9sYXlvdXRNYW5hZ2VyLnJvb3QuY29udGVudEl0ZW1zLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgICAgICAgICAgICBwYXJlbnRJdGVtID0gdGhpcy5fbGF5b3V0TWFuYWdlci5yb290LmNvbnRlbnRJdGVtc1swXTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcGFyZW50SXRlbSA9IHRoaXMuX2xheW91dE1hbmFnZXIucm9vdDtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGluZGV4ID0gMDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcGFyZW50SXRlbS5hZGRDaGlsZChjaGlsZENvbmZpZywgdGhpcy5faW5kZXhJblBhcmVudCk7XHJcbiAgICAgICAgdGhpcy5jbG9zZSgpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ3JlYXRlcyB0aGUgVVJMIGFuZCB3aW5kb3cgcGFyYW1ldGVyXHJcbiAgICAgKiBhbmQgb3BlbnMgYSBuZXcgd2luZG93XHJcbiAgICAgKlxyXG4gICAgICogQHByaXZhdGVcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJucyB7dm9pZH1cclxuICAgICAqL1xyXG4gICAgX2NyZWF0ZVdpbmRvdygpIHtcclxuICAgICAgICB2YXIgY2hlY2tSZWFkeUludGVydmFsLFxyXG4gICAgICAgICAgICB1cmwgPSB0aGlzLl9jcmVhdGVVcmwoKSxcclxuXHJcbiAgICAgICAgICAgIC8qKlxyXG4gICAgICAgICAgICAgKiBCb2d1cyB0aXRsZSB0byBwcmV2ZW50IHJlLXVzYWdlIG9mIGV4aXN0aW5nIHdpbmRvdyB3aXRoIHRoZVxyXG4gICAgICAgICAgICAgKiBzYW1lIHRpdGxlLiBUaGUgYWN0dWFsIHRpdGxlIHdpbGwgYmUgc2V0IGJ5IHRoZSBuZXcgd2luZG93J3NcclxuICAgICAgICAgICAgICogR29sZGVuTGF5b3V0IGluc3RhbmNlIGlmIGl0IGRldGVjdHMgdGhhdCBpdCBpcyBpbiBzdWJXaW5kb3dNb2RlXHJcbiAgICAgICAgICAgICAqL1xyXG4gICAgICAgICAgICB0aXRsZSA9IE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIDEwMDAwMDApLnRvU3RyaW5nKDM2KSxcclxuXHJcbiAgICAgICAgICAgIC8qKlxyXG4gICAgICAgICAgICAgKiBUaGUgb3B0aW9ucyBhcyB1c2VkIGluIHRoZSB3aW5kb3cub3BlbiBzdHJpbmdcclxuICAgICAgICAgICAgICovXHJcbiAgICAgICAgICAgIG9wdGlvbnMgPSB0aGlzLl9zZXJpYWxpemVXaW5kb3dPcHRpb25zKHtcclxuICAgICAgICAgICAgICAgIHdpZHRoOiB0aGlzLl9kaW1lbnNpb25zLndpZHRoLFxyXG4gICAgICAgICAgICAgICAgaGVpZ2h0OiB0aGlzLl9kaW1lbnNpb25zLmhlaWdodCxcclxuICAgICAgICAgICAgICAgIGlubmVyV2lkdGg6IHRoaXMuX2RpbWVuc2lvbnMud2lkdGgsXHJcbiAgICAgICAgICAgICAgICBpbm5lckhlaWdodDogdGhpcy5fZGltZW5zaW9ucy5oZWlnaHQsXHJcbiAgICAgICAgICAgICAgICBtZW51YmFyOiAnbm8nLFxyXG4gICAgICAgICAgICAgICAgdG9vbGJhcjogJ25vJyxcclxuICAgICAgICAgICAgICAgIGxvY2F0aW9uOiAnbm8nLFxyXG4gICAgICAgICAgICAgICAgcGVyc29uYWxiYXI6ICdubycsXHJcbiAgICAgICAgICAgICAgICByZXNpemFibGU6ICd5ZXMnLFxyXG4gICAgICAgICAgICAgICAgc2Nyb2xsYmFyczogJ25vJyxcclxuICAgICAgICAgICAgICAgIHN0YXR1czogJ25vJ1xyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgdGhpcy5fcG9wb3V0V2luZG93ID0gd2luZG93Lm9wZW4odXJsLCB0aXRsZSwgb3B0aW9ucyk7XHJcblxyXG4gICAgICAgIGlmICghdGhpcy5fcG9wb3V0V2luZG93KSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLl9sYXlvdXRNYW5hZ2VyLmNvbmZpZy5zZXR0aW5ncy5ibG9ja2VkUG9wb3V0c1Rocm93RXJyb3IgPT09IHRydWUpIHtcclxuICAgICAgICAgICAgICAgIHZhciBlcnJvciA9IG5ldyBFcnJvcignUG9wb3V0IGJsb2NrZWQnKTtcclxuICAgICAgICAgICAgICAgIGVycm9yLnR5cGUgPSAncG9wb3V0QmxvY2tlZCc7XHJcbiAgICAgICAgICAgICAgICB0aHJvdyBlcnJvcjtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgJCh0aGlzLl9wb3BvdXRXaW5kb3cpXHJcbiAgICAgICAgICAgIC5vbignbG9hZCcsIGZuQmluZCh0aGlzLl9wb3NpdGlvbldpbmRvdywgdGhpcykpXHJcbiAgICAgICAgICAgIC5vbigndW5sb2FkIGJlZm9yZXVubG9hZCcsIGZuQmluZCh0aGlzLl9vbkNsb3NlLCB0aGlzKSk7XHJcblxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFBvbGxpbmcgdGhlIGNoaWxkd2luZG93IHRvIGZpbmQgb3V0IGlmIEdvbGRlbkxheW91dCBoYXMgYmVlbiBpbml0aWFsaXNlZFxyXG4gICAgICAgICAqIGRvZXNuJ3Qgc2VlbSBvcHRpbWFsLCBidXQgdGhlIGFsdGVybmF0aXZlcyAtIGFkZGluZyBhIGNhbGxiYWNrIHRvIHRoZSBwYXJlbnRcclxuICAgICAgICAgKiB3aW5kb3cgb3IgcmFpc2luZyBhbiBldmVudCBvbiB0aGUgd2luZG93IG9iamVjdCAtIGJvdGggd291bGQgaW50cm9kdWNlIGtub3dsZWRnZVxyXG4gICAgICAgICAqIGFib3V0IHRoZSBwYXJlbnQgdG8gdGhlIGNoaWxkIHdpbmRvdyB3aGljaCB3ZSdkIHJhdGhlciBhdm9pZFxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGNoZWNrUmVhZHlJbnRlcnZhbCA9IHNldEludGVydmFsKGZuQmluZChmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMuX3BvcG91dFdpbmRvdy5fX2dsSW5zdGFuY2UgJiYgdGhpcy5fcG9wb3V0V2luZG93Ll9fZ2xJbnN0YW5jZS5pc0luaXRpYWxpc2VkKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9vbkluaXRpYWxpc2VkKCk7XHJcbiAgICAgICAgICAgICAgICBjbGVhckludGVydmFsKGNoZWNrUmVhZHlJbnRlcnZhbCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LCB0aGlzKSwgMTApO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogU2VyaWFsaXNlcyBhIG1hcCBvZiBrZXk6dmFsdWVzIHRvIGEgd2luZG93IG9wdGlvbnMgc3RyaW5nXHJcbiAgICAgKlxyXG4gICAgICogQHBhcmFtICAge09iamVjdH0gd2luZG93T3B0aW9uc1xyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHtTdHJpbmd9IHNlcmlhbGlzZWQgd2luZG93IG9wdGlvbnNcclxuICAgICAqL1xyXG4gICAgX3NlcmlhbGl6ZVdpbmRvd09wdGlvbnMod2luZG93T3B0aW9ucykge1xyXG4gICAgICAgIHZhciB3aW5kb3dPcHRpb25zU3RyaW5nID0gW10sXHJcbiAgICAgICAgICAgIGtleTtcclxuXHJcbiAgICAgICAgZm9yIChrZXkgaW4gd2luZG93T3B0aW9ucykge1xyXG4gICAgICAgICAgICB3aW5kb3dPcHRpb25zU3RyaW5nLnB1c2goa2V5ICsgJz0nICsgd2luZG93T3B0aW9uc1trZXldKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiB3aW5kb3dPcHRpb25zU3RyaW5nLmpvaW4oJywnKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENyZWF0ZXMgdGhlIFVSTCBmb3IgdGhlIG5ldyB3aW5kb3csIGluY2x1ZGluZyB0aGVcclxuICAgICAqIGNvbmZpZyBHRVQgcGFyYW1ldGVyXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge1N0cmluZ30gVVJMXHJcbiAgICAgKi9cclxuICAgIF9jcmVhdGVVcmwoKSB7XHJcbiAgICAgICAgdmFyIGNvbmZpZyA9IHtcclxuICAgICAgICAgICAgICAgIGNvbnRlbnQ6IHRoaXMuX2NvbmZpZ1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBzdG9yYWdlS2V5ID0gJ2dsLXdpbmRvdy1jb25maWctJyArIGdldFVuaXF1ZUlkKCksXHJcbiAgICAgICAgICAgIHVybFBhcnRzO1xyXG5cclxuICAgICAgICBjb25maWcgPSAobmV3IENvbmZpZ01pbmlmaWVyKCkpLm1pbmlmeUNvbmZpZyhjb25maWcpO1xyXG5cclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbShzdG9yYWdlS2V5LCBKU09OLnN0cmluZ2lmeShjb25maWcpKTtcclxuICAgICAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignRXJyb3Igd2hpbGUgd3JpdGluZyB0byBsb2NhbFN0b3JhZ2UgJyArIGUudG9TdHJpbmcoKSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB1cmxQYXJ0cyA9IGRvY3VtZW50LmxvY2F0aW9uLmhyZWYuc3BsaXQoJz8nKTtcclxuXHJcbiAgICAgICAgLy8gVVJMIGRvZXNuJ3QgY29udGFpbiBHRVQtcGFyYW1ldGVyc1xyXG4gICAgICAgIGlmICh1cmxQYXJ0cy5sZW5ndGggPT09IDEpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHVybFBhcnRzWzBdICsgJz9nbC13aW5kb3c9JyArIHN0b3JhZ2VLZXk7XHJcblxyXG4gICAgICAgICAgICAvLyBVUkwgY29udGFpbnMgR0VULXBhcmFtZXRlcnNcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICByZXR1cm4gZG9jdW1lbnQubG9jYXRpb24uaHJlZiArICcmZ2wtd2luZG93PScgKyBzdG9yYWdlS2V5O1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIE1vdmUgdGhlIG5ld2x5IGNyZWF0ZWQgd2luZG93IHJvdWdobHkgdG9cclxuICAgICAqIHdoZXJlIHRoZSBjb21wb25lbnQgdXNlZCB0byBiZS5cclxuICAgICAqXHJcbiAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHt2b2lkfVxyXG4gICAgICovXHJcbiAgICBfcG9zaXRpb25XaW5kb3coKSB7XHJcbiAgICAgICAgdGhpcy5fcG9wb3V0V2luZG93Lm1vdmVUbyh0aGlzLl9kaW1lbnNpb25zLmxlZnQsIHRoaXMuX2RpbWVuc2lvbnMudG9wKTtcclxuICAgICAgICB0aGlzLl9wb3BvdXRXaW5kb3cuZm9jdXMoKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENhbGxiYWNrIHdoZW4gdGhlIG5ldyB3aW5kb3cgaXMgb3BlbmVkIGFuZCB0aGUgR29sZGVuTGF5b3V0IGluc3RhbmNlXHJcbiAgICAgKiB3aXRoaW4gaXQgaXMgaW5pdGlhbGlzZWRcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJucyB7dm9pZH1cclxuICAgICAqL1xyXG4gICAgX29uSW5pdGlhbGlzZWQoKSB7XHJcbiAgICAgICAgdGhpcy5pc0luaXRpYWxpc2VkID0gdHJ1ZTtcclxuICAgICAgICB0aGlzLmdldEdsSW5zdGFuY2UoKS5vbigncG9wSW4nLCB0aGlzLnBvcEluLCB0aGlzKTtcclxuICAgICAgICB0aGlzLmVtaXQoJ2luaXRpYWxpc2VkJyk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBJbnZva2VkIDUwbXMgYWZ0ZXIgdGhlIHdpbmRvdyB1bmxvYWQgZXZlbnRcclxuICAgICAqXHJcbiAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHt2b2lkfVxyXG4gICAgICovXHJcbiAgICBfb25DbG9zZSgpIHtcclxuICAgICAgICBzZXRUaW1lb3V0KGZuQmluZCh0aGlzLmVtaXQsIHRoaXMsIFsnY2xvc2VkJ10pLCA1MCk7XHJcbiAgICB9XHJcbn1cclxuIiwiaW1wb3J0IEV2ZW50RW1pdHRlciBmcm9tICcuLi91dGlscy9FdmVudEVtaXR0ZXInXHJcbmltcG9ydCB7XHJcbiAgICBzdHJpcFRhZ3MsXHJcbiAgICBnZXRUb3VjaEV2ZW50XHJcbn0gZnJvbSAnLi4vdXRpbHMvdXRpbHMnO1xyXG5pbXBvcnQgJCBmcm9tICdqcXVlcnknO1xyXG5cclxuY29uc3QgX3RlbXBsYXRlID0gJzxkaXYgY2xhc3M9XCJsbV9kcmFnUHJveHlcIj4nICtcclxuICAgICc8ZGl2IGNsYXNzPVwibG1faGVhZGVyXCI+JyArXHJcbiAgICAnPHVsIGNsYXNzPVwibG1fdGFic1wiPicgK1xyXG4gICAgJzxsaSBjbGFzcz1cImxtX3RhYiBsbV9hY3RpdmVcIj48aSBjbGFzcz1cImxtX2xlZnRcIj48L2k+JyArXHJcbiAgICAnPHNwYW4gY2xhc3M9XCJsbV90aXRsZVwiPjwvc3Bhbj4nICtcclxuICAgICc8aSBjbGFzcz1cImxtX3JpZ2h0XCI+PC9pPjwvbGk+JyArXHJcbiAgICAnPC91bD4nICtcclxuICAgICc8L2Rpdj4nICtcclxuICAgICc8ZGl2IGNsYXNzPVwibG1fY29udGVudFwiPjwvZGl2PicgK1xyXG4gICAgJzwvZGl2Pic7XHJcblxyXG4vKipcclxuICogVGhpcyBjbGFzcyBjcmVhdGVzIGEgdGVtcG9yYXJ5IGNvbnRhaW5lclxyXG4gKiBmb3IgdGhlIGNvbXBvbmVudCB3aGlsc3QgaXQgaXMgYmVpbmcgZHJhZ2dlZFxyXG4gKiBhbmQgaGFuZGxlcyBkcmFnIGV2ZW50c1xyXG4gKlxyXG4gKiBAY29uc3RydWN0b3JcclxuICogQHByaXZhdGVcclxuICpcclxuICogQHBhcmFtIHtOdW1iZXJ9IHggICAgICAgICAgICAgIFRoZSBpbml0aWFsIHggcG9zaXRpb25cclxuICogQHBhcmFtIHtOdW1iZXJ9IHkgICAgICAgICAgICAgIFRoZSBpbml0aWFsIHkgcG9zaXRpb25cclxuICogQHBhcmFtIHtEcmFnTGlzdGVuZXJ9IGRyYWdMaXN0ZW5lclxyXG4gKiBAcGFyYW0ge2xtLkxheW91dE1hbmFnZXJ9IGxheW91dE1hbmFnZXJcclxuICogQHBhcmFtIHtBYnN0cmFjdENvbnRlbnRJdGVtfSBjb250ZW50SXRlbVxyXG4gKiBAcGFyYW0ge0Fic3RyYWN0Q29udGVudEl0ZW19IG9yaWdpbmFsUGFyZW50XHJcbiAqL1xyXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBEcmFnUHJveHkgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xyXG5cclxuICAgIGNvbnN0cnVjdG9yKHgsIHksIGRyYWdMaXN0ZW5lciwgbGF5b3V0TWFuYWdlciwgY29udGVudEl0ZW0sIG9yaWdpbmFsUGFyZW50KSB7XHJcblxyXG4gICAgICAgIHN1cGVyKCk7XHJcblxyXG4gICAgICAgIHRoaXMuX2RyYWdMaXN0ZW5lciA9IGRyYWdMaXN0ZW5lcjtcclxuICAgICAgICB0aGlzLl9sYXlvdXRNYW5hZ2VyID0gbGF5b3V0TWFuYWdlcjtcclxuICAgICAgICB0aGlzLl9jb250ZW50SXRlbSA9IGNvbnRlbnRJdGVtO1xyXG4gICAgICAgIHRoaXMuX29yaWdpbmFsUGFyZW50ID0gb3JpZ2luYWxQYXJlbnQ7XHJcblxyXG4gICAgICAgIHRoaXMuX2FyZWEgPSBudWxsO1xyXG4gICAgICAgIHRoaXMuX2xhc3RWYWxpZEFyZWEgPSBudWxsO1xyXG5cclxuICAgICAgICB0aGlzLl9kcmFnTGlzdGVuZXIub24oJ2RyYWcnLCB0aGlzLl9vbkRyYWcsIHRoaXMpO1xyXG4gICAgICAgIHRoaXMuX2RyYWdMaXN0ZW5lci5vbignZHJhZ1N0b3AnLCB0aGlzLl9vbkRyb3AsIHRoaXMpO1xyXG5cclxuICAgICAgICB0aGlzLmVsZW1lbnQgPSAkKF90ZW1wbGF0ZSk7XHJcbiAgICAgICAgaWYgKG9yaWdpbmFsUGFyZW50ICYmIG9yaWdpbmFsUGFyZW50Ll9zaWRlKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX3NpZGVkID0gb3JpZ2luYWxQYXJlbnQuX3NpZGVkO1xyXG4gICAgICAgICAgICB0aGlzLmVsZW1lbnQuYWRkQ2xhc3MoJ2xtXycgKyBvcmlnaW5hbFBhcmVudC5fc2lkZSk7XHJcbiAgICAgICAgICAgIGlmIChbJ3JpZ2h0JywgJ2JvdHRvbSddLmluZGV4T2Yob3JpZ2luYWxQYXJlbnQuX3NpZGUpID49IDApXHJcbiAgICAgICAgICAgICAgICB0aGlzLmVsZW1lbnQuZmluZCgnLmxtX2NvbnRlbnQnKS5hZnRlcih0aGlzLmVsZW1lbnQuZmluZCgnLmxtX2hlYWRlcicpKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5lbGVtZW50LmNzcyh7XHJcbiAgICAgICAgICAgIGxlZnQ6IHgsXHJcbiAgICAgICAgICAgIHRvcDogeVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHRoaXMuZWxlbWVudC5maW5kKCcubG1fdGFiJykuYXR0cigndGl0bGUnLCBzdHJpcFRhZ3ModGhpcy5fY29udGVudEl0ZW0uY29uZmlnLnRpdGxlKSk7XHJcbiAgICAgICAgdGhpcy5lbGVtZW50LmZpbmQoJy5sbV90aXRsZScpLmh0bWwodGhpcy5fY29udGVudEl0ZW0uY29uZmlnLnRpdGxlKTtcclxuICAgICAgICB0aGlzLmNoaWxkRWxlbWVudENvbnRhaW5lciA9IHRoaXMuZWxlbWVudC5maW5kKCcubG1fY29udGVudCcpO1xyXG4gICAgICAgIHRoaXMuY2hpbGRFbGVtZW50Q29udGFpbmVyLmFwcGVuZChjb250ZW50SXRlbS5lbGVtZW50KTtcclxuXHJcbiAgICAgICAgdGhpcy5fdW5kaXNwbGF5VHJlZSgpO1xyXG4gICAgICAgIHRoaXMuX2xheW91dE1hbmFnZXIuXyRjYWxjdWxhdGVJdGVtQXJlYXMoKTtcclxuICAgICAgICB0aGlzLl9zZXREaW1lbnNpb25zKCk7XHJcblxyXG4gICAgICAgICQoZG9jdW1lbnQuYm9keSkuYXBwZW5kKHRoaXMuZWxlbWVudCk7XHJcblxyXG4gICAgICAgIHZhciBvZmZzZXQgPSB0aGlzLl9sYXlvdXRNYW5hZ2VyLmNvbnRhaW5lci5vZmZzZXQoKTtcclxuXHJcbiAgICAgICAgdGhpcy5fbWluWCA9IG9mZnNldC5sZWZ0O1xyXG4gICAgICAgIHRoaXMuX21pblkgPSBvZmZzZXQudG9wO1xyXG4gICAgICAgIHRoaXMuX21heFggPSB0aGlzLl9sYXlvdXRNYW5hZ2VyLmNvbnRhaW5lci53aWR0aCgpICsgdGhpcy5fbWluWDtcclxuICAgICAgICB0aGlzLl9tYXhZID0gdGhpcy5fbGF5b3V0TWFuYWdlci5jb250YWluZXIuaGVpZ2h0KCkgKyB0aGlzLl9taW5ZO1xyXG4gICAgICAgIHRoaXMuX3dpZHRoID0gdGhpcy5lbGVtZW50LndpZHRoKCk7XHJcbiAgICAgICAgdGhpcy5faGVpZ2h0ID0gdGhpcy5lbGVtZW50LmhlaWdodCgpO1xyXG5cclxuICAgICAgICB0aGlzLl9zZXREcm9wUG9zaXRpb24oeCwgeSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDYWxsYmFjayBvbiBldmVyeSBtb3VzZU1vdmUgZXZlbnQgZHVyaW5nIGEgZHJhZy4gRGV0ZXJtaW5lcyBpZiB0aGUgZHJhZyBpc1xyXG4gICAgICogc3RpbGwgd2l0aGluIHRoZSB2YWxpZCBkcmFnIGFyZWEgYW5kIGNhbGxzIHRoZSBsYXlvdXRNYW5hZ2VyIHRvIGhpZ2hsaWdodCB0aGVcclxuICAgICAqIGN1cnJlbnQgZHJvcCBhcmVhXHJcbiAgICAgKlxyXG4gICAgICogQHBhcmFtICAge051bWJlcn0gb2Zmc2V0WCBUaGUgZGlmZmVyZW5jZSBmcm9tIHRoZSBvcmlnaW5hbCB4IHBvc2l0aW9uIGluIHB4XHJcbiAgICAgKiBAcGFyYW0gICB7TnVtYmVyfSBvZmZzZXRZIFRoZSBkaWZmZXJlbmNlIGZyb20gdGhlIG9yaWdpbmFsIHkgcG9zaXRpb24gaW4gcHhcclxuICAgICAqIEBwYXJhbSAgIHtqUXVlcnkgRE9NIGV2ZW50fSBldmVudFxyXG4gICAgICpcclxuICAgICAqIEBwcml2YXRlXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge3ZvaWR9XHJcbiAgICAgKi9cclxuICAgIF9vbkRyYWcob2Zmc2V0WCwgb2Zmc2V0WSwgZXZlbnQpIHtcclxuICAgICAgICBldmVudCA9IGdldFRvdWNoRXZlbnQoZXZlbnQpXHJcblxyXG4gICAgICAgIHZhciB4ID0gZXZlbnQucGFnZVgsXHJcbiAgICAgICAgICAgIHkgPSBldmVudC5wYWdlWSxcclxuICAgICAgICAgICAgaXNXaXRoaW5Db250YWluZXIgPSB4ID4gdGhpcy5fbWluWCAmJiB4IDwgdGhpcy5fbWF4WCAmJiB5ID4gdGhpcy5fbWluWSAmJiB5IDwgdGhpcy5fbWF4WTtcclxuXHJcbiAgICAgICAgaWYgKCFpc1dpdGhpbkNvbnRhaW5lciAmJiB0aGlzLl9sYXlvdXRNYW5hZ2VyLmNvbmZpZy5zZXR0aW5ncy5jb25zdHJhaW5EcmFnVG9Db250YWluZXIgPT09IHRydWUpIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5fc2V0RHJvcFBvc2l0aW9uKHgsIHkpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogU2V0cyB0aGUgdGFyZ2V0IHBvc2l0aW9uLCBoaWdobGlnaHRpbmcgdGhlIGFwcHJvcHJpYXRlIGFyZWFcclxuICAgICAqXHJcbiAgICAgKiBAcGFyYW0gICB7TnVtYmVyfSB4IFRoZSB4IHBvc2l0aW9uIGluIHB4XHJcbiAgICAgKiBAcGFyYW0gICB7TnVtYmVyfSB5IFRoZSB5IHBvc2l0aW9uIGluIHB4XHJcbiAgICAgKlxyXG4gICAgICogQHByaXZhdGVcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJucyB7dm9pZH1cclxuICAgICAqL1xyXG4gICAgX3NldERyb3BQb3NpdGlvbih4LCB5KSB7XHJcbiAgICAgICAgdGhpcy5lbGVtZW50LmNzcyh7XHJcbiAgICAgICAgICAgIGxlZnQ6IHgsXHJcbiAgICAgICAgICAgIHRvcDogeVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHRoaXMuX2FyZWEgPSB0aGlzLl9sYXlvdXRNYW5hZ2VyLl8kZ2V0QXJlYSh4LCB5KTtcclxuXHJcbiAgICAgICAgaWYgKHRoaXMuX2FyZWEgIT09IG51bGwpIHtcclxuICAgICAgICAgICAgdGhpcy5fbGFzdFZhbGlkQXJlYSA9IHRoaXMuX2FyZWE7XHJcbiAgICAgICAgICAgIHRoaXMuX2FyZWEuY29udGVudEl0ZW0uXyRoaWdobGlnaHREcm9wWm9uZSh4LCB5LCB0aGlzLl9hcmVhKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDYWxsYmFjayB3aGVuIHRoZSBkcmFnIGhhcyBmaW5pc2hlZC4gRGV0ZXJtaW5lcyB0aGUgZHJvcCBhcmVhXHJcbiAgICAgKiBhbmQgYWRkcyB0aGUgY2hpbGQgdG8gaXRcclxuICAgICAqXHJcbiAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHt2b2lkfVxyXG4gICAgICovXHJcbiAgICBfb25Ecm9wKCkge1xyXG4gICAgICAgIHRoaXMuX3VwZGF0ZVRyZWUoKVxyXG4gICAgICAgIHRoaXMuX2xheW91dE1hbmFnZXIuZHJvcFRhcmdldEluZGljYXRvci5oaWRlKCk7XHJcblxyXG4gICAgICAgIC8qXHJcbiAgICAgICAgICogVmFsaWQgZHJvcCBhcmVhIGZvdW5kXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgaWYgKHRoaXMuX2FyZWEgIT09IG51bGwpIHtcclxuICAgICAgICAgICAgdGhpcy5fYXJlYS5jb250ZW50SXRlbS5fJG9uRHJvcCh0aGlzLl9jb250ZW50SXRlbSwgdGhpcy5fYXJlYSk7XHJcblxyXG4gICAgICAgICAgICAvKipcclxuICAgICAgICAgICAgICogTm8gdmFsaWQgZHJvcCBhcmVhIGF2YWlsYWJsZSBhdCBwcmVzZW50LCBidXQgb25lIGhhcyBiZWVuIGZvdW5kIGJlZm9yZS5cclxuICAgICAgICAgICAgICogVXNlIGl0XHJcbiAgICAgICAgICAgICAqL1xyXG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5fbGFzdFZhbGlkQXJlYSAhPT0gbnVsbCkge1xyXG4gICAgICAgICAgICB0aGlzLl9sYXN0VmFsaWRBcmVhLmNvbnRlbnRJdGVtLl8kb25Ecm9wKHRoaXMuX2NvbnRlbnRJdGVtLCB0aGlzLl9sYXN0VmFsaWRBcmVhKTtcclxuXHJcbiAgICAgICAgICAgIC8qKlxyXG4gICAgICAgICAgICAgKiBObyB2YWxpZCBkcm9wIGFyZWEgZm91bmQgZHVyaW5nIHRoZSBkdXJhdGlvbiBvZiB0aGUgZHJhZy4gUmV0dXJuXHJcbiAgICAgICAgICAgICAqIGNvbnRlbnQgaXRlbSB0byBpdHMgb3JpZ2luYWwgcG9zaXRpb24gaWYgYSBvcmlnaW5hbCBwYXJlbnQgaXMgcHJvdmlkZWQuXHJcbiAgICAgICAgICAgICAqIChXaGljaCBpcyBub3QgdGhlIGNhc2UgaWYgdGhlIGRyYWcgaGFkIGJlZW4gaW5pdGlhdGVkIGJ5IGNyZWF0ZURyYWdTb3VyY2UpXHJcbiAgICAgICAgICAgICAqL1xyXG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5fb3JpZ2luYWxQYXJlbnQpIHtcclxuICAgICAgICAgICAgdGhpcy5fb3JpZ2luYWxQYXJlbnQuYWRkQ2hpbGQodGhpcy5fY29udGVudEl0ZW0pO1xyXG5cclxuICAgICAgICAgICAgLyoqXHJcbiAgICAgICAgICAgICAqIFRoZSBkcmFnIGRpZG4ndCB1bHRpbWF0ZWx5IGVuZCB1cCB3aXRoIGFkZGluZyB0aGUgY29udGVudCBpdGVtIHRvXHJcbiAgICAgICAgICAgICAqIGFueSBjb250YWluZXIuIEluIG9yZGVyIHRvIGVuc3VyZSBjbGVhbiB1cCBoYXBwZW5zLCBkZXN0cm95IHRoZVxyXG4gICAgICAgICAgICAgKiBjb250ZW50IGl0ZW0uXHJcbiAgICAgICAgICAgICAqL1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2NvbnRlbnRJdGVtLl8kZGVzdHJveSgpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5lbGVtZW50LnJlbW92ZSgpO1xyXG5cclxuICAgICAgICB0aGlzLl9sYXlvdXRNYW5hZ2VyLmVtaXQoJ2l0ZW1Ecm9wcGVkJywgdGhpcy5fY29udGVudEl0ZW0pO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogVW5kaXNwbGF5cyB0aGUgaXRlbSBmcm9tIGl0cyBvcmlnaW5hbCBwb3NpdGlvbiB3aXRoaW4gdGhlIHRyZWVcclxuICAgICAqXHJcbiAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHt2b2lkfVxyXG4gICAgICovXHJcbiAgICBfdW5kaXNwbGF5VHJlZSgpIHtcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogcGFyZW50IGlzIG51bGwgaWYgdGhlIGRyYWcgaGFkIGJlZW4gaW5pdGlhdGVkIGJ5IGEgZXh0ZXJuYWwgZHJhZyBzb3VyY2VcclxuICAgICAgICAgKi9cclxuICAgICAgICBpZiAodGhpcy5fY29udGVudEl0ZW0ucGFyZW50KSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2NvbnRlbnRJdGVtLnBhcmVudC51bmRpc3BsYXlDaGlsZCh0aGlzLl9jb250ZW50SXRlbSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUmVtb3ZlcyB0aGUgaXRlbSBmcm9tIGl0cyBvcmlnaW5hbCBwb3NpdGlvbiB3aXRoaW4gdGhlIHRyZWVcclxuICAgICAqXHJcbiAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHt2b2lkfVxyXG4gICAgICovXHJcbiAgICBfdXBkYXRlVHJlZSgpIHtcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogcGFyZW50IGlzIG51bGwgaWYgdGhlIGRyYWcgaGFkIGJlZW4gaW5pdGlhdGVkIGJ5IGEgZXh0ZXJuYWwgZHJhZyBzb3VyY2VcclxuICAgICAgICAgKi9cclxuICAgICAgICBpZiAodGhpcy5fY29udGVudEl0ZW0ucGFyZW50KSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2NvbnRlbnRJdGVtLnBhcmVudC5yZW1vdmVDaGlsZCh0aGlzLl9jb250ZW50SXRlbSwgdHJ1ZSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLl9jb250ZW50SXRlbS5fJHNldFBhcmVudCh0aGlzKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFVwZGF0ZXMgdGhlIERyYWcgUHJveGllJ3MgZGltZW5zaW9uc1xyXG4gICAgICpcclxuICAgICAqIEBwcml2YXRlXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge3ZvaWR9XHJcbiAgICAgKi9cclxuICAgIF9zZXREaW1lbnNpb25zKCkge1xyXG4gICAgICAgIHZhciBkaW1lbnNpb25zID0gdGhpcy5fbGF5b3V0TWFuYWdlci5jb25maWcuZGltZW5zaW9ucyxcclxuICAgICAgICAgICAgd2lkdGggPSBkaW1lbnNpb25zLmRyYWdQcm94eVdpZHRoLFxyXG4gICAgICAgICAgICBoZWlnaHQgPSBkaW1lbnNpb25zLmRyYWdQcm94eUhlaWdodDtcclxuXHJcbiAgICAgICAgdGhpcy5lbGVtZW50LndpZHRoKHdpZHRoKTtcclxuICAgICAgICB0aGlzLmVsZW1lbnQuaGVpZ2h0KGhlaWdodCk7XHJcbiAgICAgICAgd2lkdGggLT0gKHRoaXMuX3NpZGVkID8gZGltZW5zaW9ucy5oZWFkZXJIZWlnaHQgOiAwKTtcclxuICAgICAgICBoZWlnaHQgLT0gKCF0aGlzLl9zaWRlZCA/IGRpbWVuc2lvbnMuaGVhZGVySGVpZ2h0IDogMCk7XHJcbiAgICAgICAgdGhpcy5jaGlsZEVsZW1lbnRDb250YWluZXIud2lkdGgod2lkdGgpO1xyXG4gICAgICAgIHRoaXMuY2hpbGRFbGVtZW50Q29udGFpbmVyLmhlaWdodChoZWlnaHQpO1xyXG4gICAgICAgIHRoaXMuX2NvbnRlbnRJdGVtLmVsZW1lbnQud2lkdGgod2lkdGgpO1xyXG4gICAgICAgIHRoaXMuX2NvbnRlbnRJdGVtLmVsZW1lbnQuaGVpZ2h0KGhlaWdodCk7XHJcbiAgICAgICAgdGhpcy5fY29udGVudEl0ZW0uY2FsbERvd253YXJkcygnXyRzaG93Jyk7XHJcbiAgICAgICAgdGhpcy5fY29udGVudEl0ZW0uY2FsbERvd253YXJkcygnc2V0U2l6ZScpO1xyXG4gICAgfVxyXG59XHJcbiIsImltcG9ydCBEcmFnTGlzdGVuZXIgZnJvbSAnLi4vdXRpbHMvRHJhZ0xpc3RlbmVyJ1xyXG5pbXBvcnQgRHJhZ1Byb3h5IGZyb20gJy4uL2NvbnRyb2xzL0RyYWdQcm94eSdcclxuaW1wb3J0IHtcclxuICAgIGlzRnVuY3Rpb25cclxufSBmcm9tICcuLi91dGlscy91dGlscydcclxuaW1wb3J0ICQgZnJvbSAnanF1ZXJ5J1xyXG5cclxuLyoqXHJcbiAqIEFsbG93cyBmb3IgYW55IERPTSBpdGVtIHRvIGNyZWF0ZSBhIGNvbXBvbmVudCBvbiBkcmFnXHJcbiAqIHN0YXJ0IHRvYmUgZHJhZ2dlZCBpbnRvIHRoZSBMYXlvdXRcclxuICpcclxuICogQHBhcmFtIHtqUXVlcnkgZWxlbWVudH0gZWxlbWVudFxyXG4gKiBAcGFyYW0ge09iamVjdH0gaXRlbUNvbmZpZyB0aGUgY29uZmlndXJhdGlvbiBmb3IgdGhlIGNvbnRlbnRJdGVtIHRoYXQgd2lsbCBiZSBjcmVhdGVkXHJcbiAqIEBwYXJhbSB7TGF5b3V0TWFuYWdlcn0gbGF5b3V0TWFuYWdlclxyXG4gKlxyXG4gKiBAY29uc3RydWN0b3JcclxuICovXHJcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIERyYWdTb3VyY2Uge1xyXG4gICAgY29uc3RydWN0b3IoZWxlbWVudCwgaXRlbUNvbmZpZywgbGF5b3V0TWFuYWdlcikge1xyXG4gICAgICAgIHRoaXMuX2VsZW1lbnQgPSBlbGVtZW50O1xyXG4gICAgICAgIHRoaXMuX2l0ZW1Db25maWcgPSBpdGVtQ29uZmlnO1xyXG4gICAgICAgIHRoaXMuX2xheW91dE1hbmFnZXIgPSBsYXlvdXRNYW5hZ2VyO1xyXG4gICAgICAgIHRoaXMuX2RyYWdMaXN0ZW5lciA9IG51bGw7XHJcblxyXG4gICAgICAgIHRoaXMuX2NyZWF0ZURyYWdMaXN0ZW5lcigpO1xyXG4gICAgfVxyXG5cclxuXHQvKipcclxuXHQgKiBEaXNwb3NlcyBvZiB0aGUgZHJhZyBsaXN0ZW5lcnMgc28gdGhlIGRyYWcgc291cmNlIGlzIG5vdCB1c2FibGUgYW55IG1vcmUuXHJcblx0ICpcclxuXHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHQgKi9cclxuXHRkZXN0cm95KCkge1xyXG5cdFx0dGhpcy5fcmVtb3ZlRHJhZ0xpc3RlbmVyKCk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8qKlxyXG4gICAgICogQ2FsbGVkIGluaXRpYWxseSBhbmQgYWZ0ZXIgZXZlcnkgZHJhZ1xyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHt2b2lkfVxyXG4gICAgICovXHJcbiAgICBfY3JlYXRlRHJhZ0xpc3RlbmVyKCkge1xyXG4gICAgICAgIHRoaXMuX3JlbW92ZURyYWdMaXN0ZW5lcigpO1xyXG5cclxuICAgICAgICB0aGlzLl9kcmFnTGlzdGVuZXIgPSBuZXcgRHJhZ0xpc3RlbmVyKHRoaXMuX2VsZW1lbnQpO1xyXG4gICAgICAgIHRoaXMuX2RyYWdMaXN0ZW5lci5vbignZHJhZ1N0YXJ0JywgdGhpcy5fb25EcmFnU3RhcnQsIHRoaXMpO1xyXG4gICAgICAgIHRoaXMuX2RyYWdMaXN0ZW5lci5vbignZHJhZ1N0b3AnLCB0aGlzLl9jcmVhdGVEcmFnTGlzdGVuZXIsIHRoaXMpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ2FsbGJhY2sgZm9yIHRoZSBEcmFnTGlzdGVuZXIncyBkcmFnU3RhcnQgZXZlbnRcclxuICAgICAqXHJcbiAgICAgKiBAcGFyYW0gICB7aW50fSB4IHRoZSB4IHBvc2l0aW9uIG9mIHRoZSBtb3VzZSBvbiBkcmFnU3RhcnRcclxuICAgICAqIEBwYXJhbSAgIHtpbnR9IHkgdGhlIHggcG9zaXRpb24gb2YgdGhlIG1vdXNlIG9uIGRyYWdTdGFydFxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHt2b2lkfVxyXG4gICAgICovXHJcbiAgICBfb25EcmFnU3RhcnQoeCwgeSkge1xyXG4gICAgICAgIHZhciBpdGVtQ29uZmlnID0gdGhpcy5faXRlbUNvbmZpZztcclxuICAgICAgICBpZiAoaXNGdW5jdGlvbihpdGVtQ29uZmlnKSkge1xyXG4gICAgICAgICAgICBpdGVtQ29uZmlnID0gaXRlbUNvbmZpZygpO1xyXG4gICAgICAgIH1cclxuICAgICAgICB2YXIgY29udGVudEl0ZW0gPSB0aGlzLl9sYXlvdXRNYW5hZ2VyLl8kbm9ybWFsaXplQ29udGVudEl0ZW0oJC5leHRlbmQodHJ1ZSwge30sIGl0ZW1Db25maWcpKSxcclxuICAgICAgICAgICAgZHJhZ1Byb3h5ID0gbmV3IERyYWdQcm94eSh4LCB5LCB0aGlzLl9kcmFnTGlzdGVuZXIsIHRoaXMuX2xheW91dE1hbmFnZXIsIGNvbnRlbnRJdGVtLCBudWxsKTtcclxuXHJcbiAgICAgICAgdGhpcy5fbGF5b3V0TWFuYWdlci50cmFuc2l0aW9uSW5kaWNhdG9yLnRyYW5zaXRpb25FbGVtZW50cyh0aGlzLl9lbGVtZW50LCBkcmFnUHJveHkuZWxlbWVudCk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcblx0ICogQ2FsbGVkIGFmdGVyIGV2ZXJ5IGRyYWcgYW5kIHdoZW4gdGhlIGRyYWcgc291cmNlIGlzIGJlaW5nIGRpc3Bvc2VkIG9mLlxyXG5cdCAqXHJcblx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0ICovXHJcblx0X3JlbW92ZURyYWdMaXN0ZW5lcigpIHtcclxuXHRcdGlmKCB0aGlzLl9kcmFnTGlzdGVuZXIgIT09IG51bGwgKSB7XHJcblx0XHRcdHRoaXMuX2RyYWdMaXN0ZW5lci5kZXN0cm95KCk7XHJcblx0XHR9XHJcblx0fVxyXG59XHJcbiIsImltcG9ydCAkIGZyb20gJ2pxdWVyeSdcclxuXHJcbmNvbnN0IF90ZW1wbGF0ZSA9ICc8ZGl2IGNsYXNzPVwibG1fZHJvcFRhcmdldEluZGljYXRvclwiPjxkaXYgY2xhc3M9XCJsbV9pbm5lclwiPjwvZGl2PjwvZGl2PidcclxuXHJcblxyXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBEcm9wVGFyZ2V0SW5kaWNhdG9yIHtcclxuXHJcbiAgICBjb25zdHJ1Y3RvcigpIHtcclxuICAgICAgICB0aGlzLmVsZW1lbnQgPSAkKF90ZW1wbGF0ZSk7XHJcbiAgICAgICAgJChkb2N1bWVudC5ib2R5KS5hcHBlbmQodGhpcy5lbGVtZW50KTtcclxuICAgIH1cclxuXHJcbiAgICBkZXN0cm95KCkge1xyXG4gICAgICAgIHRoaXMuZWxlbWVudC5yZW1vdmUoKTtcclxuICAgIH1cclxuXHJcbiAgICBoaWdobGlnaHQoeDEsIHkxLCB4MiwgeTIpIHtcclxuICAgICAgICB0aGlzLmhpZ2hsaWdodEFyZWEoe1xyXG4gICAgICAgICAgICB4MTogeDEsXHJcbiAgICAgICAgICAgIHkxOiB5MSxcclxuICAgICAgICAgICAgeDI6IHgyLFxyXG4gICAgICAgICAgICB5MjogeTJcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBoaWdobGlnaHRBcmVhKGFyZWEpIHtcclxuICAgICAgICB0aGlzLmVsZW1lbnQuY3NzKHtcclxuICAgICAgICAgICAgbGVmdDogYXJlYS54MSxcclxuICAgICAgICAgICAgdG9wOiBhcmVhLnkxLFxyXG4gICAgICAgICAgICB3aWR0aDogYXJlYS54MiAtIGFyZWEueDEsXHJcbiAgICAgICAgICAgIGhlaWdodDogYXJlYS55MiAtIGFyZWEueTFcclxuICAgICAgICB9KS5zaG93KCk7XHJcbiAgICB9XHJcblxyXG4gICAgaGlkZSgpIHtcclxuICAgICAgICB0aGlzLmVsZW1lbnQuaGlkZSgpO1xyXG4gICAgfVxyXG59XHJcbiIsImltcG9ydCBFdmVudEVtaXR0ZXIgZnJvbSAnLi4vdXRpbHMvRXZlbnRFbWl0dGVyJ1xyXG5pbXBvcnQgVGFiIGZyb20gJy4uL2NvbnRyb2xzL1RhYidcclxuaW1wb3J0IEhlYWRlckJ1dHRvbiBmcm9tICcuLi9jb250cm9scy9IZWFkZXJCdXR0b24nXHJcbmltcG9ydCB7XHJcbiAgICBmbkJpbmRcclxufSBmcm9tICcuLi91dGlscy91dGlscyc7XHJcbmltcG9ydCAkIGZyb20gJ2pxdWVyeSc7XHJcblxyXG5jb25zdCBfdGVtcGxhdGUgPSBbXHJcbiAgICAgICAgJzxkaXYgY2xhc3M9XCJsbV9oZWFkZXJcIj4nLFxyXG4gICAgICAgICc8dWwgY2xhc3M9XCJsbV90YWJzXCI+PC91bD4nLFxyXG4gICAgICAgICc8dWwgY2xhc3M9XCJsbV9jb250cm9sc1wiPjwvdWw+JyxcclxuICAgICAgICAnPHVsIGNsYXNzPVwibG1fdGFiZHJvcGRvd25fbGlzdFwiPjwvdWw+JyxcclxuICAgICAgICAnPC9kaXY+J1xyXG4gICAgXS5qb2luKCcnKTtcclxuXHJcbi8qKlxyXG4gKiBUaGlzIGNsYXNzIHJlcHJlc2VudHMgYSBoZWFkZXIgYWJvdmUgYSBTdGFjayBDb250ZW50SXRlbS5cclxuICpcclxuICogQHBhcmFtIHtsbS5MYXlvdXRNYW5hZ2VyfSBsYXlvdXRNYW5hZ2VyXHJcbiAqIEBwYXJhbSB7QWJzdHJhY3RDb250ZW50SXRlbX0gcGFyZW50XHJcbiAqL1xyXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBIZWFkZXIgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xyXG5cclxuICAgIGNvbnN0cnVjdG9yKGxheW91dE1hbmFnZXIsIHBhcmVudCkge1xyXG5cclxuICAgICAgICBzdXBlcigpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHRoaXMubGF5b3V0TWFuYWdlciA9IGxheW91dE1hbmFnZXI7XHJcbiAgICAgICAgdGhpcy5lbGVtZW50ID0gJChfdGVtcGxhdGUpO1xyXG5cclxuICAgICAgICBpZiAodGhpcy5sYXlvdXRNYW5hZ2VyLmNvbmZpZy5zZXR0aW5ncy5zZWxlY3Rpb25FbmFibGVkID09PSB0cnVlKSB7XHJcbiAgICAgICAgICAgIHRoaXMuZWxlbWVudC5hZGRDbGFzcygnbG1fc2VsZWN0YWJsZScpO1xyXG4gICAgICAgICAgICB0aGlzLmVsZW1lbnQub24oJ2NsaWNrIHRvdWNoc3RhcnQnLCBmbkJpbmQodGhpcy5fb25IZWFkZXJDbGljaywgdGhpcykpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy50YWJzQ29udGFpbmVyID0gdGhpcy5lbGVtZW50LmZpbmQoJy5sbV90YWJzJyk7XHJcbiAgICAgICAgdGhpcy50YWJEcm9wZG93bkNvbnRhaW5lciA9IHRoaXMuZWxlbWVudC5maW5kKCcubG1fdGFiZHJvcGRvd25fbGlzdCcpO1xyXG4gICAgICAgIHRoaXMudGFiRHJvcGRvd25Db250YWluZXIuaGlkZSgpO1xyXG4gICAgICAgIHRoaXMuY29udHJvbHNDb250YWluZXIgPSB0aGlzLmVsZW1lbnQuZmluZCgnLmxtX2NvbnRyb2xzJyk7XHJcbiAgICAgICAgdGhpcy5wYXJlbnQgPSBwYXJlbnQ7XHJcbiAgICAgICAgdGhpcy5wYXJlbnQub24oJ3Jlc2l6ZScsIHRoaXMuX3VwZGF0ZVRhYlNpemVzLCB0aGlzKTtcclxuICAgICAgICB0aGlzLnRhYnMgPSBbXTtcclxuICAgICAgICB0aGlzLnRhYnNNYXJrZWRGb3JSZW1vdmFsID0gW107XHJcbiAgICAgICAgdGhpcy5hY3RpdmVDb250ZW50SXRlbSA9IG51bGw7XHJcbiAgICAgICAgdGhpcy5jbG9zZUJ1dHRvbiA9IG51bGw7XHJcbiAgICAgICAgdGhpcy5kb2NrQnV0dG9uID0gbnVsbDtcclxuICAgICAgICB0aGlzLnRhYkRyb3Bkb3duQnV0dG9uID0gbnVsbDtcclxuICAgICAgICB0aGlzLmhpZGVBZGRpdGlvbmFsVGFic0Ryb3Bkb3duID0gZm5CaW5kKHRoaXMuX2hpZGVBZGRpdGlvbmFsVGFic0Ryb3Bkb3duLCB0aGlzKTtcclxuICAgICAgICAkKGRvY3VtZW50KS5tb3VzZXVwKHRoaXMuaGlkZUFkZGl0aW9uYWxUYWJzRHJvcGRvd24pO1xyXG5cclxuICAgICAgICB0aGlzLl9sYXN0VmlzaWJsZVRhYkluZGV4ID0gLTE7XHJcbiAgICAgICAgdGhpcy5fdGFiQ29udHJvbE9mZnNldCA9IHRoaXMubGF5b3V0TWFuYWdlci5jb25maWcuc2V0dGluZ3MudGFiQ29udHJvbE9mZnNldDtcclxuICAgICAgICB0aGlzLl9jcmVhdGVDb250cm9scygpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ3JlYXRlcyBhIG5ldyB0YWIgYW5kIGFzc29jaWF0ZXMgaXQgd2l0aCBhIGNvbnRlbnRJdGVtXHJcbiAgICAgKlxyXG4gICAgICogQHBhcmFtICAgIHtBYnN0cmFjdENvbnRlbnRJdGVtfSBjb250ZW50SXRlbVxyXG4gICAgICogQHBhcmFtICAgIHtJbnRlZ2VyfSBpbmRleCBUaGUgcG9zaXRpb24gb2YgdGhlIHRhYlxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHt2b2lkfVxyXG4gICAgICovXHJcbiAgICBjcmVhdGVUYWIoY29udGVudEl0ZW0sIGluZGV4KSB7XHJcbiAgICAgICAgdmFyIHRhYiwgaTtcclxuXHJcbiAgICAgICAgLy9JZiB0aGVyZSdzIGFscmVhZHkgYSB0YWIgcmVsYXRpbmcgdG8gdGhlXHJcbiAgICAgICAgLy9jb250ZW50IGl0ZW0sIGRvbid0IGRvIGFueXRoaW5nXHJcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IHRoaXMudGFicy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICBpZiAodGhpcy50YWJzW2ldLmNvbnRlbnRJdGVtID09PSBjb250ZW50SXRlbSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0YWIgPSBuZXcgVGFiKHRoaXMsIGNvbnRlbnRJdGVtKTtcclxuXHJcbiAgICAgICAgaWYgKHRoaXMudGFicy5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgICAgdGhpcy50YWJzLnB1c2godGFiKTtcclxuICAgICAgICAgICAgdGhpcy50YWJzQ29udGFpbmVyLmFwcGVuZCh0YWIuZWxlbWVudCk7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmIChpbmRleCA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgIGluZGV4ID0gdGhpcy50YWJzLmxlbmd0aDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmIChpbmRleCA+IDApIHtcclxuICAgICAgICAgICAgdGhpcy50YWJzW2luZGV4IC0gMV0uZWxlbWVudC5hZnRlcih0YWIuZWxlbWVudCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgdGhpcy50YWJzWzBdLmVsZW1lbnQuYmVmb3JlKHRhYi5lbGVtZW50KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMudGFicy5zcGxpY2UoaW5kZXgsIDAsIHRhYik7XHJcbiAgICAgICAgdGhpcy5fdXBkYXRlVGFiU2l6ZXMoKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEZpbmRzIGEgdGFiIGJhc2VkIG9uIHRoZSBjb250ZW50SXRlbSBpdHMgYXNzb2NpYXRlZCB3aXRoIGFuZCByZW1vdmVzIGl0LlxyXG4gICAgICpcclxuICAgICAqIEBwYXJhbSAgICB7QWJzdHJhY3RDb250ZW50SXRlbX0gY29udGVudEl0ZW1cclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJucyB7dm9pZH1cclxuICAgICAqL1xyXG4gICAgcmVtb3ZlVGFiKGNvbnRlbnRJdGVtKSB7XHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLnRhYnMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMudGFic1tpXS5jb250ZW50SXRlbSA9PT0gY29udGVudEl0ZW0pIHtcclxuICAgICAgICAgICAgICAgIHRoaXMudGFic1tpXS5fJGRlc3Ryb3koKTtcclxuICAgICAgICAgICAgICAgIHRoaXMudGFicy5zcGxpY2UoaSwgMSk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCB0aGlzLnRhYnNNYXJrZWRGb3JSZW1vdmFsLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLnRhYnNNYXJrZWRGb3JSZW1vdmFsW2ldLmNvbnRlbnRJdGVtID09PSBjb250ZW50SXRlbSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy50YWJzTWFya2VkRm9yUmVtb3ZhbFtpXS5fJGRlc3Ryb3koKTtcclxuICAgICAgICAgICAgICAgIHRoaXMudGFic01hcmtlZEZvclJlbW92YWwuc3BsaWNlKGksIDEpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuXHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdjb250ZW50SXRlbSBpcyBub3QgY29udHJvbGxlZCBieSB0aGlzIGhlYWRlcicpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogRmluZHMgYSB0YWIgYmFzZWQgb24gdGhlIGNvbnRlbnRJdGVtIGl0cyBhc3NvY2lhdGVkIHdpdGggYW5kIG1hcmtzIGl0XHJcbiAgICAgKiBmb3IgcmVtb3ZhbCwgaGlkaW5nIGl0IHRvby5cclxuICAgICAqXHJcbiAgICAgKiBAcGFyYW0gICAge0Fic3RyYWN0Q29udGVudEl0ZW19IGNvbnRlbnRJdGVtXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge3ZvaWR9XHJcbiAgICAgKi9cclxuICAgIGhpZGVUYWIoY29udGVudEl0ZW0pe1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy50YWJzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLnRhYnNbaV0uY29udGVudEl0ZW0gPT09IGNvbnRlbnRJdGVtKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnRhYnNbaV0uZWxlbWVudC5oaWRlKClcclxuICAgICAgICAgICAgICAgIHRoaXMudGFic01hcmtlZEZvclJlbW92YWwucHVzaCh0aGlzLnRhYnNbaV0pXHJcbiAgICAgICAgICAgICAgICB0aGlzLnRhYnMuc3BsaWNlKGksIDEpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSAgICAgICAgXHJcblxyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignY29udGVudEl0ZW0gaXMgbm90IGNvbnRyb2xsZWQgYnkgdGhpcyBoZWFkZXInKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFRoZSBwcm9ncmFtbWF0aWNhbCBlcXVpdmFsZW50IG9mIGNsaWNraW5nIGEgVGFiLlxyXG4gICAgICpcclxuICAgICAqIEBwYXJhbSB7QWJzdHJhY3RDb250ZW50SXRlbX0gY29udGVudEl0ZW1cclxuICAgICAqL1xyXG4gICAgc2V0QWN0aXZlQ29udGVudEl0ZW0oY29udGVudEl0ZW0pIHtcclxuICAgICAgICB2YXIgaSwgaiwgaXNBY3RpdmUsIGFjdGl2ZVRhYjtcclxuXHJcbiAgICAgICAgaWYgKHRoaXMuYWN0aXZlQ29udGVudEl0ZW0gPT09IGNvbnRlbnRJdGVtKSByZXR1cm47XHJcblxyXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCB0aGlzLnRhYnMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgaXNBY3RpdmUgPSB0aGlzLnRhYnNbaV0uY29udGVudEl0ZW0gPT09IGNvbnRlbnRJdGVtO1xyXG4gICAgICAgICAgICB0aGlzLnRhYnNbaV0uc2V0QWN0aXZlKGlzQWN0aXZlKTtcclxuICAgICAgICAgICAgaWYgKGlzQWN0aXZlID09PSB0cnVlKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmFjdGl2ZUNvbnRlbnRJdGVtID0gY29udGVudEl0ZW07XHJcbiAgICAgICAgICAgICAgICB0aGlzLnBhcmVudC5jb25maWcuYWN0aXZlSXRlbUluZGV4ID0gaTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKHRoaXMubGF5b3V0TWFuYWdlci5jb25maWcuc2V0dGluZ3MucmVvcmRlck9uVGFiTWVudUNsaWNrKSB7XHJcbiAgICAgICAgICAgIC8qKlxyXG4gICAgICAgICAgICAgKiBJZiB0aGUgdGFiIHNlbGVjdGVkIHdhcyBpbiB0aGUgZHJvcGRvd24sIG1vdmUgZXZlcnl0aGluZyBkb3duIG9uZSB0byBtYWtlIHdheSBmb3IgdGhpcyBvbmUgdG8gYmUgdGhlIGZpcnN0LlxyXG4gICAgICAgICAgICAgKiBUaGlzIHdpbGwgbWFrZSBzdXJlIHRoZSBtb3N0IHVzZWQgdGFicyBzdGF5IHZpc2libGUuXHJcbiAgICAgICAgICAgICAqL1xyXG4gICAgICAgICAgICBpZiAodGhpcy5fbGFzdFZpc2libGVUYWJJbmRleCAhPT0gLTEgJiYgdGhpcy5wYXJlbnQuY29uZmlnLmFjdGl2ZUl0ZW1JbmRleCA+IHRoaXMuX2xhc3RWaXNpYmxlVGFiSW5kZXgpIHtcclxuICAgICAgICAgICAgICAgIGFjdGl2ZVRhYiA9IHRoaXMudGFic1t0aGlzLnBhcmVudC5jb25maWcuYWN0aXZlSXRlbUluZGV4XTtcclxuICAgICAgICAgICAgICAgIGZvciAoaiA9IHRoaXMucGFyZW50LmNvbmZpZy5hY3RpdmVJdGVtSW5kZXg7IGogPiAwOyBqLS0pIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnRhYnNbal0gPSB0aGlzLnRhYnNbaiAtIDFdO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgdGhpcy50YWJzWzBdID0gYWN0aXZlVGFiO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5wYXJlbnQuY29uZmlnLmFjdGl2ZUl0ZW1JbmRleCA9IDA7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMuX3VwZGF0ZVRhYlNpemVzKCk7XHJcbiAgICAgICAgdGhpcy5wYXJlbnQuZW1pdEJ1YmJsaW5nRXZlbnQoJ3N0YXRlQ2hhbmdlZCcpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUHJvZ3JhbW1hdGljYWxseSBvcGVyYXRlIHdpdGggaGVhZGVyIHBvc2l0aW9uLlxyXG4gICAgICpcclxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBwb3NpdGlvbiBvbmUgb2YgKCd0b3AnLCdsZWZ0JywncmlnaHQnLCdib3R0b20nKSB0byBzZXQgb3IgZW1wdHkgdG8gZ2V0IGl0LlxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IHByZXZpb3VzIGhlYWRlciBwb3NpdGlvblxyXG4gICAgICovXHJcbiAgICBwb3NpdGlvbihwb3NpdGlvbikge1xyXG4gICAgICAgIHZhciBwcmV2aW91cyA9IHRoaXMucGFyZW50Ll9oZWFkZXIuc2hvdztcclxuICAgICAgICBpZiAodGhpcy5wYXJlbnQuX2RvY2tlciAmJiB0aGlzLnBhcmVudC5fZG9ja2VyLmRvY2tlZClcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdDYW5cXCd0IGNoYW5nZSBoZWFkZXIgcG9zaXRpb24gaW4gZG9ja2VkIHN0YWNrJyk7XHJcbiAgICAgICAgaWYgKHByZXZpb3VzICYmICF0aGlzLnBhcmVudC5fc2lkZSlcclxuICAgICAgICAgICAgcHJldmlvdXMgPSAndG9wJztcclxuICAgICAgICBpZiAocG9zaXRpb24gIT09IHVuZGVmaW5lZCAmJiB0aGlzLnBhcmVudC5faGVhZGVyLnNob3cgIT0gcG9zaXRpb24pIHtcclxuICAgICAgICAgICAgdGhpcy5wYXJlbnQuX2hlYWRlci5zaG93ID0gcG9zaXRpb247XHJcbiAgICAgICAgICAgIHRoaXMucGFyZW50LmNvbmZpZy5oZWFkZXIgPyB0aGlzLnBhcmVudC5jb25maWcuaGVhZGVyLnNob3cgPSBwb3NpdGlvbiA6IHRoaXMucGFyZW50LmNvbmZpZy5oZWFkZXIgPSB7IHNob3c6IHBvc2l0aW9uIH07XHJcbiAgICAgICAgICAgIHRoaXMucGFyZW50Ll9zZXR1cEhlYWRlclBvc2l0aW9uKCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBwcmV2aW91cztcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFByb2dyYW1tYXRpY2FsbHkgc2V0IGNsb3NhYmlsaXR5LlxyXG4gICAgICpcclxuICAgICAqIEBwYWNrYWdlIHByaXZhdGVcclxuICAgICAqIEBwYXJhbSB7Qm9vbGVhbn0gaXNDbG9zYWJsZSBXaGV0aGVyIHRvIGVuYWJsZS9kaXNhYmxlIGNsb3NhYmlsaXR5LlxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHtCb29sZWFufSBXaGV0aGVyIHRoZSBhY3Rpb24gd2FzIHN1Y2Nlc3NmdWxcclxuICAgICAqL1xyXG4gICAgXyRzZXRDbG9zYWJsZShpc0Nsb3NhYmxlKSB7XHJcbiAgICAgICAgdGhpcy5fY2FuRGVzdHJveSA9IGlzQ2xvc2FibGUgfHwgdGhpcy50YWJzLmxlbmd0aCA+IDE7XHJcbiAgICAgICAgaWYgKHRoaXMuY2xvc2VCdXR0b24gJiYgdGhpcy5faXNDbG9zYWJsZSgpKSB7XHJcbiAgICAgICAgICAgIHRoaXMuY2xvc2VCdXR0b24uZWxlbWVudFtpc0Nsb3NhYmxlID8gXCJzaG93XCIgOiBcImhpZGVcIl0oKTtcclxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBQcm9ncmFtbWF0aWNhbGx5IHNldCBhYmlsaXR5IHRvIGRvY2suXHJcbiAgICAgKlxyXG4gICAgICogQHBhY2thZ2UgcHJpdmF0ZVxyXG4gICAgICogQHBhcmFtIHtCb29sZWFufSBpc0RvY2thYmxlIFdoZXRoZXIgdG8gZW5hYmxlL2Rpc2FibGUgYWJpbGl0eSB0byBkb2NrLlxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHtCb29sZWFufSBXaGV0aGVyIHRoZSBhY3Rpb24gd2FzIHN1Y2Nlc3NmdWxcclxuICAgICAqL1xyXG4gICAgX3NldERvY2thYmxlKGlzRG9ja2FibGUpIHtcclxuICAgICAgICBpZiAodGhpcy5kb2NrQnV0dG9uICYmIHRoaXMucGFyZW50Ll9oZWFkZXIgJiYgdGhpcy5wYXJlbnQuX2hlYWRlci5kb2NrKSB7XHJcbiAgICAgICAgICAgIHRoaXMuZG9ja0J1dHRvbi5lbGVtZW50LnRvZ2dsZSghIWlzRG9ja2FibGUpO1xyXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogRGVzdHJveXMgdGhlIGVudGlyZSBoZWFkZXJcclxuICAgICAqXHJcbiAgICAgKiBAcGFja2FnZSBwcml2YXRlXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge3ZvaWR9XHJcbiAgICAgKi9cclxuICAgIF8kZGVzdHJveSgpIHtcclxuICAgICAgICB0aGlzLmVtaXQoJ2Rlc3Ryb3knLCB0aGlzKTtcclxuXHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLnRhYnMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgdGhpcy50YWJzW2ldLl8kZGVzdHJveSgpO1xyXG4gICAgICAgIH1cclxuICAgICAgICAkKGRvY3VtZW50KS5vZmYoJ21vdXNldXAnLCB0aGlzLmhpZGVBZGRpdGlvbmFsVGFic0Ryb3Bkb3duKTtcclxuICAgICAgICB0aGlzLmVsZW1lbnQucmVtb3ZlKCk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBnZXQgc2V0dGluZ3MgZnJvbSBoZWFkZXJcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nfSB3aGVuIGV4aXN0c1xyXG4gICAgICovXHJcbiAgICBfZ2V0SGVhZGVyU2V0dGluZyhuYW1lKSB7XHJcbiAgICAgICAgaWYgKG5hbWUgaW4gdGhpcy5wYXJlbnQuX2hlYWRlcilcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMucGFyZW50Ll9oZWFkZXJbbmFtZV07XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGVzIHRoZSBwb3BvdXQsIG1heGltaXNlIGFuZCBjbG9zZSBidXR0b25zIGluIHRoZSBoZWFkZXIncyB0b3AgcmlnaHQgY29ybmVyXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge3ZvaWR9XHJcbiAgICAgKi9cclxuICAgIF9jcmVhdGVDb250cm9scygpIHtcclxuICAgICAgICB2YXIgY2xvc2VTdGFjayxcclxuICAgICAgICAgICAgcG9wb3V0LFxyXG4gICAgICAgICAgICBsYWJlbCxcclxuICAgICAgICAgICAgbWF4aW1pc2VMYWJlbCxcclxuICAgICAgICAgICAgbWluaW1pc2VMYWJlbCxcclxuICAgICAgICAgICAgbWF4aW1pc2UsXHJcbiAgICAgICAgICAgIG1heGltaXNlQnV0dG9uLFxyXG4gICAgICAgICAgICB0YWJEcm9wZG93bkxhYmVsLFxyXG4gICAgICAgICAgICBzaG93VGFiRHJvcGRvd247XHJcblxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIERyb3Bkb3duIHRvIHNob3cgYWRkaXRpb25hbCB0YWJzLlxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHNob3dUYWJEcm9wZG93biA9IGZuQmluZCh0aGlzLl9zaG93QWRkaXRpb25hbFRhYnNEcm9wZG93biwgdGhpcyk7XHJcbiAgICAgICAgdGFiRHJvcGRvd25MYWJlbCA9IHRoaXMubGF5b3V0TWFuYWdlci5jb25maWcubGFiZWxzLnRhYkRyb3Bkb3duO1xyXG4gICAgICAgIHRoaXMudGFiRHJvcGRvd25CdXR0b24gPSBuZXcgSGVhZGVyQnV0dG9uKHRoaXMsIHRhYkRyb3Bkb3duTGFiZWwsICdsbV90YWJkcm9wZG93bicsIHNob3dUYWJEcm9wZG93bik7XHJcbiAgICAgICAgdGhpcy50YWJEcm9wZG93bkJ1dHRvbi5lbGVtZW50LmhpZGUoKTtcclxuXHJcbiAgICAgICAgaWYgKHRoaXMucGFyZW50Ll9oZWFkZXIgJiYgdGhpcy5wYXJlbnQuX2hlYWRlci5kb2NrKSB7XHJcbiAgICAgICAgICAgIHZhciBidXR0b24gPSBmbkJpbmQodGhpcy5wYXJlbnQuZG9jaywgdGhpcy5wYXJlbnQpO1xyXG4gICAgICAgICAgICBsYWJlbCA9IHRoaXMuX2dldEhlYWRlclNldHRpbmcoJ2RvY2snKTtcclxuICAgICAgICAgICAgdGhpcy5kb2NrQnV0dG9uID0gbmV3IEhlYWRlckJ1dHRvbih0aGlzLCBsYWJlbCwgJ2xtX2RvY2snLCBidXR0b24pO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogUG9wb3V0IGNvbnRyb2wgdG8gbGF1bmNoIGNvbXBvbmVudCBpbiBuZXcgd2luZG93LlxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGlmICh0aGlzLl9nZXRIZWFkZXJTZXR0aW5nKCdwb3BvdXQnKSkge1xyXG4gICAgICAgICAgICBwb3BvdXQgPSBmbkJpbmQodGhpcy5fb25Qb3BvdXRDbGljaywgdGhpcyk7XHJcbiAgICAgICAgICAgIGxhYmVsID0gdGhpcy5fZ2V0SGVhZGVyU2V0dGluZygncG9wb3V0Jyk7XHJcbiAgICAgICAgICAgIG5ldyBIZWFkZXJCdXR0b24odGhpcywgbGFiZWwsICdsbV9wb3BvdXQnLCBwb3BvdXQpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogTWF4aW1pc2UgY29udHJvbCAtIHNldCB0aGUgY29tcG9uZW50IHRvIHRoZSBmdWxsIHNpemUgb2YgdGhlIGxheW91dFxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGlmICh0aGlzLl9nZXRIZWFkZXJTZXR0aW5nKCdtYXhpbWlzZScpKSB7XHJcbiAgICAgICAgICAgIG1heGltaXNlID0gZm5CaW5kKHRoaXMucGFyZW50LnRvZ2dsZU1heGltaXNlLCB0aGlzLnBhcmVudCk7XHJcbiAgICAgICAgICAgIG1heGltaXNlTGFiZWwgPSB0aGlzLl9nZXRIZWFkZXJTZXR0aW5nKCdtYXhpbWlzZScpO1xyXG4gICAgICAgICAgICBtaW5pbWlzZUxhYmVsID0gdGhpcy5fZ2V0SGVhZGVyU2V0dGluZygnbWluaW1pc2UnKTtcclxuICAgICAgICAgICAgbWF4aW1pc2VCdXR0b24gPSBuZXcgSGVhZGVyQnV0dG9uKHRoaXMsIG1heGltaXNlTGFiZWwsICdsbV9tYXhpbWlzZScsIG1heGltaXNlKTtcclxuXHJcbiAgICAgICAgICAgIHRoaXMucGFyZW50Lm9uKCdtYXhpbWlzZWQnLCBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgIG1heGltaXNlQnV0dG9uLmVsZW1lbnQuYXR0cigndGl0bGUnLCBtaW5pbWlzZUxhYmVsKTtcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICB0aGlzLnBhcmVudC5vbignbWluaW1pc2VkJywgZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICBtYXhpbWlzZUJ1dHRvbi5lbGVtZW50LmF0dHIoJ3RpdGxlJywgbWF4aW1pc2VMYWJlbCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogQ2xvc2UgYnV0dG9uXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgaWYgKHRoaXMuX2lzQ2xvc2FibGUoKSkge1xyXG4gICAgICAgICAgICBjbG9zZVN0YWNrID0gZm5CaW5kKHRoaXMucGFyZW50LnJlbW92ZSwgdGhpcy5wYXJlbnQpO1xyXG4gICAgICAgICAgICBsYWJlbCA9IHRoaXMuX2dldEhlYWRlclNldHRpbmcoJ2Nsb3NlJyk7XHJcbiAgICAgICAgICAgIHRoaXMuY2xvc2VCdXR0b24gPSBuZXcgSGVhZGVyQnV0dG9uKHRoaXMsIGxhYmVsLCAnbG1fY2xvc2UnLCBjbG9zZVN0YWNrKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBTaG93cyBkcm9wIGRvd24gZm9yIGFkZGl0aW9uYWwgdGFicyB3aGVuIHRoZXJlIGFyZSB0b28gbWFueSB0byBkaXNwbGF5LlxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHt2b2lkfVxyXG4gICAgICovXHJcbiAgICBfc2hvd0FkZGl0aW9uYWxUYWJzRHJvcGRvd24oKSB7XHJcbiAgICAgICAgdGhpcy50YWJEcm9wZG93bkNvbnRhaW5lci5zaG93KCk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBIaWRlcyBkcm9wIGRvd24gZm9yIGFkZGl0aW9uYWwgdGFicyB3aGVuIHRoZXJlIGFyZSB0b28gbWFueSB0byBkaXNwbGF5LlxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHt2b2lkfVxyXG4gICAgICovXHJcbiAgICBfaGlkZUFkZGl0aW9uYWxUYWJzRHJvcGRvd24oZSkge1xyXG4gICAgICAgIHRoaXMudGFiRHJvcGRvd25Db250YWluZXIuaGlkZSgpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ2hlY2tzIHdoZXRoZXIgdGhlIGhlYWRlciBpcyBjbG9zYWJsZSBiYXNlZCBvbiB0aGUgcGFyZW50IGNvbmZpZyBhbmRcclxuICAgICAqIHRoZSBnbG9iYWwgY29uZmlnLlxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHtCb29sZWFufSBXaGV0aGVyIHRoZSBoZWFkZXIgaXMgY2xvc2FibGUuXHJcbiAgICAgKi9cclxuICAgIF9pc0Nsb3NhYmxlKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLnBhcmVudC5jb25maWcuaXNDbG9zYWJsZSAmJiB0aGlzLmxheW91dE1hbmFnZXIuY29uZmlnLnNldHRpbmdzLnNob3dDbG9zZUljb247XHJcbiAgICB9XHJcblxyXG4gICAgX29uUG9wb3V0Q2xpY2soKSB7XHJcbiAgICAgICAgaWYgKHRoaXMubGF5b3V0TWFuYWdlci5jb25maWcuc2V0dGluZ3MucG9wb3V0V2hvbGVTdGFjayA9PT0gdHJ1ZSkge1xyXG4gICAgICAgICAgICB0aGlzLnBhcmVudC5wb3BvdXQoKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICB0aGlzLmFjdGl2ZUNvbnRlbnRJdGVtLnBvcG91dCgpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEludm9rZWQgd2hlbiB0aGUgaGVhZGVyJ3MgYmFja2dyb3VuZCBpcyBjbGlja2VkIChub3QgaXQncyB0YWJzIG9yIGNvbnRyb2xzKVxyXG4gICAgICpcclxuICAgICAqIEBwYXJhbSAgICB7alF1ZXJ5IERPTSBldmVudH0gZXZlbnRcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJucyB7dm9pZH1cclxuICAgICAqL1xyXG4gICAgX29uSGVhZGVyQ2xpY2soZXZlbnQpIHtcclxuICAgICAgICBpZiAoZXZlbnQudGFyZ2V0ID09PSB0aGlzLmVsZW1lbnRbMF0pIHtcclxuICAgICAgICAgICAgdGhpcy5wYXJlbnQuc2VsZWN0KCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUHVzaGVzIHRoZSB0YWJzIHRvIHRoZSB0YWIgZHJvcGRvd24gaWYgdGhlIGF2YWlsYWJsZSBzcGFjZSBpcyBub3Qgc3VmZmljaWVudFxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHt2b2lkfVxyXG4gICAgICovXHJcbiAgICBfdXBkYXRlVGFiU2l6ZXMoc2hvd1RhYk1lbnUpIHtcclxuICAgICAgICBpZiAodGhpcy50YWJzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvL1Nob3cgdGhlIG1lbnUgYmFzZWQgb24gZnVuY3Rpb24gYXJndW1lbnRcclxuICAgICAgICB0aGlzLnRhYkRyb3Bkb3duQnV0dG9uLmVsZW1lbnQudG9nZ2xlKHNob3dUYWJNZW51ID09PSB0cnVlKTtcclxuXHJcbiAgICAgICAgdmFyIHNpemUgPSBmdW5jdGlvbih2YWwpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHZhbCA/ICd3aWR0aCcgOiAnaGVpZ2h0JztcclxuICAgICAgICB9O1xyXG4gICAgICAgIHRoaXMuZWxlbWVudC5jc3Moc2l6ZSghdGhpcy5wYXJlbnQuX3NpZGVkKSwgJycpO1xyXG4gICAgICAgIHRoaXMuZWxlbWVudFtzaXplKHRoaXMucGFyZW50Ll9zaWRlZCldKHRoaXMubGF5b3V0TWFuYWdlci5jb25maWcuZGltZW5zaW9ucy5oZWFkZXJIZWlnaHQpO1xyXG4gICAgICAgIHZhciBhdmFpbGFibGVXaWR0aCA9IHRoaXMuZWxlbWVudC5vdXRlcldpZHRoKCkgLSB0aGlzLmNvbnRyb2xzQ29udGFpbmVyLm91dGVyV2lkdGgoKSAtIHRoaXMuX3RhYkNvbnRyb2xPZmZzZXQsXHJcbiAgICAgICAgICAgIGN1bXVsYXRpdmVUYWJXaWR0aCA9IDAsXHJcbiAgICAgICAgICAgIHZpc2libGVUYWJXaWR0aCA9IDAsXHJcbiAgICAgICAgICAgIHRhYkVsZW1lbnQsXHJcbiAgICAgICAgICAgIGksXHJcbiAgICAgICAgICAgIGosXHJcbiAgICAgICAgICAgIG1hcmdpbkxlZnQsXHJcbiAgICAgICAgICAgIG92ZXJsYXAgPSAwLFxyXG4gICAgICAgICAgICB0YWJXaWR0aCxcclxuICAgICAgICAgICAgdGFiT3ZlcmxhcEFsbG93YW5jZSA9IHRoaXMubGF5b3V0TWFuYWdlci5jb25maWcuc2V0dGluZ3MudGFiT3ZlcmxhcEFsbG93YW5jZSxcclxuICAgICAgICAgICAgdGFiT3ZlcmxhcEFsbG93YW5jZUV4Y2VlZGVkID0gZmFsc2UsXHJcbiAgICAgICAgICAgIGFjdGl2ZUluZGV4ID0gKHRoaXMuYWN0aXZlQ29udGVudEl0ZW0gPyB0aGlzLnRhYnMuaW5kZXhPZih0aGlzLmFjdGl2ZUNvbnRlbnRJdGVtLnRhYikgOiAwKSxcclxuICAgICAgICAgICAgYWN0aXZlVGFiID0gdGhpcy50YWJzW2FjdGl2ZUluZGV4XTtcclxuICAgICAgICBpZiAodGhpcy5wYXJlbnQuX3NpZGVkKVxyXG4gICAgICAgICAgICBhdmFpbGFibGVXaWR0aCA9IHRoaXMuZWxlbWVudC5vdXRlckhlaWdodCgpIC0gdGhpcy5jb250cm9sc0NvbnRhaW5lci5vdXRlckhlaWdodCgpIC0gdGhpcy5fdGFiQ29udHJvbE9mZnNldDtcclxuICAgICAgICB0aGlzLl9sYXN0VmlzaWJsZVRhYkluZGV4ID0gLTE7XHJcblxyXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCB0aGlzLnRhYnMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgdGFiRWxlbWVudCA9IHRoaXMudGFic1tpXS5lbGVtZW50O1xyXG5cclxuICAgICAgICAgICAgLy9QdXQgdGhlIHRhYiBpbiB0aGUgdGFiQ29udGFpbmVyIHNvIGl0cyB0cnVlIHdpZHRoIGNhbiBiZSBjaGVja2VkXHJcbiAgICAgICAgICAgIHRoaXMudGFic0NvbnRhaW5lci5hcHBlbmQodGFiRWxlbWVudCk7XHJcbiAgICAgICAgICAgIHRhYldpZHRoID0gdGFiRWxlbWVudC5vdXRlcldpZHRoKCkgKyBwYXJzZUludCh0YWJFbGVtZW50LmNzcygnbWFyZ2luLXJpZ2h0JyksIDEwKTtcclxuXHJcbiAgICAgICAgICAgIGN1bXVsYXRpdmVUYWJXaWR0aCArPSB0YWJXaWR0aDtcclxuXHJcbiAgICAgICAgICAgIC8vSW5jbHVkZSB0aGUgYWN0aXZlIHRhYidzIHdpZHRoIGlmIGl0IGlzbid0IGFscmVhZHlcclxuICAgICAgICAgICAgLy9UaGlzIGlzIHRvIGVuc3VyZSB0aGVyZSBpcyByb29tIHRvIHNob3cgdGhlIGFjdGl2ZSB0YWJcclxuICAgICAgICAgICAgaWYgKGFjdGl2ZUluZGV4IDw9IGkpIHtcclxuICAgICAgICAgICAgICAgIHZpc2libGVUYWJXaWR0aCA9IGN1bXVsYXRpdmVUYWJXaWR0aDtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHZpc2libGVUYWJXaWR0aCA9IGN1bXVsYXRpdmVUYWJXaWR0aCArIGFjdGl2ZVRhYi5lbGVtZW50Lm91dGVyV2lkdGgoKSArIHBhcnNlSW50KGFjdGl2ZVRhYi5lbGVtZW50LmNzcygnbWFyZ2luLXJpZ2h0JyksIDEwKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy8gSWYgdGhlIHRhYnMgd29uJ3QgZml0LCBjaGVjayB0aGUgb3ZlcmxhcCBhbGxvd2FuY2UuXHJcbiAgICAgICAgICAgIGlmICh2aXNpYmxlVGFiV2lkdGggPiBhdmFpbGFibGVXaWR0aCkge1xyXG5cclxuICAgICAgICAgICAgICAgIC8vT25jZSBhbGxvd2FuY2UgaXMgZXhjZWVkZWQsIGFsbCByZW1haW5pbmcgdGFicyBnbyB0byBtZW51LlxyXG4gICAgICAgICAgICAgICAgaWYgKCF0YWJPdmVybGFwQWxsb3dhbmNlRXhjZWVkZWQpIHtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgLy9ObyBvdmVybGFwIGZvciBmaXJzdCB0YWIgb3IgYWN0aXZlIHRhYlxyXG4gICAgICAgICAgICAgICAgICAgIC8vT3ZlcmxhcCBzcHJlYWRzIGFtb25nIG5vbi1hY3RpdmUsIG5vbi1maXJzdCB0YWJzXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFjdGl2ZUluZGV4ID4gMCAmJiBhY3RpdmVJbmRleCA8PSBpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG92ZXJsYXAgPSAodmlzaWJsZVRhYldpZHRoIC0gYXZhaWxhYmxlV2lkdGgpIC8gKGkgLSAxKTtcclxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBvdmVybGFwID0gKHZpc2libGVUYWJXaWR0aCAtIGF2YWlsYWJsZVdpZHRoKSAvIGk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICAvL0NoZWNrIG92ZXJsYXAgYWdhaW5zdCBhbGxvd2FuY2UuXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKG92ZXJsYXAgPCB0YWJPdmVybGFwQWxsb3dhbmNlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAoaiA9IDA7IGogPD0gaTsgaisrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtYXJnaW5MZWZ0ID0gKGogIT09IGFjdGl2ZUluZGV4ICYmIGogIT09IDApID8gJy0nICsgb3ZlcmxhcCArICdweCcgOiAnJztcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudGFic1tqXS5lbGVtZW50LmNzcyh7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ3otaW5kZXgnOiBpIC0gaixcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnbWFyZ2luLWxlZnQnOiBtYXJnaW5MZWZ0XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9sYXN0VmlzaWJsZVRhYkluZGV4ID0gaTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy50YWJzQ29udGFpbmVyLmFwcGVuZCh0YWJFbGVtZW50KTtcclxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0YWJPdmVybGFwQWxsb3dhbmNlRXhjZWVkZWQgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGkgPT09IGFjdGl2ZUluZGV4KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgLy9BY3RpdmUgdGFiIHNob3VsZCBzaG93IGV2ZW4gaWYgYWxsb3dhbmNlIGV4Y2VlZGVkLiAoV2UgbGVmdCByb29tLilcclxuICAgICAgICAgICAgICAgICAgICB0YWJFbGVtZW50LmNzcyh7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICd6LWluZGV4JzogJ2F1dG8nLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnbWFyZ2luLWxlZnQnOiAnJ1xyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMudGFic0NvbnRhaW5lci5hcHBlbmQodGFiRWxlbWVudCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKHRhYk92ZXJsYXBBbGxvd2FuY2VFeGNlZWRlZCAmJiBpICE9PSBhY3RpdmVJbmRleCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChzaG93VGFiTWVudSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAvL1RhYiBtZW51IGFscmVhZHkgc2hvd24sIHNvIHdlIGp1c3QgYWRkIHRvIGl0LlxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0YWJFbGVtZW50LmNzcyh7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnei1pbmRleCc6ICdhdXRvJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICdtYXJnaW4tbGVmdCc6ICcnXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnRhYkRyb3Bkb3duQ29udGFpbmVyLmFwcGVuZCh0YWJFbGVtZW50KTtcclxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAvL1dlIG5vdyBrbm93IHRoZSB0YWIgbWVudSBtdXN0IGJlIHNob3duLCBzbyB3ZSBoYXZlIHRvIHJlY2FsY3VsYXRlIGV2ZXJ5dGhpbmcuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX3VwZGF0ZVRhYlNpemVzKHRydWUpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuX2xhc3RWaXNpYmxlVGFiSW5kZXggPSBpO1xyXG4gICAgICAgICAgICAgICAgdGFiRWxlbWVudC5jc3Moe1xyXG4gICAgICAgICAgICAgICAgICAgICd6LWluZGV4JzogJ2F1dG8nLFxyXG4gICAgICAgICAgICAgICAgICAgICdtYXJnaW4tbGVmdCc6ICcnXHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIHRoaXMudGFic0NvbnRhaW5lci5hcHBlbmQodGFiRWxlbWVudCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgfVxyXG59XHJcbiIsImltcG9ydCAkIGZyb20gJ2pxdWVyeSc7XHJcblxyXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBIZWFkZXJCdXR0b24ge1xyXG4gICAgY29uc3RydWN0b3IoaGVhZGVyLCBsYWJlbCwgY3NzQ2xhc3MsIGFjdGlvbikge1xyXG4gICAgICAgIHRoaXMuX2hlYWRlciA9IGhlYWRlcjtcclxuICAgICAgICB0aGlzLmVsZW1lbnQgPSAkKCc8bGkgY2xhc3M9XCInICsgY3NzQ2xhc3MgKyAnXCIgdGl0bGU9XCInICsgbGFiZWwgKyAnXCI+PC9saT4nKTtcclxuICAgICAgICB0aGlzLl9oZWFkZXIub24oJ2Rlc3Ryb3knLCB0aGlzLl8kZGVzdHJveSwgdGhpcyk7XHJcbiAgICAgICAgdGhpcy5fYWN0aW9uID0gYWN0aW9uO1xyXG4gICAgICAgIHRoaXMuZWxlbWVudC5vbignY2xpY2sgdG91Y2hzdGFydCcsIHRoaXMuX2FjdGlvbik7XHJcbiAgICAgICAgdGhpcy5faGVhZGVyLmNvbnRyb2xzQ29udGFpbmVyLmFwcGVuZCh0aGlzLmVsZW1lbnQpO1xyXG4gICAgfVxyXG5cclxuICAgIF8kZGVzdHJveSgpIHtcclxuICAgICAgICB0aGlzLmVsZW1lbnQub2ZmKCk7XHJcbiAgICAgICAgdGhpcy5lbGVtZW50LnJlbW92ZSgpO1xyXG4gICAgfVxyXG59XHJcbiIsImltcG9ydCBEcmFnTGlzdGVuZXIgZnJvbSAnLi4vdXRpbHMvRHJhZ0xpc3RlbmVyJ1xyXG5pbXBvcnQgJCBmcm9tICdqcXVlcnknXHJcblxyXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBTcGxpdHRlciB7XHJcbiAgICBjb25zdHJ1Y3Rvcihpc1ZlcnRpY2FsLCBzaXplLCBncmFiU2l6ZSkge1xyXG4gICAgICAgIHRoaXMuX2lzVmVydGljYWwgPSBpc1ZlcnRpY2FsO1xyXG4gICAgICAgIHRoaXMuX3NpemUgPSBzaXplO1xyXG4gICAgICAgIHRoaXMuX2dyYWJTaXplID0gZ3JhYlNpemUgPCBzaXplID8gc2l6ZSA6IGdyYWJTaXplO1xyXG5cclxuICAgICAgICB0aGlzLmVsZW1lbnQgPSB0aGlzLl9jcmVhdGVFbGVtZW50KCk7XHJcbiAgICAgICAgdGhpcy5fZHJhZ0xpc3RlbmVyID0gbmV3IERyYWdMaXN0ZW5lcih0aGlzLmVsZW1lbnQpO1xyXG4gICAgfVxyXG5cclxuICAgIG9uKGV2ZW50LCBjYWxsYmFjaywgY29udGV4dCkge1xyXG4gICAgICAgIHRoaXMuX2RyYWdMaXN0ZW5lci5vbihldmVudCwgY2FsbGJhY2ssIGNvbnRleHQpO1xyXG4gICAgfVxyXG5cclxuICAgIF8kZGVzdHJveSgpIHtcclxuICAgICAgICB0aGlzLmVsZW1lbnQucmVtb3ZlKCk7XHJcbiAgICB9XHJcblxyXG4gICAgX2NyZWF0ZUVsZW1lbnQoKSB7XHJcbiAgICAgICAgdmFyIGRyYWdIYW5kbGUgPSAkKCc8ZGl2IGNsYXNzPVwibG1fZHJhZ19oYW5kbGVcIj48L2Rpdj4nKTtcclxuICAgICAgICB2YXIgZWxlbWVudCA9ICQoJzxkaXYgY2xhc3M9XCJsbV9zcGxpdHRlclwiPjwvZGl2PicpO1xyXG4gICAgICAgIGVsZW1lbnQuYXBwZW5kKGRyYWdIYW5kbGUpO1xyXG5cclxuICAgICAgICB2YXIgaGFuZGxlRXhjZXNzU2l6ZSA9IHRoaXMuX2dyYWJTaXplIC0gdGhpcy5fc2l6ZTtcclxuICAgICAgICB2YXIgaGFuZGxlRXhjZXNzUG9zID0gaGFuZGxlRXhjZXNzU2l6ZSAvIDI7XHJcblxyXG4gICAgICAgIGlmICh0aGlzLl9pc1ZlcnRpY2FsKSB7XHJcbiAgICAgICAgICAgIGRyYWdIYW5kbGUuY3NzKCd0b3AnLCAtaGFuZGxlRXhjZXNzUG9zKTtcclxuICAgICAgICAgICAgZHJhZ0hhbmRsZS5jc3MoJ2hlaWdodCcsIHRoaXMuX3NpemUgKyBoYW5kbGVFeGNlc3NTaXplKTtcclxuICAgICAgICAgICAgZWxlbWVudC5hZGRDbGFzcygnbG1fdmVydGljYWwnKTtcclxuICAgICAgICAgICAgZWxlbWVudFsnaGVpZ2h0J10odGhpcy5fc2l6ZSk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgZHJhZ0hhbmRsZS5jc3MoJ2xlZnQnLCAtaGFuZGxlRXhjZXNzUG9zKTtcclxuICAgICAgICAgICAgZHJhZ0hhbmRsZS5jc3MoJ3dpZHRoJywgdGhpcy5fc2l6ZSArIGhhbmRsZUV4Y2Vzc1NpemUpO1xyXG4gICAgICAgICAgICBlbGVtZW50LmFkZENsYXNzKCdsbV9ob3Jpem9udGFsJyk7XHJcbiAgICAgICAgICAgIGVsZW1lbnRbJ3dpZHRoJ10odGhpcy5fc2l6ZSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gZWxlbWVudDtcclxuICAgIH1cclxufVxyXG4iLCJpbXBvcnQgRHJhZ0xpc3RlbmVyIGZyb20gJy4uL3V0aWxzL0RyYWdMaXN0ZW5lcidcclxuaW1wb3J0IERyYWdQcm94eSBmcm9tICcuLi9jb250cm9scy9EcmFnUHJveHknXHJcbmltcG9ydCB7XHJcbiAgICBmbkJpbmQsXHJcbiAgICBzdHJpcFRhZ3NcclxufSBmcm9tICcuLi91dGlscy91dGlscydcclxuaW1wb3J0ICQgZnJvbSAnanF1ZXJ5J1xyXG5cclxuLyoqXHJcbiAqIFJlcHJlc2VudHMgYW4gaW5kaXZpZHVhbCB0YWIgd2l0aGluIGEgU3RhY2sncyBoZWFkZXJcclxuICpcclxuICogQHBhcmFtIHtIZWFkZXJ9IGhlYWRlclxyXG4gKiBAcGFyYW0ge0Fic3RyYWN0Q29udGVudEl0ZW19IGNvbnRlbnRJdGVtXHJcbiAqXHJcbiAqIEBjb25zdHJ1Y3RvclxyXG4gKi9cclxuXHJcbmNvbnN0IF90ZW1wbGF0ZSA9ICc8bGkgY2xhc3M9XCJsbV90YWJcIj48aSBjbGFzcz1cImxtX2xlZnRcIj48L2k+JyArXHJcbiAgICAgICAgJzxzcGFuIGNsYXNzPVwibG1fdGl0bGVcIj48L3NwYW4+PGRpdiBjbGFzcz1cImxtX2Nsb3NlX3RhYlwiPjwvZGl2PicgK1xyXG4gICAgICAgICc8aSBjbGFzcz1cImxtX3JpZ2h0XCI+PC9pPjwvbGk+J1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgVGFiIHtcclxuXHJcbiAgICBjb25zdHJ1Y3RvcihoZWFkZXIsIGNvbnRlbnRJdGVtKSB7XHJcbiAgICAgICAgdGhpcy5oZWFkZXIgPSBoZWFkZXI7XHJcbiAgICAgICAgdGhpcy5jb250ZW50SXRlbSA9IGNvbnRlbnRJdGVtO1xyXG4gICAgICAgIHRoaXMuZWxlbWVudCA9ICQoX3RlbXBsYXRlKTtcclxuICAgICAgICB0aGlzLnRpdGxlRWxlbWVudCA9IHRoaXMuZWxlbWVudC5maW5kKCcubG1fdGl0bGUnKTtcclxuICAgICAgICB0aGlzLmNsb3NlRWxlbWVudCA9IHRoaXMuZWxlbWVudC5maW5kKCcubG1fY2xvc2VfdGFiJyk7XHJcbiAgICAgICAgdGhpcy5jbG9zZUVsZW1lbnRbY29udGVudEl0ZW0uY29uZmlnLmlzQ2xvc2FibGUgPyAnc2hvdycgOiAnaGlkZSddKCk7XHJcbiAgICAgICAgdGhpcy5pc0FjdGl2ZSA9IGZhbHNlO1xyXG5cclxuICAgICAgICB0aGlzLnNldFRpdGxlKGNvbnRlbnRJdGVtLmNvbmZpZy50aXRsZSk7XHJcbiAgICAgICAgdGhpcy5jb250ZW50SXRlbS5vbigndGl0bGVDaGFuZ2VkJywgdGhpcy5zZXRUaXRsZSwgdGhpcyk7XHJcblxyXG4gICAgICAgIHRoaXMuX2xheW91dE1hbmFnZXIgPSB0aGlzLmNvbnRlbnRJdGVtLmxheW91dE1hbmFnZXI7XHJcblxyXG4gICAgICAgIGlmIChcclxuICAgICAgICAgICAgdGhpcy5fbGF5b3V0TWFuYWdlci5jb25maWcuc2V0dGluZ3MucmVvcmRlckVuYWJsZWQgPT09IHRydWUgJiZcclxuICAgICAgICAgICAgY29udGVudEl0ZW0uY29uZmlnLnJlb3JkZXJFbmFibGVkID09PSB0cnVlXHJcbiAgICAgICAgKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2RyYWdMaXN0ZW5lciA9IG5ldyBEcmFnTGlzdGVuZXIodGhpcy5lbGVtZW50KTtcclxuICAgICAgICAgICAgdGhpcy5fZHJhZ0xpc3RlbmVyLm9uKCdkcmFnU3RhcnQnLCB0aGlzLl9vbkRyYWdTdGFydCwgdGhpcyk7XHJcbiAgICAgICAgICAgIHRoaXMuY29udGVudEl0ZW0ub24oJ2Rlc3Ryb3knLCB0aGlzLl9kcmFnTGlzdGVuZXIuZGVzdHJveSwgdGhpcy5fZHJhZ0xpc3RlbmVyKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMuX29uVGFiQ2xpY2tGbiA9IGZuQmluZCh0aGlzLl9vblRhYkNsaWNrLCB0aGlzKTtcclxuICAgICAgICB0aGlzLl9vbkNsb3NlQ2xpY2tGbiA9IGZuQmluZCh0aGlzLl9vbkNsb3NlQ2xpY2ssIHRoaXMpO1xyXG5cclxuICAgICAgICB0aGlzLmVsZW1lbnQub24oJ21vdXNlZG93biB0b3VjaHN0YXJ0JywgdGhpcy5fb25UYWJDbGlja0ZuKTtcclxuXHJcbiAgICAgICAgaWYgKHRoaXMuY29udGVudEl0ZW0uY29uZmlnLmlzQ2xvc2FibGUpIHtcclxuICAgICAgICAgICAgdGhpcy5jbG9zZUVsZW1lbnQub24oJ2NsaWNrIHRvdWNoc3RhcnQnLCB0aGlzLl9vbkNsb3NlQ2xpY2tGbik7XHJcbiAgICAgICAgICAgIHRoaXMuY2xvc2VFbGVtZW50Lm9uKCdtb3VzZWRvd24nLCB0aGlzLl9vbkNsb3NlTW91c2Vkb3duKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICB0aGlzLmNsb3NlRWxlbWVudC5yZW1vdmUoKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMuY29udGVudEl0ZW0udGFiID0gdGhpcztcclxuICAgICAgICB0aGlzLmNvbnRlbnRJdGVtLmVtaXQoJ3RhYicsIHRoaXMpO1xyXG4gICAgICAgIHRoaXMuY29udGVudEl0ZW0ubGF5b3V0TWFuYWdlci5lbWl0KCd0YWJDcmVhdGVkJywgdGhpcyk7XHJcblxyXG4gICAgICAgIGlmICh0aGlzLmNvbnRlbnRJdGVtLmlzQ29tcG9uZW50KSB7XHJcbiAgICAgICAgICAgIHRoaXMuY29udGVudEl0ZW0uY29udGFpbmVyLnRhYiA9IHRoaXM7XHJcbiAgICAgICAgICAgIHRoaXMuY29udGVudEl0ZW0uY29udGFpbmVyLmVtaXQoJ3RhYicsIHRoaXMpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBTZXRzIHRoZSB0YWIncyB0aXRsZSB0byB0aGUgcHJvdmlkZWQgc3RyaW5nIGFuZCBzZXRzXHJcbiAgICAgKiBpdHMgdGl0bGUgYXR0cmlidXRlIHRvIGEgcHVyZSB0ZXh0IHJlcHJlc2VudGF0aW9uICh3aXRob3V0XHJcbiAgICAgKiBodG1sIHRhZ3MpIG9mIHRoZSBzYW1lIHN0cmluZy5cclxuICAgICAqXHJcbiAgICAgKiBAcHVibGljXHJcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gdGl0bGUgY2FuIGNvbnRhaW4gaHRtbFxyXG4gICAgICovXHJcbiAgICBzZXRUaXRsZSh0aXRsZSkge1xyXG4gICAgICAgIHRoaXMuZWxlbWVudC5hdHRyKCd0aXRsZScsIHN0cmlwVGFncyh0aXRsZSkpO1xyXG4gICAgICAgIHRoaXMudGl0bGVFbGVtZW50Lmh0bWwodGl0bGUpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogU2V0cyB0aGlzIHRhYidzIGFjdGl2ZSBzdGF0ZS4gVG8gcHJvZ3JhbW1hdGljYWxseVxyXG4gICAgICogc3dpdGNoIHRhYnMsIHVzZSBoZWFkZXIuc2V0QWN0aXZlQ29udGVudEl0ZW0oIGl0ZW0gKSBpbnN0ZWFkLlxyXG4gICAgICpcclxuICAgICAqIEBwdWJsaWNcclxuICAgICAqIEBwYXJhbSB7Qm9vbGVhbn0gaXNBY3RpdmVcclxuICAgICAqL1xyXG4gICAgc2V0QWN0aXZlKGlzQWN0aXZlKSB7XHJcbiAgICAgICAgaWYgKGlzQWN0aXZlID09PSB0aGlzLmlzQWN0aXZlKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5pc0FjdGl2ZSA9IGlzQWN0aXZlO1xyXG5cclxuICAgICAgICBpZiAoaXNBY3RpdmUpIHtcclxuICAgICAgICAgICAgdGhpcy5lbGVtZW50LmFkZENsYXNzKCdsbV9hY3RpdmUnKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICB0aGlzLmVsZW1lbnQucmVtb3ZlQ2xhc3MoJ2xtX2FjdGl2ZScpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIERlc3Ryb3lzIHRoZSB0YWJcclxuICAgICAqXHJcbiAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICogQHJldHVybnMge3ZvaWR9XHJcbiAgICAgKi9cclxuICAgIF8kZGVzdHJveSgpIHtcclxuICAgICAgICB0aGlzLmVsZW1lbnQub2ZmKCdtb3VzZWRvd24gdG91Y2hzdGFydCcsIHRoaXMuX29uVGFiQ2xpY2tGbik7XHJcbiAgICAgICAgdGhpcy5jbG9zZUVsZW1lbnQub2ZmKCdjbGljayB0b3VjaHN0YXJ0JywgdGhpcy5fb25DbG9zZUNsaWNrRm4pO1xyXG4gICAgICAgIGlmICh0aGlzLl9kcmFnTGlzdGVuZXIpIHtcclxuICAgICAgICAgICAgdGhpcy5jb250ZW50SXRlbS5vZmYoJ2Rlc3Ryb3knLCB0aGlzLl9kcmFnTGlzdGVuZXIuZGVzdHJveSwgdGhpcy5fZHJhZ0xpc3RlbmVyKTtcclxuICAgICAgICAgICAgdGhpcy5fZHJhZ0xpc3RlbmVyLm9mZignZHJhZ1N0YXJ0JywgdGhpcy5fb25EcmFnU3RhcnQpO1xyXG4gICAgICAgICAgICB0aGlzLl9kcmFnTGlzdGVuZXIgPSBudWxsO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLmVsZW1lbnQucmVtb3ZlKCk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDYWxsYmFjayBmb3IgdGhlIERyYWdMaXN0ZW5lclxyXG4gICAgICpcclxuICAgICAqIEBwYXJhbSAgIHtOdW1iZXJ9IHggVGhlIHRhYnMgYWJzb2x1dGUgeCBwb3NpdGlvblxyXG4gICAgICogQHBhcmFtICAge051bWJlcn0geSBUaGUgdGFicyBhYnNvbHV0ZSB5IHBvc2l0aW9uXHJcbiAgICAgKlxyXG4gICAgICogQHByaXZhdGVcclxuICAgICAqIEByZXR1cm5zIHt2b2lkfVxyXG4gICAgICovXHJcbiAgICBfb25EcmFnU3RhcnQoeCwgeSkge1xyXG4gICAgICAgIGlmICghdGhpcy5oZWFkZXIuX2NhbkRlc3Ryb3kpXHJcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgIGlmICh0aGlzLmNvbnRlbnRJdGVtLnBhcmVudC5pc01heGltaXNlZCA9PT0gdHJ1ZSkge1xyXG4gICAgICAgICAgICB0aGlzLmNvbnRlbnRJdGVtLnBhcmVudC50b2dnbGVNYXhpbWlzZSgpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBuZXcgRHJhZ1Byb3h5KFxyXG4gICAgICAgICAgICB4LFxyXG4gICAgICAgICAgICB5LFxyXG4gICAgICAgICAgICB0aGlzLl9kcmFnTGlzdGVuZXIsXHJcbiAgICAgICAgICAgIHRoaXMuX2xheW91dE1hbmFnZXIsXHJcbiAgICAgICAgICAgIHRoaXMuY29udGVudEl0ZW0sXHJcbiAgICAgICAgICAgIHRoaXMuaGVhZGVyLnBhcmVudFxyXG4gICAgICAgICk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDYWxsYmFjayB3aGVuIHRoZSB0YWIgaXMgY2xpY2tlZFxyXG4gICAgICpcclxuICAgICAqIEBwYXJhbSB7alF1ZXJ5IERPTSBldmVudH0gZXZlbnRcclxuICAgICAqXHJcbiAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICogQHJldHVybnMge3ZvaWR9XHJcbiAgICAgKi9cclxuICAgIF9vblRhYkNsaWNrKGV2ZW50KSB7XHJcbiAgICAgICAgLy8gbGVmdCBtb3VzZSBidXR0b24gb3IgdGFwXHJcbiAgICAgICAgaWYgKGV2ZW50LmJ1dHRvbiA9PT0gMCB8fCBldmVudC50eXBlID09PSAndG91Y2hzdGFydCcpIHtcclxuICAgICAgICAgICAgdGhpcy5oZWFkZXIucGFyZW50LnNldEFjdGl2ZUNvbnRlbnRJdGVtKCB0aGlzLmNvbnRlbnRJdGVtICk7XHJcblxyXG4gICAgICAgICAgICAvLyBtaWRkbGUgbW91c2UgYnV0dG9uXHJcbiAgICAgICAgfSBlbHNlIGlmIChldmVudC5idXR0b24gPT09IDEgJiYgdGhpcy5jb250ZW50SXRlbS5jb25maWcuaXNDbG9zYWJsZSkge1xyXG4gICAgICAgICAgICB0aGlzLl9vbkNsb3NlQ2xpY2soZXZlbnQpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENhbGxiYWNrIHdoZW4gdGhlIHRhYidzIGNsb3NlIGJ1dHRvbiBpc1xyXG4gICAgICogY2xpY2tlZFxyXG4gICAgICpcclxuICAgICAqIEBwYXJhbSAgIHtqUXVlcnkgRE9NIGV2ZW50fSBldmVudFxyXG4gICAgICpcclxuICAgICAqIEBwcml2YXRlXHJcbiAgICAgKiBAcmV0dXJucyB7dm9pZH1cclxuICAgICAqL1xyXG4gICAgX29uQ2xvc2VDbGljayhldmVudCkge1xyXG4gICAgICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xyXG4gICAgICAgIGlmICghdGhpcy5oZWFkZXIuX2NhbkRlc3Ryb3kpXHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB0aGlzLmhlYWRlci5wYXJlbnQucmVtb3ZlQ2hpbGQodGhpcy5jb250ZW50SXRlbSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDYWxsYmFjayB0byBjYXB0dXJlIHRhYiBjbG9zZSBidXR0b24gbW91c2Vkb3duXHJcbiAgICAgKiB0byBwcmV2ZW50IHRhYiBmcm9tIGFjdGl2YXRpbmcuXHJcbiAgICAgKlxyXG4gICAgICogQHBhcmFtIChqUXVlcnkgRE9NIGV2ZW50KSBldmVudFxyXG4gICAgICpcclxuICAgICAqIEBwcml2YXRlXHJcbiAgICAgKiBAcmV0dXJucyB7dm9pZH1cclxuICAgICAqL1xyXG4gICAgX29uQ2xvc2VNb3VzZWRvd24oZXZlbnQpIHtcclxuICAgICAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcclxuICAgIH1cclxufVxyXG4iLCJpbXBvcnQge1xyXG4gICAgbm93LFxyXG4gICAgYW5pbUZyYW1lLFxyXG4gICAgZm5CaW5kXHJcbn0gZnJvbSAnLi4vdXRpbHMvdXRpbHMnXHJcbmltcG9ydCAkIGZyb20gJ2pxdWVyeSdcclxuXHJcblxyXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBUcmFuc2l0aW9uSW5kaWNhdG9yIHtcclxuICAgIGNvbnN0cnVjdG9yKCkge1xyXG4gICAgICAgIHRoaXMuX2VsZW1lbnQgPSAkKCc8ZGl2IGNsYXNzPVwibG1fdHJhbnNpdGlvbl9pbmRpY2F0b3JcIj48L2Rpdj4nKTtcclxuICAgICAgICAkKGRvY3VtZW50LmJvZHkpLmFwcGVuZCh0aGlzLl9lbGVtZW50KTtcclxuXHJcbiAgICAgICAgdGhpcy5fdG9FbGVtZW50ID0gbnVsbDtcclxuICAgICAgICB0aGlzLl9mcm9tRGltZW5zaW9ucyA9IG51bGw7XHJcbiAgICAgICAgdGhpcy5fdG90YWxBbmltYXRpb25EdXJhdGlvbiA9IDIwMDtcclxuICAgICAgICB0aGlzLl9hbmltYXRpb25TdGFydFRpbWUgPSBudWxsO1xyXG4gICAgfVxyXG5cclxuICAgIGRlc3Ryb3koKSB7XHJcbiAgICAgICAgdGhpcy5fZWxlbWVudC5yZW1vdmUoKTtcclxuICAgIH1cclxuXHJcbiAgICB0cmFuc2l0aW9uRWxlbWVudHMoZnJvbUVsZW1lbnQsIHRvRWxlbWVudCkge1xyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFRPRE8gLSBUaGlzIGlzIG5vdCBxdWl0ZSBhcyBjb29sIGFzIGV4cGVjdGVkLiBSZXZpZXcuXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIC8vIHRoaXMuX3RvRWxlbWVudCA9IHRvRWxlbWVudDtcclxuICAgICAgICAvLyB0aGlzLl9hbmltYXRpb25TdGFydFRpbWUgPSBub3coKTtcclxuICAgICAgICAvLyB0aGlzLl9mcm9tRGltZW5zaW9ucyA9IHRoaXMuX21lYXN1cmUoZnJvbUVsZW1lbnQpO1xyXG4gICAgICAgIC8vIHRoaXMuX2Zyb21EaW1lbnNpb25zLm9wYWNpdHkgPSAwLjg7XHJcbiAgICAgICAgLy8gdGhpcy5fZWxlbWVudC5zaG93KCkuY3NzKHRoaXMuX2Zyb21EaW1lbnNpb25zKTtcclxuICAgICAgICAvLyBhbmltRnJhbWUoZm5CaW5kKHRoaXMuX25leHRBbmltYXRpb25GcmFtZSwgdGhpcykpO1xyXG4gICAgfVxyXG5cclxuICAgIF9uZXh0QW5pbWF0aW9uRnJhbWUoKSB7XHJcbiAgICAgICAgdmFyIHRvRGltZW5zaW9ucyA9IHRoaXMuX21lYXN1cmUodGhpcy5fdG9FbGVtZW50KSxcclxuICAgICAgICAgICAgYW5pbWF0aW9uUHJvZ3Jlc3MgPSAobm93KCkgLSB0aGlzLl9hbmltYXRpb25TdGFydFRpbWUpIC8gdGhpcy5fdG90YWxBbmltYXRpb25EdXJhdGlvbixcclxuICAgICAgICAgICAgY3VycmVudEZyYW1lU3R5bGVzID0ge30sXHJcbiAgICAgICAgICAgIGNzc1Byb3BlcnR5O1xyXG5cclxuICAgICAgICBpZiAoYW5pbWF0aW9uUHJvZ3Jlc3MgPj0gMSkge1xyXG4gICAgICAgICAgICB0aGlzLl9lbGVtZW50LmhpZGUoKTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdG9EaW1lbnNpb25zLm9wYWNpdHkgPSAwO1xyXG5cclxuICAgICAgICBmb3IgKGNzc1Byb3BlcnR5IGluIHRoaXMuX2Zyb21EaW1lbnNpb25zKSB7XHJcbiAgICAgICAgICAgIGN1cnJlbnRGcmFtZVN0eWxlc1tjc3NQcm9wZXJ0eV0gPSB0aGlzLl9mcm9tRGltZW5zaW9uc1tjc3NQcm9wZXJ0eV0gK1xyXG4gICAgICAgICAgICAgICAgKHRvRGltZW5zaW9uc1tjc3NQcm9wZXJ0eV0gLSB0aGlzLl9mcm9tRGltZW5zaW9uc1tjc3NQcm9wZXJ0eV0pICpcclxuICAgICAgICAgICAgICAgIGFuaW1hdGlvblByb2dyZXNzO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5fZWxlbWVudC5jc3MoY3VycmVudEZyYW1lU3R5bGVzKTtcclxuICAgICAgICBhbmltRnJhbWUoZm5CaW5kKHRoaXMuX25leHRBbmltYXRpb25GcmFtZSwgdGhpcykpO1xyXG4gICAgfVxyXG5cclxuICAgIF9tZWFzdXJlKGVsZW1lbnQpIHtcclxuICAgICAgICB2YXIgb2Zmc2V0ID0gZWxlbWVudC5vZmZzZXQoKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgbGVmdDogb2Zmc2V0LmxlZnQsXHJcbiAgICAgICAgICAgIHRvcDogb2Zmc2V0LnRvcCxcclxuICAgICAgICAgICAgd2lkdGg6IGVsZW1lbnQub3V0ZXJXaWR0aCgpLFxyXG4gICAgICAgICAgICBoZWlnaHQ6IGVsZW1lbnQub3V0ZXJIZWlnaHQoKVxyXG4gICAgICAgIH07XHJcbiAgICB9XHJcbn1cclxuIiwiXHJcblxyXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBDb25maWd1cmF0aW9uRXJyb3IgZXh0ZW5kcyBFcnJvciB7XHJcbiAgICBjb25zdHJ1Y3RvcihtZXNzYWdlLCBub2RlKSB7XHJcbiAgICAgICAgc3VwZXIoKTtcclxuXHJcbiAgICAgICAgdGhpcy5uYW1lID0gJ0NvbmZpZ3VyYXRpb24gRXJyb3InO1xyXG4gICAgICAgIHRoaXMubWVzc2FnZSA9IG1lc3NhZ2U7XHJcbiAgICAgICAgdGhpcy5ub2RlID0gbm9kZTtcclxuICAgIH1cclxufVxyXG4iLCJpbXBvcnQgRXZlbnRFbWl0dGVyIGZyb20gJy4uL3V0aWxzL0V2ZW50RW1pdHRlcidcclxuaW1wb3J0IHsgXHJcbiAgQUxMX0VWRU5UXHJcbn0gZnJvbSAnLi4vdXRpbHMvRXZlbnRFbWl0dGVyJ1xyXG5cclxuaW1wb3J0IEJ1YmJsaW5nRXZlbnQgZnJvbSAnLi4vdXRpbHMvQnViYmxpbmdFdmVudCdcclxuaW1wb3J0IFJvb3QgZnJvbSAnLi9Sb290J1xyXG5pbXBvcnQgQ29uZmlndXJhdGlvbkVycm9yIGZyb20gJy4uL2Vycm9ycy9Db25maWd1cmF0aW9uRXJyb3InXHJcbmltcG9ydCBpdGVtRGVmYXVsdENvbmZpZyBmcm9tICcuLi9jb25maWcvSXRlbURlZmF1bHRDb25maWcnXHJcblxyXG5pbXBvcnQge1xyXG4gICAgZm5CaW5kLFxyXG4gICAgYW5pbUZyYW1lLFxyXG4gICAgaW5kZXhPZlxyXG59IGZyb20gJy4uL3V0aWxzL3V0aWxzJ1xyXG5cclxuLyoqXHJcbiAqIFRoaXMgaXMgdGhlIGJhc2VjbGFzcyB0aGF0IGFsbCBjb250ZW50IGl0ZW1zIGluaGVyaXQgZnJvbS5cclxuICogTW9zdCBtZXRob2RzIHByb3ZpZGUgYSBzdWJzZXQgb2Ygd2hhdCB0aGUgc3ViLWNsYXNzZXMgZG8uXHJcbiAqXHJcbiAqIEl0IGFsc28gcHJvdmlkZXMgYSBudW1iZXIgb2YgZnVuY3Rpb25zIGZvciB0cmVlIHRyYXZlcnNhbFxyXG4gKlxyXG4gKiBAcGFyYW0ge2xtLkxheW91dE1hbmFnZXJ9IGxheW91dE1hbmFnZXJcclxuICogQHBhcmFtIHtpdGVtIG5vZGUgY29uZmlndXJhdGlvbn0gY29uZmlnXHJcbiAqIEBwYXJhbSB7bG0uaXRlbX0gcGFyZW50XHJcbiAqXHJcbiAqIEBldmVudCBzdGF0ZUNoYW5nZWRcclxuICogQGV2ZW50IGJlZm9yZUl0ZW1EZXN0cm95ZWRcclxuICogQGV2ZW50IGl0ZW1EZXN0cm95ZWRcclxuICogQGV2ZW50IGl0ZW1DcmVhdGVkXHJcbiAqIEBldmVudCBjb21wb25lbnRDcmVhdGVkXHJcbiAqIEBldmVudCByb3dDcmVhdGVkXHJcbiAqIEBldmVudCBjb2x1bW5DcmVhdGVkXHJcbiAqIEBldmVudCBzdGFja0NyZWF0ZWRcclxuICpcclxuICogQGNvbnN0cnVjdG9yXHJcbiAqL1xyXG5cclxuXHJcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEFic3RyYWN0Q29udGVudEl0ZW0gZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xyXG4gICAgY29uc3RydWN0b3IobGF5b3V0TWFuYWdlciwgY29uZmlnLCBwYXJlbnQpIHtcclxuXHJcbiAgICAgICAgc3VwZXIoKTtcclxuXHJcbiAgICAgICAgdGhpcy5jb25maWcgPSB0aGlzLl9leHRlbmRJdGVtTm9kZShjb25maWcpO1xyXG4gICAgICAgIHRoaXMudHlwZSA9IGNvbmZpZy50eXBlO1xyXG4gICAgICAgIHRoaXMuY29udGVudEl0ZW1zID0gW107XHJcbiAgICAgICAgdGhpcy5wYXJlbnQgPSBwYXJlbnQ7XHJcblxyXG4gICAgICAgIHRoaXMuaXNJbml0aWFsaXNlZCA9IGZhbHNlO1xyXG4gICAgICAgIHRoaXMuaXNNYXhpbWlzZWQgPSBmYWxzZTtcclxuICAgICAgICB0aGlzLmlzUm9vdCA9IGZhbHNlO1xyXG4gICAgICAgIHRoaXMuaXNSb3cgPSBmYWxzZTtcclxuICAgICAgICB0aGlzLmlzQ29sdW1uID0gZmFsc2U7XHJcbiAgICAgICAgdGhpcy5pc1N0YWNrID0gZmFsc2U7XHJcbiAgICAgICAgdGhpcy5pc0NvbXBvbmVudCA9IGZhbHNlO1xyXG5cclxuICAgICAgICB0aGlzLmxheW91dE1hbmFnZXIgPSBsYXlvdXRNYW5hZ2VyO1xyXG4gICAgICAgIHRoaXMuX3BlbmRpbmdFdmVudFByb3BhZ2F0aW9ucyA9IHt9O1xyXG4gICAgICAgIHRoaXMuX3Rocm90dGxlZEV2ZW50cyA9IFsnc3RhdGVDaGFuZ2VkJ107XHJcblxyXG4gICAgICAgIHRoaXMub24oQUxMX0VWRU5ULCB0aGlzLl9wcm9wYWdhdGVFdmVudCwgdGhpcyk7XHJcblxyXG4gICAgICAgIGlmIChjb25maWcuY29udGVudCkge1xyXG4gICAgICAgICAgICB0aGlzLl9jcmVhdGVDb250ZW50SXRlbXMoY29uZmlnKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBTZXQgdGhlIHNpemUgb2YgdGhlIGNvbXBvbmVudCBhbmQgaXRzIGNoaWxkcmVuLCBjYWxsZWQgcmVjdXJzaXZlbHlcclxuICAgICAqXHJcbiAgICAgKiBAYWJzdHJhY3RcclxuICAgICAqIEByZXR1cm5zIHZvaWRcclxuICAgICAqL1xyXG4gICAgc2V0U2l6ZSgpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Fic3RyYWN0IE1ldGhvZCcpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ2FsbHMgYSBtZXRob2QgcmVjdXJzaXZlbHkgZG93bndhcmRzIG9uIHRoZSB0cmVlXHJcbiAgICAgKlxyXG4gICAgICogQHBhcmFtICAge1N0cmluZ30gZnVuY3Rpb25OYW1lICAgICAgdGhlIG5hbWUgb2YgdGhlIGZ1bmN0aW9uIHRvIGJlIGNhbGxlZFxyXG4gICAgICogQHBhcmFtICAge1tBcnJheV19ZnVuY3Rpb25Bcmd1bWVudHMgb3B0aW9uYWwgYXJndW1lbnRzIHRoYXQgYXJlIHBhc3NlZCB0byBldmVyeSBmdW5jdGlvblxyXG4gICAgICogQHBhcmFtICAge1tib29sXX0gYm90dG9tVXAgICAgICAgICAgQ2FsbCBtZXRob2RzIGZyb20gYm90dG9tIHRvIHRvcCwgZGVmYXVsdHMgdG8gZmFsc2VcclxuICAgICAqIEBwYXJhbSAgIHtbYm9vbF19IHNraXBTZWxmICAgICAgICAgIERvbid0IGludm9rZSB0aGUgbWV0aG9kIG9uIHRoZSBjbGFzcyB0aGF0IGNhbGxzIGl0LCBkZWZhdWx0cyB0byBmYWxzZVxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHt2b2lkfVxyXG4gICAgICovXHJcbiAgICBjYWxsRG93bndhcmRzKGZ1bmN0aW9uTmFtZSwgZnVuY3Rpb25Bcmd1bWVudHMsIGJvdHRvbVVwLCBza2lwU2VsZikge1xyXG4gICAgICAgIHZhciBpO1xyXG5cclxuICAgICAgICBpZiAoYm90dG9tVXAgIT09IHRydWUgJiYgc2tpcFNlbGYgIT09IHRydWUpIHtcclxuICAgICAgICAgICAgdGhpc1tmdW5jdGlvbk5hbWVdLmFwcGx5KHRoaXMsIGZ1bmN0aW9uQXJndW1lbnRzIHx8IFtdKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IHRoaXMuY29udGVudEl0ZW1zLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIHRoaXMuY29udGVudEl0ZW1zW2ldLmNhbGxEb3dud2FyZHMoZnVuY3Rpb25OYW1lLCBmdW5jdGlvbkFyZ3VtZW50cywgYm90dG9tVXApO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoYm90dG9tVXAgPT09IHRydWUgJiYgc2tpcFNlbGYgIT09IHRydWUpIHtcclxuICAgICAgICAgICAgdGhpc1tmdW5jdGlvbk5hbWVdLmFwcGx5KHRoaXMsIGZ1bmN0aW9uQXJndW1lbnRzIHx8IFtdKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSZW1vdmVzIGEgY2hpbGQgbm9kZSAoYW5kIGl0cyBjaGlsZHJlbikgZnJvbSB0aGUgdHJlZVxyXG4gICAgICpcclxuICAgICAqIEBwYXJhbSAgIHtDb250ZW50SXRlbX0gY29udGVudEl0ZW1cclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJucyB7dm9pZH1cclxuICAgICAqL1xyXG4gICAgcmVtb3ZlQ2hpbGQoY29udGVudEl0ZW0sIGtlZXBDaGlsZCkge1xyXG4gICAgICAgIC8qXHJcbiAgICAgICAgICogR2V0IHRoZSBwb3NpdGlvbiBvZiB0aGUgaXRlbSB0aGF0J3MgdG8gYmUgcmVtb3ZlZCB3aXRoaW4gYWxsIGNvbnRlbnQgaXRlbXMgdGhpcyBub2RlIGNvbnRhaW5zXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgdmFyIGluZGV4ID0gaW5kZXhPZihjb250ZW50SXRlbSwgdGhpcy5jb250ZW50SXRlbXMpO1xyXG5cclxuICAgICAgICAvKlxyXG4gICAgICAgICAqIE1ha2Ugc3VyZSB0aGUgY29udGVudCBpdGVtIHRvIGJlIHJlbW92ZWQgaXMgYWN0dWFsbHkgYSBjaGlsZCBvZiB0aGlzIGl0ZW1cclxuICAgICAgICAgKi9cclxuICAgICAgICBpZiAoaW5kZXggPT09IC0xKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignQ2FuXFwndCByZW1vdmUgY2hpbGQgaXRlbS4gVW5rbm93biBjb250ZW50IGl0ZW0nKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8qKlxyXG5cdFx0ICogQ2FsbCAuXyRkZXN0cm95IG9uIHRoZSBjb250ZW50IGl0ZW0uIFxyXG5cdFx0ICogVGhlbiB1c2UgJ2NhbGxEb3dud2FyZHMnIHRvIGRlc3Ryb3kgYW55IGNoaWxkcmVuXHJcblx0XHQgKi9cclxuICAgICAgICBpZiAoa2VlcENoaWxkICE9PSB0cnVlKSB7XHJcblx0XHRcdHRoaXMuY29udGVudEl0ZW1zW2luZGV4XS5fJGRlc3Ryb3koKTtcclxuXHRcdFx0dGhpcy5jb250ZW50SXRlbXNbaW5kZXhdLmNhbGxEb3dud2FyZHMoJ18kZGVzdHJveScsIFtdLCB0cnVlLCB0cnVlKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFJlbW92ZSB0aGUgY29udGVudCBpdGVtIGZyb20gdGhpcyBub2RlcyBhcnJheSBvZiBjaGlsZHJlblxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHRoaXMuY29udGVudEl0ZW1zLnNwbGljZShpbmRleCwgMSk7XHJcblxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFJlbW92ZSB0aGUgaXRlbSBmcm9tIHRoZSBjb25maWd1cmF0aW9uXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgdGhpcy5jb25maWcuY29udGVudC5zcGxpY2UoaW5kZXgsIDEpO1xyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBJZiB0aGlzIG5vZGUgc3RpbGwgY29udGFpbnMgb3RoZXIgY29udGVudCBpdGVtcywgYWRqdXN0IHRoZWlyIHNpemVcclxuICAgICAgICAgKi9cclxuICAgICAgICBpZiAodGhpcy5jb250ZW50SXRlbXMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgICB0aGlzLmNhbGxEb3dud2FyZHMoJ3NldFNpemUnKTtcclxuXHJcbiAgICAgICAgICAgIC8qKlxyXG4gICAgICAgICAgICAgKiBJZiB0aGlzIHdhcyB0aGUgbGFzdCBjb250ZW50IGl0ZW0sIHJlbW92ZSB0aGlzIG5vZGUgYXMgd2VsbFxyXG4gICAgICAgICAgICAgKi9cclxuICAgICAgICB9IGVsc2UgaWYgKCEodGhpcyBpbnN0YW5jZW9mIFJvb3QpICYmIHRoaXMuY29uZmlnLmlzQ2xvc2FibGUgPT09IHRydWUpIHtcclxuICAgICAgICAgICAgdGhpcy5wYXJlbnQucmVtb3ZlQ2hpbGQodGhpcyk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogSGlkZXMgYSBjaGlsZCBub2RlIChhbmQgaXRzIGNoaWxkcmVuKSBmcm9tIHRoZSB0cmVlIHJlY2xhaW1pbmcgaXRzIHNwYWNlIGluIHRoZSBsYXlvdXRcclxuICAgICAqXHJcbiAgICAgKiBAcGFyYW0gICB7Q29udGVudEl0ZW19IGNvbnRlbnRJdGVtXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge3ZvaWR9XHJcbiAgICAgKi9cclxuICAgIHVuZGlzcGxheUNoaWxkKGNvbnRlbnRJdGVtKSB7XHJcbiAgICAgICAgLypcclxuICAgICAgICAgKiBHZXQgdGhlIHBvc2l0aW9uIG9mIHRoZSBpdGVtIHRoYXQncyB0byBiZSByZW1vdmVkIHdpdGhpbiBhbGwgY29udGVudCBpdGVtcyB0aGlzIG5vZGUgY29udGFpbnNcclxuICAgICAgICAgKi9cclxuICAgICAgICB2YXIgaW5kZXggPSBpbmRleE9mKGNvbnRlbnRJdGVtLCB0aGlzLmNvbnRlbnRJdGVtcyk7XHJcblxyXG4gICAgICAgIC8qXHJcbiAgICAgICAgICogTWFrZSBzdXJlIHRoZSBjb250ZW50IGl0ZW0gdG8gYmUgcmVtb3ZlZCBpcyBhY3R1YWxseSBhIGNoaWxkIG9mIHRoaXMgaXRlbVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGlmIChpbmRleCA9PT0gLTEpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdDYW5cXCd0IHJlbW92ZSBjaGlsZCBpdGVtLiBVbmtub3duIGNvbnRlbnQgaXRlbScpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIFJvb3QpICYmIHRoaXMuY29uZmlnLmlzQ2xvc2FibGUgPT09IHRydWUpIHtcclxuICAgICAgICAgICAgdGhpcy5wYXJlbnQudW5kaXNwbGF5Q2hpbGQodGhpcyk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogU2V0cyB1cCB0aGUgdHJlZSBzdHJ1Y3R1cmUgZm9yIHRoZSBuZXdseSBhZGRlZCBjaGlsZFxyXG4gICAgICogVGhlIHJlc3BvbnNpYmlsaXR5IGZvciB0aGUgYWN0dWFsIERPTSBtYW5pcHVsYXRpb25zIGxpZXNcclxuICAgICAqIHdpdGggdGhlIGNvbmNyZXRlIGl0ZW1cclxuICAgICAqXHJcbiAgICAgKiBAcGFyYW0ge0Fic3RyYWN0Q29udGVudEl0ZW19IGNvbnRlbnRJdGVtXHJcbiAgICAgKiBAcGFyYW0ge1tJbnRdfSBpbmRleCBJZiBvbWl0dGVkIGl0ZW0gd2lsbCBiZSBhcHBlbmRlZFxyXG4gICAgICovXHJcbiAgICBhZGRDaGlsZChjb250ZW50SXRlbSwgaW5kZXgpIHtcclxuICAgICAgICBpZiAoaW5kZXggPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICBpbmRleCA9IHRoaXMuY29udGVudEl0ZW1zLmxlbmd0aDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMuY29udGVudEl0ZW1zLnNwbGljZShpbmRleCwgMCwgY29udGVudEl0ZW0pO1xyXG5cclxuICAgICAgICBpZiAodGhpcy5jb25maWcuY29udGVudCA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgIHRoaXMuY29uZmlnLmNvbnRlbnQgPSBbXTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMuY29uZmlnLmNvbnRlbnQuc3BsaWNlKGluZGV4LCAwLCBjb250ZW50SXRlbS5jb25maWcpO1xyXG4gICAgICAgIGNvbnRlbnRJdGVtLnBhcmVudCA9IHRoaXM7XHJcblxyXG4gICAgICAgIGlmIChjb250ZW50SXRlbS5wYXJlbnQuaXNJbml0aWFsaXNlZCA9PT0gdHJ1ZSAmJiBjb250ZW50SXRlbS5pc0luaXRpYWxpc2VkID09PSBmYWxzZSkge1xyXG4gICAgICAgICAgICBjb250ZW50SXRlbS5fJGluaXQoKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSZXBsYWNlcyBvbGRDaGlsZCB3aXRoIG5ld0NoaWxkLiBUaGlzIHVzZWQgdG8gdXNlIGpRdWVyeS5yZXBsYWNlV2l0aC4uLiB3aGljaCBmb3JcclxuICAgICAqIHNvbWUgcmVhc29uIHJlbW92ZXMgYWxsIGV2ZW50IGxpc3RlbmVycywgc28gaXNuJ3QgcmVhbGx5IGFuIG9wdGlvbi5cclxuICAgICAqXHJcbiAgICAgKiBAcGFyYW0gICB7QWJzdHJhY3RDb250ZW50SXRlbX0gb2xkQ2hpbGRcclxuICAgICAqIEBwYXJhbSAgIHtBYnN0cmFjdENvbnRlbnRJdGVtfSBuZXdDaGlsZFxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHt2b2lkfVxyXG4gICAgICovXHJcbiAgICByZXBsYWNlQ2hpbGQob2xkQ2hpbGQsIG5ld0NoaWxkLCBfJGRlc3Ryb3lPbGRDaGlsZCkge1xyXG5cclxuICAgICAgICBuZXdDaGlsZCA9IHRoaXMubGF5b3V0TWFuYWdlci5fJG5vcm1hbGl6ZUNvbnRlbnRJdGVtKG5ld0NoaWxkKTtcclxuXHJcbiAgICAgICAgdmFyIGluZGV4ID0gaW5kZXhPZihvbGRDaGlsZCwgdGhpcy5jb250ZW50SXRlbXMpLFxyXG4gICAgICAgICAgICBwYXJlbnROb2RlID0gb2xkQ2hpbGQuZWxlbWVudFswXS5wYXJlbnROb2RlO1xyXG5cclxuICAgICAgICBpZiAoaW5kZXggPT09IC0xKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignQ2FuXFwndCByZXBsYWNlIGNoaWxkLiBvbGRDaGlsZCBpcyBub3QgY2hpbGQgb2YgdGhpcycpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcGFyZW50Tm9kZS5yZXBsYWNlQ2hpbGQobmV3Q2hpbGQuZWxlbWVudFswXSwgb2xkQ2hpbGQuZWxlbWVudFswXSk7XHJcblxyXG4gICAgICAgIC8qXHJcbiAgICAgICAgICogT3B0aW9uYWxseSBkZXN0cm95IHRoZSBvbGQgY29udGVudCBpdGVtXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgaWYgKF8kZGVzdHJveU9sZENoaWxkID09PSB0cnVlKSB7XHJcbiAgICAgICAgICAgIG9sZENoaWxkLnBhcmVudCA9IG51bGw7XHJcbiAgICAgICAgICAgIG9sZENoaWxkLl8kZGVzdHJveSgpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLypcclxuICAgICAgICAgKiBXaXJlIHRoZSBuZXcgY29udGVudEl0ZW0gaW50byB0aGUgdHJlZVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHRoaXMuY29udGVudEl0ZW1zW2luZGV4XSA9IG5ld0NoaWxkO1xyXG4gICAgICAgIG5ld0NoaWxkLnBhcmVudCA9IHRoaXM7XHJcblxyXG4gICAgICAgIC8qXHJcbiAgICAgICAgICogVXBkYXRlIHRhYiByZWZlcmVuY2VcclxuICAgICAgICAgKi9cclxuICAgICAgICBpZiAodGhpcy5pc1N0YWNrKSB7XHJcbiAgICAgICAgICAgIHRoaXMuaGVhZGVyLnRhYnNbaW5kZXhdLmNvbnRlbnRJdGVtID0gbmV3Q2hpbGQ7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvL1RPRE8gVGhpcyBkb2Vzbid0IHVwZGF0ZSB0aGUgY29uZmlnLi4uIHJlZmFjdG9yIHRvIGxlYXZlIGl0ZW0gbm9kZXMgdW50b3VjaGVkIGFmdGVyIGNyZWF0aW9uXHJcbiAgICAgICAgaWYgKG5ld0NoaWxkLnBhcmVudC5pc0luaXRpYWxpc2VkID09PSB0cnVlICYmIG5ld0NoaWxkLmlzSW5pdGlhbGlzZWQgPT09IGZhbHNlKSB7XHJcbiAgICAgICAgICAgIG5ld0NoaWxkLl8kaW5pdCgpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5jYWxsRG93bndhcmRzKCdzZXRTaXplJyk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDb252ZW5pZW5jZSBtZXRob2QuXHJcbiAgICAgKiBTaG9ydGhhbmQgZm9yIHRoaXMucGFyZW50LnJlbW92ZUNoaWxkKCB0aGlzIClcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJucyB7dm9pZH1cclxuICAgICAqL1xyXG4gICAgcmVtb3ZlKCkge1xyXG4gICAgICAgIHRoaXMucGFyZW50LnJlbW92ZUNoaWxkKHRoaXMpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUmVtb3ZlcyB0aGUgY29tcG9uZW50IGZyb20gdGhlIGxheW91dCBhbmQgY3JlYXRlcyBhIG5ld1xyXG4gICAgICogYnJvd3NlciB3aW5kb3cgd2l0aCB0aGUgY29tcG9uZW50IGFuZCBpdHMgY2hpbGRyZW4gaW5zaWRlXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge0Jyb3dzZXJQb3BvdXR9XHJcbiAgICAgKi9cclxuICAgIHBvcG91dCgpIHtcclxuICAgICAgICB2YXIgYnJvd3NlclBvcG91dCA9IHRoaXMubGF5b3V0TWFuYWdlci5jcmVhdGVQb3BvdXQodGhpcyk7XHJcbiAgICAgICAgdGhpcy5lbWl0QnViYmxpbmdFdmVudCgnc3RhdGVDaGFuZ2VkJyk7XHJcbiAgICAgICAgcmV0dXJuIGJyb3dzZXJQb3BvdXQ7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBNYXhpbWlzZXMgdGhlIEl0ZW0gb3IgbWluaW1pc2VzIGl0IGlmIGl0IGlzIGFscmVhZHkgbWF4aW1pc2VkXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge3ZvaWR9XHJcbiAgICAgKi9cclxuICAgIHRvZ2dsZU1heGltaXNlKGUpIHtcclxuICAgICAgICBlICYmIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICBpZiAodGhpcy5pc01heGltaXNlZCA9PT0gdHJ1ZSkge1xyXG4gICAgICAgICAgICB0aGlzLmxheW91dE1hbmFnZXIuXyRtaW5pbWlzZUl0ZW0odGhpcyk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgdGhpcy5sYXlvdXRNYW5hZ2VyLl8kbWF4aW1pc2VJdGVtKHRoaXMpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5pc01heGltaXNlZCA9ICF0aGlzLmlzTWF4aW1pc2VkO1xyXG4gICAgICAgIHRoaXMuZW1pdEJ1YmJsaW5nRXZlbnQoJ3N0YXRlQ2hhbmdlZCcpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogU2VsZWN0cyB0aGUgaXRlbSBpZiBpdCBpcyBub3QgYWxyZWFkeSBzZWxlY3RlZFxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHt2b2lkfVxyXG4gICAgICovXHJcbiAgICBzZWxlY3QoKSB7XHJcbiAgICAgICAgaWYgKHRoaXMubGF5b3V0TWFuYWdlci5zZWxlY3RlZEl0ZW0gIT09IHRoaXMpIHtcclxuICAgICAgICAgICAgdGhpcy5sYXlvdXRNYW5hZ2VyLnNlbGVjdEl0ZW0odGhpcywgdHJ1ZSk7XHJcbiAgICAgICAgICAgIHRoaXMuZWxlbWVudC5hZGRDbGFzcygnbG1fc2VsZWN0ZWQnKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBEZS1zZWxlY3RzIHRoZSBpdGVtIGlmIGl0IGlzIHNlbGVjdGVkXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge3ZvaWR9XHJcbiAgICAgKi9cclxuICAgIGRlc2VsZWN0KCkge1xyXG4gICAgICAgIGlmICh0aGlzLmxheW91dE1hbmFnZXIuc2VsZWN0ZWRJdGVtID09PSB0aGlzKSB7XHJcbiAgICAgICAgICAgIHRoaXMubGF5b3V0TWFuYWdlci5zZWxlY3RlZEl0ZW0gPSBudWxsO1xyXG4gICAgICAgICAgICB0aGlzLmVsZW1lbnQucmVtb3ZlQ2xhc3MoJ2xtX3NlbGVjdGVkJyk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogU2V0IHRoaXMgY29tcG9uZW50J3MgdGl0bGVcclxuICAgICAqXHJcbiAgICAgKiBAcHVibGljXHJcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gdGl0bGVcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJucyB7dm9pZH1cclxuICAgICAqL1xyXG4gICAgc2V0VGl0bGUodGl0bGUpIHtcclxuICAgICAgICB0aGlzLmNvbmZpZy50aXRsZSA9IHRpdGxlO1xyXG4gICAgICAgIHRoaXMuZW1pdCgndGl0bGVDaGFuZ2VkJywgdGl0bGUpO1xyXG4gICAgICAgIHRoaXMuZW1pdCgnc3RhdGVDaGFuZ2VkJyk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDaGVja3Mgd2hldGhlciBhIHByb3ZpZGVkIGlkIGlzIHByZXNlbnRcclxuICAgICAqXHJcbiAgICAgKiBAcHVibGljXHJcbiAgICAgKiBAcGFyYW0gICB7U3RyaW5nfSAgaWRcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn0gaXNQcmVzZW50XHJcbiAgICAgKi9cclxuICAgIGhhc0lkKGlkKSB7XHJcbiAgICAgICAgaWYgKCF0aGlzLmNvbmZpZy5pZCkge1xyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgdGhpcy5jb25maWcuaWQgPT09ICdzdHJpbmcnKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmNvbmZpZy5pZCA9PT0gaWQ7XHJcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLmNvbmZpZy5pZCBpbnN0YW5jZW9mIEFycmF5KSB7XHJcbiAgICAgICAgICAgIHJldHVybiBpbmRleE9mKGlkLCB0aGlzLmNvbmZpZy5pZCkgIT09IC0xO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEFkZHMgYW4gaWQuIEFkZHMgaXQgYXMgYSBzdHJpbmcgaWYgdGhlIGNvbXBvbmVudCBkb2Vzbid0XHJcbiAgICAgKiBoYXZlIGFuIGlkIHlldCBvciBjcmVhdGVzL3VzZXMgYW4gYXJyYXlcclxuICAgICAqXHJcbiAgICAgKiBAcHVibGljXHJcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gaWRcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJucyB7dm9pZH1cclxuICAgICAqL1xyXG4gICAgYWRkSWQoaWQpIHtcclxuICAgICAgICBpZiAodGhpcy5oYXNJZChpZCkpIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKCF0aGlzLmNvbmZpZy5pZCkge1xyXG4gICAgICAgICAgICB0aGlzLmNvbmZpZy5pZCA9IGlkO1xyXG4gICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHRoaXMuY29uZmlnLmlkID09PSAnc3RyaW5nJykge1xyXG4gICAgICAgICAgICB0aGlzLmNvbmZpZy5pZCA9IFt0aGlzLmNvbmZpZy5pZCwgaWRdO1xyXG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5jb25maWcuaWQgaW5zdGFuY2VvZiBBcnJheSkge1xyXG4gICAgICAgICAgICB0aGlzLmNvbmZpZy5pZC5wdXNoKGlkKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSZW1vdmVzIGFuIGV4aXN0aW5nIGlkLiBUaHJvd3MgYW4gZXJyb3JcclxuICAgICAqIGlmIHRoZSBpZCBpcyBub3QgcHJlc2VudFxyXG4gICAgICpcclxuICAgICAqIEBwdWJsaWNcclxuICAgICAqIEBwYXJhbSAgIHtTdHJpbmd9IGlkXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge3ZvaWR9XHJcbiAgICAgKi9cclxuICAgIHJlbW92ZUlkKGlkKSB7XHJcbiAgICAgICAgaWYgKCF0aGlzLmhhc0lkKGlkKSkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0lkIG5vdCBmb3VuZCcpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKHR5cGVvZiB0aGlzLmNvbmZpZy5pZCA9PT0gJ3N0cmluZycpIHtcclxuICAgICAgICAgICAgZGVsZXRlIHRoaXMuY29uZmlnLmlkO1xyXG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5jb25maWcuaWQgaW5zdGFuY2VvZiBBcnJheSkge1xyXG4gICAgICAgICAgICB2YXIgaW5kZXggPSBpbmRleE9mKGlkLCB0aGlzLmNvbmZpZy5pZCk7XHJcbiAgICAgICAgICAgIHRoaXMuY29uZmlnLmlkLnNwbGljZShpbmRleCwgMSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXHJcbiAgICAgKiBTRUxFQ1RPUlxyXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXHJcbiAgICBnZXRJdGVtc0J5RmlsdGVyKGZpbHRlcikge1xyXG4gICAgICAgIHZhciByZXN1bHQgPSBbXSxcclxuICAgICAgICAgICAgbmV4dCA9IGZ1bmN0aW9uKGNvbnRlbnRJdGVtKSB7XHJcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNvbnRlbnRJdGVtLmNvbnRlbnRJdGVtcy5sZW5ndGg7IGkrKykge1xyXG5cclxuICAgICAgICAgICAgICAgICAgICBpZiAoZmlsdGVyKGNvbnRlbnRJdGVtLmNvbnRlbnRJdGVtc1tpXSkgPT09IHRydWUpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmVzdWx0LnB1c2goY29udGVudEl0ZW0uY29udGVudEl0ZW1zW2ldKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIG5leHQoY29udGVudEl0ZW0uY29udGVudEl0ZW1zW2ldKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgbmV4dCh0aGlzKTtcclxuICAgICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgfVxyXG5cclxuICAgIGdldEl0ZW1zQnlJZChpZCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLmdldEl0ZW1zQnlGaWx0ZXIoZnVuY3Rpb24oaXRlbSkge1xyXG4gICAgICAgICAgICBpZiAoaXRlbS5jb25maWcuaWQgaW5zdGFuY2VvZiBBcnJheSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGluZGV4T2YoaWQsIGl0ZW0uY29uZmlnLmlkKSAhPT0gLTE7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gaXRlbS5jb25maWcuaWQgPT09IGlkO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgZ2V0SXRlbXNCeVR5cGUodHlwZSkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLl8kZ2V0SXRlbXNCeVByb3BlcnR5KCd0eXBlJywgdHlwZSk7XHJcbiAgICB9XHJcblxyXG4gICAgZ2V0Q29tcG9uZW50c0J5TmFtZShjb21wb25lbnROYW1lKSB7XHJcbiAgICAgICAgdmFyIGNvbXBvbmVudHMgPSB0aGlzLl8kZ2V0SXRlbXNCeVByb3BlcnR5KCdjb21wb25lbnROYW1lJywgY29tcG9uZW50TmFtZSksXHJcbiAgICAgICAgICAgIGluc3RhbmNlcyA9IFtdLFxyXG4gICAgICAgICAgICBpO1xyXG5cclxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgY29tcG9uZW50cy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICBpbnN0YW5jZXMucHVzaChjb21wb25lbnRzW2ldLmluc3RhbmNlKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBpbnN0YW5jZXM7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcclxuICAgICAqIFBBQ0tBR0UgUFJJVkFURVxyXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXHJcbiAgICBfJGdldEl0ZW1zQnlQcm9wZXJ0eShrZXksIHZhbHVlKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0SXRlbXNCeUZpbHRlcihmdW5jdGlvbihpdGVtKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBpdGVtW2tleV0gPT09IHZhbHVlO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIF8kc2V0UGFyZW50KHBhcmVudCkge1xyXG4gICAgICAgIHRoaXMucGFyZW50ID0gcGFyZW50O1xyXG4gICAgfVxyXG5cclxuICAgIF8kaGlnaGxpZ2h0RHJvcFpvbmUoeCwgeSwgYXJlYSkge1xyXG4gICAgICAgIHRoaXMubGF5b3V0TWFuYWdlci5kcm9wVGFyZ2V0SW5kaWNhdG9yLmhpZ2hsaWdodEFyZWEoYXJlYSk7XHJcbiAgICB9XHJcblxyXG4gICAgXyRvbkRyb3AoY29udGVudEl0ZW0pIHtcclxuICAgICAgICB0aGlzLmFkZENoaWxkKGNvbnRlbnRJdGVtKTtcclxuICAgIH1cclxuXHJcbiAgICBfJGhpZGUoKSB7XHJcbiAgICAgICAgdGhpcy5fY2FsbE9uQWN0aXZlQ29tcG9uZW50cygnaGlkZScpO1xyXG4gICAgICAgIHRoaXMuZWxlbWVudC5oaWRlKCk7XHJcbiAgICAgICAgdGhpcy5sYXlvdXRNYW5hZ2VyLnVwZGF0ZVNpemUoKTtcclxuICAgIH1cclxuXHJcbiAgICBfJHNob3coKSB7XHJcbiAgICAgICAgdGhpcy5fY2FsbE9uQWN0aXZlQ29tcG9uZW50cygnc2hvdycpO1xyXG4gICAgICAgIHRoaXMuZWxlbWVudC5zaG93KCk7XHJcbiAgICAgICAgdGhpcy5sYXlvdXRNYW5hZ2VyLnVwZGF0ZVNpemUoKTtcclxuICAgIH1cclxuXHJcbiAgICBfY2FsbE9uQWN0aXZlQ29tcG9uZW50cyhtZXRob2ROYW1lKSB7XHJcbiAgICAgICAgdmFyIHN0YWNrcyA9IHRoaXMuZ2V0SXRlbXNCeVR5cGUoJ3N0YWNrJyksXHJcbiAgICAgICAgICAgIGFjdGl2ZUNvbnRlbnRJdGVtLFxyXG4gICAgICAgICAgICBpO1xyXG5cclxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgc3RhY2tzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIGFjdGl2ZUNvbnRlbnRJdGVtID0gc3RhY2tzW2ldLmdldEFjdGl2ZUNvbnRlbnRJdGVtKCk7XHJcblxyXG4gICAgICAgICAgICBpZiAoYWN0aXZlQ29udGVudEl0ZW0gJiYgYWN0aXZlQ29udGVudEl0ZW0uaXNDb21wb25lbnQpIHtcclxuICAgICAgICAgICAgICAgIGFjdGl2ZUNvbnRlbnRJdGVtLmNvbnRhaW5lclttZXRob2ROYW1lXSgpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogRGVzdHJveXMgdGhpcyBpdGVtIGFuZHMgaXRzIGNoaWxkcmVuXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge3ZvaWR9XHJcbiAgICAgKi9cclxuICAgIF8kZGVzdHJveSgpIHtcclxuICAgICAgICB0aGlzLmVtaXRCdWJibGluZ0V2ZW50KCdiZWZvcmVJdGVtRGVzdHJveWVkJyk7XHJcbiAgICAgICAgdGhpcy5lbGVtZW50LnJlbW92ZSgpO1xyXG4gICAgICAgIHRoaXMuZW1pdEJ1YmJsaW5nRXZlbnQoJ2l0ZW1EZXN0cm95ZWQnKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFJldHVybnMgdGhlIGFyZWEgdGhlIGNvbXBvbmVudCBjdXJyZW50bHkgb2NjdXBpZXMgaW4gdGhlIGZvcm1hdFxyXG4gICAgICpcclxuICAgICAqIHtcclxuICAgICAqXHRcdHgxOiBpbnRcclxuICAgICAqXHRcdHh5OiBpbnRcclxuICAgICAqXHRcdHkxOiBpbnRcclxuICAgICAqXHRcdHkyOiBpbnRcclxuICAgICAqXHRcdGNvbnRlbnRJdGVtOiBjb250ZW50SXRlbVxyXG4gICAgICogfVxyXG4gICAgICovXHJcbiAgICBfJGdldEFyZWEoZWxlbWVudCkge1xyXG4gICAgICAgIGVsZW1lbnQgPSBlbGVtZW50IHx8IHRoaXMuZWxlbWVudDtcclxuXHJcbiAgICAgICAgdmFyIG9mZnNldCA9IGVsZW1lbnQub2Zmc2V0KCksXHJcbiAgICAgICAgICAgIHdpZHRoID0gZWxlbWVudC53aWR0aCgpLFxyXG4gICAgICAgICAgICBoZWlnaHQgPSBlbGVtZW50LmhlaWdodCgpO1xyXG5cclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICB4MTogb2Zmc2V0LmxlZnQsXHJcbiAgICAgICAgICAgIHkxOiBvZmZzZXQudG9wLFxyXG4gICAgICAgICAgICB4Mjogb2Zmc2V0LmxlZnQgKyB3aWR0aCxcclxuICAgICAgICAgICAgeTI6IG9mZnNldC50b3AgKyBoZWlnaHQsXHJcbiAgICAgICAgICAgIHN1cmZhY2U6IHdpZHRoICogaGVpZ2h0LFxyXG4gICAgICAgICAgICBjb250ZW50SXRlbTogdGhpc1xyXG4gICAgICAgIH07XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBUaGUgdHJlZSBvZiBjb250ZW50IGl0ZW1zIGlzIGNyZWF0ZWQgaW4gdHdvIHN0ZXBzOiBGaXJzdCBhbGwgY29udGVudCBpdGVtcyBhcmUgaW5zdGFudGlhdGVkLFxyXG4gICAgICogdGhlbiBpbml0IGlzIGNhbGxlZCByZWN1cnNpdmVseSBmcm9tIHRvcCB0byBib3R0ZW0uIFRoaXMgaXMgdGhlIGJhc2ljIGluaXQgZnVuY3Rpb24sXHJcbiAgICAgKiBpdCBjYW4gYmUgdXNlZCwgZXh0ZW5kZWQgb3Igb3ZlcndyaXR0ZW4gYnkgdGhlIGNvbnRlbnQgaXRlbXNcclxuICAgICAqXHJcbiAgICAgKiBJdHMgYmVoYXZpb3VyIGRlcGVuZHMgb24gdGhlIGNvbnRlbnQgaXRlbVxyXG4gICAgICpcclxuICAgICAqIEBwYWNrYWdlIHByaXZhdGVcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJucyB7dm9pZH1cclxuICAgICAqL1xyXG4gICAgXyRpbml0KCkge1xyXG4gICAgICAgIHZhciBpO1xyXG4gICAgICAgIHRoaXMuc2V0U2l6ZSgpO1xyXG5cclxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgdGhpcy5jb250ZW50SXRlbXMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgdGhpcy5jaGlsZEVsZW1lbnRDb250YWluZXIuYXBwZW5kKHRoaXMuY29udGVudEl0ZW1zW2ldLmVsZW1lbnQpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5pc0luaXRpYWxpc2VkID0gdHJ1ZTtcclxuICAgICAgICB0aGlzLmVtaXRCdWJibGluZ0V2ZW50KCdpdGVtQ3JlYXRlZCcpO1xyXG4gICAgICAgIHRoaXMuZW1pdEJ1YmJsaW5nRXZlbnQodGhpcy50eXBlICsgJ0NyZWF0ZWQnKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEVtaXQgYW4gZXZlbnQgdGhhdCBidWJibGVzIHVwIHRoZSBpdGVtIHRyZWUuXHJcbiAgICAgKlxyXG4gICAgICogQHBhcmFtICAge1N0cmluZ30gbmFtZSBUaGUgbmFtZSBvZiB0aGUgZXZlbnRcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJucyB7dm9pZH1cclxuICAgICAqL1xyXG4gICAgZW1pdEJ1YmJsaW5nRXZlbnQobmFtZSkge1xyXG4gICAgICAgIHZhciBldmVudCA9IG5ldyBCdWJibGluZ0V2ZW50KG5hbWUsIHRoaXMpO1xyXG4gICAgICAgIHRoaXMuZW1pdChuYW1lLCBldmVudCk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBQcml2YXRlIG1ldGhvZCwgY3JlYXRlcyBhbGwgY29udGVudCBpdGVtcyBmb3IgdGhpcyBub2RlIGF0IGluaXRpYWxpc2F0aW9uIHRpbWVcclxuICAgICAqIFBMRUFTRSBOT1RFLCBwbGVhc2Ugc2VlIGFkZENoaWxkIGZvciBhZGRpbmcgY29udGVudEl0ZW1zIGFkZCBydW50aW1lXHJcbiAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICogQHBhcmFtICAge2NvbmZpZ3VyYXRpb24gaXRlbSBub2RlfSBjb25maWdcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJucyB7dm9pZH1cclxuICAgICAqL1xyXG4gICAgX2NyZWF0ZUNvbnRlbnRJdGVtcyhjb25maWcpIHtcclxuICAgICAgICB2YXIgb0NvbnRlbnRJdGVtLCBpO1xyXG5cclxuICAgICAgICBpZiAoIShjb25maWcuY29udGVudCBpbnN0YW5jZW9mIEFycmF5KSkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgQ29uZmlndXJhdGlvbkVycm9yKCdjb250ZW50IG11c3QgYmUgYW4gQXJyYXknLCBjb25maWcpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IGNvbmZpZy5jb250ZW50Lmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIG9Db250ZW50SXRlbSA9IHRoaXMubGF5b3V0TWFuYWdlci5jcmVhdGVDb250ZW50SXRlbShjb25maWcuY29udGVudFtpXSwgdGhpcyk7XHJcbiAgICAgICAgICAgIHRoaXMuY29udGVudEl0ZW1zLnB1c2gob0NvbnRlbnRJdGVtKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBFeHRlbmRzIGFuIGl0ZW0gY29uZmlndXJhdGlvbiBub2RlIHdpdGggZGVmYXVsdCBzZXR0aW5nc1xyXG4gICAgICogQHByaXZhdGVcclxuICAgICAqIEBwYXJhbSAgIHtjb25maWd1cmF0aW9uIGl0ZW0gbm9kZX0gY29uZmlnXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge2NvbmZpZ3VyYXRpb24gaXRlbSBub2RlfSBleHRlbmRlZCBjb25maWdcclxuICAgICAqL1xyXG4gICAgX2V4dGVuZEl0ZW1Ob2RlKGNvbmZpZykge1xyXG5cclxuICAgICAgICBmb3IgKHZhciBrZXkgaW4gaXRlbURlZmF1bHRDb25maWcpIHtcclxuICAgICAgICAgICAgaWYgKGNvbmZpZ1trZXldID09PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgIGNvbmZpZ1trZXldID0gaXRlbURlZmF1bHRDb25maWdba2V5XTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIGNvbmZpZztcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENhbGxlZCBmb3IgZXZlcnkgZXZlbnQgb24gdGhlIGl0ZW0gdHJlZS4gRGVjaWRlcyB3aGV0aGVyIHRoZSBldmVudCBpcyBhIGJ1YmJsaW5nXHJcbiAgICAgKiBldmVudCBhbmQgcHJvcGFnYXRlcyBpdCB0byBpdHMgcGFyZW50XHJcbiAgICAgKlxyXG4gICAgICogQHBhcmFtICAgIHtTdHJpbmd9IG5hbWUgdGhlIG5hbWUgb2YgdGhlIGV2ZW50XHJcbiAgICAgKiBAcGFyYW0gICB7QnViYmxpbmdFdmVudH0gZXZlbnRcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJucyB7dm9pZH1cclxuICAgICAqL1xyXG4gICAgX3Byb3BhZ2F0ZUV2ZW50KG5hbWUsIGV2ZW50KSB7XHJcbiAgICAgICAgaWYgKGV2ZW50IGluc3RhbmNlb2YgQnViYmxpbmdFdmVudCAmJlxyXG4gICAgICAgICAgICBldmVudC5pc1Byb3BhZ2F0aW9uU3RvcHBlZCA9PT0gZmFsc2UgJiZcclxuICAgICAgICAgICAgdGhpcy5pc0luaXRpYWxpc2VkID09PSB0cnVlKSB7XHJcblxyXG4gICAgICAgICAgICAvKipcclxuICAgICAgICAgICAgICogSW4gc29tZSBjYXNlcyAoZS5nLiBpZiBhbiBlbGVtZW50IGlzIGNyZWF0ZWQgZnJvbSBhIERyYWdTb3VyY2UpIGl0XHJcbiAgICAgICAgICAgICAqIGRvZXNuJ3QgaGF2ZSBhIHBhcmVudCBhbmQgaXMgbm90IGJlbG93IHJvb3QuIElmIHRoYXQncyB0aGUgY2FzZVxyXG4gICAgICAgICAgICAgKiBwcm9wYWdhdGUgdGhlIGJ1YmJsaW5nIGV2ZW50IGZyb20gdGhlIHRvcCBsZXZlbCBvZiB0aGUgc3Vic3RyZWUgZGlyZWN0bHlcclxuICAgICAgICAgICAgICogdG8gdGhlIGxheW91dE1hbmFnZXJcclxuICAgICAgICAgICAgICovXHJcbiAgICAgICAgICAgIGlmICh0aGlzLmlzUm9vdCA9PT0gZmFsc2UgJiYgdGhpcy5wYXJlbnQpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMucGFyZW50LmVtaXQuYXBwbHkodGhpcy5wYXJlbnQsIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMCkpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fc2NoZWR1bGVFdmVudFByb3BhZ2F0aW9uVG9MYXlvdXRNYW5hZ2VyKG5hbWUsIGV2ZW50KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEFsbCByYXcgZXZlbnRzIGJ1YmJsZSB1cCB0byB0aGUgcm9vdCBlbGVtZW50LiBTb21lIGV2ZW50cyB0aGF0XHJcbiAgICAgKiBhcmUgcHJvcGFnYXRlZCB0byAtIGFuZCBlbWl0dGVkIGJ5IC0gdGhlIGxheW91dE1hbmFnZXIgaG93ZXZlciBhcmVcclxuICAgICAqIG9ubHkgc3RyaW5nLWJhc2VkLCBiYXRjaGVkIGFuZCBzYW5pdGl6ZWQgdG8gbWFrZSB0aGVtIG1vcmUgdXNhYmxlXHJcbiAgICAgKlxyXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgdGhlIG5hbWUgb2YgdGhlIGV2ZW50XHJcbiAgICAgKlxyXG4gICAgICogQHByaXZhdGVcclxuICAgICAqIEByZXR1cm5zIHt2b2lkfVxyXG4gICAgICovXHJcbiAgICBfc2NoZWR1bGVFdmVudFByb3BhZ2F0aW9uVG9MYXlvdXRNYW5hZ2VyKG5hbWUsIGV2ZW50KSB7XHJcbiAgICAgICAgaWYgKGluZGV4T2YobmFtZSwgdGhpcy5fdGhyb3R0bGVkRXZlbnRzKSA9PT0gLTEpIHtcclxuICAgICAgICAgICAgdGhpcy5sYXlvdXRNYW5hZ2VyLmVtaXQobmFtZSwgZXZlbnQub3JpZ2luKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5fcGVuZGluZ0V2ZW50UHJvcGFnYXRpb25zW25hbWVdICE9PSB0cnVlKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9wZW5kaW5nRXZlbnRQcm9wYWdhdGlvbnNbbmFtZV0gPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgYW5pbUZyYW1lKGZuQmluZCh0aGlzLl9wcm9wYWdhdGVFdmVudFRvTGF5b3V0TWFuYWdlciwgdGhpcywgW25hbWUsIGV2ZW50XSkpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENhbGxiYWNrIGZvciBldmVudHMgc2NoZWR1bGVkIGJ5IF9zY2hlZHVsZUV2ZW50UHJvcGFnYXRpb25Ub0xheW91dE1hbmFnZXJcclxuICAgICAqXHJcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gbmFtZSB0aGUgbmFtZSBvZiB0aGUgZXZlbnRcclxuICAgICAqXHJcbiAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICogQHJldHVybnMge3ZvaWR9XHJcbiAgICAgKi9cclxuICAgIF9wcm9wYWdhdGVFdmVudFRvTGF5b3V0TWFuYWdlcihuYW1lLCBldmVudCkge1xyXG4gICAgICAgIHRoaXMuX3BlbmRpbmdFdmVudFByb3BhZ2F0aW9uc1tuYW1lXSA9IGZhbHNlO1xyXG4gICAgICAgIHRoaXMubGF5b3V0TWFuYWdlci5lbWl0KG5hbWUsIGV2ZW50KTtcclxuICAgIH1cclxufVxyXG4iLCJpbXBvcnQgQWJzdHJhY3RDb250ZW50SXRlbSBmcm9tICcuLi9pdGVtcy9BYnN0cmFjdENvbnRlbnRJdGVtJ1xyXG5pbXBvcnQgSXRlbUNvbnRhaW5lciBmcm9tICcuLi9jb250YWluZXIvSXRlbUNvbnRhaW5lcidcclxuaW1wb3J0IFJlYWN0Q29tcG9uZW50SGFuZGxlciBmcm9tICcuLi91dGlscy9SZWFjdENvbXBvbmVudEhhbmRsZXInXHJcbmltcG9ydCAkIGZyb20gJ2pxdWVyeSdcclxuLyoqXHJcbiAqIEBwYXJhbSB7W3R5cGVdfSBsYXlvdXRNYW5hZ2VyIFtkZXNjcmlwdGlvbl1cclxuICogQHBhcmFtIHtbdHlwZV19IGNvbmZpZyAgICAgIFtkZXNjcmlwdGlvbl1cclxuICogQHBhcmFtIHtbdHlwZV19IHBhcmVudCAgICAgICAgW2Rlc2NyaXB0aW9uXVxyXG4gKi9cclxuXHJcblxyXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBDb21wb25lbnQgZXh0ZW5kcyBBYnN0cmFjdENvbnRlbnRJdGVtIHtcclxuICAgIGNvbnN0cnVjdG9yKGxheW91dE1hbmFnZXIsIGNvbmZpZywgcGFyZW50KSB7XHJcblxyXG4gICAgICAgIHN1cGVyKGxheW91dE1hbmFnZXIsIGNvbmZpZywgcGFyZW50KTtcclxuXHJcbiAgICAgICAgdmFyIENvbXBvbmVudENvbnN0cnVjdG9yID0gbGF5b3V0TWFuYWdlci5pc1JlYWN0Q29uZmlnKGNvbmZpZykgPyBSZWFjdENvbXBvbmVudEhhbmRsZXIgOiBsYXlvdXRNYW5hZ2VyLmdldENvbXBvbmVudChjb25maWcpLFxyXG4gICAgICAgICAgICBjb21wb25lbnRDb25maWcgPSAkLmV4dGVuZCh0cnVlLCB7fSwgdGhpcy5jb25maWcuY29tcG9uZW50U3RhdGUgfHwge30pO1xyXG5cclxuICAgICAgICBjb21wb25lbnRDb25maWcuY29tcG9uZW50TmFtZSA9IHRoaXMuY29uZmlnLmNvbXBvbmVudE5hbWU7XHJcbiAgICAgICAgdGhpcy5jb21wb25lbnROYW1lID0gdGhpcy5jb25maWcuY29tcG9uZW50TmFtZTtcclxuXHJcbiAgICAgICAgaWYgKHRoaXMuY29uZmlnLnRpdGxlID09PSAnJykge1xyXG4gICAgICAgICAgICB0aGlzLmNvbmZpZy50aXRsZSA9IHRoaXMuY29uZmlnLmNvbXBvbmVudE5hbWU7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLmlzQ29tcG9uZW50ID0gdHJ1ZTtcclxuICAgICAgICB0aGlzLmNvbnRhaW5lciA9IG5ldyBJdGVtQ29udGFpbmVyKHRoaXMuY29uZmlnLCB0aGlzLCBsYXlvdXRNYW5hZ2VyKTtcclxuICAgICAgICB0aGlzLmluc3RhbmNlID0gbmV3IENvbXBvbmVudENvbnN0cnVjdG9yKHRoaXMuY29udGFpbmVyLCBjb21wb25lbnRDb25maWcpO1xyXG4gICAgICAgIHRoaXMuZWxlbWVudCA9IHRoaXMuY29udGFpbmVyLl9lbGVtZW50O1xyXG4gICAgfVxyXG5cclxuICAgIGNsb3NlKCkge1xyXG4gICAgICAgIHRoaXMucGFyZW50LnJlbW92ZUNoaWxkKHRoaXMpO1xyXG4gICAgfVxyXG5cclxuICAgIHNldFNpemUoKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuZWxlbWVudC5jc3MoJ2Rpc3BsYXknKSAhPT0gJ25vbmUnKSB7XHJcbiAgICAgICAgICAgIC8vIERvIG5vdCB1cGRhdGUgc2l6ZSBvZiBoaWRkZW4gY29tcG9uZW50cyB0byBwcmV2ZW50IHVud2FudGVkIHJlZmxvd3NcclxuICAgICAgICAgICAgdGhpcy5jb250YWluZXIuXyRzZXRTaXplKHRoaXMuZWxlbWVudC53aWR0aCgpLCB0aGlzLmVsZW1lbnQuaGVpZ2h0KCkpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBfJGluaXQoKSB7XHJcbiAgICAgICAgQWJzdHJhY3RDb250ZW50SXRlbS5wcm90b3R5cGUuXyRpbml0LmNhbGwodGhpcyk7XHJcbiAgICAgICAgdGhpcy5jb250YWluZXIuZW1pdCgnb3BlbicpO1xyXG4gICAgfVxyXG5cclxuICAgIF8kaGlkZSgpIHtcclxuICAgICAgICB0aGlzLmNvbnRhaW5lci5oaWRlKCk7XHJcbiAgICAgICAgQWJzdHJhY3RDb250ZW50SXRlbS5wcm90b3R5cGUuXyRoaWRlLmNhbGwodGhpcyk7XHJcbiAgICB9XHJcblxyXG4gICAgXyRzaG93KCkge1xyXG4gICAgICAgIHRoaXMuY29udGFpbmVyLnNob3coKTtcclxuICAgICAgICBBYnN0cmFjdENvbnRlbnRJdGVtLnByb3RvdHlwZS5fJHNob3cuY2FsbCh0aGlzKTtcclxuICAgIH1cclxuXHJcbiAgICBfJHNob3duKCkge1xyXG4gICAgICAgIHRoaXMuY29udGFpbmVyLnNob3duKCk7XHJcbiAgICAgICAgQWJzdHJhY3RDb250ZW50SXRlbS5wcm90b3R5cGUuXyRzaG93bi5jYWxsKHRoaXMpO1xyXG4gICAgfVxyXG5cclxuICAgIF8kZGVzdHJveSgpIHtcclxuICAgICAgICB0aGlzLmNvbnRhaW5lci5lbWl0KCdkZXN0cm95JywgdGhpcyk7XHJcbiAgICAgICAgQWJzdHJhY3RDb250ZW50SXRlbS5wcm90b3R5cGUuXyRkZXN0cm95LmNhbGwodGhpcyk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBEcmFnZ2luZyBvbnRvIGEgY29tcG9uZW50IGRpcmVjdGx5IGlzIG5vdCBhbiBvcHRpb25cclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJucyBudWxsXHJcbiAgICAgKi9cclxuICAgIF8kZ2V0QXJlYSgpIHtcclxuICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgIH1cclxufVxyXG4iLCJpbXBvcnQgQWJzdHJhY3RDb250ZW50SXRlbSBmcm9tICcuLi9pdGVtcy9BYnN0cmFjdENvbnRlbnRJdGVtJ1xyXG5pbXBvcnQgUm93T3JDb2x1bW4gZnJvbSAnLi4vaXRlbXMvUm93T3JDb2x1bW4nXHJcbmltcG9ydCAkIGZyb20gJ2pxdWVyeSdcclxuXHJcblxyXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBSb290IGV4dGVuZHMgQWJzdHJhY3RDb250ZW50SXRlbSB7XHJcbiAgICBjb25zdHJ1Y3RvcihsYXlvdXRNYW5hZ2VyLCBjb25maWcsIGNvbnRhaW5lckVsZW1lbnQpIHtcclxuICAgICAgXHJcbiAgICAgICAgc3VwZXIobGF5b3V0TWFuYWdlciwgY29uZmlnLCBudWxsKTtcclxuXHJcbiAgICAgICAgdGhpcy5pc1Jvb3QgPSB0cnVlO1xyXG4gICAgICAgIHRoaXMudHlwZSA9ICdyb290JztcclxuICAgICAgICB0aGlzLmVsZW1lbnQgPSAkKCc8ZGl2IGNsYXNzPVwibG1fZ29sZGVubGF5b3V0IGxtX2l0ZW0gbG1fcm9vdFwiPjwvZGl2PicpO1xyXG4gICAgICAgIHRoaXMuY2hpbGRFbGVtZW50Q29udGFpbmVyID0gdGhpcy5lbGVtZW50O1xyXG4gICAgICAgIHRoaXMuX2NvbnRhaW5lckVsZW1lbnQgPSBjb250YWluZXJFbGVtZW50O1xyXG4gICAgICAgIHRoaXMuX2NvbnRhaW5lckVsZW1lbnQuYXBwZW5kKHRoaXMuZWxlbWVudCk7XHJcbiAgICB9XHJcblxyXG4gICAgYWRkQ2hpbGQoY29udGVudEl0ZW0pIHtcclxuICAgICAgICBpZiAodGhpcy5jb250ZW50SXRlbXMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Jvb3Qgbm9kZSBjYW4gb25seSBoYXZlIGEgc2luZ2xlIGNoaWxkJyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb250ZW50SXRlbSA9IHRoaXMubGF5b3V0TWFuYWdlci5fJG5vcm1hbGl6ZUNvbnRlbnRJdGVtKGNvbnRlbnRJdGVtLCB0aGlzKTtcclxuICAgICAgICB0aGlzLmNoaWxkRWxlbWVudENvbnRhaW5lci5hcHBlbmQoY29udGVudEl0ZW0uZWxlbWVudCk7XHJcbiAgICAgICAgQWJzdHJhY3RDb250ZW50SXRlbS5wcm90b3R5cGUuYWRkQ2hpbGQuY2FsbCh0aGlzLCBjb250ZW50SXRlbSk7XHJcblxyXG4gICAgICAgIHRoaXMuY2FsbERvd253YXJkcygnc2V0U2l6ZScpO1xyXG4gICAgICAgIHRoaXMuZW1pdEJ1YmJsaW5nRXZlbnQoJ3N0YXRlQ2hhbmdlZCcpO1xyXG4gICAgfVxyXG5cclxuICAgIHNldFNpemUod2lkdGgsIGhlaWdodCkge1xyXG4gICAgICAgIHdpZHRoID0gKHR5cGVvZiB3aWR0aCA9PT0gJ3VuZGVmaW5lZCcpID8gdGhpcy5fY29udGFpbmVyRWxlbWVudC53aWR0aCgpIDogd2lkdGg7XHJcbiAgICAgICAgaGVpZ2h0ID0gKHR5cGVvZiBoZWlnaHQgPT09ICd1bmRlZmluZWQnKSA/IHRoaXMuX2NvbnRhaW5lckVsZW1lbnQuaGVpZ2h0KCkgOiBoZWlnaHQ7XHJcblxyXG4gICAgICAgIHRoaXMuZWxlbWVudC53aWR0aCh3aWR0aCk7XHJcbiAgICAgICAgdGhpcy5lbGVtZW50LmhlaWdodChoZWlnaHQpO1xyXG5cclxuICAgICAgICAvKlxyXG4gICAgICAgICAqIFJvb3QgY2FuIGJlIGVtcHR5XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgaWYgKHRoaXMuY29udGVudEl0ZW1zWzBdKSB7XHJcbiAgICAgICAgICAgIHRoaXMuY29udGVudEl0ZW1zWzBdLmVsZW1lbnQud2lkdGgod2lkdGgpO1xyXG4gICAgICAgICAgICB0aGlzLmNvbnRlbnRJdGVtc1swXS5lbGVtZW50LmhlaWdodChoZWlnaHQpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBfJGhpZ2hsaWdodERyb3Bab25lKHgsIHksIGFyZWEpIHtcclxuICAgICAgICB0aGlzLmxheW91dE1hbmFnZXIudGFiRHJvcFBsYWNlaG9sZGVyLnJlbW92ZSgpO1xyXG4gICAgICAgIEFic3RyYWN0Q29udGVudEl0ZW0ucHJvdG90eXBlLl8kaGlnaGxpZ2h0RHJvcFpvbmUuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcclxuICAgIH1cclxuXHJcbiAgICBfJG9uRHJvcChjb250ZW50SXRlbSwgYXJlYSkge1xyXG4gICAgICAgIHZhciBzdGFjaztcclxuXHJcbiAgICAgICAgaWYgKGNvbnRlbnRJdGVtLmlzQ29tcG9uZW50KSB7XHJcbiAgICAgICAgICAgIHN0YWNrID0gdGhpcy5sYXlvdXRNYW5hZ2VyLmNyZWF0ZUNvbnRlbnRJdGVtKHtcclxuICAgICAgICAgICAgICAgIHR5cGU6ICdzdGFjaycsXHJcbiAgICAgICAgICAgICAgICBoZWFkZXI6IGNvbnRlbnRJdGVtLmNvbmZpZy5oZWFkZXIgfHwge31cclxuICAgICAgICAgICAgfSwgdGhpcyk7XHJcbiAgICAgICAgICAgIHN0YWNrLl8kaW5pdCgpO1xyXG4gICAgICAgICAgICBzdGFjay5hZGRDaGlsZChjb250ZW50SXRlbSk7XHJcbiAgICAgICAgICAgIGNvbnRlbnRJdGVtID0gc3RhY2s7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoIXRoaXMuY29udGVudEl0ZW1zLmxlbmd0aCkge1xyXG4gICAgICAgICAgICB0aGlzLmFkZENoaWxkKGNvbnRlbnRJdGVtKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAvKlxyXG4gICAgICAgICAgICAgKiBJZiB0aGUgY29udGVudEl0ZW0gdGhhdCdzIGJlaW5nIGRyb3BwZWQgaXMgbm90IGRyb3BwZWQgb24gYSBTdGFjayAoY2FzZXMgd2hpY2gganVzdCBwYXNzZWQgYWJvdmUgYW5kIFxyXG4gICAgICAgICAgICAgKiB3aGljaCB3b3VsZCB3cmFwIHRoZSBjb250ZW50SXRlbSBpbiBhIFN0YWNrKSB3ZSBuZWVkIHRvIGNoZWNrIHdoZXRoZXIgY29udGVudEl0ZW0gaXMgYSBSb3dPckNvbHVtbi5cclxuICAgICAgICAgICAgICogSWYgaXQgaXMsIHdlIG5lZWQgdG8gcmUtd3JhcCBpdCBpbiBhIFN0YWNrIGxpa2UgaXQgd2FzIHdoZW4gaXQgd2FzIGRyYWdnZWQgYnkgaXRzIFRhYiAoaXQgd2FzIGRyYWdnZWQhKS5cclxuICAgICAgICAgICAgICovXHJcbiAgICAgICAgICAgIGlmKGNvbnRlbnRJdGVtLmNvbmZpZy50eXBlID09PSAncm93JyB8fCBjb250ZW50SXRlbS5jb25maWcudHlwZSA9PT0gJ2NvbHVtbicpe1xyXG4gICAgICAgICAgICAgICAgc3RhY2sgPSB0aGlzLmxheW91dE1hbmFnZXIuY3JlYXRlQ29udGVudEl0ZW0oe1xyXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdGFjaydcclxuICAgICAgICAgICAgICAgIH0sIHRoaXMpXHJcbiAgICAgICAgICAgICAgICBzdGFjay5hZGRDaGlsZChjb250ZW50SXRlbSlcclxuICAgICAgICAgICAgICAgIGNvbnRlbnRJdGVtID0gc3RhY2tcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgdmFyIHR5cGUgPSBhcmVhLnNpZGVbMF0gPT0gJ3gnID8gJ3JvdycgOiAnY29sdW1uJztcclxuICAgICAgICAgICAgdmFyIGRpbWVuc2lvbiA9IGFyZWEuc2lkZVswXSA9PSAneCcgPyAnd2lkdGgnIDogJ2hlaWdodCc7XHJcbiAgICAgICAgICAgIHZhciBpbnNlcnRCZWZvcmUgPSBhcmVhLnNpZGVbMV0gPT0gJzInO1xyXG4gICAgICAgICAgICB2YXIgY29sdW1uID0gdGhpcy5jb250ZW50SXRlbXNbMF07XHJcbiAgICAgICAgICAgIGlmICghKGNvbHVtbiBpbnN0YW5jZW9mIFJvd09yQ29sdW1uKSB8fCBjb2x1bW4udHlwZSAhPSB0eXBlKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgcm93T3JDb2x1bW4gPSB0aGlzLmxheW91dE1hbmFnZXIuY3JlYXRlQ29udGVudEl0ZW0oe1xyXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6IHR5cGVcclxuICAgICAgICAgICAgICAgIH0sIHRoaXMpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5yZXBsYWNlQ2hpbGQoY29sdW1uLCByb3dPckNvbHVtbik7XHJcbiAgICAgICAgICAgICAgICByb3dPckNvbHVtbi5hZGRDaGlsZChjb250ZW50SXRlbSwgaW5zZXJ0QmVmb3JlID8gMCA6IHVuZGVmaW5lZCwgdHJ1ZSk7XHJcbiAgICAgICAgICAgICAgICByb3dPckNvbHVtbi5hZGRDaGlsZChjb2x1bW4sIGluc2VydEJlZm9yZSA/IHVuZGVmaW5lZCA6IDAsIHRydWUpO1xyXG4gICAgICAgICAgICAgICAgY29sdW1uLmNvbmZpZ1tkaW1lbnNpb25dID0gNTA7XHJcbiAgICAgICAgICAgICAgICBjb250ZW50SXRlbS5jb25maWdbZGltZW5zaW9uXSA9IDUwO1xyXG4gICAgICAgICAgICAgICAgcm93T3JDb2x1bW4uY2FsbERvd253YXJkcygnc2V0U2l6ZScpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgdmFyIHNpYmJsaW5nID0gY29sdW1uLmNvbnRlbnRJdGVtc1tpbnNlcnRCZWZvcmUgPyAwIDogY29sdW1uLmNvbnRlbnRJdGVtcy5sZW5ndGggLSAxXVxyXG4gICAgICAgICAgICAgICAgY29sdW1uLmFkZENoaWxkKGNvbnRlbnRJdGVtLCBpbnNlcnRCZWZvcmUgPyAwIDogdW5kZWZpbmVkLCB0cnVlKTtcclxuICAgICAgICAgICAgICAgIHNpYmJsaW5nLmNvbmZpZ1tkaW1lbnNpb25dICo9IDAuNTtcclxuICAgICAgICAgICAgICAgIGNvbnRlbnRJdGVtLmNvbmZpZ1tkaW1lbnNpb25dID0gc2liYmxpbmcuY29uZmlnW2RpbWVuc2lvbl07XHJcbiAgICAgICAgICAgICAgICBjb2x1bW4uY2FsbERvd253YXJkcygnc2V0U2l6ZScpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59XHJcbiIsImltcG9ydCBBYnN0cmFjdENvbnRlbnRJdGVtIGZyb20gJy4uL2l0ZW1zL0Fic3RyYWN0Q29udGVudEl0ZW0nXHJcbmltcG9ydCBTdGFjayBmcm9tICcuLi9pdGVtcy9TdGFjaydcclxuaW1wb3J0IFNwbGl0dGVyIGZyb20gJy4uL2NvbnRyb2xzL1NwbGl0dGVyJ1xyXG5pbXBvcnQge1xyXG4gICAgZm5CaW5kLFxyXG4gICAgYW5pbUZyYW1lLFxyXG4gICAgaW5kZXhPZlxyXG59IGZyb20gJy4uL3V0aWxzL3V0aWxzJ1xyXG5pbXBvcnQgJCBmcm9tICdqcXVlcnknXHJcblxyXG5cclxuXHJcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFJvd09yQ29sdW1uIGV4dGVuZHMgQWJzdHJhY3RDb250ZW50SXRlbSB7XHJcbiAgICBjb25zdHJ1Y3Rvcihpc0NvbHVtbiwgbGF5b3V0TWFuYWdlciwgY29uZmlnLCBwYXJlbnQpIHtcclxuICAgICAgXHJcbiAgICAgICAgc3VwZXIobGF5b3V0TWFuYWdlciwgY29uZmlnLCBwYXJlbnQpO1xyXG5cclxuICAgICAgICB0aGlzLmlzUm93ID0gIWlzQ29sdW1uO1xyXG4gICAgICAgIHRoaXMuaXNDb2x1bW4gPSBpc0NvbHVtbjtcclxuXHJcbiAgICAgICAgdGhpcy5lbGVtZW50ID0gJCgnPGRpdiBjbGFzcz1cImxtX2l0ZW0gbG1fJyArIChpc0NvbHVtbiA/ICdjb2x1bW4nIDogJ3JvdycpICsgJ1wiPjwvZGl2PicpO1xyXG4gICAgICAgIHRoaXMuY2hpbGRFbGVtZW50Q29udGFpbmVyID0gdGhpcy5lbGVtZW50O1xyXG4gICAgICAgIHRoaXMuX3NwbGl0dGVyU2l6ZSA9IGxheW91dE1hbmFnZXIuY29uZmlnLmRpbWVuc2lvbnMuYm9yZGVyV2lkdGg7XHJcbiAgICAgICAgdGhpcy5fc3BsaXR0ZXJHcmFiU2l6ZSA9IGxheW91dE1hbmFnZXIuY29uZmlnLmRpbWVuc2lvbnMuYm9yZGVyR3JhYldpZHRoO1xyXG4gICAgICAgIHRoaXMuX2lzQ29sdW1uID0gaXNDb2x1bW47XHJcbiAgICAgICAgdGhpcy5fZGltZW5zaW9uID0gaXNDb2x1bW4gPyAnaGVpZ2h0JyA6ICd3aWR0aCc7XHJcbiAgICAgICAgdGhpcy5fc3BsaXR0ZXIgPSBbXTtcclxuICAgICAgICB0aGlzLl9zcGxpdHRlclBvc2l0aW9uID0gbnVsbDtcclxuICAgICAgICB0aGlzLl9zcGxpdHRlck1pblBvc2l0aW9uID0gbnVsbDtcclxuICAgICAgICB0aGlzLl9zcGxpdHRlck1heFBvc2l0aW9uID0gbnVsbDtcclxuICAgIH1cclxuXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBBZGQgYSBuZXcgY29udGVudEl0ZW0gdG8gdGhlIFJvdyBvciBDb2x1bW5cclxuICAgICAqXHJcbiAgICAgKiBAcGFyYW0ge0Fic3RyYWN0Q29udGVudEl0ZW19IGNvbnRlbnRJdGVtXHJcbiAgICAgKiBAcGFyYW0ge1tpbnRdfSBpbmRleCBUaGUgcG9zaXRpb24gb2YgdGhlIG5ldyBpdGVtIHdpdGhpbiB0aGUgUm93IG9yIENvbHVtbi5cclxuICAgICAqICAgICAgICAgICAgICAgICAgICAgIElmIG5vIGluZGV4IGlzIHByb3ZpZGVkIHRoZSBpdGVtIHdpbGwgYmUgYWRkZWQgdG8gdGhlIGVuZFxyXG4gICAgICogQHBhcmFtIHtbYm9vbF19IF8kc3VzcGVuZFJlc2l6ZSBJZiB0cnVlIHRoZSBpdGVtcyB3b24ndCBiZSByZXNpemVkLiBUaGlzIHdpbGwgbGVhdmUgdGhlIGl0ZW0gaW5cclxuICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYW4gaW5jb25zaXN0ZW50IHN0YXRlIGFuZCBpcyBvbmx5IGludGVuZGVkIHRvIGJlIHVzZWQgaWYgbXVsdGlwbGVcclxuICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2hpbGRyZW4gbmVlZCB0byBiZSBhZGRlZCBpbiBvbmUgZ28gYW5kIHJlc2l6ZSBpcyBjYWxsZWQgYWZ0ZXJ3YXJkc1xyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHt2b2lkfVxyXG4gICAgICovXHJcbiAgICBhZGRDaGlsZChjb250ZW50SXRlbSwgaW5kZXgsIF8kc3VzcGVuZFJlc2l6ZSkge1xyXG5cclxuICAgICAgICB2YXIgbmV3SXRlbVNpemUsIGl0ZW1TaXplLCBpLCBzcGxpdHRlckVsZW1lbnQ7XHJcblxyXG4gICAgICAgIGNvbnRlbnRJdGVtID0gdGhpcy5sYXlvdXRNYW5hZ2VyLl8kbm9ybWFsaXplQ29udGVudEl0ZW0oY29udGVudEl0ZW0sIHRoaXMpO1xyXG5cclxuICAgICAgICBpZiAoaW5kZXggPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICBpbmRleCA9IHRoaXMuY29udGVudEl0ZW1zLmxlbmd0aDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICh0aGlzLmNvbnRlbnRJdGVtcy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICAgIHNwbGl0dGVyRWxlbWVudCA9IHRoaXMuX2NyZWF0ZVNwbGl0dGVyKE1hdGgubWF4KDAsIGluZGV4IC0gMSkpLmVsZW1lbnQ7XHJcblxyXG4gICAgICAgICAgICBpZiAoaW5kZXggPiAwKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmNvbnRlbnRJdGVtc1tpbmRleCAtIDFdLmVsZW1lbnQuYWZ0ZXIoc3BsaXR0ZXJFbGVtZW50KTtcclxuICAgICAgICAgICAgICAgIHNwbGl0dGVyRWxlbWVudC5hZnRlcihjb250ZW50SXRlbS5lbGVtZW50KTtcclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9pc0RvY2tlZChpbmRleCAtIDEpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fc3BsaXR0ZXJbaW5kZXggLSAxXS5lbGVtZW50LmhpZGUoKTtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9zcGxpdHRlcltpbmRleF0uZWxlbWVudC5zaG93KCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmNvbnRlbnRJdGVtc1swXS5lbGVtZW50LmJlZm9yZShzcGxpdHRlckVsZW1lbnQpO1xyXG4gICAgICAgICAgICAgICAgc3BsaXR0ZXJFbGVtZW50LmJlZm9yZShjb250ZW50SXRlbS5lbGVtZW50KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMuY2hpbGRFbGVtZW50Q29udGFpbmVyLmFwcGVuZChjb250ZW50SXRlbS5lbGVtZW50KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIEFic3RyYWN0Q29udGVudEl0ZW0ucHJvdG90eXBlLmFkZENoaWxkLmNhbGwodGhpcywgY29udGVudEl0ZW0sIGluZGV4KTtcclxuXHJcbiAgICAgICAgbmV3SXRlbVNpemUgPSAoMSAvIHRoaXMuY29udGVudEl0ZW1zLmxlbmd0aCkgKiAxMDA7XHJcblxyXG4gICAgICAgIGlmIChfJHN1c3BlbmRSZXNpemUgPT09IHRydWUpIHtcclxuICAgICAgICAgICAgdGhpcy5lbWl0QnViYmxpbmdFdmVudCgnc3RhdGVDaGFuZ2VkJyk7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCB0aGlzLmNvbnRlbnRJdGVtcy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5jb250ZW50SXRlbXNbaV0gPT09IGNvbnRlbnRJdGVtKSB7XHJcbiAgICAgICAgICAgICAgICBjb250ZW50SXRlbS5jb25maWdbdGhpcy5fZGltZW5zaW9uXSA9IG5ld0l0ZW1TaXplO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgaXRlbVNpemUgPSB0aGlzLmNvbnRlbnRJdGVtc1tpXS5jb25maWdbdGhpcy5fZGltZW5zaW9uXSAqPSAoMTAwIC0gbmV3SXRlbVNpemUpIC8gMTAwO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5jb250ZW50SXRlbXNbaV0uY29uZmlnW3RoaXMuX2RpbWVuc2lvbl0gPSBpdGVtU2l6ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5jYWxsRG93bndhcmRzKCdzZXRTaXplJyk7XHJcbiAgICAgICAgdGhpcy5lbWl0QnViYmxpbmdFdmVudCgnc3RhdGVDaGFuZ2VkJyk7XHJcbiAgICAgICAgdGhpcy5fdmFsaWRhdGVEb2NraW5nKCk7XHJcbiAgICB9XHJcblxyXG5cclxuICAgIC8qKlxyXG4gICAgICogVW5kaXNwbGF5cyBhIGNoaWxkIG9mIHRoaXMgZWxlbWVudFxyXG4gICAgICpcclxuICAgICAqIEBwYXJhbSAgIHtBYnN0cmFjdENvbnRlbnRJdGVtfSBjb250ZW50SXRlbVxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHt2b2lkfVxyXG4gICAgICovXHJcbiAgICB1bmRpc3BsYXlDaGlsZChjb250ZW50SXRlbSkge1xyXG4gICAgICAgIHZhciB1bmRpc3BsYXllZEl0ZW1TaXplID0gY29udGVudEl0ZW0uY29uZmlnW3RoaXMuX2RpbWVuc2lvbl0sXHJcbiAgICAgICAgICAgIGluZGV4ID0gaW5kZXhPZihjb250ZW50SXRlbSwgdGhpcy5jb250ZW50SXRlbXMpLFxyXG4gICAgICAgICAgICBzcGxpdHRlckluZGV4ID0gTWF0aC5tYXgoaW5kZXggLSAxLCAwKSxcclxuICAgICAgICAgICAgaSxcclxuICAgICAgICAgICAgY2hpbGRJdGVtO1xyXG5cclxuICAgICAgICBpZiAoaW5kZXggPT09IC0xKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignQ2FuXFwndCB1bmRpc3BsYXkgY2hpbGQuIENvbnRlbnRJdGVtIGlzIG5vdCBjaGlsZCBvZiB0aGlzIFJvdyBvciBDb2x1bW4nKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIEhpZGUgdGhlIHNwbGl0dGVyIGJlZm9yZSB0aGUgaXRlbSBvciBhZnRlciBpZiB0aGUgaXRlbSBoYXBwZW5zXHJcbiAgICAgICAgICogdG8gYmUgdGhlIGZpcnN0IGluIHRoZSByb3cvY29sdW1uXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgaWYgKHRoaXMuX3NwbGl0dGVyW3NwbGl0dGVySW5kZXhdKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX3NwbGl0dGVyW3NwbGl0dGVySW5kZXhdLmVsZW1lbnQuaGlkZSgpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKHNwbGl0dGVySW5kZXggPCB0aGlzLl9zcGxpdHRlci5sZW5ndGgpIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMuX2lzRG9ja2VkKHNwbGl0dGVySW5kZXgpKVxyXG4gICAgICAgICAgICAgICAgdGhpcy5fc3BsaXR0ZXJbc3BsaXR0ZXJJbmRleF0uZWxlbWVudC5oaWRlKCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBBbGxvY2F0ZSB0aGUgc3BhY2UgdGhhdCB0aGUgaGlkZGVuIGl0ZW0gb2NjdXBpZWQgdG8gdGhlIHJlbWFpbmluZyBpdGVtc1xyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHZhciBkb2NrZWQgPSB0aGlzLl9pc0RvY2tlZCgpO1xyXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCB0aGlzLmNvbnRlbnRJdGVtcy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5jb250ZW50SXRlbXNbaV0gIT09IGNvbnRlbnRJdGVtKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuX2lzRG9ja2VkKGkpKVxyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY29udGVudEl0ZW1zW2ldLmNvbmZpZ1t0aGlzLl9kaW1lbnNpb25dICs9IHVuZGlzcGxheWVkSXRlbVNpemUgLyAodGhpcy5jb250ZW50SXRlbXMubGVuZ3RoIC0gMSAtIGRvY2tlZCk7ICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgIHRoaXMuY29udGVudEl0ZW1zW2ldLmNvbmZpZ1t0aGlzLl9kaW1lbnNpb25dID0gMFxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZih0aGlzLmNvbnRlbnRJdGVtcy5sZW5ndGggPT09IDEpe1xyXG4gICAgICAgICAgICBBYnN0cmFjdENvbnRlbnRJdGVtLnByb3RvdHlwZS51bmRpc3BsYXlDaGlsZC5jYWxsKHRoaXMsIGNvbnRlbnRJdGVtKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMuY2FsbERvd253YXJkcygnc2V0U2l6ZScpO1xyXG4gICAgICAgIHRoaXMuZW1pdEJ1YmJsaW5nRXZlbnQoJ3N0YXRlQ2hhbmdlZCcpO1xyXG4gICAgfVxyXG5cclxuXHJcbiAgICAvKipcclxuICAgICAqIFJlbW92ZXMgYSBjaGlsZCBvZiB0aGlzIGVsZW1lbnRcclxuICAgICAqXHJcbiAgICAgKiBAcGFyYW0gICB7QWJzdHJhY3RDb250ZW50SXRlbX0gY29udGVudEl0ZW1cclxuICAgICAqIEBwYXJhbSAgIHtib29sZWFufSBrZWVwQ2hpbGQgICBJZiB0cnVlIHRoZSBjaGlsZCB3aWxsIGJlIHJlbW92ZWQsIGJ1dCBub3QgZGVzdHJveWVkXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge3ZvaWR9XHJcbiAgICAgKi9cclxuICAgIHJlbW92ZUNoaWxkKGNvbnRlbnRJdGVtLCBrZWVwQ2hpbGQpIHtcclxuICAgICAgICB2YXIgcmVtb3ZlZEl0ZW1TaXplID0gY29udGVudEl0ZW0uY29uZmlnW3RoaXMuX2RpbWVuc2lvbl0sXHJcbiAgICAgICAgICAgIGluZGV4ID0gaW5kZXhPZihjb250ZW50SXRlbSwgdGhpcy5jb250ZW50SXRlbXMpLFxyXG4gICAgICAgICAgICBzcGxpdHRlckluZGV4ID0gTWF0aC5tYXgoaW5kZXggLSAxLCAwKSxcclxuICAgICAgICAgICAgaSxcclxuICAgICAgICAgICAgY2hpbGRJdGVtO1xyXG4gICAgICAgIGlmIChpbmRleCA9PT0gLTEpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdDYW5cXCd0IHJlbW92ZSBjaGlsZC4gQ29udGVudEl0ZW0gaXMgbm90IGNoaWxkIG9mIHRoaXMgUm93IG9yIENvbHVtbicpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogUmVtb3ZlIHRoZSBzcGxpdHRlciBiZWZvcmUgdGhlIGl0ZW0gb3IgYWZ0ZXIgaWYgdGhlIGl0ZW0gaGFwcGVuc1xyXG4gICAgICAgICAqIHRvIGJlIHRoZSBmaXJzdCBpbiB0aGUgcm93L2NvbHVtblxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGlmICh0aGlzLl9zcGxpdHRlcltzcGxpdHRlckluZGV4XSkge1xyXG4gICAgICAgICAgICB0aGlzLl9zcGxpdHRlcltzcGxpdHRlckluZGV4XS5fJGRlc3Ryb3koKTtcclxuICAgICAgICAgICAgdGhpcy5fc3BsaXR0ZXIuc3BsaWNlKHNwbGl0dGVySW5kZXgsIDEpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKHNwbGl0dGVySW5kZXggPCB0aGlzLl9zcGxpdHRlci5sZW5ndGgpIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMuX2lzRG9ja2VkKHNwbGl0dGVySW5kZXgpKVxyXG4gICAgICAgICAgICAgICAgdGhpcy5fc3BsaXR0ZXJbc3BsaXR0ZXJJbmRleF0uZWxlbWVudC5oaWRlKCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIEFsbG9jYXRlIHRoZSBzcGFjZSB0aGF0IHRoZSByZW1vdmVkIGl0ZW0gb2NjdXBpZWQgdG8gdGhlIHJlbWFpbmluZyBpdGVtc1xyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHZhciBkb2NrZWQgPSB0aGlzLl9pc0RvY2tlZCgpO1xyXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCB0aGlzLmNvbnRlbnRJdGVtcy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5jb250ZW50SXRlbXNbaV0gIT09IGNvbnRlbnRJdGVtKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuX2lzRG9ja2VkKGkpKVxyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY29udGVudEl0ZW1zW2ldLmNvbmZpZ1t0aGlzLl9kaW1lbnNpb25dICs9IHJlbW92ZWRJdGVtU2l6ZSAvICh0aGlzLmNvbnRlbnRJdGVtcy5sZW5ndGggLSAxIC0gZG9ja2VkKTtcclxuXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIEFic3RyYWN0Q29udGVudEl0ZW0ucHJvdG90eXBlLnJlbW92ZUNoaWxkLmNhbGwodGhpcywgY29udGVudEl0ZW0sIGtlZXBDaGlsZCk7XHJcblxyXG4gICAgICAgIGlmICh0aGlzLmNvbnRlbnRJdGVtcy5sZW5ndGggPT09IDEgJiYgdGhpcy5jb25maWcuaXNDbG9zYWJsZSA9PT0gdHJ1ZSkge1xyXG4gICAgICAgICAgICBjaGlsZEl0ZW0gPSB0aGlzLmNvbnRlbnRJdGVtc1swXTtcclxuICAgICAgICAgICAgdGhpcy5jb250ZW50SXRlbXMgPSBbXTtcclxuICAgICAgICAgICAgdGhpcy5wYXJlbnQucmVwbGFjZUNoaWxkKHRoaXMsIGNoaWxkSXRlbSwgdHJ1ZSk7XHJcbiAgICAgICAgICAgIHRoaXMuX3ZhbGlkYXRlRG9ja2luZyh0aGlzLnBhcmVudCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgdGhpcy5jYWxsRG93bndhcmRzKCdzZXRTaXplJyk7XHJcbiAgICAgICAgICAgIHRoaXMuZW1pdEJ1YmJsaW5nRXZlbnQoJ3N0YXRlQ2hhbmdlZCcpO1xyXG4gICAgICAgICAgICB0aGlzLl92YWxpZGF0ZURvY2tpbmcoKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSZXBsYWNlcyBhIGNoaWxkIG9mIHRoaXMgUm93IG9yIENvbHVtbiB3aXRoIGFub3RoZXIgY29udGVudEl0ZW1cclxuICAgICAqXHJcbiAgICAgKiBAcGFyYW0gICB7QWJzdHJhY3RDb250ZW50SXRlbX0gb2xkQ2hpbGRcclxuICAgICAqIEBwYXJhbSAgIHtBYnN0cmFjdENvbnRlbnRJdGVtfSBuZXdDaGlsZFxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHt2b2lkfVxyXG4gICAgICovXHJcbiAgICByZXBsYWNlQ2hpbGQob2xkQ2hpbGQsIG5ld0NoaWxkKSB7XHJcbiAgICAgICAgdmFyIHNpemUgPSBvbGRDaGlsZC5jb25maWdbdGhpcy5fZGltZW5zaW9uXTtcclxuICAgICAgICBBYnN0cmFjdENvbnRlbnRJdGVtLnByb3RvdHlwZS5yZXBsYWNlQ2hpbGQuY2FsbCh0aGlzLCBvbGRDaGlsZCwgbmV3Q2hpbGQpO1xyXG4gICAgICAgIG5ld0NoaWxkLmNvbmZpZ1t0aGlzLl9kaW1lbnNpb25dID0gc2l6ZTtcclxuICAgICAgICB0aGlzLmNhbGxEb3dud2FyZHMoJ3NldFNpemUnKTtcclxuICAgICAgICB0aGlzLmVtaXRCdWJibGluZ0V2ZW50KCdzdGF0ZUNoYW5nZWQnKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENhbGxlZCB3aGVuZXZlciB0aGUgZGltZW5zaW9ucyBvZiB0aGlzIGl0ZW0gb3Igb25lIG9mIGl0cyBwYXJlbnRzIGNoYW5nZVxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHt2b2lkfVxyXG4gICAgICovXHJcbiAgICBzZXRTaXplKCkge1xyXG4gICAgICAgIGlmICh0aGlzLmNvbnRlbnRJdGVtcy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2NhbGN1bGF0ZVJlbGF0aXZlU2l6ZXMoKTtcclxuICAgICAgICAgICAgdGhpcy5fc2V0QWJzb2x1dGVTaXplcygpO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLmVtaXRCdWJibGluZ0V2ZW50KCdzdGF0ZUNoYW5nZWQnKTtcclxuICAgICAgICB0aGlzLmVtaXQoJ3Jlc2l6ZScpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogRG9jayBvciB1bmRvY2sgYSBjaGlsZCBpZiBpdCBwb3NpaWJsZVxyXG4gICAgICpcclxuICAgICAqIEBwYXJhbSAgIHtBYnN0cmFjdENvbnRlbnRJdGVtfSBjb250ZW50SXRlbVxyXG4gICAgICogQHBhcmFtICAge0Jvb2xlYW59IG1vZGUgb3IgdG9nZ2xlIGlmIHVuZGVmaW5lZFxyXG4gICAgICogQHBhcmFtICAge0Jvb2xlYW59IGNvbGxhcHNlZCBhZnRlciBkb2NraW5nXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge3ZvaWR9XHJcbiAgICAgKi9cclxuICAgIGRvY2soY29udGVudEl0ZW0sIG1vZGUsIGNvbGxhcHNlZCkge1xyXG4gICAgICAgIGlmICh0aGlzLmNvbnRlbnRJdGVtcy5sZW5ndGggPT09IDEpXHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignQ2FuXFwndCBkb2NrIGNoaWxkIHdoZW4gaXQgc2luZ2xlJyk7XHJcblxyXG4gICAgICAgIHZhciByZW1vdmVkSXRlbVNpemUgPSBjb250ZW50SXRlbS5jb25maWdbdGhpcy5fZGltZW5zaW9uXSxcclxuICAgICAgICAgICAgaGVhZGVyU2l6ZSA9IHRoaXMubGF5b3V0TWFuYWdlci5jb25maWcuZGltZW5zaW9ucy5oZWFkZXJIZWlnaHQsXHJcbiAgICAgICAgICAgIGluZGV4ID0gaW5kZXhPZihjb250ZW50SXRlbSwgdGhpcy5jb250ZW50SXRlbXMpLFxyXG4gICAgICAgICAgICBzcGxpdHRlckluZGV4ID0gTWF0aC5tYXgoaW5kZXggLSAxLCAwKTtcclxuXHJcbiAgICAgICAgaWYgKGluZGV4ID09PSAtMSkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NhblxcJ3QgZG9jayBjaGlsZC4gQ29udGVudEl0ZW0gaXMgbm90IGNoaWxkIG9mIHRoaXMgUm93IG9yIENvbHVtbicpO1xyXG4gICAgICAgIH1cclxuICAgICAgICB2YXIgaXNEb2NrZWQgPSBjb250ZW50SXRlbS5fZG9ja2VyICYmIGNvbnRlbnRJdGVtLl9kb2NrZXIuZG9ja2VkO1xyXG4gICAgICAgIHZhciBpXHJcbiAgICAgICAgaWYgKHR5cGVvZiBtb2RlICE9ICd1bmRlZmluZWQnKVxyXG4gICAgICAgICAgICBpZiAobW9kZSA9PSBpc0RvY2tlZClcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICBpZiAoaXNEb2NrZWQpIHsgLy8gdW5kb2NrIGl0XHJcbiAgICAgICAgICAgIHRoaXMuX3NwbGl0dGVyW3NwbGl0dGVySW5kZXhdLmVsZW1lbnQuc2hvdygpO1xyXG4gICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgdGhpcy5jb250ZW50SXRlbXMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgICAgIHZhciBuZXdJdGVtU2l6ZSA9IGNvbnRlbnRJdGVtLl9kb2NrZXIuc2l6ZTtcclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLmNvbnRlbnRJdGVtc1tpXSA9PT0gY29udGVudEl0ZW0pIHtcclxuICAgICAgICAgICAgICAgICAgICBjb250ZW50SXRlbS5jb25maWdbdGhpcy5fZGltZW5zaW9uXSA9IG5ld0l0ZW1TaXplO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICBpdGVtU2l6ZSA9IHRoaXMuY29udGVudEl0ZW1zW2ldLmNvbmZpZ1t0aGlzLl9kaW1lbnNpb25dICo9ICgxMDAgLSBuZXdJdGVtU2l6ZSkgLyAxMDA7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jb250ZW50SXRlbXNbaV0uY29uZmlnW3RoaXMuX2RpbWVuc2lvbl0gPSBpdGVtU2l6ZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBjb250ZW50SXRlbS5fZG9ja2VyID0ge1xyXG4gICAgICAgICAgICAgICAgZG9ja2VkOiBmYWxzZVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH0gZWxzZSB7IC8vIGRvY2tcclxuICAgICAgICAgICAgaWYgKHRoaXMuY29udGVudEl0ZW1zLmxlbmd0aCAtIHRoaXMuX2lzRG9ja2VkKCkgPCAyKVxyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdDYW5cXCd0IGRvY2sgY2hpbGQgd2hlbiBpdCBpcyBsYXN0IGluICcgKyB0aGlzLmNvbmZpZy50eXBlKTtcclxuICAgICAgICAgICAgdmFyIGF1dG9zaWRlID0ge1xyXG4gICAgICAgICAgICAgICAgY29sdW1uOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgZmlyc3Q6ICd0b3AnLFxyXG4gICAgICAgICAgICAgICAgICAgIGxhc3Q6ICdib3R0b20nXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgcm93OiB7XHJcbiAgICAgICAgICAgICAgICAgICAgZmlyc3Q6ICdsZWZ0JyxcclxuICAgICAgICAgICAgICAgICAgICBsYXN0OiAncmlnaHQnXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIHZhciByZXF1aXJlZCA9IGF1dG9zaWRlW3RoaXMuY29uZmlnLnR5cGVdW2luZGV4ID8gJ2xhc3QnIDogJ2ZpcnN0J107XHJcbiAgICAgICAgICAgIGlmIChjb250ZW50SXRlbS5oZWFkZXIucG9zaXRpb24oKSAhPSByZXF1aXJlZClcclxuICAgICAgICAgICAgICAgIGNvbnRlbnRJdGVtLmhlYWRlci5wb3NpdGlvbihyZXF1aXJlZCk7XHJcblxyXG4gICAgICAgICAgICBpZiAodGhpcy5fc3BsaXR0ZXJbc3BsaXR0ZXJJbmRleF0pIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuX3NwbGl0dGVyW3NwbGl0dGVySW5kZXhdLmVsZW1lbnQuaGlkZSgpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHZhciBkb2NrZWQgPSB0aGlzLl9pc0RvY2tlZCgpO1xyXG4gICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgdGhpcy5jb250ZW50SXRlbXMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLmNvbnRlbnRJdGVtc1tpXSAhPT0gY29udGVudEl0ZW0pIHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMuX2lzRG9ja2VkKGkpKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbnRlbnRJdGVtc1tpXS5jb25maWdbdGhpcy5fZGltZW5zaW9uXSArPSByZW1vdmVkSXRlbVNpemUgLyAodGhpcy5jb250ZW50SXRlbXMubGVuZ3RoIC0gMSAtIGRvY2tlZCk7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2VcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbnRlbnRJdGVtc1tpXS5jb25maWdbdGhpcy5fZGltZW5zaW9uXSA9IDA7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgY29udGVudEl0ZW0uX2RvY2tlciA9IHtcclxuICAgICAgICAgICAgICAgIGRpbWVuc2lvbjogdGhpcy5fZGltZW5zaW9uLFxyXG4gICAgICAgICAgICAgICAgc2l6ZTogcmVtb3ZlZEl0ZW1TaXplLFxyXG4gICAgICAgICAgICAgICAgcmVhbFNpemU6IGNvbnRlbnRJdGVtLmVsZW1lbnRbdGhpcy5fZGltZW5zaW9uXSgpIC0gaGVhZGVyU2l6ZSxcclxuICAgICAgICAgICAgICAgIGRvY2tlZDogdHJ1ZSxcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgaWYgKGNvbGxhcHNlZClcclxuICAgICAgICAgICAgICAgIGNvbnRlbnRJdGVtLmNoaWxkRWxlbWVudENvbnRhaW5lclt0aGlzLl9kaW1lbnNpb25dKDApO1xyXG4gICAgICAgIH1cclxuICAgICAgICBjb250ZW50SXRlbS5lbGVtZW50LnRvZ2dsZUNsYXNzKCdsbV9kb2NrZWQnLCBjb250ZW50SXRlbS5fZG9ja2VyLmRvY2tlZCk7XHJcbiAgICAgICAgdGhpcy5jYWxsRG93bndhcmRzKCdzZXRTaXplJyk7XHJcbiAgICAgICAgdGhpcy5lbWl0QnViYmxpbmdFdmVudCgnc3RhdGVDaGFuZ2VkJyk7XHJcbiAgICAgICAgdGhpcy5fdmFsaWRhdGVEb2NraW5nKCk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBJbnZva2VkIHJlY3Vyc2l2ZWx5IGJ5IHRoZSBsYXlvdXQgbWFuYWdlci4gQWJzdHJhY3RDb250ZW50SXRlbS5pbml0IGFwcGVuZHNcclxuICAgICAqIHRoZSBjb250ZW50SXRlbSdzIERPTSBlbGVtZW50cyB0byB0aGUgY29udGFpbmVyLCBSb3dPckNvbHVtbiBpbml0IGFkZHMgc3BsaXR0ZXJzXHJcbiAgICAgKiBpbiBiZXR3ZWVuIHRoZW1cclxuICAgICAqXHJcbiAgICAgKiBAcGFja2FnZSBwcml2YXRlXHJcbiAgICAgKiBAb3ZlcnJpZGUgQWJzdHJhY3RDb250ZW50SXRlbS5fJGluaXRcclxuICAgICAqIEByZXR1cm5zIHt2b2lkfVxyXG4gICAgICovXHJcbiAgICBfJGluaXQoKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuaXNJbml0aWFsaXNlZCA9PT0gdHJ1ZSkgcmV0dXJuO1xyXG5cclxuICAgICAgICB2YXIgaTtcclxuXHJcbiAgICAgICAgQWJzdHJhY3RDb250ZW50SXRlbS5wcm90b3R5cGUuXyRpbml0LmNhbGwodGhpcyk7XHJcblxyXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCB0aGlzLmNvbnRlbnRJdGVtcy5sZW5ndGggLSAxOyBpKyspIHtcclxuICAgICAgICAgICAgdGhpcy5jb250ZW50SXRlbXNbaV0uZWxlbWVudC5hZnRlcih0aGlzLl9jcmVhdGVTcGxpdHRlcihpKS5lbGVtZW50KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IHRoaXMuY29udGVudEl0ZW1zLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLmNvbnRlbnRJdGVtc1tpXS5faGVhZGVyICYmIHRoaXMuY29udGVudEl0ZW1zW2ldLl9oZWFkZXIuZG9ja2VkKVxyXG4gICAgICAgICAgICAgICAgdGhpcy5kb2NrKHRoaXMuY29udGVudEl0ZW1zW2ldLCB0cnVlLCB0cnVlKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBUdXJucyB0aGUgcmVsYXRpdmUgc2l6ZXMgY2FsY3VsYXRlZCBieSBfY2FsY3VsYXRlUmVsYXRpdmVTaXplcyBpbnRvXHJcbiAgICAgKiBhYnNvbHV0ZSBwaXhlbCB2YWx1ZXMgYW5kIGFwcGxpZXMgdGhlbSB0byB0aGUgY2hpbGRyZW4ncyBET00gZWxlbWVudHNcclxuICAgICAqXHJcbiAgICAgKiBBc3NpZ25zIGFkZGl0aW9uYWwgcGl4ZWxzIHRvIGNvdW50ZXJhY3QgTWF0aC5mbG9vclxyXG4gICAgICpcclxuICAgICAqIEBwcml2YXRlXHJcbiAgICAgKiBAcmV0dXJucyB7dm9pZH1cclxuICAgICAqL1xyXG4gICAgX3NldEFic29sdXRlU2l6ZXMoKSB7XHJcbiAgICAgICAgdmFyIGksXHJcbiAgICAgICAgICAgIHNpemVEYXRhID0gdGhpcy5fY2FsY3VsYXRlQWJzb2x1dGVTaXplcygpO1xyXG5cclxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgdGhpcy5jb250ZW50SXRlbXMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgaWYgKHNpemVEYXRhLmFkZGl0aW9uYWxQaXhlbCAtIGkgPiAwKSB7XHJcbiAgICAgICAgICAgICAgICBzaXplRGF0YS5pdGVtU2l6ZXNbaV0rKztcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgaWYgKHRoaXMuX2lzQ29sdW1uKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmNvbnRlbnRJdGVtc1tpXS5lbGVtZW50LndpZHRoKHNpemVEYXRhLnRvdGFsV2lkdGgpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5jb250ZW50SXRlbXNbaV0uZWxlbWVudC5oZWlnaHQoc2l6ZURhdGEuaXRlbVNpemVzW2ldKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuY29udGVudEl0ZW1zW2ldLmVsZW1lbnQud2lkdGgoc2l6ZURhdGEuaXRlbVNpemVzW2ldKTtcclxuICAgICAgICAgICAgICAgIHRoaXMuY29udGVudEl0ZW1zW2ldLmVsZW1lbnQuaGVpZ2h0KHNpemVEYXRhLnRvdGFsSGVpZ2h0KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENhbGN1bGF0ZXMgdGhlIGFic29sdXRlIHNpemVzIG9mIGFsbCBvZiB0aGUgY2hpbGRyZW4gb2YgdGhpcyBJdGVtLlxyXG4gICAgICogQHJldHVybnMge29iamVjdH0gLSBTZXQgd2l0aCBhYnNvbHV0ZSBzaXplcyBhbmQgYWRkaXRpb25hbCBwaXhlbHMuXHJcbiAgICAgKi9cclxuICAgIF9jYWxjdWxhdGVBYnNvbHV0ZVNpemVzKCkge1xyXG4gICAgICAgIHZhciBpLFxyXG4gICAgICAgICAgICB0b3RhbFNwbGl0dGVyU2l6ZSA9ICh0aGlzLmNvbnRlbnRJdGVtcy5sZW5ndGggLSAxKSAqIHRoaXMuX3NwbGl0dGVyU2l6ZSxcclxuICAgICAgICAgICAgaGVhZGVyU2l6ZSA9IHRoaXMubGF5b3V0TWFuYWdlci5jb25maWcuZGltZW5zaW9ucy5oZWFkZXJIZWlnaHQsXHJcbiAgICAgICAgICAgIHRvdGFsV2lkdGggPSB0aGlzLmVsZW1lbnQud2lkdGgoKSxcclxuICAgICAgICAgICAgdG90YWxIZWlnaHQgPSB0aGlzLmVsZW1lbnQuaGVpZ2h0KCksXHJcbiAgICAgICAgICAgIHRvdGFsQXNzaWduZWQgPSAwLFxyXG4gICAgICAgICAgICBhZGRpdGlvbmFsUGl4ZWwsXHJcbiAgICAgICAgICAgIGl0ZW1TaXplLFxyXG4gICAgICAgICAgICBpdGVtU2l6ZXMgPSBbXTtcclxuXHJcbiAgICAgICAgaWYgKHRoaXMuX2lzQ29sdW1uKSB7XHJcbiAgICAgICAgICAgIHRvdGFsSGVpZ2h0IC09IHRvdGFsU3BsaXR0ZXJTaXplO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHRvdGFsV2lkdGggLT0gdG90YWxTcGxpdHRlclNpemU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCB0aGlzLmNvbnRlbnRJdGVtcy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5faXNEb2NrZWQoaSkpXHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5faXNDb2x1bW4pIHtcclxuICAgICAgICAgICAgICAgICAgICB0b3RhbEhlaWdodCAtPSBoZWFkZXJTaXplIC0gdGhpcy5fc3BsaXR0ZXJTaXplO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICB0b3RhbFdpZHRoIC09IGhlYWRlclNpemUgLSB0aGlzLl9zcGxpdHRlclNpemU7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgdGhpcy5jb250ZW50SXRlbXMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMuX2lzQ29sdW1uKSB7XHJcbiAgICAgICAgICAgICAgICBpdGVtU2l6ZSA9IE1hdGguZmxvb3IodG90YWxIZWlnaHQgKiAodGhpcy5jb250ZW50SXRlbXNbaV0uY29uZmlnLmhlaWdodCAvIDEwMCkpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgaXRlbVNpemUgPSBNYXRoLmZsb29yKHRvdGFsV2lkdGggKiAodGhpcy5jb250ZW50SXRlbXNbaV0uY29uZmlnLndpZHRoIC8gMTAwKSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKHRoaXMuX2lzRG9ja2VkKGkpKVxyXG4gICAgICAgICAgICAgICAgaXRlbVNpemUgPSBoZWFkZXJTaXplO1xyXG5cclxuICAgICAgICAgICAgdG90YWxBc3NpZ25lZCArPSBpdGVtU2l6ZTtcclxuICAgICAgICAgICAgaXRlbVNpemVzLnB1c2goaXRlbVNpemUpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgYWRkaXRpb25hbFBpeGVsID0gTWF0aC5mbG9vcigodGhpcy5faXNDb2x1bW4gPyB0b3RhbEhlaWdodCA6IHRvdGFsV2lkdGgpIC0gdG90YWxBc3NpZ25lZCk7XHJcblxyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIGl0ZW1TaXplczogaXRlbVNpemVzLFxyXG4gICAgICAgICAgICBhZGRpdGlvbmFsUGl4ZWw6IGFkZGl0aW9uYWxQaXhlbCxcclxuICAgICAgICAgICAgdG90YWxXaWR0aDogdG90YWxXaWR0aCxcclxuICAgICAgICAgICAgdG90YWxIZWlnaHQ6IHRvdGFsSGVpZ2h0XHJcbiAgICAgICAgfTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENhbGN1bGF0ZXMgdGhlIHJlbGF0aXZlIHNpemVzIG9mIGFsbCBjaGlsZHJlbiBvZiB0aGlzIEl0ZW0uIFRoZSBsb2dpY1xyXG4gICAgICogaXMgYXMgZm9sbG93czpcclxuICAgICAqXHJcbiAgICAgKiAtIEFkZCB1cCB0aGUgdG90YWwgc2l6ZSBvZiBhbGwgaXRlbXMgdGhhdCBoYXZlIGEgY29uZmlndXJlZCBzaXplXHJcbiAgICAgKlxyXG4gICAgICogLSBJZiB0aGUgdG90YWwgPT0gMTAwIChjaGVjayBmb3IgZmxvYXRpbmcgcG9pbnQgZXJyb3JzKVxyXG4gICAgICogICAgICAgIEV4Y2VsbGVudCwgam9iIGRvbmVcclxuICAgICAqXHJcbiAgICAgKiAtIElmIHRoZSB0b3RhbCBpcyA+IDEwMCxcclxuICAgICAqICAgICAgICBzZXQgdGhlIHNpemUgb2YgaXRlbXMgd2l0aG91dCBzZXQgZGltZW5zaW9ucyB0byAxLzMgYW5kIGFkZCB0aGlzIHRvIHRoZSB0b3RhbFxyXG4gICAgICogICAgICAgIHNldCB0aGUgc2l6ZSBvZmYgYWxsIGl0ZW1zIHNvIHRoYXQgdGhlIHRvdGFsIGlzIGh1bmRyZWQgcmVsYXRpdmUgdG8gdGhlaXIgb3JpZ2luYWwgc2l6ZVxyXG4gICAgICpcclxuICAgICAqIC0gSWYgdGhlIHRvdGFsIGlzIDwgMTAwXHJcbiAgICAgKiAgICAgICAgSWYgdGhlcmUgYXJlIGl0ZW1zIHdpdGhvdXQgc2V0IGRpbWVuc2lvbnMsIGRpc3RyaWJ1dGUgdGhlIHJlbWFpbmRlciB0byAxMDAgZXZlbmx5IGJldHdlZW4gdGhlbVxyXG4gICAgICogICAgICAgIElmIHRoZXJlIGFyZSBubyBpdGVtcyB3aXRob3V0IHNldCBkaW1lbnNpb25zLCBpbmNyZWFzZSBhbGwgaXRlbXMgc2l6ZXMgcmVsYXRpdmUgdG9cclxuICAgICAqICAgICAgICB0aGVpciBvcmlnaW5hbCBzaXplIHNvIHRoYXQgdGhleSBhZGQgdXAgdG8gMTAwXHJcbiAgICAgKlxyXG4gICAgICogQHByaXZhdGVcclxuICAgICAqIEByZXR1cm5zIHt2b2lkfVxyXG4gICAgICovXHJcbiAgICBfY2FsY3VsYXRlUmVsYXRpdmVTaXplcygpIHtcclxuXHJcbiAgICAgICAgdmFyIGksXHJcbiAgICAgICAgICAgIHRvdGFsID0gMCxcclxuICAgICAgICAgICAgaXRlbXNXaXRob3V0U2V0RGltZW5zaW9uID0gW10sXHJcbiAgICAgICAgICAgIGRpbWVuc2lvbiA9IHRoaXMuX2lzQ29sdW1uID8gJ2hlaWdodCcgOiAnd2lkdGgnO1xyXG5cclxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgdGhpcy5jb250ZW50SXRlbXMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMuY29udGVudEl0ZW1zW2ldLmNvbmZpZ1tkaW1lbnNpb25dICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgIHRvdGFsICs9IHRoaXMuY29udGVudEl0ZW1zW2ldLmNvbmZpZ1tkaW1lbnNpb25dO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgaXRlbXNXaXRob3V0U2V0RGltZW5zaW9uLnB1c2godGhpcy5jb250ZW50SXRlbXNbaV0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBFdmVyeXRoaW5nIGFkZHMgdXAgdG8gaHVuZHJlZCwgYWxsIGdvb2QgOi0pXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgaWYgKE1hdGgucm91bmQodG90YWwpID09PSAxMDApIHtcclxuICAgICAgICAgICAgdGhpcy5fcmVzcGVjdE1pbkl0ZW1XaWR0aCgpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBBbGxvY2F0ZSB0aGUgcmVtYWluaW5nIHNpemUgdG8gdGhlIGl0ZW1zIHdpdGhvdXQgYSBzZXQgZGltZW5zaW9uXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgaWYgKE1hdGgucm91bmQodG90YWwpIDwgMTAwICYmIGl0ZW1zV2l0aG91dFNldERpbWVuc2lvbi5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBpdGVtc1dpdGhvdXRTZXREaW1lbnNpb24ubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgICAgIGl0ZW1zV2l0aG91dFNldERpbWVuc2lvbltpXS5jb25maWdbZGltZW5zaW9uXSA9ICgxMDAgLSB0b3RhbCkgLyBpdGVtc1dpdGhvdXRTZXREaW1lbnNpb24ubGVuZ3RoO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHRoaXMuX3Jlc3BlY3RNaW5JdGVtV2lkdGgoKTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogSWYgdGhlIHRvdGFsIGlzID4gMTAwLCBidXQgdGhlcmUgYXJlIGFsc28gaXRlbXMgd2l0aG91dCBhIHNldCBkaW1lbnNpb24gbGVmdCwgYXNzaW5nIDUwXHJcbiAgICAgICAgICogYXMgdGhlaXIgZGltZW5zaW9uIGFuZCBhZGQgaXQgdG8gdGhlIHRvdGFsXHJcbiAgICAgICAgICpcclxuICAgICAgICAgKiBUaGlzIHdpbGwgYmUgcmVzZXQgaW4gdGhlIG5leHQgc3RlcFxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGlmIChNYXRoLnJvdW5kKHRvdGFsKSA+IDEwMCkge1xyXG4gICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgaXRlbXNXaXRob3V0U2V0RGltZW5zaW9uLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICBpdGVtc1dpdGhvdXRTZXREaW1lbnNpb25baV0uY29uZmlnW2RpbWVuc2lvbl0gPSA1MDtcclxuICAgICAgICAgICAgICAgIHRvdGFsICs9IDUwO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBTZXQgZXZlcnkgaXRlbXMgc2l6ZSByZWxhdGl2ZSB0byAxMDAgcmVsYXRpdmUgdG8gaXRzIHNpemUgdG8gdG90YWxcclxuICAgICAgICAgKi9cclxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgdGhpcy5jb250ZW50SXRlbXMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgdGhpcy5jb250ZW50SXRlbXNbaV0uY29uZmlnW2RpbWVuc2lvbl0gPSAodGhpcy5jb250ZW50SXRlbXNbaV0uY29uZmlnW2RpbWVuc2lvbl0gLyB0b3RhbCkgKiAxMDA7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLl9yZXNwZWN0TWluSXRlbVdpZHRoKCk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBBZGp1c3RzIHRoZSBjb2x1bW4gd2lkdGhzIHRvIHJlc3BlY3QgdGhlIGRpbWVuc2lvbnMgbWluSXRlbVdpZHRoIGlmIHNldC5cclxuICAgICAqIEByZXR1cm5zIHt9XHJcbiAgICAgKi9cclxuICAgIF9yZXNwZWN0TWluSXRlbVdpZHRoKCkge1xyXG4gICAgICAgIHZhciBtaW5JdGVtV2lkdGggPSB0aGlzLmxheW91dE1hbmFnZXIuY29uZmlnLmRpbWVuc2lvbnMgPyAodGhpcy5sYXlvdXRNYW5hZ2VyLmNvbmZpZy5kaW1lbnNpb25zLm1pbkl0ZW1XaWR0aCB8fCAwKSA6IDAsXHJcbiAgICAgICAgICAgIHNpemVEYXRhID0gbnVsbCxcclxuICAgICAgICAgICAgZW50cmllc092ZXJNaW4gPSBbXSxcclxuICAgICAgICAgICAgdG90YWxPdmVyTWluID0gMCxcclxuICAgICAgICAgICAgdG90YWxVbmRlck1pbiA9IDAsXHJcbiAgICAgICAgICAgIHJlbWFpbmluZ1dpZHRoID0gMCxcclxuICAgICAgICAgICAgaXRlbVNpemUgPSAwLFxyXG4gICAgICAgICAgICBjb250ZW50SXRlbSA9IG51bGwsXHJcbiAgICAgICAgICAgIHJlZHVjZVBlcmNlbnQsXHJcbiAgICAgICAgICAgIHJlZHVjZWRXaWR0aCxcclxuICAgICAgICAgICAgYWxsRW50cmllcyA9IFtdLFxyXG4gICAgICAgICAgICBlbnRyeTtcclxuXHJcbiAgICAgICAgaWYgKHRoaXMuX2lzQ29sdW1uIHx8ICFtaW5JdGVtV2lkdGggfHwgdGhpcy5jb250ZW50SXRlbXMubGVuZ3RoIDw9IDEpIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgc2l6ZURhdGEgPSB0aGlzLl9jYWxjdWxhdGVBYnNvbHV0ZVNpemVzKCk7XHJcblxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIEZpZ3VyZSBvdXQgaG93IG11Y2ggd2UgYXJlIHVuZGVyIHRoZSBtaW4gaXRlbSBzaXplIHRvdGFsIGFuZCBob3cgbXVjaCByb29tIHdlIGhhdmUgdG8gdXNlLlxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5jb250ZW50SXRlbXMubGVuZ3RoOyBpKyspIHtcclxuXHJcbiAgICAgICAgICAgIGNvbnRlbnRJdGVtID0gdGhpcy5jb250ZW50SXRlbXNbaV07XHJcbiAgICAgICAgICAgIGl0ZW1TaXplID0gc2l6ZURhdGEuaXRlbVNpemVzW2ldO1xyXG5cclxuICAgICAgICAgICAgaWYgKGl0ZW1TaXplIDwgbWluSXRlbVdpZHRoKSB7XHJcbiAgICAgICAgICAgICAgICB0b3RhbFVuZGVyTWluICs9IG1pbkl0ZW1XaWR0aCAtIGl0ZW1TaXplO1xyXG4gICAgICAgICAgICAgICAgZW50cnkgPSB7XHJcbiAgICAgICAgICAgICAgICAgICAgd2lkdGg6IG1pbkl0ZW1XaWR0aFxyXG4gICAgICAgICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICB0b3RhbE92ZXJNaW4gKz0gaXRlbVNpemUgLSBtaW5JdGVtV2lkdGg7XHJcbiAgICAgICAgICAgICAgICBlbnRyeSA9IHtcclxuICAgICAgICAgICAgICAgICAgICB3aWR0aDogaXRlbVNpemVcclxuICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgICAgICBlbnRyaWVzT3Zlck1pbi5wdXNoKGVudHJ5KTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgYWxsRW50cmllcy5wdXNoKGVudHJ5KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIElmIHRoZXJlIGlzIG5vdGhpbmcgdW5kZXIgbWluLCBvciB0aGVyZSBpcyBub3QgZW5vdWdoIG92ZXIgdG8gbWFrZSB1cCB0aGUgZGlmZmVyZW5jZSwgZG8gbm90aGluZy5cclxuICAgICAgICAgKi9cclxuICAgICAgICBpZiAodG90YWxVbmRlck1pbiA9PT0gMCB8fCB0b3RhbFVuZGVyTWluID4gdG90YWxPdmVyTWluKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIEV2ZW5seSByZWR1Y2UgYWxsIGNvbHVtbnMgdGhhdCBhcmUgb3ZlciB0aGUgbWluIGl0ZW0gd2lkdGggdG8gbWFrZSB1cCB0aGUgZGlmZmVyZW5jZS5cclxuICAgICAgICAgKi9cclxuICAgICAgICByZWR1Y2VQZXJjZW50ID0gdG90YWxVbmRlck1pbiAvIHRvdGFsT3Zlck1pbjtcclxuICAgICAgICByZW1haW5pbmdXaWR0aCA9IHRvdGFsVW5kZXJNaW47XHJcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IGVudHJpZXNPdmVyTWluLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIGVudHJ5ID0gZW50cmllc092ZXJNaW5baV07XHJcbiAgICAgICAgICAgIHJlZHVjZWRXaWR0aCA9IE1hdGgucm91bmQoKGVudHJ5LndpZHRoIC0gbWluSXRlbVdpZHRoKSAqIHJlZHVjZVBlcmNlbnQpO1xyXG4gICAgICAgICAgICByZW1haW5pbmdXaWR0aCAtPSByZWR1Y2VkV2lkdGg7XHJcbiAgICAgICAgICAgIGVudHJ5LndpZHRoIC09IHJlZHVjZWRXaWR0aDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFRha2UgYW55dGhpbmcgcmVtYWluaW5nIGZyb20gdGhlIGxhc3QgaXRlbS5cclxuICAgICAgICAgKi9cclxuICAgICAgICBpZiAocmVtYWluaW5nV2lkdGggIT09IDApIHtcclxuICAgICAgICAgICAgYWxsRW50cmllc1thbGxFbnRyaWVzLmxlbmd0aCAtIDFdLndpZHRoIC09IHJlbWFpbmluZ1dpZHRoO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogU2V0IGV2ZXJ5IGl0ZW1zIHNpemUgcmVsYXRpdmUgdG8gMTAwIHJlbGF0aXZlIHRvIGl0cyBzaXplIHRvIHRvdGFsXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IHRoaXMuY29udGVudEl0ZW1zLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIHRoaXMuY29udGVudEl0ZW1zW2ldLmNvbmZpZy53aWR0aCA9IChhbGxFbnRyaWVzW2ldLndpZHRoIC8gc2l6ZURhdGEudG90YWxXaWR0aCkgKiAxMDA7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogSW5zdGFudGlhdGVzIGEgbmV3IFNwbGl0dGVyLCBiaW5kcyBldmVudHMgdG8gaXQgYW5kIGFkZHNcclxuICAgICAqIGl0IHRvIHRoZSBhcnJheSBvZiBzcGxpdHRlcnMgYXQgdGhlIHBvc2l0aW9uIHNwZWNpZmllZCBhcyB0aGUgaW5kZXggYXJndW1lbnRcclxuICAgICAqXHJcbiAgICAgKiBXaGF0IGl0IGRvZXNuJ3QgZG8gdGhvdWdoIGlzIGFwcGVuZCB0aGUgc3BsaXR0ZXIgdG8gdGhlIERPTVxyXG4gICAgICpcclxuICAgICAqIEBwYXJhbSAgIHtJbnR9IGluZGV4IFRoZSBwb3NpdGlvbiBvZiB0aGUgc3BsaXR0ZXJcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJucyB7U3BsaXR0ZXJ9XHJcbiAgICAgKi9cclxuICAgIF9jcmVhdGVTcGxpdHRlcihpbmRleCkge1xyXG4gICAgICAgIHZhciBzcGxpdHRlcjtcclxuICAgICAgICBzcGxpdHRlciA9IG5ldyBTcGxpdHRlcih0aGlzLl9pc0NvbHVtbiwgdGhpcy5fc3BsaXR0ZXJTaXplLCB0aGlzLl9zcGxpdHRlckdyYWJTaXplKTtcclxuICAgICAgICBzcGxpdHRlci5vbignZHJhZycsIGZuQmluZCh0aGlzLl9vblNwbGl0dGVyRHJhZywgdGhpcywgW3NwbGl0dGVyXSksIHRoaXMpO1xyXG4gICAgICAgIHNwbGl0dGVyLm9uKCdkcmFnU3RvcCcsIGZuQmluZCh0aGlzLl9vblNwbGl0dGVyRHJhZ1N0b3AsIHRoaXMsIFtzcGxpdHRlcl0pLCB0aGlzKTtcclxuICAgICAgICBzcGxpdHRlci5vbignZHJhZ1N0YXJ0JywgZm5CaW5kKHRoaXMuX29uU3BsaXR0ZXJEcmFnU3RhcnQsIHRoaXMsIFtzcGxpdHRlcl0pLCB0aGlzKTtcclxuICAgICAgICB0aGlzLl9zcGxpdHRlci5zcGxpY2UoaW5kZXgsIDAsIHNwbGl0dGVyKTtcclxuICAgICAgICByZXR1cm4gc3BsaXR0ZXI7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBMb2NhdGVzIHRoZSBpbnN0YW5jZSBvZiBTcGxpdHRlciBpbiB0aGUgYXJyYXkgb2ZcclxuICAgICAqIHJlZ2lzdGVyZWQgc3BsaXR0ZXJzIGFuZCByZXR1cm5zIGEgbWFwIGNvbnRhaW5pbmcgdGhlIGNvbnRlbnRJdGVtXHJcbiAgICAgKiBiZWZvcmUgYW5kIGFmdGVyIHRoZSBzcGxpdHRlcnMsIGJvdGggb2Ygd2hpY2ggYXJlIGFmZmVjdGVkIGlmIHRoZVxyXG4gICAgICogc3BsaXR0ZXIgaXMgbW92ZWRcclxuICAgICAqXHJcbiAgICAgKiBAcGFyYW0gICB7U3BsaXR0ZXJ9IHNwbGl0dGVyXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge09iamVjdH0gQSBtYXAgb2YgY29udGVudEl0ZW1zIHRoYXQgdGhlIHNwbGl0dGVyIGFmZmVjdHNcclxuICAgICAqL1xyXG4gICAgX2dldEl0ZW1zRm9yU3BsaXR0ZXIoc3BsaXR0ZXIpIHtcclxuICAgICAgICB2YXIgaW5kZXggPSBpbmRleE9mKHNwbGl0dGVyLCB0aGlzLl9zcGxpdHRlcik7XHJcblxyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIGJlZm9yZTogdGhpcy5jb250ZW50SXRlbXNbaW5kZXhdLFxyXG4gICAgICAgICAgICBhZnRlcjogdGhpcy5jb250ZW50SXRlbXNbaW5kZXggKyAxXVxyXG4gICAgICAgIH07XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBHZXRzIGRvY2tpbmcgaW5mb3JtYXRpb25cclxuICAgICAqIEBwcml2YXRlXHJcbiAgICAgKi9cclxuICAgIF9pc0RvY2tlZChpbmRleCkge1xyXG4gICAgICAgIGlmICh0eXBlb2YgaW5kZXggPT0gJ3VuZGVmaW5lZCcpIHtcclxuICAgICAgICAgICAgdmFyIGNvdW50ID0gMDtcclxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmNvbnRlbnRJdGVtcy5sZW5ndGg7ICsraSlcclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9pc0RvY2tlZChpKSlcclxuICAgICAgICAgICAgICAgICAgICBjb3VudCsrO1xyXG4gICAgICAgICAgICByZXR1cm4gY291bnQ7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChpbmRleCA8IHRoaXMuY29udGVudEl0ZW1zLmxlbmd0aClcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuY29udGVudEl0ZW1zW2luZGV4XS5fZG9ja2VyICYmIHRoaXMuY29udGVudEl0ZW1zW2luZGV4XS5fZG9ja2VyLmRvY2tlZDtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFZhbGlkYXRlIGlmIHJvdyBvciBjb2x1bW4gaGFzIGFiaWxpdHkgdG8gZG9ja1xyXG4gICAgICogQHByaXZhdGVcclxuICAgICAqL1xyXG4gICAgX3ZhbGlkYXRlRG9ja2luZyh0aGF0KSB7XHJcbiAgICAgICAgdGhhdCA9IHRoYXQgfHwgdGhpcztcclxuICAgICAgICB2YXIgY2FuID0gdGhhdC5jb250ZW50SXRlbXMubGVuZ3RoIC0gdGhhdC5faXNEb2NrZWQoKSA+IDE7XHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGF0LmNvbnRlbnRJdGVtcy5sZW5ndGg7ICsraSlcclxuICAgICAgICAgICAgaWYgKHRoYXQuY29udGVudEl0ZW1zW2ldIGluc3RhbmNlb2YgU3RhY2spIHtcclxuICAgICAgICAgICAgICAgIHRoYXQuY29udGVudEl0ZW1zW2ldLmhlYWRlci5fc2V0RG9ja2FibGUodGhhdC5faXNEb2NrZWQoaSkgfHwgY2FuKTtcclxuICAgICAgICAgICAgICAgIHRoYXQuY29udGVudEl0ZW1zW2ldLmhlYWRlci5fJHNldENsb3NhYmxlKGNhbik7XHJcbiAgICAgICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEdldHMgdGhlIG1pbmltdW0gZGltZW5zaW9ucyBmb3IgdGhlIGdpdmVuIGl0ZW0gY29uZmlndXJhdGlvbiBhcnJheVxyXG4gICAgICogQHBhcmFtIGl0ZW1cclxuICAgICAqIEBwcml2YXRlXHJcbiAgICAgKi9cclxuICAgIF9nZXRNaW5pbXVtRGltZW5zaW9ucyhhcnIpIHtcclxuICAgICAgICB2YXIgbWluV2lkdGggPSAwLFxyXG4gICAgICAgICAgICBtaW5IZWlnaHQgPSAwO1xyXG5cclxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFyci5sZW5ndGg7ICsraSkge1xyXG4gICAgICAgICAgICBtaW5XaWR0aCA9IE1hdGgubWF4KGFycltpXS5taW5XaWR0aCB8fCAwLCBtaW5XaWR0aCk7XHJcbiAgICAgICAgICAgIG1pbkhlaWdodCA9IE1hdGgubWF4KGFycltpXS5taW5IZWlnaHQgfHwgMCwgbWluSGVpZ2h0KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIGhvcml6b250YWw6IG1pbldpZHRoLFxyXG4gICAgICAgICAgICB2ZXJ0aWNhbDogbWluSGVpZ2h0XHJcbiAgICAgICAgfTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEludm9rZWQgd2hlbiBhIHNwbGl0dGVyJ3MgZHJhZ0xpc3RlbmVyIGZpcmVzIGRyYWdTdGFydC4gQ2FsY3VsYXRlcyB0aGUgc3BsaXR0ZXJzXHJcbiAgICAgKiBtb3ZlbWVudCBhcmVhIG9uY2UgKHNvIHRoYXQgaXQgZG9lc24ndCBuZWVkIGNhbGN1bGF0aW5nIG9uIGV2ZXJ5IG1vdXNlbW92ZSBldmVudClcclxuICAgICAqXHJcbiAgICAgKiBAcGFyYW0gICB7U3BsaXR0ZXJ9IHNwbGl0dGVyXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge3ZvaWR9XHJcbiAgICAgKi9cclxuICAgIF9vblNwbGl0dGVyRHJhZ1N0YXJ0KHNwbGl0dGVyKSB7XHJcbiAgICAgICAgdmFyIGl0ZW1zID0gdGhpcy5fZ2V0SXRlbXNGb3JTcGxpdHRlcihzcGxpdHRlciksXHJcbiAgICAgICAgICAgIG1pblNpemUgPSB0aGlzLmxheW91dE1hbmFnZXIuY29uZmlnLmRpbWVuc2lvbnNbdGhpcy5faXNDb2x1bW4gPyAnbWluSXRlbUhlaWdodCcgOiAnbWluSXRlbVdpZHRoJ107XHJcblxyXG4gICAgICAgIHZhciBiZWZvcmVNaW5EaW0gPSB0aGlzLl9nZXRNaW5pbXVtRGltZW5zaW9ucyhpdGVtcy5iZWZvcmUuY29uZmlnLmNvbnRlbnQpO1xyXG4gICAgICAgIHZhciBiZWZvcmVNaW5TaXplID0gdGhpcy5faXNDb2x1bW4gPyBiZWZvcmVNaW5EaW0udmVydGljYWwgOiBiZWZvcmVNaW5EaW0uaG9yaXpvbnRhbDtcclxuXHJcbiAgICAgICAgdmFyIGFmdGVyTWluRGltID0gdGhpcy5fZ2V0TWluaW11bURpbWVuc2lvbnMoaXRlbXMuYWZ0ZXIuY29uZmlnLmNvbnRlbnQpO1xyXG4gICAgICAgIHZhciBhZnRlck1pblNpemUgPSB0aGlzLl9pc0NvbHVtbiA/IGFmdGVyTWluRGltLnZlcnRpY2FsIDogYWZ0ZXJNaW5EaW0uaG9yaXpvbnRhbDtcclxuXHJcbiAgICAgICAgdGhpcy5fc3BsaXR0ZXJQb3NpdGlvbiA9IDA7XHJcbiAgICAgICAgdGhpcy5fc3BsaXR0ZXJNaW5Qb3NpdGlvbiA9IC0xICogKGl0ZW1zLmJlZm9yZS5lbGVtZW50W3RoaXMuX2RpbWVuc2lvbl0oKSAtIChiZWZvcmVNaW5TaXplIHx8IG1pblNpemUpKTtcclxuICAgICAgICB0aGlzLl9zcGxpdHRlck1heFBvc2l0aW9uID0gaXRlbXMuYWZ0ZXIuZWxlbWVudFt0aGlzLl9kaW1lbnNpb25dKCkgLSAoYWZ0ZXJNaW5TaXplIHx8IG1pblNpemUpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogSW52b2tlZCB3aGVuIGEgc3BsaXR0ZXIncyBEcmFnTGlzdGVuZXIgZmlyZXMgZHJhZy4gVXBkYXRlcyB0aGUgc3BsaXR0ZXJzIERPTSBwb3NpdGlvbixcclxuICAgICAqIGJ1dCBub3QgdGhlIHNpemVzIG9mIHRoZSBlbGVtZW50cyB0aGUgc3BsaXR0ZXIgY29udHJvbHMgaW4gb3JkZXIgdG8gbWluaW1pemUgcmVzaXplIGV2ZW50c1xyXG4gICAgICpcclxuICAgICAqIEBwYXJhbSAgIHtTcGxpdHRlcn0gc3BsaXR0ZXJcclxuICAgICAqIEBwYXJhbSAgIHtJbnR9IG9mZnNldFggIFJlbGF0aXZlIHBpeGVsIHZhbHVlcyB0byB0aGUgc3BsaXR0ZXJzIG9yaWdpbmFsIHBvc2l0aW9uLiBDYW4gYmUgbmVnYXRpdmVcclxuICAgICAqIEBwYXJhbSAgIHtJbnR9IG9mZnNldFkgIFJlbGF0aXZlIHBpeGVsIHZhbHVlcyB0byB0aGUgc3BsaXR0ZXJzIG9yaWdpbmFsIHBvc2l0aW9uLiBDYW4gYmUgbmVnYXRpdmVcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJucyB7dm9pZH1cclxuICAgICAqL1xyXG4gICAgX29uU3BsaXR0ZXJEcmFnKHNwbGl0dGVyLCBvZmZzZXRYLCBvZmZzZXRZKSB7XHJcbiAgICAgICAgdmFyIG9mZnNldCA9IHRoaXMuX2lzQ29sdW1uID8gb2Zmc2V0WSA6IG9mZnNldFg7XHJcblxyXG4gICAgICAgIGlmIChvZmZzZXQgPiB0aGlzLl9zcGxpdHRlck1pblBvc2l0aW9uICYmIG9mZnNldCA8IHRoaXMuX3NwbGl0dGVyTWF4UG9zaXRpb24pIHtcclxuICAgICAgICAgICAgdGhpcy5fc3BsaXR0ZXJQb3NpdGlvbiA9IG9mZnNldDtcclxuICAgICAgICAgICAgc3BsaXR0ZXIuZWxlbWVudC5jc3ModGhpcy5faXNDb2x1bW4gPyAndG9wJyA6ICdsZWZ0Jywgb2Zmc2V0KTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBJbnZva2VkIHdoZW4gYSBzcGxpdHRlcidzIERyYWdMaXN0ZW5lciBmaXJlcyBkcmFnU3RvcC4gUmVzZXRzIHRoZSBzcGxpdHRlcnMgRE9NIHBvc2l0aW9uLFxyXG4gICAgICogYW5kIGFwcGxpZXMgdGhlIG5ldyBzaXplcyB0byB0aGUgZWxlbWVudHMgYmVmb3JlIGFuZCBhZnRlciB0aGUgc3BsaXR0ZXIgYW5kIHRoZWlyIGNoaWxkcmVuXHJcbiAgICAgKiBvbiB0aGUgbmV4dCBhbmltYXRpb24gZnJhbWVcclxuICAgICAqXHJcbiAgICAgKiBAcGFyYW0gICB7U3BsaXR0ZXJ9IHNwbGl0dGVyXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge3ZvaWR9XHJcbiAgICAgKi9cclxuICAgIF9vblNwbGl0dGVyRHJhZ1N0b3Aoc3BsaXR0ZXIpIHtcclxuXHJcbiAgICAgICAgdmFyIGl0ZW1zID0gdGhpcy5fZ2V0SXRlbXNGb3JTcGxpdHRlcihzcGxpdHRlciksXHJcbiAgICAgICAgICAgIHNpemVCZWZvcmUgPSBpdGVtcy5iZWZvcmUuZWxlbWVudFt0aGlzLl9kaW1lbnNpb25dKCksXHJcbiAgICAgICAgICAgIHNpemVBZnRlciA9IGl0ZW1zLmFmdGVyLmVsZW1lbnRbdGhpcy5fZGltZW5zaW9uXSgpLFxyXG4gICAgICAgICAgICBzcGxpdHRlclBvc2l0aW9uSW5SYW5nZSA9ICh0aGlzLl9zcGxpdHRlclBvc2l0aW9uICsgc2l6ZUJlZm9yZSkgLyAoc2l6ZUJlZm9yZSArIHNpemVBZnRlciksXHJcbiAgICAgICAgICAgIHRvdGFsUmVsYXRpdmVTaXplID0gaXRlbXMuYmVmb3JlLmNvbmZpZ1t0aGlzLl9kaW1lbnNpb25dICsgaXRlbXMuYWZ0ZXIuY29uZmlnW3RoaXMuX2RpbWVuc2lvbl07XHJcblxyXG4gICAgICAgIGl0ZW1zLmJlZm9yZS5jb25maWdbdGhpcy5fZGltZW5zaW9uXSA9IHNwbGl0dGVyUG9zaXRpb25JblJhbmdlICogdG90YWxSZWxhdGl2ZVNpemU7XHJcbiAgICAgICAgaXRlbXMuYWZ0ZXIuY29uZmlnW3RoaXMuX2RpbWVuc2lvbl0gPSAoMSAtIHNwbGl0dGVyUG9zaXRpb25JblJhbmdlKSAqIHRvdGFsUmVsYXRpdmVTaXplO1xyXG5cclxuICAgICAgICBzcGxpdHRlci5lbGVtZW50LmNzcyh7XHJcbiAgICAgICAgICAgICd0b3AnOiAwLFxyXG4gICAgICAgICAgICAnbGVmdCc6IDBcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgYW5pbUZyYW1lKGZuQmluZCh0aGlzLmNhbGxEb3dud2FyZHMsIHRoaXMsIFsnc2V0U2l6ZSddKSk7XHJcbiAgICB9XHJcbn1cclxuIiwiaW1wb3J0IEFic3RyYWN0Q29udGVudEl0ZW0gZnJvbSAnLi4vaXRlbXMvQWJzdHJhY3RDb250ZW50SXRlbSdcclxuaW1wb3J0IFJvd09yQ29sdW1uIGZyb20gJy4uL2l0ZW1zL1Jvd09yQ29sdW1uJ1xyXG5pbXBvcnQgSGVhZGVyIGZyb20gJy4uL2NvbnRyb2xzL0hlYWRlcidcclxuXHJcbmltcG9ydCB7XHJcbiAgICBmbkJpbmQsXHJcbiAgICBjb3B5LFxyXG4gICAgaW5kZXhPZlxyXG59IGZyb20gJy4uL3V0aWxzL3V0aWxzJ1xyXG5pbXBvcnQgJCBmcm9tICdqcXVlcnknO1xyXG5cclxuXHJcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFN0YWNrIGV4dGVuZHMgQWJzdHJhY3RDb250ZW50SXRlbSB7XHJcbiAgICBjb25zdHJ1Y3RvcihsYXlvdXRNYW5hZ2VyLCBjb25maWcsIHBhcmVudCkge1xyXG4gICAgICAgIHN1cGVyKGxheW91dE1hbmFnZXIsIGNvbmZpZywgcGFyZW50KVxyXG5cclxuICAgICAgICB0aGlzLmVsZW1lbnQgPSAkKCc8ZGl2IGNsYXNzPVwibG1faXRlbSBsbV9zdGFja1wiPjwvZGl2PicpO1xyXG4gICAgICAgIHRoaXMuX2FjdGl2ZUNvbnRlbnRJdGVtID0gbnVsbDtcclxuICAgICAgICB2YXIgY2ZnID0gbGF5b3V0TWFuYWdlci5jb25maWc7XHJcbiAgICAgICAgdGhpcy5faGVhZGVyID0geyAvLyBkZWZhdWx0cycgcmVjb25zdHJ1Y3Rpb24gZnJvbSBvbGQgY29uZmlndXJhdGlvbiBzdHlsZVxyXG4gICAgICAgICAgICBzaG93OiBjZmcuc2V0dGluZ3MuaGFzSGVhZGVycyA9PT0gdHJ1ZSAmJiBjb25maWcuaGFzSGVhZGVycyAhPT0gZmFsc2UsXHJcbiAgICAgICAgICAgIHBvcG91dDogY2ZnLnNldHRpbmdzLnNob3dQb3BvdXRJY29uICYmIGNmZy5sYWJlbHMucG9wb3V0LFxyXG4gICAgICAgICAgICBtYXhpbWlzZTogY2ZnLnNldHRpbmdzLnNob3dNYXhpbWlzZUljb24gJiYgY2ZnLmxhYmVscy5tYXhpbWlzZSxcclxuICAgICAgICAgICAgY2xvc2U6IGNmZy5zZXR0aW5ncy5zaG93Q2xvc2VJY29uICYmIGNmZy5sYWJlbHMuY2xvc2UsXHJcbiAgICAgICAgICAgIG1pbmltaXNlOiBjZmcubGFiZWxzLm1pbmltaXNlLFxyXG4gICAgICAgIH07XHJcbiAgICAgICAgaWYgKGNmZy5oZWFkZXIpIC8vIGxvYWQgc2ltcGxpZmllZCB2ZXJzaW9uIG9mIGhlYWRlciBjb25maWd1cmF0aW9uIChodHRwczovL2dpdGh1Yi5jb20vZGVlcHN0cmVhbUlPL2dvbGRlbi1sYXlvdXQvcHVsbC8yNDUpXHJcbiAgICAgICAgICAgIGNvcHkodGhpcy5faGVhZGVyLCBjZmcuaGVhZGVyKTtcclxuICAgICAgICBpZiAoY29uZmlnLmhlYWRlcikgLy8gbG9hZCBmcm9tIHN0YWNrXHJcbiAgICAgICAgICAgIGNvcHkodGhpcy5faGVhZGVyLCBjb25maWcuaGVhZGVyKTtcclxuICAgICAgICBpZiAoY29uZmlnLmNvbnRlbnQgJiYgY29uZmlnLmNvbnRlbnRbMF0gJiYgY29uZmlnLmNvbnRlbnRbMF0uaGVhZGVyKSAvLyBsb2FkIGZyb20gY29tcG9uZW50IGlmIHN0YWNrIG9taXR0ZWRcclxuICAgICAgICAgICAgY29weSh0aGlzLl9oZWFkZXIsIGNvbmZpZy5jb250ZW50WzBdLmhlYWRlcik7XHJcblxyXG4gICAgICAgIHRoaXMuX2Ryb3Bab25lcyA9IHt9O1xyXG4gICAgICAgIHRoaXMuX2Ryb3BTZWdtZW50ID0gbnVsbDtcclxuICAgICAgICB0aGlzLl9jb250ZW50QXJlYURpbWVuc2lvbnMgPSBudWxsO1xyXG4gICAgICAgIHRoaXMuX2Ryb3BJbmRleCA9IG51bGw7XHJcblxyXG4gICAgICAgIHRoaXMuaXNTdGFjayA9IHRydWU7XHJcblxyXG4gICAgICAgIHRoaXMuY2hpbGRFbGVtZW50Q29udGFpbmVyID0gJCgnPGRpdiBjbGFzcz1cImxtX2l0ZW1zXCI+PC9kaXY+Jyk7XHJcbiAgICAgICAgdGhpcy5oZWFkZXIgPSBuZXcgSGVhZGVyKGxheW91dE1hbmFnZXIsIHRoaXMpO1xyXG5cclxuICAgICAgICB0aGlzLmVsZW1lbnQub24oJ21vdXNlbGVhdmUgbW91c2VlbnRlcicsIGZuQmluZChmdW5jdGlvbihldmVudCkge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5fZG9ja2VyICYmIHRoaXMuX2RvY2tlci5kb2NrZWQpXHJcbiAgICAgICAgICAgICAgICB0aGlzLmNoaWxkRWxlbWVudENvbnRhaW5lclt0aGlzLl9kb2NrZXIuZGltZW5zaW9uXShldmVudC50eXBlID09ICdtb3VzZWVudGVyJyA/IHRoaXMuX2RvY2tlci5yZWFsU2l6ZSA6IDApO1xyXG4gICAgICAgIH0sIHRoaXMpKTtcclxuICAgICAgICB0aGlzLmVsZW1lbnQuYXBwZW5kKHRoaXMuaGVhZGVyLmVsZW1lbnQpO1xyXG4gICAgICAgIHRoaXMuZWxlbWVudC5hcHBlbmQodGhpcy5jaGlsZEVsZW1lbnRDb250YWluZXIpO1xyXG4gICAgICAgIHRoaXMuX3NldHVwSGVhZGVyUG9zaXRpb24oKTtcclxuICAgICAgICB0aGlzLl8kdmFsaWRhdGVDbG9zYWJpbGl0eSgpO1xyXG4gICAgfVxyXG5cclxuICAgIGRvY2sobW9kZSkge1xyXG4gICAgICAgIGlmICh0aGlzLl9oZWFkZXIuZG9jaylcclxuICAgICAgICAgICAgaWYgKHRoaXMucGFyZW50IGluc3RhbmNlb2YgUm93T3JDb2x1bW4pXHJcbiAgICAgICAgICAgICAgICB0aGlzLnBhcmVudC5kb2NrKHRoaXMsIG1vZGUpO1xyXG4gICAgfVxyXG5cclxuICAgIHNldFNpemUoKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuZWxlbWVudC5jc3MoJ2Rpc3BsYXknKSA9PT0gJ25vbmUnKSByZXR1cm47XHJcbiAgICAgICAgdmFyIGlzRG9ja2VkID0gdGhpcy5fZG9ja2VyICYmIHRoaXMuX2RvY2tlci5kb2NrZWQsXHJcbiAgICAgICAgICAgIGNvbnRlbnQgPSB7XHJcbiAgICAgICAgICAgICAgICB3aWR0aDogdGhpcy5lbGVtZW50LndpZHRoKCksXHJcbiAgICAgICAgICAgICAgICBoZWlnaHQ6IHRoaXMuZWxlbWVudC5oZWlnaHQoKVxyXG4gICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICBpZiAodGhpcy5faGVhZGVyLnNob3cpXHJcbiAgICAgICAgICAgIGNvbnRlbnRbdGhpcy5fc2lkZWQgPyAnd2lkdGgnIDogJ2hlaWdodCddIC09IHRoaXMubGF5b3V0TWFuYWdlci5jb25maWcuZGltZW5zaW9ucy5oZWFkZXJIZWlnaHQ7XHJcbiAgICAgICAgaWYgKGlzRG9ja2VkKVxyXG4gICAgICAgICAgICBjb250ZW50W3RoaXMuX2RvY2tlci5kaW1lbnNpb25dID0gdGhpcy5fZG9ja2VyLnJlYWxTaXplO1xyXG4gICAgICAgIGlmICghaXNEb2NrZWQgfHwgdGhpcy5fZG9ja2VyLmRpbWVuc2lvbiA9PSAnaGVpZ2h0JylcclxuICAgICAgICAgICAgdGhpcy5jaGlsZEVsZW1lbnRDb250YWluZXIud2lkdGgoY29udGVudC53aWR0aCk7XHJcbiAgICAgICAgaWYgKCFpc0RvY2tlZCB8fCB0aGlzLl9kb2NrZXIuZGltZW5zaW9uID09ICd3aWR0aCcpXHJcbiAgICAgICAgICAgIHRoaXMuY2hpbGRFbGVtZW50Q29udGFpbmVyLmhlaWdodChjb250ZW50LmhlaWdodCk7XHJcblxyXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5jb250ZW50SXRlbXMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgdGhpcy5jb250ZW50SXRlbXNbaV0uZWxlbWVudC53aWR0aChjb250ZW50LndpZHRoKTtcclxuICAgICAgICAgICAgdGhpcy5jb250ZW50SXRlbXNbaV0uZWxlbWVudC5oZWlnaHQoY29udGVudC5oZWlnaHQpO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLmVtaXQoJ3Jlc2l6ZScpO1xyXG4gICAgICAgIHRoaXMuZW1pdEJ1YmJsaW5nRXZlbnQoJ3N0YXRlQ2hhbmdlZCcpO1xyXG4gICAgfVxyXG5cclxuICAgIF8kaW5pdCgpIHtcclxuICAgICAgICB2YXIgaSwgaW5pdGlhbEl0ZW07XHJcblxyXG4gICAgICAgIGlmICh0aGlzLmlzSW5pdGlhbGlzZWQgPT09IHRydWUpIHJldHVybjtcclxuXHJcbiAgICAgICAgQWJzdHJhY3RDb250ZW50SXRlbS5wcm90b3R5cGUuXyRpbml0LmNhbGwodGhpcyk7XHJcblxyXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCB0aGlzLmNvbnRlbnRJdGVtcy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICB0aGlzLmhlYWRlci5jcmVhdGVUYWIodGhpcy5jb250ZW50SXRlbXNbaV0pO1xyXG4gICAgICAgICAgICB0aGlzLmNvbnRlbnRJdGVtc1tpXS5fJGhpZGUoKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICh0aGlzLmNvbnRlbnRJdGVtcy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICAgIGluaXRpYWxJdGVtID0gdGhpcy5jb250ZW50SXRlbXNbdGhpcy5jb25maWcuYWN0aXZlSXRlbUluZGV4IHx8IDBdO1xyXG5cclxuICAgICAgICAgICAgaWYgKCFpbml0aWFsSXRlbSkge1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdDb25maWd1cmVkIGFjdGl2ZUl0ZW1JbmRleCBvdXQgb2YgYm91bmRzJyk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHRoaXMuc2V0QWN0aXZlQ29udGVudEl0ZW0oaW5pdGlhbEl0ZW0pO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLl8kdmFsaWRhdGVDbG9zYWJpbGl0eSgpO1x0XHRcclxuXHRcdGlmICh0aGlzLnBhcmVudCBpbnN0YW5jZW9mIFJvd09yQ29sdW1uKSB7XHJcblx0XHRcdHRoaXMucGFyZW50Ll92YWxpZGF0ZURvY2tpbmcoKTtcclxuXHRcdH1cclxuICAgIH1cclxuXHJcbiAgICBzZXRBY3RpdmVDb250ZW50SXRlbShjb250ZW50SXRlbSkge1xyXG4gICAgICAgIGlmICh0aGlzLl9hY3RpdmVDb250ZW50SXRlbSA9PT0gY29udGVudEl0ZW0pIHJldHVybjtcclxuXHJcbiAgICAgICAgaWYgKGluZGV4T2YoY29udGVudEl0ZW0sIHRoaXMuY29udGVudEl0ZW1zKSA9PT0gLTEpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdjb250ZW50SXRlbSBpcyBub3QgYSBjaGlsZCBvZiB0aGlzIHN0YWNrJyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAodGhpcy5fYWN0aXZlQ29udGVudEl0ZW0gIT09IG51bGwpIHtcclxuICAgICAgICAgICAgdGhpcy5fYWN0aXZlQ29udGVudEl0ZW0uXyRoaWRlKCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLl9hY3RpdmVDb250ZW50SXRlbSA9IGNvbnRlbnRJdGVtO1xyXG4gICAgICAgIHRoaXMuaGVhZGVyLnNldEFjdGl2ZUNvbnRlbnRJdGVtKGNvbnRlbnRJdGVtKTtcclxuICAgICAgICBjb250ZW50SXRlbS5fJHNob3coKTtcclxuICAgICAgICB0aGlzLmVtaXQoJ2FjdGl2ZUNvbnRlbnRJdGVtQ2hhbmdlZCcsIGNvbnRlbnRJdGVtKTtcclxuICAgICAgICB0aGlzLmxheW91dE1hbmFnZXIuZW1pdCgnYWN0aXZlQ29udGVudEl0ZW1DaGFuZ2VkJywgY29udGVudEl0ZW0pO1xyXG4gICAgICAgIHRoaXMuZW1pdEJ1YmJsaW5nRXZlbnQoJ3N0YXRlQ2hhbmdlZCcpO1xyXG4gICAgfVxyXG5cclxuICAgIGdldEFjdGl2ZUNvbnRlbnRJdGVtKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLmhlYWRlci5hY3RpdmVDb250ZW50SXRlbTtcclxuICAgIH1cclxuXHJcbiAgICBhZGRDaGlsZChjb250ZW50SXRlbSwgaW5kZXgpIHtcclxuICAgICAgICBpZihpbmRleCA+IHRoaXMuY29udGVudEl0ZW1zLmxlbmd0aCl7XHJcbiAgICAgICAgICAgIC8qIFxyXG4gICAgICAgICAgICAgKiBVR0xZIFBBVENIOiBQUiAjNDI4LCBjb21taXQgYTRlODRlYzUgZml4ZWQgYSBidWcgYXBwZWFyaW5nIG9uIHRvdWNoc2NyZWVucyBkdXJpbmcgdGhlIGRyYWcgb2YgYSBwYW5lbC4gXHJcbiAgICAgICAgICAgICAqIFRoZSBidWcgd2FzIGNhdXNlZCBieSB0aGUgcGh5c2ljYWwgcmVtb3ZhbCBvZiB0aGUgZWxlbWVudCBvbiBkcmFnOiBwYXJ0aWFsIGRvY3VtZW50YXRpb24gaXMgYXQgaXNzdWUgIzQyNS4gXHJcbiAgICAgICAgICAgICAqIFRoZSBmaXggaW50cm9kdWNlZCB0aGUgZnVuY3Rpb24gdW5kaXNwbGF5Q2hpbGQoKSAoY2FsbGVkICd1bmRpc3BsYXknIHRvIGRpZmZlcmVudGlhdGUgaXQgZnJvbSBqUXVlcnkuaGlkZSksIFxyXG4gICAgICAgICAgICAgKiB3aGljaCBkb2Vzbid0IHJlbW92ZSB0aGUgZWxlbWVudCBidXQgb25seSBoaWRlcyBpdDogdGhhdCdzIHdoeSB3aGVuIGEgdGFiIGlzIGRyYWdnZWQgJiBkcm9wcGVkIGludG8gaXRzIFxyXG4gICAgICAgICAgICAgKiBvcmlnaW5hbCBjb250YWluZXIgKGF0IHRoZSBlbmQpLCB0aGUgaW5kZXggaGVyZSBjb3VsZCBiZSBvZmYgYnkgb25lLlxyXG4gICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgaW5kZXggLT0gMVxyXG4gICAgICAgIH0gICAgICAgIFxyXG4gICAgICAgIGNvbnRlbnRJdGVtID0gdGhpcy5sYXlvdXRNYW5hZ2VyLl8kbm9ybWFsaXplQ29udGVudEl0ZW0oY29udGVudEl0ZW0sIHRoaXMpO1xyXG4gICAgICAgIEFic3RyYWN0Q29udGVudEl0ZW0ucHJvdG90eXBlLmFkZENoaWxkLmNhbGwodGhpcywgY29udGVudEl0ZW0sIGluZGV4KTtcclxuICAgICAgICB0aGlzLmNoaWxkRWxlbWVudENvbnRhaW5lci5hcHBlbmQoY29udGVudEl0ZW0uZWxlbWVudCk7XHJcbiAgICAgICAgdGhpcy5oZWFkZXIuY3JlYXRlVGFiKGNvbnRlbnRJdGVtLCBpbmRleCk7XHJcbiAgICAgICAgdGhpcy5zZXRBY3RpdmVDb250ZW50SXRlbShjb250ZW50SXRlbSk7XHJcbiAgICAgICAgdGhpcy5jYWxsRG93bndhcmRzKCdzZXRTaXplJyk7XHJcbiAgICAgICAgdGhpcy5fJHZhbGlkYXRlQ2xvc2FiaWxpdHkoKTtcclxuICAgICAgICBpZiAodGhpcy5wYXJlbnQgaW5zdGFuY2VvZiBSb3dPckNvbHVtbilcclxuICAgICAgICAgICAgdGhpcy5wYXJlbnQuX3ZhbGlkYXRlRG9ja2luZygpO1xyXG4gICAgICAgIHRoaXMuZW1pdEJ1YmJsaW5nRXZlbnQoJ3N0YXRlQ2hhbmdlZCcpO1xyXG4gICAgfVxyXG5cclxuICAgIHJlbW92ZUNoaWxkKGNvbnRlbnRJdGVtLCBrZWVwQ2hpbGQpIHtcclxuICAgICAgICB2YXIgaW5kZXggPSBpbmRleE9mKGNvbnRlbnRJdGVtLCB0aGlzLmNvbnRlbnRJdGVtcyk7XHJcbiAgICAgICAgQWJzdHJhY3RDb250ZW50SXRlbS5wcm90b3R5cGUucmVtb3ZlQ2hpbGQuY2FsbCh0aGlzLCBjb250ZW50SXRlbSwga2VlcENoaWxkKTtcclxuICAgICAgICB0aGlzLmhlYWRlci5yZW1vdmVUYWIoY29udGVudEl0ZW0pO1xyXG4gICAgICAgIGlmICh0aGlzLmhlYWRlci5hY3RpdmVDb250ZW50SXRlbSA9PT0gY29udGVudEl0ZW0pIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMuY29udGVudEl0ZW1zLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuc2V0QWN0aXZlQ29udGVudEl0ZW0odGhpcy5jb250ZW50SXRlbXNbTWF0aC5tYXgoaW5kZXggLSAxLCAwKV0pO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fYWN0aXZlQ29udGVudEl0ZW0gPSBudWxsO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLmNvbmZpZy5hY3RpdmVJdGVtSW5kZXggPj0gdGhpcy5jb250ZW50SXRlbXMubGVuZ3RoKSB7XHJcblx0XHRcdGlmICh0aGlzLmNvbnRlbnRJdGVtcy5sZW5ndGggPiAwKSB7XHJcblx0XHRcdFx0dmFyIGFjdGl2ZUluZGV4ID0gaW5kZXhPZih0aGlzLmdldEFjdGl2ZUNvbnRlbnRJdGVtKCksIHRoaXMuY29udGVudEl0ZW1zKTtcclxuXHRcdFx0XHR0aGlzLmNvbmZpZy5hY3RpdmVJdGVtSW5kZXggPSBNYXRoLm1heChhY3RpdmVJbmRleCwgMCk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcbiAgICAgICAgdGhpcy5fJHZhbGlkYXRlQ2xvc2FiaWxpdHkoKTtcclxuICAgICAgICBpZiAodGhpcy5wYXJlbnQgaW5zdGFuY2VvZiBSb3dPckNvbHVtbilcclxuICAgICAgICAgICAgdGhpcy5wYXJlbnQuX3ZhbGlkYXRlRG9ja2luZygpO1xyXG4gICAgICAgIHRoaXMuZW1pdEJ1YmJsaW5nRXZlbnQoJ3N0YXRlQ2hhbmdlZCcpO1xyXG4gICAgfVxyXG5cclxuICAgIHVuZGlzcGxheUNoaWxkKGNvbnRlbnRJdGVtKSB7XHJcbiAgICAgICAgaWYodGhpcy5jb250ZW50SXRlbXMubGVuZ3RoID4gMSl7XHJcbiAgICAgICAgICAgIHZhciBpbmRleCA9IGluZGV4T2YoY29udGVudEl0ZW0sIHRoaXMuY29udGVudEl0ZW1zKVxyXG4gICAgICAgICAgICBjb250ZW50SXRlbS5fJGhpZGUgJiYgY29udGVudEl0ZW0uXyRoaWRlKClcclxuICAgICAgICAgICAgdGhpcy5zZXRBY3RpdmVDb250ZW50SXRlbSh0aGlzLmNvbnRlbnRJdGVtc1tpbmRleCA9PT0gMCA/IGluZGV4KzEgOiBpbmRleC0xXSlcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICB0aGlzLmhlYWRlci5oaWRlVGFiKGNvbnRlbnRJdGVtKTtcclxuICAgICAgICAgICAgY29udGVudEl0ZW0uXyRoaWRlICYmIGNvbnRlbnRJdGVtLl8kaGlkZSgpXHJcbiAgICAgICAgICAgIEFic3RyYWN0Q29udGVudEl0ZW0ucHJvdG90eXBlLnVuZGlzcGxheUNoaWxkLmNhbGwodGhpcywgY29udGVudEl0ZW0pO1xyXG4gICAgICAgICAgICBpZiAodGhpcy5wYXJlbnQgaW5zdGFuY2VvZiBSb3dPckNvbHVtbilcclxuICAgICAgICAgICAgICAgIHRoaXMucGFyZW50Ll92YWxpZGF0ZURvY2tpbmcoKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5lbWl0QnViYmxpbmdFdmVudCgnc3RhdGVDaGFuZ2VkJyk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBWYWxpZGF0ZXMgdGhhdCB0aGUgc3RhY2sgaXMgc3RpbGwgY2xvc2FibGUgb3Igbm90LiBJZiBhIHN0YWNrIGlzIGFibGVcclxuICAgICAqIHRvIGNsb3NlLCBidXQgaGFzIGEgbm9uIGNsb3NhYmxlIGNvbXBvbmVudCBhZGRlZCB0byBpdCwgdGhlIHN0YWNrIGlzIG5vXHJcbiAgICAgKiBsb25nZXIgY2xvc2FibGUgdW50aWwgYWxsIGNvbXBvbmVudHMgYXJlIGNsb3NhYmxlLlxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHt2b2lkfVxyXG4gICAgICovXHJcbiAgICBfJHZhbGlkYXRlQ2xvc2FiaWxpdHkoKSB7XHJcbiAgICAgICAgdmFyIGNvbnRlbnRJdGVtLFxyXG4gICAgICAgICAgICBpc0Nsb3NhYmxlLFxyXG4gICAgICAgICAgICBsZW4sXHJcbiAgICAgICAgICAgIGk7XHJcblxyXG4gICAgICAgIGlzQ2xvc2FibGUgPSB0aGlzLmhlYWRlci5faXNDbG9zYWJsZSgpO1xyXG5cclxuICAgICAgICBmb3IgKGkgPSAwLCBsZW4gPSB0aGlzLmNvbnRlbnRJdGVtcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG4gICAgICAgICAgICBpZiAoIWlzQ2xvc2FibGUpIHtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBpc0Nsb3NhYmxlID0gdGhpcy5jb250ZW50SXRlbXNbaV0uY29uZmlnLmlzQ2xvc2FibGU7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLmhlYWRlci5fJHNldENsb3NhYmxlKGlzQ2xvc2FibGUpO1xyXG4gICAgfVxyXG5cclxuICAgIF8kZGVzdHJveSgpIHtcclxuICAgICAgICBBYnN0cmFjdENvbnRlbnRJdGVtLnByb3RvdHlwZS5fJGRlc3Ryb3kuY2FsbCh0aGlzKTtcclxuICAgICAgICB0aGlzLmhlYWRlci5fJGRlc3Ryb3koKTtcclxuICAgICAgICB0aGlzLmVsZW1lbnQub2ZmKCdtb3VzZWVudGVyIG1vdXNlbGVhdmUnKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIE9rLCB0aGlzIG9uZSBpcyBnb2luZyB0byBiZSB0aGUgdHJpY2t5IG9uZTogVGhlIHVzZXIgaGFzIGRyb3BwZWQge2NvbnRlbnRJdGVtfSBvbnRvIHRoaXMgc3RhY2suXHJcbiAgICAgKlxyXG4gICAgICogSXQgd2FzIGRyb3BwZWQgb24gZWl0aGVyIHRoZSBzdGFja3MgaGVhZGVyIG9yIHRoZSB0b3AsIHJpZ2h0LCBib3R0b20gb3IgbGVmdCBiaXQgb2YgdGhlIGNvbnRlbnQgYXJlYVxyXG4gICAgICogKHdoaWNoIG9uZSBvZiB0aG9zZSBpcyBzdG9yZWQgaW4gdGhpcy5fZHJvcFNlZ21lbnQpLiBOb3csIGlmIHRoZSB1c2VyIGhhcyBkcm9wcGVkIG9uIHRoZSBoZWFkZXIgdGhlIGNhc2VcclxuICAgICAqIGlzIHJlbGF0aXZlbHkgY2xlYXI6IFdlIGFkZCB0aGUgaXRlbSB0byB0aGUgZXhpc3Rpbmcgc3RhY2suLi4gam9iIGRvbmUgKG1pZ2h0IGJlIGdvb2QgdG8gaGF2ZVxyXG4gICAgICogdGFiIHJlb3JkZXJpbmcgYXQgc29tZSBwb2ludCwgYnV0IGxldHMgbm90IHN3ZWF0IGl0IHJpZ2h0IG5vdylcclxuICAgICAqXHJcbiAgICAgKiBJZiB0aGUgaXRlbSB3YXMgZHJvcHBlZCBvbiB0aGUgY29udGVudCBwYXJ0IHRoaW5ncyBhcmUgYSBiaXQgbW9yZSBjb21wbGljYXRlZC4gSWYgaXQgd2FzIGRyb3BwZWQgb24gZWl0aGVyIHRoZVxyXG4gICAgICogdG9wIG9yIGJvdHRvbSByZWdpb24gd2UgbmVlZCB0byBjcmVhdGUgYSBuZXcgY29sdW1uIGFuZCBwbGFjZSB0aGUgaXRlbXMgYWNjb3JkaW5nbHkuXHJcbiAgICAgKiBVbmxlc3MsIG9mIGNvdXJzZSBpZiB0aGUgc3RhY2sgaXMgYWxyZWFkeSB3aXRoaW4gYSBjb2x1bW4uLi4gaW4gd2hpY2ggY2FzZSB3ZSB3YW50XHJcbiAgICAgKiB0byBhZGQgdGhlIG5ld2x5IGNyZWF0ZWQgaXRlbSB0byB0aGUgZXhpc3RpbmcgY29sdW1uLi4uXHJcbiAgICAgKiBlaXRoZXIgcHJlcGVuZCBvciBhcHBlbmQgaXQsIGRlcGVuZGluZyBvbiB3ZXRoZXIgaXRzIHRvcCBvciBib3R0b20uXHJcbiAgICAgKlxyXG4gICAgICogU2FtZSB0aGluZyBmb3Igcm93cyBhbmQgbGVmdCAvIHJpZ2h0IGRyb3Agc2VnbWVudHMuLi4gc28gaW4gdG90YWwgdGhlcmUgYXJlIDkgdGhpbmdzIHRoYXQgY2FuIHBvdGVudGlhbGx5IGhhcHBlblxyXG4gICAgICogKGxlZnQsIHRvcCwgcmlnaHQsIGJvdHRvbSkgKiBpcyBjaGlsZCBvZiB0aGUgcmlnaHQgcGFyZW50IChyb3csIGNvbHVtbikgKyBoZWFkZXIgZHJvcFxyXG4gICAgICpcclxuICAgICAqIEBwYXJhbSAgICB7bG0uaXRlbX0gY29udGVudEl0ZW1cclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJucyB7dm9pZH1cclxuICAgICAqL1xyXG4gICAgXyRvbkRyb3AoY29udGVudEl0ZW0pIHtcclxuICAgICAgICAvKlxyXG4gICAgICAgICAqIFRoZSBpdGVtIHdhcyBkcm9wcGVkIG9uIHRoZSBoZWFkZXIgYXJlYS4gSnVzdCBhZGQgaXQgYXMgYSBjaGlsZCBvZiB0aGlzIHN0YWNrIGFuZFxyXG4gICAgICAgICAqIGdldCB0aGUgaGVsbCBvdXQgb2YgdGhpcyBsb2dpY1xyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGlmICh0aGlzLl9kcm9wU2VnbWVudCA9PT0gJ2hlYWRlcicpIHtcclxuICAgICAgICAgICAgdGhpcy5fcmVzZXRIZWFkZXJEcm9wWm9uZSgpO1xyXG4gICAgICAgICAgICB0aGlzLmFkZENoaWxkKGNvbnRlbnRJdGVtLCB0aGlzLl9kcm9wSW5kZXgpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvKlxyXG4gICAgICAgICAqIFRoZSBzdGFjayBpcyBlbXB0eS4gTGV0J3MganVzdCBhZGQgdGhlIGVsZW1lbnQuXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgaWYgKHRoaXMuX2Ryb3BTZWdtZW50ID09PSAnYm9keScpIHtcclxuICAgICAgICAgICAgdGhpcy5hZGRDaGlsZChjb250ZW50SXRlbSk7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8qXHJcbiAgICAgICAgICogVGhlIGl0ZW0gd2FzIGRyb3BwZWQgb24gdGhlIHRvcC0sIGxlZnQtLCBib3R0b20tIG9yIHJpZ2h0LSBwYXJ0IG9mIHRoZSBjb250ZW50LiBMZXQnc1xyXG4gICAgICAgICAqIGFnZ3JlZ2F0ZSBzb21lIGNvbmRpdGlvbnMgdG8gbWFrZSB0aGUgaWYgc3RhdGVtZW50cyBsYXRlciBvbiBtb3JlIHJlYWRhYmxlXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgdmFyIGlzVmVydGljYWwgPSB0aGlzLl9kcm9wU2VnbWVudCA9PT0gJ3RvcCcgfHwgdGhpcy5fZHJvcFNlZ21lbnQgPT09ICdib3R0b20nLFxyXG4gICAgICAgICAgICBpc0hvcml6b250YWwgPSB0aGlzLl9kcm9wU2VnbWVudCA9PT0gJ2xlZnQnIHx8IHRoaXMuX2Ryb3BTZWdtZW50ID09PSAncmlnaHQnLFxyXG4gICAgICAgICAgICBpbnNlcnRCZWZvcmUgPSB0aGlzLl9kcm9wU2VnbWVudCA9PT0gJ3RvcCcgfHwgdGhpcy5fZHJvcFNlZ21lbnQgPT09ICdsZWZ0JyxcclxuICAgICAgICAgICAgaGFzQ29ycmVjdFBhcmVudCA9IChpc1ZlcnRpY2FsICYmIHRoaXMucGFyZW50LmlzQ29sdW1uKSB8fCAoaXNIb3Jpem9udGFsICYmIHRoaXMucGFyZW50LmlzUm93KSxcclxuICAgICAgICAgICAgdHlwZSA9IGlzVmVydGljYWwgPyAnY29sdW1uJyA6ICdyb3cnLFxyXG4gICAgICAgICAgICBkaW1lbnNpb24gPSBpc1ZlcnRpY2FsID8gJ2hlaWdodCcgOiAnd2lkdGgnLFxyXG4gICAgICAgICAgICBpbmRleCxcclxuICAgICAgICAgICAgc3RhY2ssXHJcbiAgICAgICAgICAgIHJvd09yQ29sdW1uO1xyXG5cclxuICAgICAgICAvKlxyXG4gICAgICAgICAqIFRoZSBjb250ZW50IGl0ZW0gY2FuIGJlIGVpdGhlciBhIGNvbXBvbmVudCBvciBhIHN0YWNrLiBJZiBpdCBpcyBhIGNvbXBvbmVudCwgd3JhcCBpdCBpbnRvIGEgc3RhY2tcclxuICAgICAgICAgKi9cclxuICAgICAgICBpZiAoY29udGVudEl0ZW0uaXNDb21wb25lbnQpIHtcclxuICAgICAgICAgICAgc3RhY2sgPSB0aGlzLmxheW91dE1hbmFnZXIuY3JlYXRlQ29udGVudEl0ZW0oe1xyXG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0YWNrJyxcclxuICAgICAgICAgICAgICAgIGhlYWRlcjogY29udGVudEl0ZW0uY29uZmlnLmhlYWRlciB8fCB7fVxyXG4gICAgICAgICAgICB9LCB0aGlzKTtcclxuICAgICAgICAgICAgc3RhY2suXyRpbml0KCk7XHJcbiAgICAgICAgICAgIHN0YWNrLmFkZENoaWxkKGNvbnRlbnRJdGVtKTtcclxuICAgICAgICAgICAgY29udGVudEl0ZW0gPSBzdGFjaztcclxuICAgICAgICB9XHJcblxyXG5cclxuICAgICAgICAvKlxyXG4gICAgICAgICAqIElmIHRoZSBjb250ZW50SXRlbSB0aGF0J3MgYmVpbmcgZHJvcHBlZCBpcyBub3QgZHJvcHBlZCBvbiBhIFN0YWNrIChjYXNlcyB3aGljaCBqdXN0IHBhc3NlZCBhYm92ZSBhbmQgXHJcbiAgICAgICAgICogd2hpY2ggd291bGQgd3JhcCB0aGUgY29udGVudEl0ZW0gaW4gYSBTdGFjaykgd2UgbmVlZCB0byBjaGVjayB3aGV0aGVyIGNvbnRlbnRJdGVtIGlzIGEgUm93T3JDb2x1bW4uXHJcbiAgICAgICAgICogSWYgaXQgaXMsIHdlIG5lZWQgdG8gcmUtd3JhcCBpdCBpbiBhIFN0YWNrIGxpa2UgaXQgd2FzIHdoZW4gaXQgd2FzIGRyYWdnZWQgYnkgaXRzIFRhYiAoaXQgd2FzIGRyYWdnZWQhKS5cclxuICAgICAgICAgKi9cclxuICAgICAgICBpZihjb250ZW50SXRlbS5jb25maWcudHlwZSA9PT0gJ3JvdycgfHwgY29udGVudEl0ZW0uY29uZmlnLnR5cGUgPT09ICdjb2x1bW4nKXtcclxuICAgICAgICAgICAgc3RhY2sgPSB0aGlzLmxheW91dE1hbmFnZXIuY3JlYXRlQ29udGVudEl0ZW0oe1xyXG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0YWNrJ1xyXG4gICAgICAgICAgICB9LCB0aGlzKVxyXG4gICAgICAgICAgICBzdGFjay5hZGRDaGlsZChjb250ZW50SXRlbSlcclxuICAgICAgICAgICAgY29udGVudEl0ZW0gPSBzdGFja1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLypcclxuICAgICAgICAgKiBJZiB0aGUgaXRlbSBpcyBkcm9wcGVkIG9uIHRvcCBvciBib3R0b20gb2YgYSBjb2x1bW4gb3IgbGVmdCBhbmQgcmlnaHQgb2YgYSByb3csIGl0J3MgYWxyZWFkeVxyXG4gICAgICAgICAqIGxheWQgb3V0IGluIHRoZSBjb3JyZWN0IHdheS4gSnVzdCBhZGQgaXQgYXMgYSBjaGlsZFxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGlmIChoYXNDb3JyZWN0UGFyZW50KSB7XHJcbiAgICAgICAgICAgIGluZGV4ID0gaW5kZXhPZih0aGlzLCB0aGlzLnBhcmVudC5jb250ZW50SXRlbXMpO1xyXG4gICAgICAgICAgICB0aGlzLnBhcmVudC5hZGRDaGlsZChjb250ZW50SXRlbSwgaW5zZXJ0QmVmb3JlID8gaW5kZXggOiBpbmRleCArIDEsIHRydWUpO1xyXG4gICAgICAgICAgICB0aGlzLmNvbmZpZ1tkaW1lbnNpb25dICo9IDAuNTtcclxuICAgICAgICAgICAgY29udGVudEl0ZW0uY29uZmlnW2RpbWVuc2lvbl0gPSB0aGlzLmNvbmZpZ1tkaW1lbnNpb25dO1xyXG4gICAgICAgICAgICB0aGlzLnBhcmVudC5jYWxsRG93bndhcmRzKCdzZXRTaXplJyk7XHJcbiAgICAgICAgICAgIC8qXHJcbiAgICAgICAgICAgICAqIFRoaXMgaGFuZGxlcyBpdGVtcyB0aGF0IGFyZSBkcm9wcGVkIG9uIHRvcCBvciBib3R0b20gb2YgYSByb3cgb3IgbGVmdCAvIHJpZ2h0IG9mIGEgY29sdW1uLiBXZSBuZWVkXHJcbiAgICAgICAgICAgICAqIHRvIGNyZWF0ZSB0aGUgYXBwcm9wcmlhdGUgY29udGVudEl0ZW0gZm9yIHRoZW0gdG8gbGl2ZSBpblxyXG4gICAgICAgICAgICAgKi9cclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICB0eXBlID0gaXNWZXJ0aWNhbCA/ICdjb2x1bW4nIDogJ3Jvdyc7XHJcbiAgICAgICAgICAgIHJvd09yQ29sdW1uID0gdGhpcy5sYXlvdXRNYW5hZ2VyLmNyZWF0ZUNvbnRlbnRJdGVtKHtcclxuICAgICAgICAgICAgICAgIHR5cGU6IHR5cGVcclxuICAgICAgICAgICAgfSwgdGhpcyk7XHJcbiAgICAgICAgICAgIHRoaXMucGFyZW50LnJlcGxhY2VDaGlsZCh0aGlzLCByb3dPckNvbHVtbik7XHJcblxyXG4gICAgICAgICAgICByb3dPckNvbHVtbi5hZGRDaGlsZChjb250ZW50SXRlbSwgaW5zZXJ0QmVmb3JlID8gMCA6IHVuZGVmaW5lZCwgdHJ1ZSk7XHJcbiAgICAgICAgICAgIHJvd09yQ29sdW1uLmFkZENoaWxkKHRoaXMsIGluc2VydEJlZm9yZSA/IHVuZGVmaW5lZCA6IDAsIHRydWUpO1xyXG5cclxuICAgICAgICAgICAgdGhpcy5jb25maWdbZGltZW5zaW9uXSA9IDUwO1xyXG4gICAgICAgICAgICBjb250ZW50SXRlbS5jb25maWdbZGltZW5zaW9uXSA9IDUwO1xyXG4gICAgICAgICAgICByb3dPckNvbHVtbi5jYWxsRG93bndhcmRzKCdzZXRTaXplJyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMucGFyZW50Ll92YWxpZGF0ZURvY2tpbmcoKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIElmIHRoZSB1c2VyIGhvdmVycyBhYm92ZSB0aGUgaGVhZGVyIHBhcnQgb2YgdGhlIHN0YWNrLCBpbmRpY2F0ZSBkcm9wIHBvc2l0aW9ucyBmb3IgdGFicy5cclxuICAgICAqIG90aGVyd2lzZSBpbmRpY2F0ZSB3aGljaCBzZWdtZW50IG9mIHRoZSBib2R5IHRoZSBkcmFnZ2VkIGl0ZW0gd291bGQgYmUgZHJvcHBlZCBvblxyXG4gICAgICpcclxuICAgICAqIEBwYXJhbSAgICB7SW50fSB4IEFic29sdXRlIFNjcmVlbiBYXHJcbiAgICAgKiBAcGFyYW0gICAge0ludH0geSBBYnNvbHV0ZSBTY3JlZW4gWVxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHt2b2lkfVxyXG4gICAgICovXHJcbiAgICBfJGhpZ2hsaWdodERyb3Bab25lKHgsIHkpIHtcclxuICAgICAgICB2YXIgc2VnbWVudCwgYXJlYTtcclxuXHJcbiAgICAgICAgZm9yIChzZWdtZW50IGluIHRoaXMuX2NvbnRlbnRBcmVhRGltZW5zaW9ucykge1xyXG4gICAgICAgICAgICBhcmVhID0gdGhpcy5fY29udGVudEFyZWFEaW1lbnNpb25zW3NlZ21lbnRdLmhvdmVyQXJlYTtcclxuXHJcbiAgICAgICAgICAgIGlmIChhcmVhLngxIDwgeCAmJiBhcmVhLngyID4geCAmJiBhcmVhLnkxIDwgeSAmJiBhcmVhLnkyID4geSkge1xyXG5cclxuICAgICAgICAgICAgICAgIGlmIChzZWdtZW50ID09PSAnaGVhZGVyJykge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2Ryb3BTZWdtZW50ID0gJ2hlYWRlcic7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5faGlnaGxpZ2h0SGVhZGVyRHJvcFpvbmUodGhpcy5fc2lkZWQgPyB5IDogeCk7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3Jlc2V0SGVhZGVyRHJvcFpvbmUoKTtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9oaWdobGlnaHRCb2R5RHJvcFpvbmUoc2VnbWVudCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIF8kZ2V0QXJlYSgpIHtcclxuICAgICAgICBpZiAodGhpcy5lbGVtZW50LmNzcygnZGlzcGxheScpID09PSAnbm9uZScpIHtcclxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB2YXIgZ2V0QXJlYSA9IEFic3RyYWN0Q29udGVudEl0ZW0ucHJvdG90eXBlLl8kZ2V0QXJlYSxcclxuICAgICAgICAgICAgaGVhZGVyQXJlYSA9IGdldEFyZWEuY2FsbCh0aGlzLCB0aGlzLmhlYWRlci5lbGVtZW50KSxcclxuICAgICAgICAgICAgY29udGVudEFyZWEgPSBnZXRBcmVhLmNhbGwodGhpcywgdGhpcy5jaGlsZEVsZW1lbnRDb250YWluZXIpLFxyXG4gICAgICAgICAgICBjb250ZW50V2lkdGggPSBjb250ZW50QXJlYS54MiAtIGNvbnRlbnRBcmVhLngxLFxyXG4gICAgICAgICAgICBjb250ZW50SGVpZ2h0ID0gY29udGVudEFyZWEueTIgLSBjb250ZW50QXJlYS55MTtcclxuXHJcbiAgICAgICAgdGhpcy5fY29udGVudEFyZWFEaW1lbnNpb25zID0ge1xyXG4gICAgICAgICAgICBoZWFkZXI6IHtcclxuICAgICAgICAgICAgICAgIGhvdmVyQXJlYToge1xyXG4gICAgICAgICAgICAgICAgICAgIHgxOiBoZWFkZXJBcmVhLngxLFxyXG4gICAgICAgICAgICAgICAgICAgIHkxOiBoZWFkZXJBcmVhLnkxLFxyXG4gICAgICAgICAgICAgICAgICAgIHgyOiBoZWFkZXJBcmVhLngyLFxyXG4gICAgICAgICAgICAgICAgICAgIHkyOiBoZWFkZXJBcmVhLnkyXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgaGlnaGxpZ2h0QXJlYToge1xyXG4gICAgICAgICAgICAgICAgICAgIHgxOiBoZWFkZXJBcmVhLngxLFxyXG4gICAgICAgICAgICAgICAgICAgIHkxOiBoZWFkZXJBcmVhLnkxLFxyXG4gICAgICAgICAgICAgICAgICAgIHgyOiBoZWFkZXJBcmVhLngyLFxyXG4gICAgICAgICAgICAgICAgICAgIHkyOiBoZWFkZXJBcmVhLnkyXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBJZiB0aGlzIFN0YWNrIGlzIGEgcGFyZW50IHRvIHJvd3MsIGNvbHVtbnMgb3Igb3RoZXIgc3RhY2tzIG9ubHkgaXRzXHJcbiAgICAgICAgICogaGVhZGVyIGlzIGEgdmFsaWQgZHJvcHpvbmUuXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgaWYgKHRoaXMuX2FjdGl2ZUNvbnRlbnRJdGVtICYmIHRoaXMuX2FjdGl2ZUNvbnRlbnRJdGVtLmlzQ29tcG9uZW50ID09PSBmYWxzZSkge1xyXG4gICAgICAgICAgICByZXR1cm4gaGVhZGVyQXJlYTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIEhpZ2hsaWdodCB0aGUgZW50aXJlIGJvZHkgaWYgdGhlIHN0YWNrIGlzIGVtcHR5XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgaWYgKHRoaXMuY29udGVudEl0ZW1zLmxlbmd0aCA9PT0gMCkge1xyXG5cclxuICAgICAgICAgICAgdGhpcy5fY29udGVudEFyZWFEaW1lbnNpb25zLmJvZHkgPSB7XHJcbiAgICAgICAgICAgICAgICBob3ZlckFyZWE6IHtcclxuICAgICAgICAgICAgICAgICAgICB4MTogY29udGVudEFyZWEueDEsXHJcbiAgICAgICAgICAgICAgICAgICAgeTE6IGNvbnRlbnRBcmVhLnkxLFxyXG4gICAgICAgICAgICAgICAgICAgIHgyOiBjb250ZW50QXJlYS54MixcclxuICAgICAgICAgICAgICAgICAgICB5MjogY29udGVudEFyZWEueTJcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBoaWdobGlnaHRBcmVhOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgeDE6IGNvbnRlbnRBcmVhLngxLFxyXG4gICAgICAgICAgICAgICAgICAgIHkxOiBjb250ZW50QXJlYS55MSxcclxuICAgICAgICAgICAgICAgICAgICB4MjogY29udGVudEFyZWEueDIsXHJcbiAgICAgICAgICAgICAgICAgICAgeTI6IGNvbnRlbnRBcmVhLnkyXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH07XHJcblxyXG4gICAgICAgICAgICByZXR1cm4gZ2V0QXJlYS5jYWxsKHRoaXMsIHRoaXMuZWxlbWVudCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLl9jb250ZW50QXJlYURpbWVuc2lvbnMubGVmdCA9IHtcclxuICAgICAgICAgICAgaG92ZXJBcmVhOiB7XHJcbiAgICAgICAgICAgICAgICB4MTogY29udGVudEFyZWEueDEsXHJcbiAgICAgICAgICAgICAgICB5MTogY29udGVudEFyZWEueTEsXHJcbiAgICAgICAgICAgICAgICB4MjogY29udGVudEFyZWEueDEgKyBjb250ZW50V2lkdGggKiAwLjI1LFxyXG4gICAgICAgICAgICAgICAgeTI6IGNvbnRlbnRBcmVhLnkyXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIGhpZ2hsaWdodEFyZWE6IHtcclxuICAgICAgICAgICAgICAgIHgxOiBjb250ZW50QXJlYS54MSxcclxuICAgICAgICAgICAgICAgIHkxOiBjb250ZW50QXJlYS55MSxcclxuICAgICAgICAgICAgICAgIHgyOiBjb250ZW50QXJlYS54MSArIGNvbnRlbnRXaWR0aCAqIDAuNSxcclxuICAgICAgICAgICAgICAgIHkyOiBjb250ZW50QXJlYS55MlxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgdGhpcy5fY29udGVudEFyZWFEaW1lbnNpb25zLnRvcCA9IHtcclxuICAgICAgICAgICAgaG92ZXJBcmVhOiB7XHJcbiAgICAgICAgICAgICAgICB4MTogY29udGVudEFyZWEueDEgKyBjb250ZW50V2lkdGggKiAwLjI1LFxyXG4gICAgICAgICAgICAgICAgeTE6IGNvbnRlbnRBcmVhLnkxLFxyXG4gICAgICAgICAgICAgICAgeDI6IGNvbnRlbnRBcmVhLngxICsgY29udGVudFdpZHRoICogMC43NSxcclxuICAgICAgICAgICAgICAgIHkyOiBjb250ZW50QXJlYS55MSArIGNvbnRlbnRIZWlnaHQgKiAwLjVcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgaGlnaGxpZ2h0QXJlYToge1xyXG4gICAgICAgICAgICAgICAgeDE6IGNvbnRlbnRBcmVhLngxLFxyXG4gICAgICAgICAgICAgICAgeTE6IGNvbnRlbnRBcmVhLnkxLFxyXG4gICAgICAgICAgICAgICAgeDI6IGNvbnRlbnRBcmVhLngyLFxyXG4gICAgICAgICAgICAgICAgeTI6IGNvbnRlbnRBcmVhLnkxICsgY29udGVudEhlaWdodCAqIDAuNVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgdGhpcy5fY29udGVudEFyZWFEaW1lbnNpb25zLnJpZ2h0ID0ge1xyXG4gICAgICAgICAgICBob3ZlckFyZWE6IHtcclxuICAgICAgICAgICAgICAgIHgxOiBjb250ZW50QXJlYS54MSArIGNvbnRlbnRXaWR0aCAqIDAuNzUsXHJcbiAgICAgICAgICAgICAgICB5MTogY29udGVudEFyZWEueTEsXHJcbiAgICAgICAgICAgICAgICB4MjogY29udGVudEFyZWEueDIsXHJcbiAgICAgICAgICAgICAgICB5MjogY29udGVudEFyZWEueTJcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgaGlnaGxpZ2h0QXJlYToge1xyXG4gICAgICAgICAgICAgICAgeDE6IGNvbnRlbnRBcmVhLngxICsgY29udGVudFdpZHRoICogMC41LFxyXG4gICAgICAgICAgICAgICAgeTE6IGNvbnRlbnRBcmVhLnkxLFxyXG4gICAgICAgICAgICAgICAgeDI6IGNvbnRlbnRBcmVhLngyLFxyXG4gICAgICAgICAgICAgICAgeTI6IGNvbnRlbnRBcmVhLnkyXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICB0aGlzLl9jb250ZW50QXJlYURpbWVuc2lvbnMuYm90dG9tID0ge1xyXG4gICAgICAgICAgICBob3ZlckFyZWE6IHtcclxuICAgICAgICAgICAgICAgIHgxOiBjb250ZW50QXJlYS54MSArIGNvbnRlbnRXaWR0aCAqIDAuMjUsXHJcbiAgICAgICAgICAgICAgICB5MTogY29udGVudEFyZWEueTEgKyBjb250ZW50SGVpZ2h0ICogMC41LFxyXG4gICAgICAgICAgICAgICAgeDI6IGNvbnRlbnRBcmVhLngxICsgY29udGVudFdpZHRoICogMC43NSxcclxuICAgICAgICAgICAgICAgIHkyOiBjb250ZW50QXJlYS55MlxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBoaWdobGlnaHRBcmVhOiB7XHJcbiAgICAgICAgICAgICAgICB4MTogY29udGVudEFyZWEueDEsXHJcbiAgICAgICAgICAgICAgICB5MTogY29udGVudEFyZWEueTEgKyBjb250ZW50SGVpZ2h0ICogMC41LFxyXG4gICAgICAgICAgICAgICAgeDI6IGNvbnRlbnRBcmVhLngyLFxyXG4gICAgICAgICAgICAgICAgeTI6IGNvbnRlbnRBcmVhLnkyXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICByZXR1cm4gZ2V0QXJlYS5jYWxsKHRoaXMsIHRoaXMuZWxlbWVudCk7XHJcbiAgICB9XHJcblxyXG4gICAgX2hpZ2hsaWdodEhlYWRlckRyb3Bab25lKHgpIHtcclxuICAgICAgICB2YXIgaSxcclxuICAgICAgICAgICAgdGFiRWxlbWVudCxcclxuICAgICAgICAgICAgdGFic0xlbmd0aCA9IHRoaXMuaGVhZGVyLnRhYnMubGVuZ3RoLFxyXG4gICAgICAgICAgICBpc0Fib3ZlVGFiID0gZmFsc2UsXHJcbiAgICAgICAgICAgIHRhYlRvcCxcclxuICAgICAgICAgICAgdGFiTGVmdCxcclxuICAgICAgICAgICAgb2Zmc2V0LFxyXG4gICAgICAgICAgICBwbGFjZUhvbGRlckxlZnQsXHJcbiAgICAgICAgICAgIGhlYWRlck9mZnNldCxcclxuICAgICAgICAgICAgdGFiV2lkdGgsXHJcbiAgICAgICAgICAgIGhhbGZYO1xyXG5cclxuICAgICAgICAvLyBFbXB0eSBzdGFja1xyXG4gICAgICAgIGlmICh0YWJzTGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICAgIGhlYWRlck9mZnNldCA9IHRoaXMuaGVhZGVyLmVsZW1lbnQub2Zmc2V0KCk7XHJcblxyXG4gICAgICAgICAgICB0aGlzLmxheW91dE1hbmFnZXIuZHJvcFRhcmdldEluZGljYXRvci5oaWdobGlnaHRBcmVhKHtcclxuICAgICAgICAgICAgICAgIHgxOiBoZWFkZXJPZmZzZXQubGVmdCxcclxuICAgICAgICAgICAgICAgIHgyOiBoZWFkZXJPZmZzZXQubGVmdCArIDEwMCxcclxuICAgICAgICAgICAgICAgIHkxOiBoZWFkZXJPZmZzZXQudG9wICsgdGhpcy5oZWFkZXIuZWxlbWVudC5oZWlnaHQoKSAtIDIwLFxyXG4gICAgICAgICAgICAgICAgeTI6IGhlYWRlck9mZnNldC50b3AgKyB0aGlzLmhlYWRlci5lbGVtZW50LmhlaWdodCgpXHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IHRhYnNMZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICB0YWJFbGVtZW50ID0gdGhpcy5oZWFkZXIudGFic1tpXS5lbGVtZW50O1xyXG4gICAgICAgICAgICBvZmZzZXQgPSB0YWJFbGVtZW50Lm9mZnNldCgpO1xyXG4gICAgICAgICAgICBpZiAodGhpcy5fc2lkZWQpIHtcclxuICAgICAgICAgICAgICAgIHRhYkxlZnQgPSBvZmZzZXQudG9wO1xyXG4gICAgICAgICAgICAgICAgdGFiVG9wID0gb2Zmc2V0LmxlZnQ7XHJcbiAgICAgICAgICAgICAgICB0YWJXaWR0aCA9IHRhYkVsZW1lbnQuaGVpZ2h0KCk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICB0YWJMZWZ0ID0gb2Zmc2V0LmxlZnQ7XHJcbiAgICAgICAgICAgICAgICB0YWJUb3AgPSBvZmZzZXQudG9wO1xyXG4gICAgICAgICAgICAgICAgdGFiV2lkdGggPSB0YWJFbGVtZW50LndpZHRoKCk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGlmICh4ID4gdGFiTGVmdCAmJiB4IDwgdGFiTGVmdCArIHRhYldpZHRoKSB7XHJcbiAgICAgICAgICAgICAgICBpc0Fib3ZlVGFiID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoaXNBYm92ZVRhYiA9PT0gZmFsc2UgJiYgeCA8IHRhYkxlZnQpIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaGFsZlggPSB0YWJMZWZ0ICsgdGFiV2lkdGggLyAyO1xyXG5cclxuICAgICAgICBpZiAoeCA8IGhhbGZYKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2Ryb3BJbmRleCA9IGk7XHJcbiAgICAgICAgICAgIHRhYkVsZW1lbnQuYmVmb3JlKHRoaXMubGF5b3V0TWFuYWdlci50YWJEcm9wUGxhY2Vob2xkZXIpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2Ryb3BJbmRleCA9IE1hdGgubWluKGkgKyAxLCB0YWJzTGVuZ3RoKTtcclxuICAgICAgICAgICAgdGFiRWxlbWVudC5hZnRlcih0aGlzLmxheW91dE1hbmFnZXIudGFiRHJvcFBsYWNlaG9sZGVyKTtcclxuICAgICAgICB9XHJcblxyXG5cclxuICAgICAgICBpZiAodGhpcy5fc2lkZWQpIHtcclxuICAgICAgICAgICAgdmFyIHBsYWNlSG9sZGVyVG9wID0gdGhpcy5sYXlvdXRNYW5hZ2VyLnRhYkRyb3BQbGFjZWhvbGRlci5vZmZzZXQoKS50b3A7XHJcbiAgICAgICAgICAgIHRoaXMubGF5b3V0TWFuYWdlci5kcm9wVGFyZ2V0SW5kaWNhdG9yLmhpZ2hsaWdodEFyZWEoe1xyXG4gICAgICAgICAgICAgICAgeDE6IHRhYlRvcCxcclxuICAgICAgICAgICAgICAgIHgyOiB0YWJUb3AgKyB0YWJFbGVtZW50LmlubmVySGVpZ2h0KCksXHJcbiAgICAgICAgICAgICAgICB5MTogcGxhY2VIb2xkZXJUb3AsXHJcbiAgICAgICAgICAgICAgICB5MjogcGxhY2VIb2xkZXJUb3AgKyB0aGlzLmxheW91dE1hbmFnZXIudGFiRHJvcFBsYWNlaG9sZGVyLndpZHRoKClcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgcGxhY2VIb2xkZXJMZWZ0ID0gdGhpcy5sYXlvdXRNYW5hZ2VyLnRhYkRyb3BQbGFjZWhvbGRlci5vZmZzZXQoKS5sZWZ0O1xyXG5cclxuICAgICAgICB0aGlzLmxheW91dE1hbmFnZXIuZHJvcFRhcmdldEluZGljYXRvci5oaWdobGlnaHRBcmVhKHtcclxuICAgICAgICAgICAgeDE6IHBsYWNlSG9sZGVyTGVmdCxcclxuICAgICAgICAgICAgeDI6IHBsYWNlSG9sZGVyTGVmdCArIHRoaXMubGF5b3V0TWFuYWdlci50YWJEcm9wUGxhY2Vob2xkZXIud2lkdGgoKSxcclxuICAgICAgICAgICAgeTE6IHRhYlRvcCxcclxuICAgICAgICAgICAgeTI6IHRhYlRvcCArIHRhYkVsZW1lbnQuaW5uZXJIZWlnaHQoKVxyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIF9yZXNldEhlYWRlckRyb3Bab25lKCkge1xyXG4gICAgICAgIHRoaXMubGF5b3V0TWFuYWdlci50YWJEcm9wUGxhY2Vob2xkZXIucmVtb3ZlKCk7XHJcbiAgICB9XHJcblxyXG4gICAgdG9nZ2xlTWF4aW1pc2UoZSkge1xyXG4gICAgICAgIGlmICghdGhpcy5pc01heGltaXNlZClcclxuICAgICAgICAgICAgdGhpcy5kb2NrKGZhbHNlKTtcclxuICAgICAgICBBYnN0cmFjdENvbnRlbnRJdGVtLnByb3RvdHlwZS50b2dnbGVNYXhpbWlzZS5jYWxsKHRoaXMsIGUpO1xyXG4gICAgfVxyXG5cclxuICAgIF9zZXR1cEhlYWRlclBvc2l0aW9uKCkge1xyXG4gICAgICAgIHZhciBzaWRlID0gWydyaWdodCcsICdsZWZ0JywgJ2JvdHRvbSddLmluZGV4T2YodGhpcy5faGVhZGVyLnNob3cpID49IDAgJiYgdGhpcy5faGVhZGVyLnNob3c7XHJcbiAgICAgICAgdGhpcy5oZWFkZXIuZWxlbWVudC50b2dnbGUoISF0aGlzLl9oZWFkZXIuc2hvdyk7XHJcbiAgICAgICAgdGhpcy5fc2lkZSA9IHNpZGU7XHJcbiAgICAgICAgdGhpcy5fc2lkZWQgPSBbJ3JpZ2h0JywgJ2xlZnQnXS5pbmRleE9mKHRoaXMuX3NpZGUpID49IDA7XHJcbiAgICAgICAgdGhpcy5lbGVtZW50LnJlbW92ZUNsYXNzKCdsbV9sZWZ0IGxtX3JpZ2h0IGxtX2JvdHRvbScpO1xyXG4gICAgICAgIGlmICh0aGlzLl9zaWRlKVxyXG4gICAgICAgICAgICB0aGlzLmVsZW1lbnQuYWRkQ2xhc3MoJ2xtXycgKyB0aGlzLl9zaWRlKTtcclxuICAgICAgICBpZiAodGhpcy5lbGVtZW50LmZpbmQoJy5sbV9oZWFkZXInKS5sZW5ndGggJiYgdGhpcy5jaGlsZEVsZW1lbnRDb250YWluZXIpIHtcclxuICAgICAgICAgICAgdmFyIGhlYWRlclBvc2l0aW9uID0gWydyaWdodCcsICdib3R0b20nXS5pbmRleE9mKHRoaXMuX3NpZGUpID49IDAgPyAnYmVmb3JlJyA6ICdhZnRlcic7XHJcbiAgICAgICAgICAgIHRoaXMuaGVhZGVyLmVsZW1lbnRbaGVhZGVyUG9zaXRpb25dKHRoaXMuY2hpbGRFbGVtZW50Q29udGFpbmVyKTtcclxuICAgICAgICAgICAgdGhpcy5jYWxsRG93bndhcmRzKCdzZXRTaXplJyk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIF9oaWdobGlnaHRCb2R5RHJvcFpvbmUoc2VnbWVudCkge1xyXG4gICAgICAgIHZhciBoaWdobGlnaHRBcmVhID0gdGhpcy5fY29udGVudEFyZWFEaW1lbnNpb25zW3NlZ21lbnRdLmhpZ2hsaWdodEFyZWE7XHJcbiAgICAgICAgdGhpcy5sYXlvdXRNYW5hZ2VyLmRyb3BUYXJnZXRJbmRpY2F0b3IuaGlnaGxpZ2h0QXJlYShoaWdobGlnaHRBcmVhKTtcclxuICAgICAgICB0aGlzLl9kcm9wU2VnbWVudCA9IHNlZ21lbnQ7XHJcbiAgICB9XHJcbn1cclxuIiwiXHJcblxyXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBCdWJibGluZ0V2ZW50IHtcclxuICAgIGNvbnN0cnVjdG9yKG5hbWUsIG9yaWdpbikge1xyXG4gICAgICAgIHRoaXMubmFtZSA9IG5hbWU7XHJcbiAgICAgICAgdGhpcy5vcmlnaW4gPSBvcmlnaW47XHJcbiAgICAgICAgdGhpcy5pc1Byb3BhZ2F0aW9uU3RvcHBlZCA9IGZhbHNlO1xyXG4gICAgfVxyXG5cclxuICAgIHN0b3BQcm9wYWdhdGlvbigpIHtcclxuICAgICAgICB0aGlzLmlzUHJvcGFnYXRpb25TdG9wcGVkID0gdHJ1ZTtcclxuICAgIH1cclxufVxyXG4iLCJpbXBvcnQge1xyXG4gICAgaW5kZXhPZlxyXG59IGZyb20gJy4uL3V0aWxzL3V0aWxzJ1xyXG5cclxuLyoqXHJcbiAqIE1pbmlmaWVzIGFuZCB1bm1pbmlmaWVzIGNvbmZpZ3MgYnkgcmVwbGFjaW5nIGZyZXF1ZW50IGtleXNcclxuICogYW5kIHZhbHVlcyB3aXRoIG9uZSBsZXR0ZXIgc3Vic3RpdHV0ZXMuIENvbmZpZyBvcHRpb25zIG11c3RcclxuICogcmV0YWluIGFycmF5IHBvc2l0aW9uL2luZGV4LCBhZGQgbmV3IG9wdGlvbnMgYXQgdGhlIGVuZC5cclxuICpcclxuICogQGNvbnN0cnVjdG9yXHJcbiAqL1xyXG5cclxuXHJcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIENvbmZpZ01pbmlmaWVyIHtcclxuICAgIGNvbnN0cnVjdG9yKCkge1xyXG4gICAgICAgIHRoaXMuX2tleXMgPSBbXHJcbiAgICAgICAgICAgICdzZXR0aW5ncycsXHJcbiAgICAgICAgICAgICdoYXNIZWFkZXJzJyxcclxuICAgICAgICAgICAgJ2NvbnN0cmFpbkRyYWdUb0NvbnRhaW5lcicsXHJcbiAgICAgICAgICAgICdzZWxlY3Rpb25FbmFibGVkJyxcclxuICAgICAgICAgICAgJ2RpbWVuc2lvbnMnLFxyXG4gICAgICAgICAgICAnYm9yZGVyV2lkdGgnLFxyXG4gICAgICAgICAgICAnbWluSXRlbUhlaWdodCcsXHJcbiAgICAgICAgICAgICdtaW5JdGVtV2lkdGgnLFxyXG4gICAgICAgICAgICAnaGVhZGVySGVpZ2h0JyxcclxuICAgICAgICAgICAgJ2RyYWdQcm94eVdpZHRoJyxcclxuICAgICAgICAgICAgJ2RyYWdQcm94eUhlaWdodCcsXHJcbiAgICAgICAgICAgICdsYWJlbHMnLFxyXG4gICAgICAgICAgICAnY2xvc2UnLFxyXG4gICAgICAgICAgICAnbWF4aW1pc2UnLFxyXG4gICAgICAgICAgICAnbWluaW1pc2UnLFxyXG4gICAgICAgICAgICAncG9wb3V0JyxcclxuICAgICAgICAgICAgJ2NvbnRlbnQnLFxyXG4gICAgICAgICAgICAnY29tcG9uZW50TmFtZScsXHJcbiAgICAgICAgICAgICdjb21wb25lbnRTdGF0ZScsXHJcbiAgICAgICAgICAgICdpZCcsXHJcbiAgICAgICAgICAgICd3aWR0aCcsXHJcbiAgICAgICAgICAgICd0eXBlJyxcclxuICAgICAgICAgICAgJ2hlaWdodCcsXHJcbiAgICAgICAgICAgICdpc0Nsb3NhYmxlJyxcclxuICAgICAgICAgICAgJ3RpdGxlJyxcclxuICAgICAgICAgICAgJ3BvcG91dFdob2xlU3RhY2snLFxyXG4gICAgICAgICAgICAnb3BlblBvcG91dHMnLFxyXG4gICAgICAgICAgICAncGFyZW50SWQnLFxyXG4gICAgICAgICAgICAnYWN0aXZlSXRlbUluZGV4JyxcclxuICAgICAgICAgICAgJ3Jlb3JkZXJFbmFibGVkJyxcclxuICAgICAgICAgICAgJ2JvcmRlckdyYWJXaWR0aCcsXHJcblxyXG5cclxuXHJcblxyXG4gICAgICAgICAgICAvL01heGltdW0gMzYgZW50cmllcywgZG8gbm90IGNyb3NzIHRoaXMgbGluZSFcclxuICAgICAgICBdO1xyXG4gICAgICAgIGlmICh0aGlzLl9rZXlzLmxlbmd0aCA+IDM2KSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVG9vIG1hbnkga2V5cyBpbiBjb25maWcgbWluaWZpZXIgbWFwJyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLl92YWx1ZXMgPSBbXHJcbiAgICAgICAgICAgIHRydWUsXHJcbiAgICAgICAgICAgIGZhbHNlLFxyXG4gICAgICAgICAgICAncm93JyxcclxuICAgICAgICAgICAgJ2NvbHVtbicsXHJcbiAgICAgICAgICAgICdzdGFjaycsXHJcbiAgICAgICAgICAgICdjb21wb25lbnQnLFxyXG4gICAgICAgICAgICAnY2xvc2UnLFxyXG4gICAgICAgICAgICAnbWF4aW1pc2UnLFxyXG4gICAgICAgICAgICAnbWluaW1pc2UnLFxyXG4gICAgICAgICAgICAnb3BlbiBpbiBuZXcgd2luZG93J1xyXG4gICAgICAgIF07XHJcbiAgICB9XHJcblxyXG5cclxuICAgIC8qKlxyXG4gICAgICogVGFrZXMgYSBHb2xkZW5MYXlvdXQgY29uZmlndXJhdGlvbiBvYmplY3QgYW5kXHJcbiAgICAgKiByZXBsYWNlcyBpdHMga2V5cyBhbmQgdmFsdWVzIHJlY3Vyc2l2ZWx5IHdpdGhcclxuICAgICAqIG9uZSBsZXR0ZXIgY291bnRlcnBhcnRzXHJcbiAgICAgKlxyXG4gICAgICogQHBhcmFtICAge09iamVjdH0gY29uZmlnIEEgR29sZGVuTGF5b3V0IGNvbmZpZyBvYmplY3RcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBtaW5pZmllZCBjb25maWdcclxuICAgICAqL1xyXG4gICAgbWluaWZ5Q29uZmlnKGNvbmZpZykge1xyXG4gICAgICAgIHZhciBtaW4gPSB7fTtcclxuICAgICAgICB0aGlzLl9uZXh0TGV2ZWwoY29uZmlnLCBtaW4sICdfbWluJyk7XHJcbiAgICAgICAgcmV0dXJuIG1pbjtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFRha2VzIGEgY29uZmlndXJhdGlvbiBPYmplY3QgdGhhdCB3YXMgcHJldmlvdXNseSBtaW5pZmllZFxyXG4gICAgICogdXNpbmcgbWluaWZ5Q29uZmlnIGFuZCByZXR1cm5zIGl0cyBvcmlnaW5hbCB2ZXJzaW9uXHJcbiAgICAgKlxyXG4gICAgICogQHBhcmFtICAge09iamVjdH0gbWluaWZpZWRDb25maWdcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSB0aGUgb3JpZ2luYWwgY29uZmlndXJhdGlvblxyXG4gICAgICovXHJcbiAgICB1bm1pbmlmeUNvbmZpZyhtaW5pZmllZENvbmZpZykge1xyXG4gICAgICAgIHZhciBvcmlnID0ge307XHJcbiAgICAgICAgdGhpcy5fbmV4dExldmVsKG1pbmlmaWVkQ29uZmlnLCBvcmlnLCAnX21heCcpO1xyXG4gICAgICAgIHJldHVybiBvcmlnO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUmVjdXJzaXZlIGZ1bmN0aW9uLCBjYWxsZWQgZm9yIGV2ZXJ5IGxldmVsIG9mIHRoZSBjb25maWcgc3RydWN0dXJlXHJcbiAgICAgKlxyXG4gICAgICogQHBhcmFtICAge0FycmF5fE9iamVjdH0gb3JpZ1xyXG4gICAgICogQHBhcmFtICAge0FycmF5fE9iamVjdH0gbWluXHJcbiAgICAgKiBAcGFyYW0gICAge1N0cmluZ30gdHJhbnNsYXRpb25GblxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHt2b2lkfVxyXG4gICAgICovXHJcbiAgICBfbmV4dExldmVsKGZyb20sIHRvLCB0cmFuc2xhdGlvbkZuKSB7XHJcbiAgICAgICAgdmFyIGtleSwgbWluS2V5O1xyXG5cclxuICAgICAgICBmb3IgKGtleSBpbiBmcm9tKSB7XHJcblxyXG4gICAgICAgICAgICAvKipcclxuICAgICAgICAgICAgICogRm9yIGluIHJldHVybnMgYXJyYXkgaW5kaWNlcyBhcyBrZXlzLCBzbyBsZXQncyBjYXN0IHRoZW0gdG8gbnVtYmVyc1xyXG4gICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgaWYgKGZyb20gaW5zdGFuY2VvZiBBcnJheSkga2V5ID0gcGFyc2VJbnQoa2V5LCAxMCk7XHJcblxyXG4gICAgICAgICAgICAvKipcclxuICAgICAgICAgICAgICogSW4gY2FzZSBzb21ldGhpbmcgaGFzIGV4dGVuZGVkIE9iamVjdCBwcm90b3R5cGVzXHJcbiAgICAgICAgICAgICAqL1xyXG4gICAgICAgICAgICBpZiAoIWZyb20uaGFzT3duUHJvcGVydHkoa2V5KSkgY29udGludWU7XHJcblxyXG4gICAgICAgICAgICAvKipcclxuICAgICAgICAgICAgICogVHJhbnNsYXRlIHRoZSBrZXkgdG8gYSBvbmUgbGV0dGVyIHN1YnN0aXR1dGVcclxuICAgICAgICAgICAgICovXHJcbiAgICAgICAgICAgIG1pbktleSA9IHRoaXNbdHJhbnNsYXRpb25Gbl0oa2V5LCB0aGlzLl9rZXlzKTtcclxuXHJcbiAgICAgICAgICAgIC8qKlxyXG4gICAgICAgICAgICAgKiBGb3IgQXJyYXlzIGFuZCBPYmplY3RzLCBjcmVhdGUgYSBuZXcgQXJyYXkvT2JqZWN0XHJcbiAgICAgICAgICAgICAqIG9uIHRoZSBtaW5pZmllZCBvYmplY3QgYW5kIHJlY3Vyc2UgaW50byBpdFxyXG4gICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgaWYgKHR5cGVvZiBmcm9tW2tleV0gPT09ICdvYmplY3QnKSB7XHJcbiAgICAgICAgICAgICAgICB0b1ttaW5LZXldID0gZnJvbVtrZXldIGluc3RhbmNlb2YgQXJyYXkgPyBbXSA6IHt9O1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fbmV4dExldmVsKGZyb21ba2V5XSwgdG9bbWluS2V5XSwgdHJhbnNsYXRpb25Gbik7XHJcblxyXG4gICAgICAgICAgICAgICAgLyoqXHJcbiAgICAgICAgICAgICAgICAgKiBGb3IgcHJpbWl0aXZlIHZhbHVlcyAoU3RyaW5ncywgTnVtYmVycywgQm9vbGVhbiBldGMuKVxyXG4gICAgICAgICAgICAgICAgICogbWluaWZ5IHRoZSB2YWx1ZVxyXG4gICAgICAgICAgICAgICAgICovXHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICB0b1ttaW5LZXldID0gdGhpc1t0cmFuc2xhdGlvbkZuXShmcm9tW2tleV0sIHRoaXMuX3ZhbHVlcyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBNaW5pZmllcyB2YWx1ZSBiYXNlZCBvbiBhIGRpY3Rpb25hcnlcclxuICAgICAqXHJcbiAgICAgKiBAcGFyYW0gICB7U3RyaW5nfEJvb2xlYW59IHZhbHVlXHJcbiAgICAgKiBAcGFyYW0gICB7QXJyYXk8U3RyaW5nfEJvb2xlYW4+fSBkaWN0aW9uYXJ5XHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge1N0cmluZ30gVGhlIG1pbmlmaWVkIHZlcnNpb25cclxuICAgICAqL1xyXG4gICAgX21pbih2YWx1ZSwgZGljdGlvbmFyeSkge1xyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIElmIGEgdmFsdWUgYWN0dWFsbHkgaXMgYSBzaW5nbGUgY2hhcmFjdGVyLCBwcmVmaXggaXRcclxuICAgICAgICAgKiB3aXRoIF9fXyB0byBhdm9pZCBtaXN0YWtpbmcgaXQgZm9yIGEgbWluaWZpY2F0aW9uIGNvZGVcclxuICAgICAgICAgKi9cclxuICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJyAmJiB2YWx1ZS5sZW5ndGggPT09IDEpIHtcclxuICAgICAgICAgICAgcmV0dXJuICdfX18nICsgdmFsdWU7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB2YXIgaW5kZXggPSBpbmRleE9mKHZhbHVlLCBkaWN0aW9uYXJ5KTtcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogdmFsdWUgbm90IGZvdW5kIGluIHRoZSBkaWN0aW9uYXJ5LCByZXR1cm4gaXQgdW5tb2RpZmllZFxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGlmIChpbmRleCA9PT0gLTEpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHZhbHVlO1xyXG5cclxuICAgICAgICAgICAgLyoqXHJcbiAgICAgICAgICAgICAqIHZhbHVlIGZvdW5kIGluIGRpY3Rpb25hcnksIHJldHVybiBpdHMgYmFzZTM2IGNvdW50ZXJwYXJ0XHJcbiAgICAgICAgICAgICAqL1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHJldHVybiBpbmRleC50b1N0cmluZygzNik7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIF9tYXgodmFsdWUsIGRpY3Rpb25hcnkpIHtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiB2YWx1ZSBpcyBhIHNpbmdsZSBjaGFyYWN0ZXIuIEFzc3VtZSB0aGF0IGl0J3MgYSB0cmFuc2xhdGlvblxyXG4gICAgICAgICAqIGFuZCByZXR1cm4gdGhlIG9yaWdpbmFsIHZhbHVlIGZyb20gdGhlIGRpY3Rpb25hcnlcclxuICAgICAgICAgKi9cclxuICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJyAmJiB2YWx1ZS5sZW5ndGggPT09IDEpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGRpY3Rpb25hcnlbcGFyc2VJbnQodmFsdWUsIDM2KV07XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAgKiB2YWx1ZSBvcmlnaW5hbGx5IHdhcyBhIHNpbmdsZSBjaGFyYWN0ZXIgYW5kIHdhcyBwcmVmaXhlZCB3aXRoIF9fX1xyXG4gICAgICAgICAqIHRvIGF2b2lkIG1pc3Rha2luZyBpdCBmb3IgYSB0cmFuc2xhdGlvbi4gUmVtb3ZlIHRoZSBwcmVmaXhcclxuICAgICAgICAgKiBhbmQgcmV0dXJuIHRoZSBvcmlnaW5hbCBjaGFyYWN0ZXJcclxuICAgICAgICAgKi9cclxuICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJyAmJiB2YWx1ZS5zdWJzdHIoMCwgMykgPT09ICdfX18nKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB2YWx1ZVszXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogdmFsdWUgd2FzIG5vdCBtaW5pZmllZFxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHJldHVybiB2YWx1ZTtcclxuICAgIH1cclxufVxyXG5cclxuIiwiaW1wb3J0IEV2ZW50RW1pdHRlciBmcm9tICcuLi91dGlscy9FdmVudEVtaXR0ZXInXHJcbmltcG9ydCB7XHJcbiAgICBmbkJpbmQsIFxyXG4gICAgZ2V0VG91Y2hFdmVudFxyXG59IGZyb20gJy4uL3V0aWxzL3V0aWxzJ1xyXG5pbXBvcnQgJCBmcm9tICdqcXVlcnknXHJcblxyXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBEcmFnTGlzdGVuZXIgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xyXG4gICAgY29uc3RydWN0b3IoZUVsZW1lbnQsIG5CdXR0b25Db2RlKSB7XHJcblxyXG4gICAgICAgIHN1cGVyKCk7XHJcblxyXG4gICAgICAgIHRoaXMuX3RpbWVvdXQgPSBudWxsXHJcblxyXG5cclxuICAgICAgICB0aGlzLl9lRWxlbWVudCA9ICQoZUVsZW1lbnQpO1xyXG4gICAgICAgIHRoaXMuX29Eb2N1bWVudCA9ICQoZG9jdW1lbnQpO1xyXG4gICAgICAgIHRoaXMuX2VCb2R5ID0gJChkb2N1bWVudC5ib2R5KTtcclxuICAgICAgICB0aGlzLl9uQnV0dG9uQ29kZSA9IG5CdXR0b25Db2RlIHx8IDA7XHJcblxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFRoZSBkZWxheSBhZnRlciB3aGljaCB0byBzdGFydCB0aGUgZHJhZyBpbiBtaWxsaXNlY29uZHNcclxuICAgICAgICAgKi9cclxuICAgICAgICB0aGlzLl9uRGVsYXkgPSAyMDA7XHJcblxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFRoZSBkaXN0YW5jZSB0aGUgbW91c2UgbmVlZHMgdG8gYmUgbW92ZWQgdG8gcXVhbGlmeSBhcyBhIGRyYWdcclxuICAgICAgICAgKi9cclxuICAgICAgICB0aGlzLl9uRGlzdGFuY2UgPSAxMDsgLy9UT0RPIC0gd29ya3MgYmV0dGVyIHdpdGggZGVsYXkgb25seVxyXG5cclxuICAgICAgICB0aGlzLl9uWCA9IDA7XHJcbiAgICAgICAgdGhpcy5fblkgPSAwO1xyXG5cclxuICAgICAgICB0aGlzLl9uT3JpZ2luYWxYID0gMDtcclxuICAgICAgICB0aGlzLl9uT3JpZ2luYWxZID0gMDtcclxuXHJcbiAgICAgICAgdGhpcy5fYkRyYWdnaW5nID0gZmFsc2U7XHJcblxyXG4gICAgICAgIHRoaXMuX2ZNb3ZlID0gZm5CaW5kKHRoaXMub25Nb3VzZU1vdmUsIHRoaXMpO1xyXG4gICAgICAgIHRoaXMuX2ZVcCA9IGZuQmluZCh0aGlzLm9uTW91c2VVcCwgdGhpcyk7XHJcbiAgICAgICAgdGhpcy5fZkRvd24gPSBmbkJpbmQodGhpcy5vbk1vdXNlRG93biwgdGhpcyk7XHJcblxyXG5cclxuICAgICAgICB0aGlzLl9lRWxlbWVudC5vbignbW91c2Vkb3duIHRvdWNoc3RhcnQnLCB0aGlzLl9mRG93bik7XHJcbiAgICB9XHJcblxyXG4gICAgZGVzdHJveSgpIHtcclxuICAgICAgICB0aGlzLl9lRWxlbWVudC51bmJpbmQoJ21vdXNlZG93biB0b3VjaHN0YXJ0JywgdGhpcy5fZkRvd24pO1xyXG4gICAgICAgIHRoaXMuX29Eb2N1bWVudC51bmJpbmQoJ21vdXNldXAgdG91Y2hlbmQnLCB0aGlzLl9mVXApO1xyXG4gICAgICAgIHRoaXMuX2VFbGVtZW50ID0gbnVsbDtcclxuICAgICAgICB0aGlzLl9vRG9jdW1lbnQgPSBudWxsO1xyXG4gICAgICAgIHRoaXMuX2VCb2R5ID0gbnVsbDtcclxuICAgIH1cclxuXHJcbiAgICBvbk1vdXNlRG93bihvRXZlbnQpIHtcclxuICAgICAgICBvRXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuXHJcbiAgICAgICAgaWYgKG9FdmVudC5idXR0b24gPT0gMCB8fCBvRXZlbnQudHlwZSA9PT0gXCJ0b3VjaHN0YXJ0XCIpIHtcclxuICAgICAgICAgICAgdmFyIGNvb3JkaW5hdGVzID0gdGhpcy5fZ2V0Q29vcmRpbmF0ZXMob0V2ZW50KTtcclxuXHJcbiAgICAgICAgICAgIHRoaXMuX25PcmlnaW5hbFggPSBjb29yZGluYXRlcy54O1xyXG4gICAgICAgICAgICB0aGlzLl9uT3JpZ2luYWxZID0gY29vcmRpbmF0ZXMueTtcclxuXHJcbiAgICAgICAgICAgIHRoaXMuX29Eb2N1bWVudC5vbignbW91c2Vtb3ZlIHRvdWNobW92ZScsIHRoaXMuX2ZNb3ZlKTtcclxuICAgICAgICAgICAgdGhpcy5fb0RvY3VtZW50Lm9uZSgnbW91c2V1cCB0b3VjaGVuZCcsIHRoaXMuX2ZVcCk7XHJcblxyXG4gICAgICAgICAgICB0aGlzLl90aW1lb3V0ID0gc2V0VGltZW91dChmbkJpbmQodGhpcy5fc3RhcnREcmFnLCB0aGlzKSwgdGhpcy5fbkRlbGF5KTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgb25Nb3VzZU1vdmUob0V2ZW50KSB7XHJcbiAgICAgICAgaWYgKHRoaXMuX3RpbWVvdXQgIT0gbnVsbCkge1xyXG4gICAgICAgICAgICBvRXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuXHJcbiAgICAgICAgICAgIHZhciBjb29yZGluYXRlcyA9IHRoaXMuX2dldENvb3JkaW5hdGVzKG9FdmVudCk7XHJcblxyXG4gICAgICAgICAgICB0aGlzLl9uWCA9IGNvb3JkaW5hdGVzLnggLSB0aGlzLl9uT3JpZ2luYWxYO1xyXG4gICAgICAgICAgICB0aGlzLl9uWSA9IGNvb3JkaW5hdGVzLnkgLSB0aGlzLl9uT3JpZ2luYWxZO1xyXG5cclxuICAgICAgICAgICAgaWYgKHRoaXMuX2JEcmFnZ2luZyA9PT0gZmFsc2UpIHtcclxuICAgICAgICAgICAgICAgIGlmIChcclxuICAgICAgICAgICAgICAgICAgICBNYXRoLmFicyh0aGlzLl9uWCkgPiB0aGlzLl9uRGlzdGFuY2UgfHxcclxuICAgICAgICAgICAgICAgICAgICBNYXRoLmFicyh0aGlzLl9uWSkgPiB0aGlzLl9uRGlzdGFuY2VcclxuICAgICAgICAgICAgICAgICkge1xyXG4gICAgICAgICAgICAgICAgICAgIGNsZWFyVGltZW91dCh0aGlzLl90aW1lb3V0KTtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9zdGFydERyYWcoKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgaWYgKHRoaXMuX2JEcmFnZ2luZykge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5lbWl0KCdkcmFnJywgdGhpcy5fblgsIHRoaXMuX25ZLCBvRXZlbnQpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIG9uTW91c2VVcChvRXZlbnQpIHtcclxuICAgICAgICBpZiAodGhpcy5fdGltZW91dCAhPSBudWxsKSB7XHJcbiAgICAgICAgICAgIGNsZWFyVGltZW91dCh0aGlzLl90aW1lb3V0KTtcclxuICAgICAgICAgICAgdGhpcy5fZUJvZHkucmVtb3ZlQ2xhc3MoJ2xtX2RyYWdnaW5nJyk7XHJcbiAgICAgICAgICAgIHRoaXMuX2VFbGVtZW50LnJlbW92ZUNsYXNzKCdsbV9kcmFnZ2luZycpO1xyXG4gICAgICAgICAgICB0aGlzLl9vRG9jdW1lbnQuZmluZCgnaWZyYW1lJykuY3NzKCdwb2ludGVyLWV2ZW50cycsICcnKTtcclxuICAgICAgICAgICAgdGhpcy5fb0RvY3VtZW50LnVuYmluZCgnbW91c2Vtb3ZlIHRvdWNobW92ZScsIHRoaXMuX2ZNb3ZlKTtcclxuICAgICAgICAgICAgdGhpcy5fb0RvY3VtZW50LnVuYmluZCgnbW91c2V1cCB0b3VjaGVuZCcsIHRoaXMuX2ZVcCk7XHJcblxyXG4gICAgICAgICAgICBpZiAodGhpcy5fYkRyYWdnaW5nID09PSB0cnVlKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9iRHJhZ2dpbmcgPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgIHRoaXMuZW1pdCgnZHJhZ1N0b3AnLCBvRXZlbnQsIHRoaXMuX25PcmlnaW5hbFggKyB0aGlzLl9uWCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgX3N0YXJ0RHJhZygpIHtcclxuICAgICAgICB0aGlzLl9iRHJhZ2dpbmcgPSB0cnVlO1xyXG4gICAgICAgIHRoaXMuX2VCb2R5LmFkZENsYXNzKCdsbV9kcmFnZ2luZycpO1xyXG4gICAgICAgIHRoaXMuX2VFbGVtZW50LmFkZENsYXNzKCdsbV9kcmFnZ2luZycpO1xyXG4gICAgICAgIHRoaXMuX29Eb2N1bWVudC5maW5kKCdpZnJhbWUnKS5jc3MoJ3BvaW50ZXItZXZlbnRzJywgJ25vbmUnKTtcclxuICAgICAgICB0aGlzLmVtaXQoJ2RyYWdTdGFydCcsIHRoaXMuX25PcmlnaW5hbFgsIHRoaXMuX25PcmlnaW5hbFkpO1xyXG4gICAgfVxyXG5cclxuICAgIF9nZXRDb29yZGluYXRlcyhldmVudCkge1xyXG4gICAgICAgIGV2ZW50ID0gZ2V0VG91Y2hFdmVudChldmVudClcclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICB4OiBldmVudC5wYWdlWCxcclxuICAgICAgICAgICAgeTogZXZlbnQucGFnZVlcclxuICAgICAgICB9O1xyXG4gICAgfVxyXG59XHJcbiIsImltcG9ydCB7XHJcbiAgICBpc0Z1bmN0aW9uXHJcbn0gZnJvbSAnLi4vdXRpbHMvdXRpbHMnXHJcblxyXG4vKipcclxuICogVGhlIG5hbWUgb2YgdGhlIGV2ZW50IHRoYXQncyB0cmlnZ2VyZWQgZm9yIGV2ZXJ5IG90aGVyIGV2ZW50XHJcbiAqXHJcbiAqIHVzYWdlXHJcbiAqXHJcbiAqIG15RW1pdHRlci5vbiggRXZlbnRFbWl0dGVyLkFMTF9FVkVOVCwgZnVuY3Rpb24oIGV2ZW50TmFtZSwgYXJnc0FycmF5ICl7XHJcbiAqICAvL2RvIHN0dWZmXHJcbiAqIH0pO1xyXG4gKlxyXG4gKiBAdHlwZSB7U3RyaW5nfVxyXG4gKi9cclxuZXhwb3J0IGNvbnN0IEFMTF9FVkVOVCA9ICdfX2FsbCdcclxuXHJcblxyXG4vKipcclxuICogQSBnZW5lcmljIGFuZCB2ZXJ5IGZhc3QgRXZlbnRFbWl0dGVyXHJcbiAqIGltcGxlbWVudGF0aW9uLiBPbiB0b3Agb2YgZW1pdHRpbmcgdGhlXHJcbiAqIGFjdHVhbCBldmVudCBpdCBlbWl0cyBhblxyXG4gKlxyXG4gKiBFdmVudEVtaXR0ZXIuQUxMX0VWRU5UXHJcbiAqXHJcbiAqIGV2ZW50IGZvciBldmVyeSBldmVudCB0cmlnZ2VyZWQuIFRoaXMgYWxsb3dzXHJcbiAqIHRvIGhvb2sgaW50byBpdCBhbmQgcHJveHkgZXZlbnRzIGZvcndhcmRzXHJcbiAqXHJcbiAqIEBjb25zdHJ1Y3RvclxyXG4gKi9cclxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgRXZlbnRFbWl0dGVyIHtcclxuXHJcbiAgICBjb25zdHJ1Y3RvcigpIHtcclxuICAgICAgICB0aGlzLl9tU3Vic2NyaXB0aW9ucyA9IHt9O1xyXG4gICAgICAgIHRoaXMuX21TdWJzY3JpcHRpb25zW0FMTF9FVkVOVF0gPSBbXTtcclxuXHJcblxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIExpc3RlbiBmb3IgZXZlbnRzXHJcbiAgICAgICAgICpcclxuICAgICAgICAgKiBAcGFyYW0gICB7U3RyaW5nfSBzRXZlbnQgICAgVGhlIG5hbWUgb2YgdGhlIGV2ZW50IHRvIGxpc3RlbiB0b1xyXG4gICAgICAgICAqIEBwYXJhbSAgIHtGdW5jdGlvbn0gZkNhbGxiYWNrIFRoZSBjYWxsYmFjayB0byBleGVjdXRlIHdoZW4gdGhlIGV2ZW50IG9jY3Vyc1xyXG4gICAgICAgICAqIEBwYXJhbSAgIHtbT2JqZWN0XX0gb0NvbnRleHQgVGhlIHZhbHVlIG9mIHRoZSB0aGlzIHBvaW50ZXIgd2l0aGluIHRoZSBjYWxsYmFjayBmdW5jdGlvblxyXG4gICAgICAgICAqXHJcbiAgICAgICAgICogQHJldHVybnMge3ZvaWR9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgdGhpcy5vbiA9IGZ1bmN0aW9uKHNFdmVudCwgZkNhbGxiYWNrLCBvQ29udGV4dCkge1xyXG4gICAgICAgICAgICBpZiAoIWlzRnVuY3Rpb24oZkNhbGxiYWNrKSkge1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdUcmllZCB0byBsaXN0ZW4gdG8gZXZlbnQgJyArIHNFdmVudCArICcgd2l0aCBub24tZnVuY3Rpb24gY2FsbGJhY2sgJyArIGZDYWxsYmFjayk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGlmICghdGhpcy5fbVN1YnNjcmlwdGlvbnNbc0V2ZW50XSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fbVN1YnNjcmlwdGlvbnNbc0V2ZW50XSA9IFtdO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB0aGlzLl9tU3Vic2NyaXB0aW9uc1tzRXZlbnRdLnB1c2goe1xyXG4gICAgICAgICAgICAgICAgZm46IGZDYWxsYmFjayxcclxuICAgICAgICAgICAgICAgIGN0eDogb0NvbnRleHRcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogRW1pdCBhbiBldmVudCBhbmQgbm90aWZ5IGxpc3RlbmVyc1xyXG4gICAgICAgICAqXHJcbiAgICAgICAgICogQHBhcmFtICAge1N0cmluZ30gc0V2ZW50IFRoZSBuYW1lIG9mIHRoZSBldmVudFxyXG4gICAgICAgICAqIEBwYXJhbSAgICB7TWl4ZWR9ICB2YXJpb3VzIGFkZGl0aW9uYWwgYXJndW1lbnRzIHRoYXQgd2lsbCBiZSBwYXNzZWQgdG8gdGhlIGxpc3RlbmVyXHJcbiAgICAgICAgICpcclxuICAgICAgICAgKiBAcmV0dXJucyB7dm9pZH1cclxuICAgICAgICAgKi9cclxuICAgICAgICB0aGlzLmVtaXQgPSBmdW5jdGlvbihzRXZlbnQpIHtcclxuICAgICAgICAgICAgdmFyIGksIGN0eCwgYXJncztcclxuXHJcbiAgICAgICAgICAgIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xyXG5cclxuICAgICAgICAgICAgdmFyIHN1YnMgPSB0aGlzLl9tU3Vic2NyaXB0aW9uc1tzRXZlbnRdO1xyXG5cclxuICAgICAgICAgICAgaWYgKHN1YnMpIHtcclxuICAgICAgICAgICAgICAgIHN1YnMgPSBzdWJzLnNsaWNlKCk7XHJcbiAgICAgICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgc3Vicy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICAgICAgICAgIGN0eCA9IHN1YnNbaV0uY3R4IHx8IHt9O1xyXG4gICAgICAgICAgICAgICAgICAgIHN1YnNbaV0uZm4uYXBwbHkoY3R4LCBhcmdzKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgYXJncy51bnNoaWZ0KHNFdmVudCk7XHJcblxyXG4gICAgICAgICAgICB2YXIgYWxsRXZlbnRTdWJzID0gdGhpcy5fbVN1YnNjcmlwdGlvbnNbQUxMX0VWRU5UXS5zbGljZSgpXHJcblxyXG4gICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgYWxsRXZlbnRTdWJzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICBjdHggPSBhbGxFdmVudFN1YnNbaV0uY3R4IHx8IHt9O1xyXG4gICAgICAgICAgICAgICAgYWxsRXZlbnRTdWJzW2ldLmZuLmFwcGx5KGN0eCwgYXJncyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBSZW1vdmVzIGEgbGlzdGVuZXIgZm9yIGFuIGV2ZW50LCBvciBhbGwgbGlzdGVuZXJzIGlmIG5vIGNhbGxiYWNrIGFuZCBjb250ZXh0IGlzIHByb3ZpZGVkLlxyXG4gICAgICAgICAqXHJcbiAgICAgICAgICogQHBhcmFtICAge1N0cmluZ30gc0V2ZW50ICAgIFRoZSBuYW1lIG9mIHRoZSBldmVudFxyXG4gICAgICAgICAqIEBwYXJhbSAgIHtGdW5jdGlvbn0gZkNhbGxiYWNrIFRoZSBwcmV2aW91c2x5IHJlZ2lzdGVyZWQgY2FsbGJhY2sgbWV0aG9kIChvcHRpb25hbClcclxuICAgICAgICAgKiBAcGFyYW0gICB7T2JqZWN0fSBvQ29udGV4dCAgVGhlIHByZXZpb3VzbHkgcmVnaXN0ZXJlZCBjb250ZXh0IChvcHRpb25hbClcclxuICAgICAgICAgKlxyXG4gICAgICAgICAqIEByZXR1cm5zIHt2b2lkfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHRoaXMudW5iaW5kID0gZnVuY3Rpb24oc0V2ZW50LCBmQ2FsbGJhY2ssIG9Db250ZXh0KSB7XHJcbiAgICAgICAgICAgIGlmICghdGhpcy5fbVN1YnNjcmlwdGlvbnNbc0V2ZW50XSkge1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBzdWJzY3JpYnRpb25zIHRvIHVuc3Vic2NyaWJlIGZvciBldmVudCAnICsgc0V2ZW50KTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgdmFyIGksIGJVbmJvdW5kID0gZmFsc2U7XHJcblxyXG4gICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgdGhpcy5fbVN1YnNjcmlwdGlvbnNbc0V2ZW50XS5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICAgICAgaWYgKFxyXG4gICAgICAgICAgICAgICAgICAgICghZkNhbGxiYWNrIHx8IHRoaXMuX21TdWJzY3JpcHRpb25zW3NFdmVudF1baV0uZm4gPT09IGZDYWxsYmFjaykgJiZcclxuICAgICAgICAgICAgICAgICAgICAoIW9Db250ZXh0IHx8IG9Db250ZXh0ID09PSB0aGlzLl9tU3Vic2NyaXB0aW9uc1tzRXZlbnRdW2ldLmN0eClcclxuICAgICAgICAgICAgICAgICkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX21TdWJzY3JpcHRpb25zW3NFdmVudF0uc3BsaWNlKGksIDEpO1xyXG4gICAgICAgICAgICAgICAgICAgIGJVbmJvdW5kID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgaWYgKGJVbmJvdW5kID09PSBmYWxzZSkge1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdOb3RoaW5nIHRvIHVuYmluZCBmb3IgJyArIHNFdmVudCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBBbGlhcyBmb3IgdW5iaW5kXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgdGhpcy5vZmYgPSB0aGlzLnVuYmluZDtcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogQWxpYXMgZm9yIGVtaXRcclxuICAgICAgICAgKi9cclxuICAgICAgICB0aGlzLnRyaWdnZXIgPSB0aGlzLmVtaXQ7XHJcbiAgICB9XHJcbn1cclxuIiwiaW1wb3J0IEV2ZW50RW1pdHRlciBmcm9tICcuLi91dGlscy9FdmVudEVtaXR0ZXInXHJcbmltcG9ydCB7IFxyXG4gIEFMTF9FVkVOVFxyXG59IGZyb20gJy4uL3V0aWxzL0V2ZW50RW1pdHRlcidcclxuaW1wb3J0IHtcclxuICAgIGZuQmluZFxyXG59IGZyb20gJy4uL3V0aWxzL3V0aWxzJ1xyXG5pbXBvcnQgJCBmcm9tICdqcXVlcnknXHJcblxyXG4vKipcclxuICogQW4gRXZlbnRFbWl0dGVyIHNpbmdsZXRvbiB0aGF0IHByb3BhZ2F0ZXMgZXZlbnRzXHJcbiAqIGFjcm9zcyBtdWx0aXBsZSB3aW5kb3dzLiBUaGlzIGlzIGEgbGl0dGxlIGJpdCB0cmlja2llciBzaW5jZVxyXG4gKiB3aW5kb3dzIGFyZSBhbGxvd2VkIHRvIG9wZW4gY2hpbGRXaW5kb3dzIGluIHRoZWlyIG93biByaWdodFxyXG4gKlxyXG4gKiBUaGlzIG1lYW5zIHRoYXQgd2UgZGVhbCB3aXRoIGEgdHJlZSBvZiB3aW5kb3dzLiBIZW5jZSB0aGUgcnVsZXMgZm9yIGV2ZW50IHByb3BhZ2F0aW9uIGFyZTpcclxuICpcclxuICogLSBQcm9wYWdhdGUgZXZlbnRzIGZyb20gdGhpcyBsYXlvdXQgdG8gYm90aCBwYXJlbnRzIGFuZCBjaGlsZHJlblxyXG4gKiAtIFByb3BhZ2F0ZSBldmVudHMgZnJvbSBwYXJlbnQgdG8gdGhpcyBhbmQgY2hpbGRyZW5cclxuICogLSBQcm9wYWdhdGUgZXZlbnRzIGZyb20gY2hpbGRyZW4gdG8gdGhlIG90aGVyIGNoaWxkcmVuIChidXQgbm90IHRoZSBlbWl0dGluZyBvbmUpIGFuZCB0aGUgcGFyZW50XHJcbiAqXHJcbiAqIEBjb25zdHJ1Y3RvclxyXG4gKlxyXG4gKiBAcGFyYW0ge2xtLkxheW91dE1hbmFnZXJ9IGxheW91dE1hbmFnZXJcclxuICovXHJcblxyXG5cclxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgRXZlbnRIdWIgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xyXG4gICAgY29uc3RydWN0b3IobGF5b3V0TWFuYWdlcikge1xyXG4gICAgICAgIFxyXG4gICAgICAgIHN1cGVyKCk7XHJcblxyXG4gICAgICAgIHRoaXMuX2xheW91dE1hbmFnZXIgPSBsYXlvdXRNYW5hZ2VyO1xyXG4gICAgICAgIHRoaXMuX2RvbnRQcm9wYWdhdGVUb1BhcmVudCA9IG51bGw7XHJcbiAgICAgICAgdGhpcy5fY2hpbGRFdmVudFNvdXJjZSA9IG51bGw7XHJcbiAgICAgICAgdGhpcy5vbihBTExfRVZFTlQsIGZuQmluZCh0aGlzLl9vbkV2ZW50RnJvbVRoaXMsIHRoaXMpKTtcclxuICAgICAgICB0aGlzLl9ib3VuZE9uRXZlbnRGcm9tQ2hpbGQgPSBmbkJpbmQodGhpcy5fb25FdmVudEZyb21DaGlsZCwgdGhpcyk7XHJcbiAgICAgICAgJCh3aW5kb3cpLm9uKCdnbF9jaGlsZF9ldmVudCcsIHRoaXMuX2JvdW5kT25FdmVudEZyb21DaGlsZCk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDYWxsZWQgb24gZXZlcnkgZXZlbnQgZW1pdHRlZCBvbiB0aGlzIGV2ZW50SHViLCByZWdhcmRsZXMgb2Ygb3JpZ2luLlxyXG4gICAgICpcclxuICAgICAqIEBwcml2YXRlXHJcbiAgICAgKlxyXG4gICAgICogQHBhcmFtIHtNaXhlZH1cclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJucyB7dm9pZH1cclxuICAgICAqL1xyXG4gICAgX29uRXZlbnRGcm9tVGhpcygpIHtcclxuICAgICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XHJcblxyXG4gICAgICAgIGlmICh0aGlzLl9sYXlvdXRNYW5hZ2VyLmlzU3ViV2luZG93ICYmIGFyZ3NbMF0gIT09IHRoaXMuX2RvbnRQcm9wYWdhdGVUb1BhcmVudCkge1xyXG4gICAgICAgICAgICB0aGlzLl9wcm9wYWdhdGVUb1BhcmVudChhcmdzKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5fcHJvcGFnYXRlVG9DaGlsZHJlbihhcmdzKTtcclxuXHJcbiAgICAgICAgLy9SZXNldFxyXG4gICAgICAgIHRoaXMuX2RvbnRQcm9wYWdhdGVUb1BhcmVudCA9IG51bGw7XHJcbiAgICAgICAgdGhpcy5fY2hpbGRFdmVudFNvdXJjZSA9IG51bGw7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDYWxsZWQgYnkgdGhlIHBhcmVudCBsYXlvdXQuXHJcbiAgICAgKlxyXG4gICAgICogQHBhcmFtICAge0FycmF5fSBhcmdzIEV2ZW50IG5hbWUgKyBhcmd1bWVudHNcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJucyB7dm9pZH1cclxuICAgICAqL1xyXG4gICAgXyRvbkV2ZW50RnJvbVBhcmVudChhcmdzKSB7XHJcbiAgICAgICAgdGhpcy5fZG9udFByb3BhZ2F0ZVRvUGFyZW50ID0gYXJnc1swXTtcclxuICAgICAgICB0aGlzLmVtaXQuYXBwbHkodGhpcywgYXJncyk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDYWxsYmFjayBmb3IgY2hpbGQgZXZlbnRzIHJhaXNlZCBvbiB0aGUgd2luZG93XHJcbiAgICAgKlxyXG4gICAgICogQHBhcmFtICAge0RPTUV2ZW50fSBldmVudFxyXG4gICAgICogQHByaXZhdGVcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJucyB7dm9pZH1cclxuICAgICAqL1xyXG4gICAgX29uRXZlbnRGcm9tQ2hpbGQoZXZlbnQpIHtcclxuICAgICAgICB0aGlzLl9jaGlsZEV2ZW50U291cmNlID0gZXZlbnQub3JpZ2luYWxFdmVudC5fX2dsO1xyXG4gICAgICAgIHRoaXMuZW1pdC5hcHBseSh0aGlzLCBldmVudC5vcmlnaW5hbEV2ZW50Ll9fZ2xBcmdzKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFByb3BhZ2F0ZXMgdGhlIGV2ZW50IHRvIHRoZSBwYXJlbnQgYnkgZW1pdHRpbmdcclxuICAgICAqIGl0IG9uIHRoZSBwYXJlbnQncyBET00gd2luZG93XHJcbiAgICAgKlxyXG4gICAgICogQHBhcmFtICAge0FycmF5fSBhcmdzIEV2ZW50IG5hbWUgKyBhcmd1bWVudHNcclxuICAgICAqIEBwcml2YXRlXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge3ZvaWR9XHJcbiAgICAgKi9cclxuICAgIF9wcm9wYWdhdGVUb1BhcmVudChhcmdzKSB7XHJcbiAgICAgICAgdmFyIGV2ZW50LFxyXG4gICAgICAgICAgICBldmVudE5hbWUgPSAnZ2xfY2hpbGRfZXZlbnQnO1xyXG5cclxuICAgICAgICBpZiAoZG9jdW1lbnQuY3JlYXRlRXZlbnQpIHtcclxuICAgICAgICAgICAgZXZlbnQgPSB3aW5kb3cub3BlbmVyLmRvY3VtZW50LmNyZWF0ZUV2ZW50KCdIVE1MRXZlbnRzJyk7XHJcbiAgICAgICAgICAgIGV2ZW50LmluaXRFdmVudChldmVudE5hbWUsIHRydWUsIHRydWUpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGV2ZW50ID0gd2luZG93Lm9wZW5lci5kb2N1bWVudC5jcmVhdGVFdmVudE9iamVjdCgpO1xyXG4gICAgICAgICAgICBldmVudC5ldmVudFR5cGUgPSBldmVudE5hbWU7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBldmVudC5ldmVudE5hbWUgPSBldmVudE5hbWU7XHJcbiAgICAgICAgZXZlbnQuX19nbEFyZ3MgPSBhcmdzO1xyXG4gICAgICAgIGV2ZW50Ll9fZ2wgPSB0aGlzLl9sYXlvdXRNYW5hZ2VyO1xyXG5cclxuICAgICAgICBpZiAoZG9jdW1lbnQuY3JlYXRlRXZlbnQpIHtcclxuICAgICAgICAgICAgd2luZG93Lm9wZW5lci5kaXNwYXRjaEV2ZW50KGV2ZW50KTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICB3aW5kb3cub3BlbmVyLmZpcmVFdmVudCgnb24nICsgZXZlbnQuZXZlbnRUeXBlLCBldmVudCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUHJvcGFnYXRlIGV2ZW50cyB0byBjaGlsZHJlblxyXG4gICAgICpcclxuICAgICAqIEBwYXJhbSAgIHtBcnJheX0gYXJncyBFdmVudCBuYW1lICsgYXJndW1lbnRzXHJcbiAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHt2b2lkfVxyXG4gICAgICovXHJcbiAgICBfcHJvcGFnYXRlVG9DaGlsZHJlbihhcmdzKSB7XHJcbiAgICAgICAgdmFyIGNoaWxkR2wsIGk7XHJcblxyXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCB0aGlzLl9sYXlvdXRNYW5hZ2VyLm9wZW5Qb3BvdXRzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIGNoaWxkR2wgPSB0aGlzLl9sYXlvdXRNYW5hZ2VyLm9wZW5Qb3BvdXRzW2ldLmdldEdsSW5zdGFuY2UoKTtcclxuXHJcbiAgICAgICAgICAgIGlmIChjaGlsZEdsICYmIGNoaWxkR2wgIT09IHRoaXMuX2NoaWxkRXZlbnRTb3VyY2UpIHtcclxuICAgICAgICAgICAgICAgIGNoaWxkR2wuZXZlbnRIdWIuXyRvbkV2ZW50RnJvbVBhcmVudChhcmdzKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIERlc3Ryb3lzIHRoZSBFdmVudEh1YlxyXG4gICAgICpcclxuICAgICAqIEBwdWJsaWNcclxuICAgICAqIEByZXR1cm5zIHt2b2lkfVxyXG4gICAgICovXHJcblxyXG4gICAgZGVzdHJveSgpIHtcclxuICAgICAgICAkKHdpbmRvdykub2ZmKCdnbF9jaGlsZF9ldmVudCcsIHRoaXMuX2JvdW5kT25FdmVudEZyb21DaGlsZCk7XHJcbiAgICB9XHJcbn1cclxuIiwiaW1wb3J0ICQgZnJvbSAnanF1ZXJ5J1xyXG4vKipcclxuICogQSBzcGVjaWFsaXNlZCBHb2xkZW5MYXlvdXQgY29tcG9uZW50IHRoYXQgYmluZHMgR29sZGVuTGF5b3V0IGNvbnRhaW5lclxyXG4gKiBsaWZlY3ljbGUgZXZlbnRzIHRvIHJlYWN0IGNvbXBvbmVudHNcclxuICpcclxuICogQGNvbnN0cnVjdG9yXHJcbiAqXHJcbiAqIEBwYXJhbSB7SXRlbUNvbnRhaW5lcn0gY29udGFpbmVyXHJcbiAqIEBwYXJhbSB7T2JqZWN0fSBzdGF0ZSBzdGF0ZSBpcyBub3QgcmVxdWlyZWQgZm9yIHJlYWN0IGNvbXBvbmVudHNcclxuICovXHJcblxyXG5cclxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgUmVhY3RDb21wb25lbnRIYW5kbGVyIHtcclxuICAgIGNvbnN0cnVjdG9yKGNvbnRhaW5lciwgc3RhdGUpIHtcclxuICAgICAgICB0aGlzLl9yZWFjdENvbXBvbmVudCA9IG51bGw7XHJcbiAgICAgICAgdGhpcy5fb3JpZ2luYWxDb21wb25lbnRXaWxsVXBkYXRlID0gbnVsbDtcclxuICAgICAgICB0aGlzLl9jb250YWluZXIgPSBjb250YWluZXI7XHJcbiAgICAgICAgdGhpcy5faW5pdGlhbFN0YXRlID0gc3RhdGU7XHJcbiAgICAgICAgdGhpcy5fcmVhY3RDbGFzcyA9IHRoaXMuX2dldFJlYWN0Q2xhc3MoKTtcclxuICAgICAgICB0aGlzLl9jb250YWluZXIub24oJ29wZW4nLCB0aGlzLl9yZW5kZXIsIHRoaXMpO1xyXG4gICAgICAgIHRoaXMuX2NvbnRhaW5lci5vbignZGVzdHJveScsIHRoaXMuX2Rlc3Ryb3ksIHRoaXMpO1xyXG4gICAgfVxyXG5cclxuXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGVzIHRoZSByZWFjdCBjbGFzcyBhbmQgY29tcG9uZW50IGFuZCBoeWRyYXRlcyBpdCB3aXRoXHJcbiAgICAgKiB0aGUgaW5pdGlhbCBzdGF0ZSAtIGlmIG9uZSBpcyBwcmVzZW50XHJcbiAgICAgKlxyXG4gICAgICogQnkgZGVmYXVsdCwgcmVhY3QncyBnZXRJbml0aWFsU3RhdGUgd2lsbCBiZSB1c2VkXHJcbiAgICAgKlxyXG4gICAgICogQHByaXZhdGVcclxuICAgICAqIEByZXR1cm5zIHt2b2lkfVxyXG4gICAgICovXHJcbiAgICBfcmVuZGVyKCkge1xyXG4gICAgICAgIFJlYWN0RE9NLnJlbmRlcih0aGlzLl9nZXRSZWFjdENvbXBvbmVudCgpLCB0aGlzLl9jb250YWluZXIuZ2V0RWxlbWVudCgpWzBdKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEZpcmVkIGJ5IHJlYWN0IHdoZW4gdGhlIGNvbXBvbmVudCBpcyBjcmVhdGVkLiAgQWxzbyBmaXJlZCB1cG9uIGRlc3RydWN0aW9uICh3aGVyZSBjb21wb25lbnQgaXMgbnVsbCkuXHJcbiAgICAgKiA8cD5cclxuICAgICAqIE5vdGU6IFRoaXMgY2FsbGJhY2sgaXMgdXNlZCBpbnN0ZWFkIG9mIHRoZSByZXR1cm4gZnJvbSBgUmVhY3RET00ucmVuZGVyYCBiZWNhdXNlXHJcbiAgICAgKlx0ICAgb2YgaHR0cHM6Ly9naXRodWIuY29tL2ZhY2Vib29rL3JlYWN0L2lzc3Vlcy8xMDMwOS5cclxuICAgICAqIDwvcD5cclxuICAgICAqXHJcbiAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICogQGFyZyB7UmVhY3QuUmVmfSBjb21wb25lbnQgVGhlIGNvbXBvbmVudCBpbnN0YW5jZSBjcmVhdGVkIGJ5IHRoZSBgUmVhY3RET00ucmVuZGVyYCBjYWxsIGluIHRoZSBgX3JlbmRlcmAgbWV0aG9kLlxyXG4gICAgICogQHJldHVybnMge3ZvaWR9XHJcbiAgICAgKi9cclxuICAgIF9nb3RSZWFjdENvbXBvbmVudChjb21wb25lbnQpIHtcclxuICAgICAgICBpZiAoY29tcG9uZW50ICE9PSBudWxsKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX3JlYWN0Q29tcG9uZW50ID0gY29tcG9uZW50O1xyXG4gICAgICAgICAgICB0aGlzLl9vcmlnaW5hbENvbXBvbmVudFdpbGxVcGRhdGUgPSB0aGlzLl9yZWFjdENvbXBvbmVudC5jb21wb25lbnRXaWxsVXBkYXRlIHx8IGZ1bmN0aW9uKCkge307XHJcbiAgICAgICAgICAgIHRoaXMuX3JlYWN0Q29tcG9uZW50LmNvbXBvbmVudFdpbGxVcGRhdGUgPSB0aGlzLl9vblVwZGF0ZS5iaW5kKCB0aGlzICk7XHJcbiAgICAgICAgICAgIGlmKCB0aGlzLl9jb250YWluZXIuZ2V0U3RhdGUoKSApIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuX3JlYWN0Q29tcG9uZW50LnNldFN0YXRlKCB0aGlzLl9jb250YWluZXIuZ2V0U3RhdGUoKSApO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgXHJcbiAgICAvKipcclxuICAgICAqIFJlbW92ZXMgdGhlIGNvbXBvbmVudCBmcm9tIHRoZSBET00gYW5kIHRodXMgaW52b2tlcyBSZWFjdCdzIHVubW91bnQgbGlmZWN5Y2xlXHJcbiAgICAgKlxyXG4gICAgICogQHByaXZhdGVcclxuICAgICAqIEByZXR1cm5zIHt2b2lkfVxyXG4gICAgICovXHJcbiAgICBfZGVzdHJveSgpIHtcclxuICAgICAgICBSZWFjdERPTS51bm1vdW50Q29tcG9uZW50QXROb2RlKHRoaXMuX2NvbnRhaW5lci5nZXRFbGVtZW50KClbMF0pO1xyXG4gICAgICAgIHRoaXMuX2NvbnRhaW5lci5vZmYoJ29wZW4nLCB0aGlzLl9yZW5kZXIsIHRoaXMpO1xyXG4gICAgICAgIHRoaXMuX2NvbnRhaW5lci5vZmYoJ2Rlc3Ryb3knLCB0aGlzLl9kZXN0cm95LCB0aGlzKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEhvb2tzIGludG8gUmVhY3QncyBzdGF0ZSBtYW5hZ2VtZW50IGFuZCBhcHBsaWVzIHRoZSBjb21wb25lbnRzdGF0ZVxyXG4gICAgICogdG8gR29sZGVuTGF5b3V0XHJcbiAgICAgKlxyXG4gICAgICogQHByaXZhdGVcclxuICAgICAqIEByZXR1cm5zIHt2b2lkfVxyXG4gICAgICovXHJcbiAgICBfb25VcGRhdGUobmV4dFByb3BzLCBuZXh0U3RhdGUpIHtcclxuICAgICAgICB0aGlzLl9jb250YWluZXIuc2V0U3RhdGUobmV4dFN0YXRlKTtcclxuICAgICAgICB0aGlzLl9vcmlnaW5hbENvbXBvbmVudFdpbGxVcGRhdGUuY2FsbCh0aGlzLl9yZWFjdENvbXBvbmVudCwgbmV4dFByb3BzLCBuZXh0U3RhdGUpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUmV0cmlldmVzIHRoZSByZWFjdCBjbGFzcyBmcm9tIEdvbGRlbkxheW91dCdzIHJlZ2lzdHJ5XHJcbiAgICAgKlxyXG4gICAgICogQHByaXZhdGVcclxuICAgICAqIEByZXR1cm5zIHtSZWFjdC5DbGFzc31cclxuICAgICAqL1xyXG4gICAgX2dldFJlYWN0Q2xhc3MoKSB7XHJcbiAgICAgICAgdmFyIGNvbXBvbmVudE5hbWUgPSB0aGlzLl9jb250YWluZXIuX2NvbmZpZy5jb21wb25lbnQ7XHJcbiAgICAgICAgdmFyIHJlYWN0Q2xhc3M7XHJcblxyXG4gICAgICAgIGlmICghY29tcG9uZW50TmFtZSkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIHJlYWN0IGNvbXBvbmVudCBuYW1lLiB0eXBlOiByZWFjdC1jb21wb25lbnQgbmVlZHMgYSBmaWVsZCBgY29tcG9uZW50YCcpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmVhY3RDbGFzcyA9IHRoaXMuX2NvbnRhaW5lci5sYXlvdXRNYW5hZ2VyLmdldENvbXBvbmVudCh0aGlzLl9jb250YWluZXIuX2NvbmZpZyk7XHJcblxyXG4gICAgICAgIGlmICghcmVhY3RDbGFzcykge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1JlYWN0IGNvbXBvbmVudCBcIicgKyBjb21wb25lbnROYW1lICsgJ1wiIG5vdCBmb3VuZC4gJyArXHJcbiAgICAgICAgICAgICAgICAnUGxlYXNlIHJlZ2lzdGVyIGFsbCBjb21wb25lbnRzIHdpdGggR29sZGVuTGF5b3V0IHVzaW5nIGByZWdpc3RlckNvbXBvbmVudChuYW1lLCBjb21wb25lbnQpYCcpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIHJlYWN0Q2xhc3M7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDb3BpZXMgYW5kIGV4dGVuZHMgdGhlIHByb3BlcnRpZXMgYXJyYXkgYW5kIHJldHVybnMgdGhlIFJlYWN0IGVsZW1lbnRcclxuICAgICAqXHJcbiAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICogQHJldHVybnMge1JlYWN0LkVsZW1lbnR9XHJcbiAgICAgKi9cclxuICAgIF9nZXRSZWFjdENvbXBvbmVudCgpIHtcclxuICAgICAgICB2YXIgZGVmYXVsdFByb3BzID0ge1xyXG4gICAgICAgICAgICBnbEV2ZW50SHViOiB0aGlzLl9jb250YWluZXIubGF5b3V0TWFuYWdlci5ldmVudEh1YixcclxuICAgICAgICAgICAgZ2xDb250YWluZXI6IHRoaXMuX2NvbnRhaW5lcixcclxuICAgICAgICAgICAgcmVmOiB0aGlzLl9nb3RSZWFjdENvbXBvbmVudC5iaW5kKHRoaXMpLFxyXG4gICAgICAgIH07XHJcbiAgICAgICAgdmFyIHByb3BzID0gJC5leHRlbmQoZGVmYXVsdFByb3BzLCB0aGlzLl9jb250YWluZXIuX2NvbmZpZy5wcm9wcyk7XHJcbiAgICAgICAgcmV0dXJuIFJlYWN0LmNyZWF0ZUVsZW1lbnQodGhpcy5fcmVhY3RDbGFzcywgcHJvcHMpO1xyXG4gICAgfVxyXG59XHJcbiIsImltcG9ydCAkIGZyb20gJ2pxdWVyeSdcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBGKCkge31cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBnZXRUb3VjaEV2ZW50KGV2ZW50KXtcclxuICAgIGlmKCQuemVwdG8pe1xyXG4gICAgICAgIHJldHVybiBldmVudC50b3VjaGVzID8gZXZlbnQudGFyZ2V0VG91Y2hlc1swXSA6IGV2ZW50O1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICByZXR1cm4gZXZlbnQub3JpZ2luYWxFdmVudCAmJiBldmVudC5vcmlnaW5hbEV2ZW50LnRvdWNoZXMgPyBldmVudC5vcmlnaW5hbEV2ZW50LnRvdWNoZXNbMF0gOiBldmVudDtcclxuICAgIH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGV4dGVuZChzdWJDbGFzcywgc3VwZXJDbGFzcykge1xyXG4gICAgc3ViQ2xhc3MucHJvdG90eXBlID0gY3JlYXRlT2JqZWN0KHN1cGVyQ2xhc3MucHJvdG90eXBlKTtcclxuICAgIHN1YkNsYXNzLnByb3RvdHlwZS5jb250cnVjdG9yID0gc3ViQ2xhc3M7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVPYmplY3QocHJvdG90eXBlKSB7XHJcbiAgICBpZiAodHlwZW9mIE9iamVjdC5jcmVhdGUgPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICByZXR1cm4gT2JqZWN0LmNyZWF0ZShwcm90b3R5cGUpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICBGLnByb3RvdHlwZSA9IHByb3RvdHlwZTtcclxuICAgICAgICByZXR1cm4gbmV3IEYoKTtcclxuICAgIH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIG9iamVjdEtleXMob2JqZWN0KSB7XHJcbiAgICB2YXIga2V5cywga2V5O1xyXG5cclxuICAgIGlmICh0eXBlb2YgT2JqZWN0LmtleXMgPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICByZXR1cm4gT2JqZWN0LmtleXMob2JqZWN0KTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAga2V5cyA9IFtdO1xyXG4gICAgICAgIGZvciAoa2V5IGluIG9iamVjdCkge1xyXG4gICAgICAgICAgICBrZXlzLnB1c2goa2V5KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIGtleXM7XHJcbiAgICB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBnZXRIYXNoVmFsdWUoa2V5KSB7XHJcbiAgICB2YXIgbWF0Y2hlcyA9IGxvY2F0aW9uLmhhc2gubWF0Y2gobmV3IFJlZ0V4cChrZXkgKyAnPShbXiZdKiknKSk7XHJcbiAgICByZXR1cm4gbWF0Y2hlcyA/IG1hdGNoZXNbMV0gOiBudWxsO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gZ2V0UXVlcnlTdHJpbmdQYXJhbShwYXJhbSkge1xyXG4gICAgaWYgKHdpbmRvdy5sb2NhdGlvbi5oYXNoKSB7XHJcbiAgICAgICAgcmV0dXJuIGdldEhhc2hWYWx1ZShwYXJhbSk7XHJcbiAgICB9IGVsc2UgaWYgKCF3aW5kb3cubG9jYXRpb24uc2VhcmNoKSB7XHJcbiAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIGtleVZhbHVlUGFpcnMgPSB3aW5kb3cubG9jYXRpb24uc2VhcmNoLnN1YnN0cigxKS5zcGxpdCgnJicpLFxyXG4gICAgICAgIHBhcmFtcyA9IHt9LFxyXG4gICAgICAgIHBhaXIsXHJcbiAgICAgICAgaTtcclxuXHJcbiAgICBmb3IgKGkgPSAwOyBpIDwga2V5VmFsdWVQYWlycy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgIHBhaXIgPSBrZXlWYWx1ZVBhaXJzW2ldLnNwbGl0KCc9Jyk7XHJcbiAgICAgICAgcGFyYW1zW3BhaXJbMF1dID0gcGFpclsxXTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gcGFyYW1zW3BhcmFtXSB8fCBudWxsO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gY29weSh0YXJnZXQsIHNvdXJjZSkge1xyXG4gICAgZm9yICh2YXIga2V5IGluIHNvdXJjZSkge1xyXG4gICAgICAgIHRhcmdldFtrZXldID0gc291cmNlW2tleV07XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdGFyZ2V0O1xyXG59XHJcblxyXG4vKipcclxuICogVGhpcyBpcyBiYXNlZCBvbiBQYXVsIElyaXNoJ3Mgc2hpbSwgYnV0IGxvb2tzIHF1aXRlIG9kZCBpbiBjb21wYXJpc29uLiBXaHk/XHJcbiAqIEJlY2F1c2VcclxuICogYSkgaXQgc2hvdWxkbid0IGFmZmVjdCB0aGUgZ2xvYmFsIHJlcXVlc3RBbmltYXRpb25GcmFtZSBmdW5jdGlvblxyXG4gKiBiKSBpdCBzaG91bGRuJ3QgcGFzcyBvbiB0aGUgdGltZSB0aGF0IGhhcyBwYXNzZWRcclxuICpcclxuICogQHBhcmFtICAge0Z1bmN0aW9ufSBmblxyXG4gKlxyXG4gKiBAcmV0dXJucyB7dm9pZH1cclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBhbmltRnJhbWUoZm4pIHtcclxuICAgIHJldHVybiAod2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSB8fFxyXG4gICAgICAgIHdpbmRvdy53ZWJraXRSZXF1ZXN0QW5pbWF0aW9uRnJhbWUgfHxcclxuICAgICAgICB3aW5kb3cubW96UmVxdWVzdEFuaW1hdGlvbkZyYW1lIHx8XHJcbiAgICAgICAgZnVuY3Rpb24oY2FsbGJhY2spIHtcclxuICAgICAgICAgICAgd2luZG93LnNldFRpbWVvdXQoY2FsbGJhY2ssIDEwMDAgLyA2MCk7XHJcbiAgICAgICAgfSkoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgZm4oKTtcclxuICAgIH0pO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gaW5kZXhPZihuZWVkbGUsIGhheXN0YWNrKSB7XHJcbiAgICBpZiAoIShoYXlzdGFjayBpbnN0YW5jZW9mIEFycmF5KSkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignSGF5c3RhY2sgaXMgbm90IGFuIEFycmF5Jyk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGhheXN0YWNrLmluZGV4T2YpIHtcclxuICAgICAgICByZXR1cm4gaGF5c3RhY2suaW5kZXhPZihuZWVkbGUpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGhheXN0YWNrLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIGlmIChoYXlzdGFja1tpXSA9PT0gbmVlZGxlKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gaTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gLTE7XHJcbiAgICB9XHJcbn1cclxuXHJcblxyXG5leHBvcnQgdmFyIGlzRnVuY3Rpb24gPSAodHlwZW9mIC8uLyAhPSAnZnVuY3Rpb24nICYmIHR5cGVvZiBJbnQ4QXJyYXkgIT0gJ29iamVjdCcpID8gXHJcbiAgICBmdW5jdGlvbiBpc0Z1bmN0aW9uKG9iaikge1xyXG4gICAgICAgIHJldHVybiB0eXBlb2Ygb2JqID09ICdmdW5jdGlvbicgfHwgZmFsc2U7XHJcbiAgICB9IDogZnVuY3Rpb24gaXNGdW5jdGlvbihvYmopIHtcclxuICAgICAgICByZXR1cm4gdG9TdHJpbmcuY2FsbChvYmopID09PSAnW29iamVjdCBGdW5jdGlvbl0nO1xyXG4gICAgfVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGZuQmluZChmbiwgY29udGV4dCwgYm91bmRBcmdzKSB7XHJcblxyXG4gICAgaWYgKEZ1bmN0aW9uLnByb3RvdHlwZS5iaW5kICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICByZXR1cm4gRnVuY3Rpb24ucHJvdG90eXBlLmJpbmQuYXBwbHkoZm4sIFtjb250ZXh0XS5jb25jYXQoYm91bmRBcmdzIHx8IFtdKSk7XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIGJvdW5kID0gZnVuY3Rpb24oKSB7XHJcblxyXG4gICAgICAgIC8vIEpvaW4gdGhlIGFscmVhZHkgYXBwbGllZCBhcmd1bWVudHMgdG8gdGhlIG5vdyBjYWxsZWQgb25lcyAoYWZ0ZXIgY29udmVydGluZyB0byBhbiBhcnJheSBhZ2FpbikuXHJcbiAgICAgICAgdmFyIGFyZ3MgPSAoYm91bmRBcmdzIHx8IFtdKS5jb25jYXQoQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAwKSk7XHJcblxyXG4gICAgICAgIC8vIElmIG5vdCBiZWluZyBjYWxsZWQgYXMgYSBjb25zdHJ1Y3RvclxyXG4gICAgICAgIGlmICghKHRoaXMgaW5zdGFuY2VvZiBib3VuZCkpIHtcclxuICAgICAgICAgICAgLy8gcmV0dXJuIHRoZSByZXN1bHQgb2YgdGhlIGZ1bmN0aW9uIGNhbGxlZCBib3VuZCB0byB0YXJnZXQgYW5kIHBhcnRpYWxseSBhcHBsaWVkLlxyXG4gICAgICAgICAgICByZXR1cm4gZm4uYXBwbHkoY29udGV4dCwgYXJncyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIC8vIElmIGJlaW5nIGNhbGxlZCBhcyBhIGNvbnN0cnVjdG9yLCBhcHBseSB0aGUgZnVuY3Rpb24gYm91bmQgdG8gc2VsZi5cclxuICAgICAgICBmbi5hcHBseSh0aGlzLCBhcmdzKTtcclxuICAgIH07XHJcbiAgICAvLyBBdHRhY2ggdGhlIHByb3RvdHlwZSBvZiB0aGUgZnVuY3Rpb24gdG8gb3VyIG5ld2x5IGNyZWF0ZWQgZnVuY3Rpb24uXHJcbiAgICBib3VuZC5wcm90b3R5cGUgPSBmbi5wcm90b3R5cGU7XHJcbiAgICByZXR1cm4gYm91bmQ7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiByZW1vdmVGcm9tQXJyYXkoaXRlbSwgYXJyYXkpIHtcclxuICAgIHZhciBpbmRleCA9IGluZGV4T2YoaXRlbSwgYXJyYXkpO1xyXG5cclxuICAgIGlmIChpbmRleCA9PT0gLTEpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NhblxcJ3QgcmVtb3ZlIGl0ZW0gZnJvbSBhcnJheS4gSXRlbSBpcyBub3QgaW4gdGhlIGFycmF5Jyk7XHJcbiAgICB9XHJcblxyXG4gICAgYXJyYXkuc3BsaWNlKGluZGV4LCAxKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIG5vdygpIHtcclxuICAgIGlmICh0eXBlb2YgRGF0ZS5ub3cgPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICByZXR1cm4gRGF0ZS5ub3coKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgcmV0dXJuIChuZXcgRGF0ZSgpKS5nZXRUaW1lKCk7XHJcbiAgICB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBnZXRVbmlxdWVJZCgpIHtcclxuICAgIHJldHVybiAoTWF0aC5yYW5kb20oKSAqIDEwMDAwMDAwMDAwMDAwMDApXHJcbiAgICAgICAgLnRvU3RyaW5nKDM2KVxyXG4gICAgICAgIC5yZXBsYWNlKCcuJywgJycpO1xyXG59XHJcblxyXG4vKipcclxuICogQSBiYXNpYyBYU1MgZmlsdGVyLiBJdCBpcyB1bHRpbWF0ZWx5IHVwIHRvIHRoZVxyXG4gKiBpbXBsZW1lbnRpbmcgZGV2ZWxvcGVyIHRvIG1ha2Ugc3VyZSB0aGVpciBwYXJ0aWN1bGFyXHJcbiAqIGFwcGxpY2F0aW9ucyBhbmQgdXNlY2FzZXMgYXJlIHNhdmUgZnJvbSBjcm9zcyBzaXRlIHNjcmlwdGluZyBhdHRhY2tzXHJcbiAqXHJcbiAqIEBwYXJhbSAgIHtTdHJpbmd9IGlucHV0XHJcbiAqIEBwYXJhbSAgICB7Qm9vbGVhbn0ga2VlcFRhZ3NcclxuICpcclxuICogQHJldHVybnMge1N0cmluZ30gZmlsdGVyZWQgaW5wdXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBmaWx0ZXJYc3MoaW5wdXQsIGtlZXBUYWdzKSB7XHJcblxyXG4gICAgdmFyIG91dHB1dCA9IGlucHV0XHJcbiAgICAgICAgLnJlcGxhY2UoL2phdmFzY3JpcHQvZ2ksICdqJiM5Nzt2YXNjcmlwdCcpXHJcbiAgICAgICAgLnJlcGxhY2UoL2V4cHJlc3Npb24vZ2ksICdleHByJiMxMDE7c3Npb24nKVxyXG4gICAgICAgIC5yZXBsYWNlKC9vbmxvYWQvZ2ksICdvbmxvJiM5NztkJylcclxuICAgICAgICAucmVwbGFjZSgvc2NyaXB0L2dpLCAnJiMxMTU7Y3JpcHQnKVxyXG4gICAgICAgIC5yZXBsYWNlKC9vbmVycm9yL2dpLCAnb24mIzEwMTtycm9yJyk7XHJcblxyXG4gICAgaWYgKGtlZXBUYWdzID09PSB0cnVlKSB7XHJcbiAgICAgICAgcmV0dXJuIG91dHB1dDtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgcmV0dXJuIG91dHB1dFxyXG4gICAgICAgICAgICAucmVwbGFjZSgvPi9nLCAnJmd0OycpXHJcbiAgICAgICAgICAgIC5yZXBsYWNlKC88L2csICcmbHQ7Jyk7XHJcbiAgICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBSZW1vdmVzIGh0bWwgdGFncyBmcm9tIGEgc3RyaW5nXHJcbiAqXHJcbiAqIEBwYXJhbSAgIHtTdHJpbmd9IGlucHV0XHJcbiAqXHJcbiAqIEByZXR1cm5zIHtTdHJpbmd9IGlucHV0IHdpdGhvdXQgdGFnc1xyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHN0cmlwVGFncyhpbnB1dCkge1xyXG4gICAgcmV0dXJuICQudHJpbShpbnB1dC5yZXBsYWNlKC8oPChbXj5dKyk+KS9pZywgJycpKTtcclxufVxyXG4iLCJtb2R1bGUuZXhwb3J0cyA9IF9fV0VCUEFDS19FWFRFUk5BTF9NT0RVTEVfanF1ZXJ5X187Il0sInNvdXJjZVJvb3QiOiIifQ==