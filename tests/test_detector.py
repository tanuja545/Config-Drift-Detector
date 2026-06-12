from detector import detect_drift

def test_no_drift():
    actual = {"port": 8080}
    intended = {"port": 8080}

    result = detect_drift(actual, intended)

    assert len(result) == 0

def test_port_drift():
    actual = {"port": 8080}
    intended = {"port": 9090}

    result = detect_drift(actual, intended)

    assert len(result) > 0

def test_debug_drift():
    actual = {"debug": True}
    intended = {"debug": False}

    result = detect_drift(actual, intended)

    assert len(result) > 0
