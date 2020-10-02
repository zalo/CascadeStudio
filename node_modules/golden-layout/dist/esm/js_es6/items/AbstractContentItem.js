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
import BubblingEvent from '../utils/BubblingEvent';
import Root from './Root';
import ConfigurationError from '../errors/ConfigurationError';
import itemDefaultConfig from '../config/ItemDefaultConfig';
import { fnBind, animFrame, indexOf } from '../utils/utils';
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

    _this.on(ALL_EVENT, _this._propagateEvent, _assertThisInitialized(_this));

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
      var index = indexOf(contentItem, this.contentItems);
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
      } else if (!(this instanceof Root) && this.config.isClosable === true) {
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
      var index = indexOf(contentItem, this.contentItems);
      /*
       * Make sure the content item to be removed is actually a child of this item
       */

      if (index === -1) {
        throw new Error('Can\'t remove child item. Unknown content item');
      }

      if (!(this instanceof Root) && this.config.isClosable === true) {
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
      var index = indexOf(oldChild, this.contentItems),
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
        return indexOf(id, this.config.id) !== -1;
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
        var index = indexOf(id, this.config.id);
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
          return indexOf(id, item.config.id) !== -1;
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
      var event = new BubblingEvent(name, this);
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
        throw new ConfigurationError('content must be an Array', config);
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
      for (var key in itemDefaultConfig) {
        if (config[key] === undefined) {
          config[key] = itemDefaultConfig[key];
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
      if (event instanceof BubblingEvent && event.isPropagationStopped === false && this.isInitialised === true) {
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
      if (indexOf(name, this._throttledEvents) === -1) {
        this.layoutManager.emit(name, event.origin);
      } else {
        if (this._pendingEventPropagations[name] !== true) {
          this._pendingEventPropagations[name] = true;
          animFrame(fnBind(this._propagateEventToLayoutManager, this, [name, event]));
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
}(EventEmitter);

export { AbstractContentItem as default };