function Node() {
    this._element = null;

    switch (arguments.length){
        case 1 :
            var arg = arguments[0];
            if (arg != Node.INPUT_TEXT &&
                arg != Node.INPUT_BUTTON &&
                arg != Node.INPUT_SELECT &&
                arg != Node.INPUT_CHECKBOX) {
                this._element = document.createElement(arg);
            }
            else {
                this._element = document.createElement('input');
                this._element.type = arg;
            }
            break;
        case 0:
            this._element = document.createElement('div');
            break;
    }
}

Node.DIV            = 'div';
Node.INPUT_TEXT     = 'text';
Node.INPUT_BUTTON   = 'button';
Node.INPUT_SELECT   = 'select';
Node.INPUT_CHECKBOX = 'checkbox';
Node.OPTION         = 'option';
Node.LIST           = 'ul';
Node.LIST_ITEM      = 'li';
Node.SPAN           = 'span';
Node.TEXTAREA       = 'textarea';

Node.prototype = {
    addChild: function (node) {
        this._element.appendChild(node.getElement());
        return node;
    },
    addChildren: function () {
        var i = -1, l = arguments.length, e = this._element;
        while (++i < l) {
            e.appendChild(arguments[i].getElement());
        }
        return this;
    },
    addChildAt: function (node, index) {
        this._element.insertBefore(node.getElement(), this._element.children[index]);
        return node;
    },
    removeChild: function (node) {
        if (!this.contains(node))return null;
        this._element.removeChild(node.getElement());
        return node;
    },
    removeChildren: function () {
        var i = -1, l = arguments.length, e = this._element;
        while (++i < l) {
            e.removeChild(arguments[i].getElement());
        }
        return this;
    },
    removeChildAt: function (node, index) {
        if (!this.contains(node))return null;
        this._element.removeChild(node.getElement());
        return node;
    },
    removeAllChildren: function () {
        var element = this._element;
        while (element.hasChildNodes())element.removeChild(element.lastChild);
        return this;
    },
    setWidth: function (value) {
        this._element.style.width = value + 'px';
        return this;
    },
    getWidth: function () {
        return this._element.offsetWidth;
    },
    setHeight: function (value) {
        this._element.style.height = value + 'px';
        return this;
    },
    getHeight: function () {
        return this._element.offsetHeight;
    },
    setPosition: function (x, y) {
        return this.setPosition(x).setPosition(y);
    },
    setPositionX: function (x) {
        this._element.style.marginLeft = x + 'px';
        return this;
    },
    setPositionY: function (y) {
        this._element.style.marginTop = y + 'px';
        return this;
    },
    setPositionGlobal: function (x, y) {
        return this.setPositionGlobalX(x).setPositionGlobalY(y);
    },
    setPositionGlobalX: function (x) {
        this._element.style.left = x + 'px';
        return this;
    },
    setPositionGlobalY: function (y) {
        this._element.style.top = y + 'px';
        return this;
    },
    getPosition: function () {
        return [this.getPositionX(), this.getPositionY()];
    },
    getPositionX: function () {
        return this._element.offsetLeft;
    },
    getPositionY: function () {
        return this._element.offsetTop;
    },
    getPositionGlobal: function () {
        var offset = [0, 0],
            element = this._element;

        while (element) {
            offset[0] += element.offsetLeft;
            offset[1] += element.offsetTop;
            element = element.offsetParent;
        }

        return offset;
    },
    getPositionGlobalX: function () {
        var offset = 0,
            element = this._element;

        while (element) {
            offset += element.offsetLeft;
            element = element.offsetParent;
        }

        return offset;
    },
    getPositionGlobalY: function () {
        var offset = 0,
            element = this._element;

        while (element) {
            offset += element.offsetTop;
            element = element.offsetParent;
        }

        return offset;
    },
    addEventListener: function (type, listener, useCapture) {
        this._element.addEventListener(type, listener, useCapture);
        return this;
    },
    removeEventListener: function (type, listener, useCapture) {
        this._element.removeEventListener(type, listener, useCapture);
        return this;
    },
    dispatchEvent : function(event) {
        this._element.dispatchEvent(event);
        return this;
    },
    setStyleClass: function (style) {
        this._element.className = style;
        return this;
    },
    setStyleProperty: function (property, value) {
        this._element.style[property] = value;
        return this;
    },
    getStyleProperty: function (property) {
        return this._element.style[property];
    },
    setStyleProperties: function (properties) {
        for (var p in properties){
            this._element.style[p] = properties[p];
        }
        return this;
    },
    deleteStyleClass: function () {
        this._element.className = '';
        return this
    },
    deleteStyleProperty: function (property) {
        this._element.style[property] = '';
        return this;
    },
    deleteStyleProperties: function (properties) {
        for (var p in properties){
            this._element.style[p] = '';
        }
        return this;
    },
    getChildAt: function (index) {
        return new Node().setElement(this._element.children[index]);
    },
    getChildIndex: function (node) {
        return this._indexOf(this._element, node.getElement());
    },
    getNumChildren: function () {
        return this._element.children.length;
    },
    getFirstChild: function () {
        return new Node().setElement(this._element.firstChild);
    },
    getLastChild: function () {
        return new Node().setElement(this._element.lastChild);
    },
    hasChildren: function () {
        return this._element.children.length != 0;
    },
    contains: function (node) {
        return this._indexOf(this._element, node.getElement()) != -1;
    },
    _indexOf: function (parentElement, element) {
        return Array.prototype.indexOf.call(parentElement.children, element);
    },
    setProperty: function (property, value) {
        this._element[property] = value;
        return this;
    },
    setProperties: function (properties) {
        for (var p in properties){
            this._element[p] = properties[p];
        }
        return this;
    },
    getProperty: function (property) {
        return this._element[property];
    },
    setElement: function (element) {
        this._element = element;
        return this;
    },
    getElement: function () {
        return this._element;
    },
    getStyle: function () {
        return this._element.style;
    },
    getParent: function () {
        return new Node().setElement(this._element.parentNode);
    }
};

Node.getNodeByElement = function (element) {
    return new Node().setElement(element);
};
Node.getNodeById = function (id) {
    return new Node().setElement(document.getElementById(id));
};

export default Node;