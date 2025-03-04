export const getSignalIcon = (signalStrength: number, size: number = 50) => {
    const iconStyle = {
      width: `${size}px`,
      height: `${size}px`,
    };
  
    if (signalStrength >= -49) {
      return (
        <img
          src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAC4jAAAuIwF4pT92AAAAG3RFWHRTb2Z0d2FyZQBDZWxzeXMgU3R1ZGlvIFRvb2zBp+F8AAAA80lEQVRYhe2UT0pCcRRGz32UphWh8USI16BZtIrAIrCBK1CJajE1cg9N+reElhDtIYjkRakIL0zxNniTrN/0Nrrf7OOc8ZFO71ijpMjPRQICTJ8n+Tfk0r1vabq9tCDsxsvsVIo8PgyZK1hyad819TWZ8Xt78RrDpwlzVSy5tG+PtL/1+UcAqL+UALDk0r051Lf6OCjE/XUALLmcXDf0vfYRFDbTKgCWXM6v9jXbSINCeVQDwJLL2eWBlitfQSEbFHLRkIt3wDvgHfAOeAe8A94B70Cn19QoWVkA3gHwDuTzDvxLB04vGrpanQaFbFBAVbHk3+YKPrOX++U6AAAADmVYSWZNTQAqAAAACAAAAAAAAADSU5MAAAAASUVORK5CYII="
          alt="Excellent Signal"
          style={iconStyle}
        />
      );
    } else if (signalStrength >= -59) {
      return (
        <img
          src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAC4jAAAuIwF4pT92AAAAG3RFWHRTb2Z0d2FyZQBDZWxzeXMgU3R1ZGlvIFRvb2zBp+F8AAABe0lEQVRYhe2UPUtCURzGn5MkeM1EwSLo5QO0NAQtQSYmYkWR1NTW2zfoGxjV1BCVpUPQUOrpZQgiIgpaWpqbI4iCtBA1rnH/DS2Fl3PBwyGCe9bfcx6e4ZwfW1qLkafDgZ/HwRgYgMLDJ65P3+Nn5zeHqONEI/0TA8NeLupn67kRqnQZvwK9gSZ0+zTkLl5xspWXGjC64OOifraRjZHeWa253BNoxv3dB46Sb1IDxua9XNTPNjNRMtorpgUNjy4c7xSlBozPebion20fRIi1FU0D9OQBT5WkBsRn3VzUz1L7YWpszZsGqs9+ZNMVqQGTMy4u6mfp3UFyai+mAb3cgsyeLjVgatrJRf1sJTFEPrduGiiUnLi8KksNCAU1LupntgdsD9ge+A8eWAVwW88AAH2hoLYo5QEAUMktPWAQQSW39IBBBJXc0gMAoJJbegAAVHJLDwCASm7pAQBQyS09AAAque0B2wO2B/7eA8uJMPndtY8E+P6nBIJK/gX1w0bLZ/pmZAAAAA5lWElmTU0AKgAAAAgAAAAAAAAA0lOTAAAAAElFTkSuQmCC"
          alt="Good Signal"
          style={iconStyle}
        />
      );
    } else if (signalStrength >= -69) {
      return (
        <img
          src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAC4jAAAuIwF4pT92AAAAG3RFWHRTb2Z0d2FyZQBDZWxzeXMgU3R1ZGlvIFRvb2zBp+F8AAABTElEQVRYhe3UP0tCURjH8e8tCIr+kKAEIo6Nbe2BRUhbr8HXUHtLGEQELVIttWQhNOng4CBkU3NuFkYYWWJpWPQ0tBRePNDDMwT3jPcLl99wzsfbWUtKND7MzzMkHgC3Nx/kK63VQqmcw+h4Z3srEpv//PUx0hon9DJGsf5IJts0HrCblNjce18Idya5qr6RyT3bDjjdXpbobNc31q9H2T9v2w7Ibi7JTLztG+9rExzkX20HnGwkJBJu+sbGQ4jDYtd2wPH6gkzR8I0tIhxd9GwHbKUWZZqeb3xihGK1YzsgcCBwIHDgPziQBi4H/KNSKJXv/jzA5QCApRNOBwTB0gmnA+IJlk44HQCwdMLpAIClE04HACydcDoAYOmE0wEApRODB2gd0Ha1A9qudkDb1Q5ou9oBbVc7oO1qB7TdS6cSEqL/ksD3OxcEy/4FzwjJWugXYLUAAAAOZVhJZk1NACoAAAAIAAAAAAAAANJTkwAAAABJRU5ErkJggg=="
          alt="Fair Signal"
          style={iconStyle}
        />
      );
    } else {
      return (
        <img
          src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAC4jAAAuIwF4pT92AAAAG3RFWHRTb2Z0d2FyZQBDZWxzeXMgU3R1ZGlvIFRvb2zBp+F8AAAA4ElEQVRYhe3Uy0rCQRiG8eejaCGZpPwzSLuR2hmeshAvy1334MZDl9A1eA0mQgUqIop44G0hIqLbwc03m4F5PoYfsxiTxDmXOcABDnCAAxzgAAc4wAEOKDw9184K+KiWlb24PDw0wOB7tQYgZLfP2pseF5uDgSi65jYV46s3RIKQ3TrVV2Vny6OnidI3dGcLJAjZrf1e0sNkfjQAMEjEAAjZrVXJ63443Z4IsP3+k4oDELJbs/Siu9/RSeFfOglAyG6NQk6J/mgv2/EMJpntBSG71ctFJVenP6PxlSFByP4PVi/ppngsemgAAAAOZVhJZk1NACoAAAAIAAAAAAAAANJTkwAAAABJRU5ErkJggg=="
          alt="Weak Signal"
          style={iconStyle}
        />
      );
    }
  };  