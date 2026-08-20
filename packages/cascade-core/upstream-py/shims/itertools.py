# `itertools` superset shim: this MicroPython build bundles at most a partial
# itertools; upstream build123d dev needs product (build_common) and
# cycle/permutations/starmap (operations_part). Pure-Python definitions of
# everything used, with the builtin module (when present) star-imported first.
try:
    from itertools import *  # noqa: F401,F403 - the builtin module
except ImportError:
    pass


def cycle(iterable):
    saved = []
    for el in iterable:
        yield el
        saved.append(el)
    while saved:
        for el in saved:
            yield el


def starmap(function, iterable):
    for args in iterable:
        yield function(*args)


def chain(*iterables):
    for it in iterables:
        for el in it:
            yield el


def combinations(iterable, r):
    pool = tuple(iterable)
    n = len(pool)
    if r > n:
        return
    indices = list(range(r))
    yield tuple(pool[i] for i in indices)
    while True:
        for i in reversed(range(r)):
            if indices[i] != i + n - r:
                break
        else:
            return
        indices[i] += 1
        for j in range(i + 1, r):
            indices[j] = indices[j - 1] + 1
        yield tuple(pool[i] for i in indices)


def product(*iterables, repeat=1):
    pools = [tuple(p) for p in iterables] * repeat
    result = [[]]
    for pool in pools:
        result = [x + [y] for x in result for y in pool]
    for prod in result:
        yield tuple(prod)


def permutations(iterable, r=None):
    pool = tuple(iterable)
    n = len(pool)
    if r is None:
        r = n
    if r > n:
        return
    indices = list(range(n))
    cycles = list(range(n, n - r, -1))
    yield tuple(pool[i] for i in indices[:r])
    while n:
        for i in reversed(range(r)):
            cycles[i] -= 1
            if cycles[i] == 0:
                indices[i:] = indices[i + 1:] + indices[i:i + 1]
                cycles[i] = n - i
            else:
                j = cycles[i]
                indices[i], indices[-j] = indices[-j], indices[i]
                yield tuple(pool[i] for i in indices[:r])
                break
        else:
            return
