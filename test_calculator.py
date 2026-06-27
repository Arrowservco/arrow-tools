from calculator import add, subtract, multiply

def test_add():
    assert add(2, 3) == 5

def test_subtract():
    assert subtract(5, 3) == 2

def test_multiply():
    assert multiply(4, 3) == 12

if __name__ == "__main__":
    test_add()
    test_subtract()
    test_multiply()
    print("All tests passed!")
