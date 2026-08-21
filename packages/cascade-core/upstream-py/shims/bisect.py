# `bisect` shim (MicroPython has no bisect module). Pure-Python CPython
# semantics for the functions upstream topology uses (one_d.bisect_right).


def bisect_right(a, x, lo=0, hi=None):
    if hi is None:
        hi = len(a)
    while lo < hi:
        mid = (lo + hi) // 2
        if x < a[mid]:
            hi = mid
        else:
            lo = mid + 1
    return lo


def bisect_left(a, x, lo=0, hi=None):
    if hi is None:
        hi = len(a)
    while lo < hi:
        mid = (lo + hi) // 2
        if a[mid] < x:
            lo = mid + 1
        else:
            hi = mid
    return lo


bisect = bisect_right


def insort_right(a, x, lo=0, hi=None):
    a.insert(bisect_right(a, x, lo, hi), x)


def insort_left(a, x, lo=0, hi=None):
    a.insert(bisect_left(a, x, lo, hi), x)


insort = insort_right
