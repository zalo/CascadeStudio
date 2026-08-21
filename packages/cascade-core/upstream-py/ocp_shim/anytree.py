# anytree shim (pytopo=upstream) — upstream shape_core's Shape subclasses
# anytree.NodeMixin for the assembly tree. Minimal parent/children semantics;
# attributes are stored under the LITERAL mangled names ('_NodeMixin__...')
# because (a) upstream code references them by string in copy_attributes_to
# and (b) MicroPython does not implement name mangling.


class NodeMixin:
    separator = "/"

    @property
    def parent(self):
        return getattr(self, '_NodeMixin__parent', None)

    def _cs_hook(self, name, arg):
        fn = getattr(self, name, None)
        if fn is not None:
            fn(arg)

    @parent.setter
    def parent(self, value):
        old = getattr(self, '_NodeMixin__parent', None)
        if old is value:
            return
        if old is not None:
            self._cs_hook('_pre_detach', old)
            kids = list(getattr(old, '_NodeMixin__children', ()))
            kids = [k for k in kids if k is not self]
            setattr(old, '_NodeMixin__children', tuple(kids))
            self._cs_hook('_post_detach', old)
        if value is not None:
            self._cs_hook('_pre_attach', value)
        setattr(self, '_NodeMixin__parent', value)
        if value is not None:
            kids = list(getattr(value, '_NodeMixin__children', ()))
            kids.append(self)
            setattr(value, '_NodeMixin__children', tuple(kids))
            self._cs_hook('_post_attach', value)

    @property
    def children(self):
        return tuple(getattr(self, '_NodeMixin__children', ()))

    @children.setter
    def children(self, value):
        # anytree's attach/detach hook protocol: upstream Compound rebuilds
        # its wrapped TopoDS from the children in _post_attach_children
        old = self.children
        value = tuple(value)
        if old:
            self._cs_hook('_pre_detach_children', old)
            for c in old:
                setattr(c, '_NodeMixin__parent', None)
            setattr(self, '_NodeMixin__children', ())
            self._cs_hook('_post_detach_children', old)
        self._cs_hook('_pre_attach_children', value)
        setattr(self, '_NodeMixin__children', value)
        for c in value:
            setattr(c, '_NodeMixin__parent', self)
        self._cs_hook('_post_attach_children', value)

    @property
    def is_leaf(self):
        return not getattr(self, '_NodeMixin__children', ())

    @property
    def is_root(self):
        return getattr(self, '_NodeMixin__parent', None) is None

    @property
    def height(self):
        kids = getattr(self, '_NodeMixin__children', ())
        if not kids:
            return 0
        return 1 + max(k.height for k in kids)

    @property
    def depth(self):
        d = 0
        p = getattr(self, '_NodeMixin__parent', None)
        while p is not None:
            d += 1
            p = getattr(p, '_NodeMixin__parent', None)
        return d

    @property
    def descendants(self):
        out = []

        def walk(n):
            for c in getattr(n, '_NodeMixin__children', ()):
                out.append(c)
                walk(c)
        walk(self)
        return tuple(out)


def PreOrderIter(node):
    """Pre-order traversal INCLUDING the start node (anytree semantics;
    upstream composite's Compound iteration/children walks ride on it)."""
    yield node
    for c in getattr(node, '_NodeMixin__children', ()):
        yield from PreOrderIter(c)


class RenderTree:
    """Minimal pre-order iterator yielding (prefix, fill, node)."""

    def __init__(self, node, **kwargs):
        self.node = node

    def __iter__(self):
        def walk(n, depth):
            yield ('    ' * depth, '    ' * depth, n)
            for c in getattr(n, '_NodeMixin__children', ()):
                yield from walk(c, depth + 1)
        return walk(self.node, 0)
