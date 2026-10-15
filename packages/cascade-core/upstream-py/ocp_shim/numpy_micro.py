# numpy_micro — the numpy surface upstream build123d geometry.py +
# topology/*.py ACTUALLY use (numpy-bill.json, upstream-topology spike):
#
#   np.array          Axis._intersect_axis (1-D vectors + one 3x3 system)
#   np.cross          3-vectors only
#   np.linalg.lstsq   the 3x3 axis-intersection system (full-rank; upstream
#                     guards coaxial/skew BEFORE calling)
#   np.linspace       Color.color_wheel, Mixin1D.curvature_comb
#   (0.13) Shape.tessellate_with_uvs — export_obj's UV path: np.empty((n, k)),
#                     row/column/boolean-mask item assignment, 2-D @ 2-D,
#                     row broadcasting in + - * /, `< scalar` masks,
#                     .min/.max(axis=0)
#
# Loaded as module 'numpy' ONLY under pytopo=upstream (UpstreamB123d.js);
# the honest RAISING stub (shims/numpy.py) stays everywhere else. Validated
# against real numpy in the reference venv on the exact axis-intersection
# inputs (experiments/upstream-topology-spike/validate-numpy-micro.py).
#
# Pure Python, MicroPython-compatible. NOT a numpy: anything outside the
# billed surface raises loudly.
import math

pi = math.pi


class ndarray:
    """1-D (list of floats) or 2-D (list of row lists)."""

    def __init__(self, data, _2d=False):
        self._2d = _2d
        self.data = data

    # -- construction helpers ------------------------------------------- #
    @staticmethod
    def _of(data, _2d):
        return ndarray(data, _2d)

    # -- the billed operator surface ------------------------------------ #
    @property
    def T(self):
        if not self._2d:
            return self
        rows = self.data
        return ndarray([[rows[r][c] for r in range(len(rows))]
                        for c in range(len(rows[0]))], True)

    def __neg__(self):
        if self._2d:
            return ndarray([[-x for x in row] for row in self.data], True)
        return ndarray([-x for x in self.data])

    def _elementwise(self, other, op):
        if self._2d:
            # 2-D op scalar / 2-D op row (numpy broadcasting of a 1-D row
            # over every row) / 2-D op same-shape 2-D
            if isinstance(other, ndarray) and other._2d:
                return ndarray([[op(a, b) for a, b in zip(r, q)]
                                for r, q in zip(self.data, other.data)], True)
            if isinstance(other, (ndarray, list, tuple)):
                row = other.data if isinstance(other, ndarray) else list(other)
                return ndarray([[op(a, b) for a, b in zip(r, row)]
                                for r in self.data], True)
            return ndarray([[op(a, other) for a in r] for r in self.data], True)
        if isinstance(other, ndarray):
            if other._2d:
                raise NotImplementedError('numpy_micro: 1-D op 2-D')
            other = other.data
        elif not isinstance(other, (list, tuple)):
            return ndarray([op(a, other) for a in self.data])
        return ndarray([op(a, b) for a, b in zip(self.data, other)])

    def __truediv__(self, other):
        return self._elementwise(other, lambda a, b: a / b)

    def __lt__(self, other):
        if self._2d:
            raise NotImplementedError('numpy_micro: 2-D comparison')
        return ndarray([a < other for a in self.data])

    def __matmul__(self, other):
        if not (self._2d and isinstance(other, ndarray) and other._2d):
            raise NotImplementedError('numpy_micro: @ needs two 2-D arrays')
        cols = list(zip(*other.data))

        def dot(r, c):
            # accumulate from the FIRST product (like numpy's dot), not from
            # an int 0: keeps IEEE signed zeros (-0.0 normals) bit-identical
            acc = r[0] * c[0]
            for k in range(1, len(r)):
                acc += r[k] * c[k]
            return acc
        return ndarray([[dot(r, c) for c in cols] for r in self.data], True)

    def _reduce(self, fn, axis):
        if not self._2d:
            if axis not in (None, 0):
                raise NotImplementedError('numpy_micro: axis on 1-D')
            return fn(self.data)
        if axis == 0:
            return ndarray([fn(c) for c in zip(*self.data)])
        raise NotImplementedError('numpy_micro: 2-D reduction needs axis=0')

    def min(self, axis=None):
        return self._reduce(min, axis)

    def max(self, axis=None):
        return self._reduce(max, axis)

    def __setitem__(self, key, value):
        if isinstance(key, ndarray):
            # boolean mask assignment (1-D): a[a < tol] = 1.0
            for i, flag in enumerate(key.data):
                if flag:
                    self.data[i] = value
            return
        if isinstance(key, tuple):
            # a[:, j] = column (2-D)
            rows, col = key
            if not (self._2d and _full_slice(rows)):
                raise NotImplementedError('numpy_micro: only [:, j] indexing')
            vals = value.data if isinstance(value, ndarray) else value
            if isinstance(vals, (list, tuple)):
                for r, v in zip(self.data, vals):
                    r[col] = float(v)
            else:
                for r in self.data:
                    r[col] = float(vals)
            return
        if self._2d:
            v = value.data if isinstance(value, ndarray) else value
            self.data[key] = [float(x) for x in v]
        else:
            self.data[key] = float(value)

    def __add__(self, other):
        return self._elementwise(other, lambda a, b: a + b)

    def __radd__(self, other):
        return self._elementwise(other, lambda a, b: b + a)

    def __sub__(self, other):
        return self._elementwise(other, lambda a, b: a - b)

    def __rsub__(self, other):
        return self._elementwise(other, lambda a, b: b - a)

    def __mul__(self, k):
        if isinstance(k, ndarray):
            return self._elementwise(k, lambda a, b: a * b)
        if self._2d:
            return ndarray([[x * k for x in row] for row in self.data], True)
        return ndarray([x * k for x in self.data])

    def __rmul__(self, k):
        return self.__mul__(k)

    def __iter__(self):
        if self._2d:
            return iter([ndarray(r) for r in self.data])
        return iter(self.data)

    def __len__(self):
        return len(self.data)

    def __getitem__(self, i):
        if isinstance(i, tuple):
            rows, col = i
            if not (self._2d and _full_slice(rows)):
                raise NotImplementedError('numpy_micro: only [:, j] indexing')
            return ndarray([r[col] for r in self.data])
        v = self.data[i]
        return ndarray(v) if isinstance(v, list) else v

    def __repr__(self):
        return 'ndarray(' + repr(self.data) + ')'

    def __getattr__(self, name):
        raise NotImplementedError(
            'numpy_micro: ndarray.' + name + ' is outside the billed surface')


def array(seq):
    items = list(seq)
    if items and isinstance(items[0], (list, tuple, ndarray)):
        return ndarray([list(r.data if isinstance(r, ndarray) else r)
                        for r in items], True)
    return ndarray([float(x) for x in items])


def _full_slice(k):
    # `[:, j]`; MicroPython cannot construct slice() to compare against
    return isinstance(k, slice) and repr(k) == 'slice(None, None, None)'


def empty(shape):
    """np.empty((n, k)) / np.empty(n) — zero-filled (numpy leaves it
    uninitialized; every billed caller writes each element before reading)."""
    if isinstance(shape, (list, tuple)):
        if len(shape) == 2:
            return ndarray([[0.0] * int(shape[1]) for _ in range(int(shape[0]))],
                           True)
        if len(shape) == 1:
            shape = shape[0]
        else:
            raise NotImplementedError('numpy_micro: empty() beyond 2-D')
    return ndarray([0.0] * int(shape))


def cross(a, b):
    ax, ay, az = list(a)
    bx, by, bz = list(b)
    return ndarray([ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx])


def linspace(start, stop, num=50, endpoint=True):
    num = int(num)
    if num <= 0:
        return ndarray([])
    if num == 1:
        return ndarray([float(start)])
    step = (stop - start) / ((num - 1) if endpoint else num)
    return ndarray([start + step * i for i in range(num)])


def _solve(a, b):
    """Gaussian elimination with partial pivoting on an n x n system
    (mutates copies). Raises on a singular matrix — upstream guards the
    only lstsq call site (coaxial/skew checked first)."""
    n = len(a)
    m = [list(a[i]) + [b[i]] for i in range(n)]
    for col in range(n):
        piv = max(range(col, n), key=lambda r: abs(m[r][col]))
        if abs(m[piv][col]) < 1e-14:
            raise ArithmeticError('numpy_micro lstsq: singular system')
        if piv != col:
            m[col], m[piv] = m[piv], m[col]
        inv = 1.0 / m[col][col]
        for r in range(col + 1, n):
            f = m[r][col] * inv
            if f == 0.0:
                continue
            for c in range(col, n + 1):
                m[r][c] -= f * m[col][c]
    x = [0.0] * n
    for r in range(n - 1, -1, -1):
        s = m[r][n]
        for c in range(r + 1, n):
            s -= m[r][c] * x[c]
        x[r] = s / m[r][r]
    return x


class _Linalg:
    @staticmethod
    def lstsq(a, b, rcond=None):
        """Least squares via the normal equations (A^T A x = A^T b). For the
        billed full-rank square 3x3 system this IS numpy's unique minimizer;
        the minimum-norm SVD solution of a singular system is NOT replicated
        (upstream never reaches lstsq with one)."""
        rows = a.data if isinstance(a, ndarray) else [list(r) for r in a]
        rhs = list(b)
        mrows = len(rows)
        ncols = len(rows[0])
        ata = [[sum(rows[k][i] * rows[k][j] for k in range(mrows))
                for j in range(ncols)] for i in range(ncols)]
        atb = [sum(rows[k][i] * rhs[k] for k in range(mrows))
               for i in range(ncols)]
        x = _solve(ata, atb)
        # (solution, residuals, rank, singular values) — only [0] is billed;
        # the rest raise on USE rather than carry fake numbers
        return (ndarray(x), _unsupported('lstsq residuals'),
                _unsupported('lstsq rank'), _unsupported('lstsq singular values'))


class _Unsupported:
    def __init__(self, what):
        self._what = what

    def __getattr__(self, name):
        raise NotImplementedError('numpy_micro: ' + self._what
                                  + ' is outside the billed surface')


def _unsupported(what):
    return _Unsupported(what)


linalg = _Linalg()


def __getattr__(name):  # CPython PEP 562 (validation runs); no-op on MicroPython
    raise NotImplementedError(
        'numpy_micro: numpy.' + name + ' is outside the billed surface')
