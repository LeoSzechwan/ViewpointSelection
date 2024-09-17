import { useCesiumStore } from '@/store/cesium.js';
// cesium国产地图纠偏
import { AMapImageryProvider, TdtImageryProvider, BaiduImageryProvider } from '@cesium-china/cesium-map'
import Tool from "@/js/cesium_plot/plot/drawTool.js"
import util from "@/js/cesium_plot/util.js"
import bus from "@/js/common/bus.js"
import { Cesium3DTileset } from 'cesium';


/*================ 初始化 ================*/
let viewer = null    //cesium viewer
let addedLayers = {}
const mylocation = new Cesium.CustomDataSource('mylocation')
const searchLocation = new Cesium.CustomDataSource('searchLocation')
export let plotDrawTool = null

/**
*  @Description  : 初始化viewer
*  @Param        : 
*  @Return       : 
*/
function initViewer(containerId) {
  Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJiM2Q3ZGMxYy02MzA4L' +
    'TQwMjgtYjQ5OS0zMGM5ZDY2OTVhOTMiLCJpZCI6MTYyMzI4LCJpYXQiOjE2OTI4NjU1NTN9.e86PKA9QjVOMcI5ANHU454hy5wwUNIjOWbop8232glE'
  viewer = new Cesium.Viewer(containerId, {
    animation: false,
    infoBox: false,
    baseLayerPicker: false,
    fullscreenButton: false,
    vrButton: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    selectionIndicator: false,
    timeline: false,
    navigationHelpButton: false,
    navigationInstructionsInitiallyVisible: false,
    terrain: Cesium.Terrain.fromWorldTerrain({
      requestVertexNormals: true,
      requestWaterMask: true, // 动态水流
    }),
  })

  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(
      104.599048,
      32.479784,
      6253909.1
    ),
    orientation: {
      heading: 6.1160,
      pitch: -1.5590,
      roll: 0,
    }
  });

  // 去掉logo
  viewer._cesiumWidget._creditContainer.style.display = "none";

  // 时间
  var utc = Cesium.JulianDate.fromDate(new Date());
  viewer.clockViewModel.currentTime = Cesium.JulianDate.addHours(utc, 0, new Cesium.JulianDate());

  // 光照
  viewer.scene.globe.enableLighting = true;
  viewer.shadows = true;
  viewer.scene.sun.show = true;
  viewer.scene.skyAtmosphere.show = true;
  viewer.scene.fog.enable = true;
  
  // 启用深度检测
  viewer.scene.globe.depthTestAgainstTerrain = true;

  //全局状态更新
  const store = useCesiumStore()
  store.update(viewer)

  // 标绘工具
  plotDrawTool = new Tool(viewer, {
    canEdit: true,
  });

  // 广播三维视图初始化完成
  bus.emit('viewerInited', true)
}

export function useCesiumViewer(containerId) {
  if (viewer) return
  initViewer(containerId)
}


/**
 * @description: 绘制工具控制
 */
export function plotDraw(item) {
  if (plotDrawTool) {
    if (item) {
      plotDrawTool.start(item);
    } else {
      plotDrawTool.removeAll();
    }
  } else {
    console.log('标绘工具未初始化')
  }
}

/**
 * @description: 绘制工具
 */
export function plotDrawToGeojson(type = 'all') {
  if (plotDrawTool) {
    if (type == 'all' || !type) {
      console.log('all', plotDrawTool.allToGeojson());
    } else {
      console.log();
    }
  } else {
    console.log('标绘工具未初始化')
  }
}
