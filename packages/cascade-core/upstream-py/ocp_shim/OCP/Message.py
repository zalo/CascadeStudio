# GENERATED OCP.Message — proxies over the embind binding (gen-ocp-shim.mjs)
from ocp_registry import Message_Gravity, Message_ProgressRange  # noqa: F401
Message_Trace = Message_Gravity.Message_Trace
Message_Info = Message_Gravity.Message_Info
Message_Warning = Message_Gravity.Message_Warning
Message_Alarm = Message_Gravity.Message_Alarm
Message_Fail = Message_Gravity.Message_Fail
class _Any:
    def __init__(self, *a, **k):
        raise NotImplementedError(
            'OCP.Message.' + self.__class__.__name__ + ' is not in the generated shim')
class Message(_Any):
    pass
