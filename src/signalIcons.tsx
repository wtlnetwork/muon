export const getSignalIcon = (signalStrength: number, size: number = 50) => {
    const iconStyle = {
      width: `${size}px`,
      height: `${size}px`,
    };
  
    if (signalStrength >= -49) {
      return (
        <img
          src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAJtJREFUOE9jZGBgEGBgYPiPAAqwgqEwCwgIgEQB8SAQBcQIQTwIBYgAoQAACAegBokDABW7QKBxQJgAElAYXgJgKICgAADAIA4YU3f0AAAAASUVORK5CYII="
          alt="Excellent Signal"
          style={iconStyle}
        />
      );
    } else if (signalStrength >= -59) {
      return (
        <img
          src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAMBJREFUOE9jZGBgEBBkYBBiMDBAYlAwA4gEQJMgFgDiTgDxLhBDIDAAk0EA8S4QQyAQB4IBEAACA7wCB2QJgAQAAAABJRU5ErkJggg=="
          alt="Good Signal"
          style={iconStyle}
        />
      );
    } else if (signalStrength >= -69) {
      return (
        <img
          src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAANlJREFUOE9jZGBgEBAYGIHiCN4NxQYQBcgEQJMgFgDiTgDxLhBDIBAHggERIArEkyAwBRJgYICogMgwgExlAwAAH40CBwPUHMAAAAAElFTkSuQmCC"
          alt="Fair Signal"
          style={iconStyle}
        />
      );
    } else {
      return (
        <img
          src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABUAAAAQCAYAAAD5W6JAAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAERJREFUOE9jZGBgEBBkYBBiMgAJiJgEgQBIzABRkgFgTQCQAOQkA8CcQJAA5CUQCwJxAkADkJFADADScAi0IoBeAAAAABJRU5ErkJggg=="
          alt="Weak Signal"
          style={iconStyle}
        />
      );
    }
  };  
