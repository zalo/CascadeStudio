# HONEST sklearn.cluster stub (pysrc=real on Pyodide): scikit-learn is a
# compiled package serving only brep_from_stl.detect_primitives (a deliberate
# skip on every leg). Any USE raises loudly.


class DBSCAN:
    def __init__(self, *a, **k):
        raise NotImplementedError(
            'sklearn.cluster.DBSCAN is not available in the browser worker '
            '(detect_primitives is not supported)')
