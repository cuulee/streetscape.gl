// @flow
import React, {Component} from 'react';
import PropTypes from 'prop-types';

import {_MapContext as MapContext} from 'react-map-gl';

import PerspectivePopup from './perspective-popup';

import {resolveCoordinateTransform, positionToLngLat} from '../../utils/transform';

const renderDefaultObjectLabel = ({id, isSelected}) => isSelected && <div>ID: {id}</div>;

export default class ObjectLabelsOverlay extends Component {
  static propTypes = {
    objectSelection: PropTypes.object,
    frame: PropTypes.object,
    metadata: PropTypes.object,
    xvizStyleParser: PropTypes.object,

    renderObjectLabel: PropTypes.func,
    style: PropTypes.object,
    getTransformMatrix: PropTypes.func
  };

  static defaultProps = {
    objectSelection: {},
    renderObjectLabel: renderDefaultObjectLabel,
    style: {}
  };

  constructor(props) {
    super(props);
    this.state = {
      coordinateProps: {}
    };
  }

  componentWillReceiveProps(nextProps) {
    const {frame} = nextProps;

    if (frame && frame !== this.props.frame) {
      this.setState({
        coordinateProps: {}
      });
    }
  }

  _getCoordinateProps(streamName) {
    const {coordinateProps} = this.state;
    let result = coordinateProps[streamName];

    if (result) {
      return result;
    }

    const {frame, metadata, getTransformMatrix} = this.props;
    const streamMetadata = metadata.streams && metadata.streams[streamName];
    result = resolveCoordinateTransform(frame, streamMetadata, getTransformMatrix);
    // cache calculated coordinate props by stream name
    coordinateProps[streamName] = result;

    return result;
  }

  _renderPerspectivePopup = object => {
    const {objectSelection, frame, xvizStyleParser, style, renderObjectLabel} = this.props;

    const isSelected = Boolean(objectSelection[object.id]);
    const styleProps = {
      id: object.id,
      isSelected,
      object,
      xvizStyles: xvizStyleParser
    };

    const labelContent = renderObjectLabel(styleProps);

    if (!labelContent) {
      return null;
    }

    let trackingPoint;
    let objectHeight;

    for (const streamName of object.streamNames) {
      const feature = object.getFeature(streamName);
      if (!trackingPoint && (feature.center || feature.vertices)) {
        trackingPoint = positionToLngLat(object.position, this._getCoordinateProps(streamName));
      }
      if (!objectHeight && feature.vertices) {
        objectHeight = xvizStyleParser.getStylesheet(streamName).getProperty('height', feature);
      }
    }

    trackingPoint[2] += objectHeight || 0;

    // compensate for camera offset
    if (frame.origin) {
      trackingPoint[2] -= frame.origin[2];
    }

    return (
      <PerspectivePopup
        key={object.id}
        longitude={trackingPoint[0]}
        latitude={trackingPoint[1]}
        altitude={trackingPoint[2]}
        anchor="bottom-left"
        dynamicPosition={true}
        styleProps={styleProps}
        style={style}
        sortByDepth={true}
        closeButton={false}
        closeOnClick={false}
      >
        {labelContent}
      </PerspectivePopup>
    );
  };

  render() {
    const {frame, viewport, renderObjectLabel} = this.props;

    if (!frame || !renderObjectLabel) {
      return null;
    }

    return (
      <MapContext.Provider value={{viewport}}>
        {Object.values(frame.objects).map(this._renderPerspectivePopup)}
      </MapContext.Provider>
    );
  }
}
