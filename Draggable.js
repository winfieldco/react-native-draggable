/**
 *  * https://github.com/tongyy/react-native-draggable
 *
 */

import React from 'react';
import {
  View,
  Text,
  Image,
  PanResponder,
  Animated,
  Dimensions,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import PropTypes from 'prop-types';

function clamp(number, min, max) {
  return Math.max(min, Math.min(number, max));
}

export default function Draggable(props) {
  const {
    renderText,
    isCircle,
    renderSize,
    imageSource,
    renderColor,
    children,
    shouldReverse,
    onReverse,
    disabled,
    debug,
    animatedViewProps,
    touchableOpacityProps,
    onDrag,
    onShortPressRelease,
    onDragRelease,
    onLongPress,
    onPressIn,
    onPressOut,
    onRelease,
    x,
    y,
    z,
    minX,
    minY,
    maxX,
    maxY,
    dragHandle,
    afterRender,
  } = props;

  // The Animated object housing our xy value so that we can spring back
  const pan = React.useRef(new Animated.ValueXY());
  // Always set to xy value of pan, would like to remove
  const offsetFromStart = React.useRef({x: 0, y: 0});
  // Width/Height of Draggable (renderSize is arbitrary if children are passed in)
  const childSize = React.useRef({x: renderSize, y: renderSize});
  // Top/Left/Right/Bottom location on screen from start of most recent touch
  const startBounds = React.useRef();
  // Whether we're currently dragging or not
  const isDragging = React.useRef(false);

  const getBounds = React.useCallback(() => {
    const left = x + offsetFromStart.current.x;
    const top = y + offsetFromStart.current.y;
    return {
      left,
      top,
      right: left + childSize.current.x,
      bottom: top + childSize.current.y,
    };
  }, [x, y]);

  const shouldStartDrag = React.useCallback(
    (gs) => {
      return !disabled && (Math.abs(gs.dx) > 2 || Math.abs(gs.dy) > 2);
    },
    [disabled],
  );

  const reversePosition = React.useCallback(() => {
    const originalOffset = {x: 0, y: 0};
    const newOffset = onReverse ? onReverse() : originalOffset;
    Animated.spring(pan.current, {
      toValue: newOffset || originalOffset,
      useNativeDriver: false,
    }).start();
  }, [pan]);

  // Provide a function that can be passed to callbacks to animate to a specific offset
  var animateTo = (offset, callback) => {
    Animated.spring(pan.current, {
      toValue: offset,
      useNativeDriver: false,  

      // Allows subsequent animations to run quickly afterwards
      restDisplacementThreshold: 1,
      restSpeedThreshold: 1,
          
    }).start(() => {
      if(callback) {
        callback();
      }
    });    
  }

  const onPanResponderRelease = React.useCallback(
    (e, gestureState) => {
      isDragging.current = false;
      if (!shouldReverse) {
        pan.current.flattenOffset();     
      } else {
        reversePosition();
      }

      // Must be placed below the flatten offset, otherwise animateTo will cause jumping as it will
      // animate but then flatten immediately during the animation
      if (onDragRelease) {
        onDragRelease(e, gestureState, startBounds.current, getBounds());
        onRelease(e, true);
      }

    },
    [onDragRelease, shouldReverse, onRelease, reversePosition, getBounds],
  );

  const onPanResponderGrant = React.useCallback(
    (e, gestureState) => {
      startBounds.current = getBounds();
      isDragging.current = true;
      if (!shouldReverse) {
        pan.current.setOffset(offsetFromStart.current);
        pan.current.setValue({x: 0, y: 0});
      }
    },
    [getBounds, shouldReverse],
  );

  const handleOnDrag = React.useCallback(
    (e, gestureState) => {
      const {dx, dy} = gestureState;
      const {top, right, left, bottom} = startBounds.current;
      const far = 999999999;
      const changeX = clamp(
        dx,
        Number.isFinite(minX) ? minX - left : -far,
        Number.isFinite(maxX) ? maxX - right : far,
      );
      const changeY = clamp(
        dy,
        Number.isFinite(minY) ? minY - top : -far,
        Number.isFinite(maxY) ? maxY - bottom : far,
      );
      pan.current.setValue({x: changeX, y: changeY});
      onDrag(e, gestureState, startBounds.current, getBounds());
    },
    [maxX, maxY, minX, minY, onDrag],
  );

  const panResponder = React.useMemo(() => {
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        shouldStartDrag(gestureState),
      onMoveShouldSetPanResponderCapture: (_, gestureState) =>
        shouldStartDrag(gestureState),
      onPanResponderGrant,
      onPanResponderMove: Animated.event([], {
        listener: handleOnDrag,
        useNativeDriver: false,
      }),
      onPanResponderRelease,
    });
  }, [
    handleOnDrag,
    onPanResponderGrant,
    onPanResponderRelease,
    shouldStartDrag,
  ]);

  // TODO Figure out a way to destroy and remove offsetFromStart entirely
  React.useEffect(() => {

    if(afterRender) {
      afterRender({animateTo: animateTo});
    }

    const curPan = pan.current; // Using an instance to avoid losing the pointer before the cleanup
    if (!shouldReverse) {
      curPan.addListener((c) => {
        offsetFromStart.current = c;
      });
    } else {
      reversePosition();
    }
    return () => {
      curPan.removeAllListeners();
    };
  }, [shouldReverse]);
  
  const positionCss = React.useMemo(() => {
    const Window = Dimensions.get('window');
    return {
      position: 'absolute',
      top: 0,
      left: 0,
      width: Window.width,
      height: Window.height,
    };
  }, []);

  const dragItemCss = React.useMemo(() => {
    const style = {
      top: y,
      left: x,
      elevation: z,
      zIndex: z,
    };
    if (renderColor) {
      style.backgroundColor = renderColor;
    }
    if (isCircle) {
      style.borderRadius = renderSize;
    }

    if (children) {
      return {
        ...style,
        alignSelf: 'baseline',
      };
    }
    return {
      ...style,
      justifyContent: 'center',
      width: renderSize,
      height: renderSize,
    };
  }, [children, isCircle, renderColor, renderSize, x, y, z]);

  const touchableContent = React.useMemo(() => {
    if (children) {

      if(dragHandle) { 
        return dragHandle.renderChildren(children, {panResponder: panResponder});
      }

      return children;

    } else if (imageSource) {
      return (
        <Image
          style={{width: renderSize, height: renderSize}}
          source={imageSource}
        />
      );
    } else {
      return <Text style={styles.text}>{renderText}</Text>;
    }
  }, [children, imageSource, renderSize, renderText]);

  const handleOnLayout = React.useCallback((event) => {
    const {height, width} = event.nativeEvent.layout;
    childSize.current = {x: width, y: height};
  }, []);

  const handlePressOut = React.useCallback(
    (event) => {
      onPressOut(event);
      if (!isDragging.current) {
        onRelease(event, false);
      }
    },
    [onPressOut, onRelease],
  );

  const getDebugView = React.useCallback(() => {
    const {width, height} = Dimensions.get('window');
    const far = 9999;
    const constrained = minX || maxX || minY || maxY;
    if (!constrained) {
      return null;
    } // could show other debug info here
    const left = minX || -far;
    const right = maxX ? width - maxX : -far;
    const top = minY || -far;
    const bottom = maxY ? height - maxY : -far;
    return (
      <View
        pointerEvents="box-none"
        style={{left, right, top, bottom, ...styles.debugView}}
      />
    );
  }, [maxX, maxY, minX, minY]);

  if(dragHandle) { 

    return (
      <View pointerEvents="box-none" style={positionCss}>
        {debug && getDebugView()}
        <Animated.View
          pointerEvents="box-none"
          {...animatedViewProps}          
          style={pan.current.getLayout()}>
          <View
            onLayout={handleOnLayout}
            style={dragItemCss}
            disabled={disabled}
          >
            {touchableContent}
          </View>
        </Animated.View>
      </View>
    );

  }

  return (
    <View pointerEvents="box-none" style={positionCss}>
      {debug && getDebugView()}
      <Animated.View
        pointerEvents="box-none"
        {...animatedViewProps}
        {...panResponder.panHandlers}
        style={pan.current.getLayout()}>
        <TouchableOpacity
          {...touchableOpacityProps}
          onLayout={handleOnLayout}
          style={dragItemCss}
          disabled={disabled}
          onPress={onShortPressRelease}
          onLongPress={onLongPress}
          onPressIn={onPressIn}
          onPressOut={handlePressOut}>
          {touchableContent}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

/***** Default props and types */

Draggable.defaultProps = {
  renderText: '＋',
  renderSize: 36,
  shouldReverse: false,
  disabled: false,
  debug: false,
  onDrag: () => {},
  onShortPressRelease: () => {},
  onDragRelease: () => {},
  onLongPress: () => {},
  onPressIn: () => {},
  onPressOut: () => {},
  onRelease: () => {},
  x: 0,
  y: 0,
  z: 1,
};

Draggable.propTypes = {
  /**** props that should probably be removed in favor of "children" */
  renderText: PropTypes.string,
  isCircle: PropTypes.bool,
  renderSize: PropTypes.number,
  imageSource: PropTypes.number,
  renderColor: PropTypes.string,
  /**** */
  children: PropTypes.element,
  shouldReverse: PropTypes.bool,
  disabled: PropTypes.bool,
  debug: PropTypes.bool,
  animatedViewProps: PropTypes.object,
  touchableOpacityProps: PropTypes.object,
  onDrag: PropTypes.func,
  onShortPressRelease: PropTypes.func,
  onDragRelease: PropTypes.func,
  onLongPress: PropTypes.func,
  onPressIn: PropTypes.func,
  onPressOut: PropTypes.func,
  onRelease: PropTypes.func,
  onReverse: PropTypes.func,
  x: PropTypes.number,
  y: PropTypes.number,
  // z/elevation should be removed because it doesn't sync up visually and haptically
  z: PropTypes.number,
  minX: PropTypes.number,
  minY: PropTypes.number,
  maxX: PropTypes.number,
  maxY: PropTypes.number,
  dragHandle: React.PropTypes.shape({
    renderChildren: React.PropTypes.func,
  }),
  afterRender: PropTypes.func,
};

const styles = StyleSheet.create({
  text: {color: '#fff', textAlign: 'center'},
  test: {backgroundColor: 'red'},
  debugView: {
    backgroundColor: '#ff000044',
    position: 'absolute',
    borderColor: '#fced0ecc',
    borderWidth: 4,
  },
});
