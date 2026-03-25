type CesiumModule = typeof import('cesium');

type WeatherImageryState = {
  cloudLayer: InstanceType<typeof import('cesium').ImageryLayer> | null;
  temperatureLayer: InstanceType<typeof import('cesium').ImageryLayer> | null;
};

const GIBS_BASE = 'https://gibs.earthdata.nasa.gov/wmts/epsg4326/best';

export function createWeatherImagery(): WeatherImageryState {
  return { cloudLayer: null, temperatureLayer: null };
}

export function updateWeatherImagery(
  Cesium: CesiumModule,
  viewer: InstanceType<typeof import('cesium').Viewer>,
  state: WeatherImageryState,
  showClouds: boolean,
  showTemperature: boolean,
  simulationDate: Date
) {
  const dateStr = formatGibsDate(simulationDate);

  // Cloud layer (MODIS Terra corrected reflectance serves as cloud proxy)
  if (showClouds && !state.cloudLayer) {
    const provider = new Cesium.WebMapTileServiceImageryProvider({
      url: GIBS_BASE,
      layer: 'MODIS_Terra_CorrectedReflectance_TrueColor',
      style: 'default',
      format: 'image/jpeg',
      tileMatrixSetID: '250m',
      maximumLevel: 8,
      tileWidth: 512,
      tileHeight: 512,
      tilingScheme: new Cesium.GeographicTilingScheme(),
      times: new Cesium.TimeIntervalCollection([
        new Cesium.TimeInterval({
          start: Cesium.JulianDate.fromIso8601(dateStr),
          stop: Cesium.JulianDate.fromIso8601(dateStr)
        })
      ])
    });
    state.cloudLayer = viewer.imageryLayers.addImageryProvider(provider);
    state.cloudLayer.alpha = 0.45;
    state.cloudLayer.brightness = 1.2;
  } else if (!showClouds && state.cloudLayer) {
    viewer.imageryLayers.remove(state.cloudLayer);
    state.cloudLayer = null;
  }

  // Temperature layer (AIRS Surface Temperature)
  if (showTemperature && !state.temperatureLayer) {
    const provider = new Cesium.WebMapTileServiceImageryProvider({
      url: GIBS_BASE,
      layer: 'AIRS_L3_Surface_Air_Temperature_Daily_Day',
      style: 'default',
      format: 'image/png',
      tileMatrixSetID: '2km',
      maximumLevel: 5,
      tileWidth: 512,
      tileHeight: 512,
      tilingScheme: new Cesium.GeographicTilingScheme(),
      times: new Cesium.TimeIntervalCollection([
        new Cesium.TimeInterval({
          start: Cesium.JulianDate.fromIso8601(dateStr),
          stop: Cesium.JulianDate.fromIso8601(dateStr)
        })
      ])
    });
    state.temperatureLayer = viewer.imageryLayers.addImageryProvider(provider);
    state.temperatureLayer.alpha = 0.55;
  } else if (!showTemperature && state.temperatureLayer) {
    viewer.imageryLayers.remove(state.temperatureLayer);
    state.temperatureLayer = null;
  }

  viewer.scene.requestRender();
}

export function clearWeatherImagery(
  viewer: InstanceType<typeof import('cesium').Viewer>,
  state: WeatherImageryState
) {
  if (state.cloudLayer) {
    viewer.imageryLayers.remove(state.cloudLayer);
    state.cloudLayer = null;
  }
  if (state.temperatureLayer) {
    viewer.imageryLayers.remove(state.temperatureLayer);
    state.temperatureLayer = null;
  }
}

function formatGibsDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
