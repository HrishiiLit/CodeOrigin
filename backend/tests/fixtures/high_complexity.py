def complex_decision_matrix(a, b, c, d, e):
    if a > 0:
        if b > 0:
            if c > 0:
                if d > 0:
                    return e * 2 if e > 0 else e - 2
                else:
                    return d - 1
            else:
                return c - 1
        elif b < -10:
            for i in range(10):
                if i % 2 == 0:
                    a += i
            return a
        else:
            return b
    else:
        while a < 0:
            a += 1
            if a == -5:
                break
        return a
