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
import Tab from '../controls/Tab';
import HeaderButton from '../controls/HeaderButton';
import { fnBind } from '../utils/utils';
import $ from 'jquery';

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
    _this.element = $(_template);

    if (_this.layoutManager.config.settings.selectionEnabled === true) {
      _this.element.addClass('lm_selectable');

      _this.element.on('click touchstart', fnBind(_this._onHeaderClick, _assertThisInitialized(_this)));
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
    _this.hideAdditionalTabsDropdown = fnBind(_this._hideAdditionalTabsDropdown, _assertThisInitialized(_this));
    $(document).mouseup(_this.hideAdditionalTabsDropdown);
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

      tab = new Tab(this, contentItem);

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

      $(document).off('mouseup', this.hideAdditionalTabsDropdown);
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

      showTabDropdown = fnBind(this._showAdditionalTabsDropdown, this);
      tabDropdownLabel = this.layoutManager.config.labels.tabDropdown;
      this.tabDropdownButton = new HeaderButton(this, tabDropdownLabel, 'lm_tabdropdown', showTabDropdown);
      this.tabDropdownButton.element.hide();

      if (this.parent._header && this.parent._header.dock) {
        var button = fnBind(this.parent.dock, this.parent);
        label = this._getHeaderSetting('dock');
        this.dockButton = new HeaderButton(this, label, 'lm_dock', button);
      }
      /**
       * Popout control to launch component in new window.
       */


      if (this._getHeaderSetting('popout')) {
        popout = fnBind(this._onPopoutClick, this);
        label = this._getHeaderSetting('popout');
        new HeaderButton(this, label, 'lm_popout', popout);
      }
      /**
       * Maximise control - set the component to the full size of the layout
       */


      if (this._getHeaderSetting('maximise')) {
        maximise = fnBind(this.parent.toggleMaximise, this.parent);
        maximiseLabel = this._getHeaderSetting('maximise');
        minimiseLabel = this._getHeaderSetting('minimise');
        maximiseButton = new HeaderButton(this, maximiseLabel, 'lm_maximise', maximise);
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
        closeStack = fnBind(this.parent.remove, this.parent);
        label = this._getHeaderSetting('close');
        this.closeButton = new HeaderButton(this, label, 'lm_close', closeStack);
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
}(EventEmitter);

export { Header as default };