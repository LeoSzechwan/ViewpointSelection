import { useCesiumStore } from '@/store/cesium.js';
// cesium国产地图纠偏
import { AMapImageryProvider, TdtImageryProvider, BaiduImageryProvider } from '@cesium-china/cesium-map'
import Tool from "@/js/cesium_plot/plot/drawTool.js"
import util from "@/js/cesium_plot/util.js"
import bus from "@/js/common/bus.js"
import { Cesium3DTileset } from 'cesium';
import axios from 'axios';
import ComTool from './comTool'
import { area } from 'turf';
import turf from 'turf'
import QuickHull from 'quickhull3d'
const comTool = new ComTool()
import qh from 'quick-hull-2d'
import { CVPPSO } from './chaosPSO'

/*================ 初始化 ================*/
let viewer = null    //cesium viewer
let addedLayers = {}
export let plotDrawTool = null
let importanceArr = []

/**
*  @Description  : 初始化viewer
*  @Param        : 
*  @Return       : 
*/
async function initViewer(containerId) {
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
    terrainProvider: new Cesium.Terrain(
      Cesium.CesiumTerrainProvider.fromIonAssetId(1),
    ),
    imageryProvider: false,
  })

  viewer.terrainProvider = await Cesium.createWorldTerrainAsync({
    requestVertexNormals: true,  // 请求法线贴图
    requestWaterMask: false      // 可选：禁用水面反射
  });

  // 启用地形光照效果
  viewer.scene.globe.enableLighting = true;
  // 设置 globe 的统一颜色
  viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#4e6d30');
  // 启用阴影以增强地形效果
  // viewer.shadows = true;  // 启用阴影
  // viewer.scene.globe.shadows = Cesium.ShadowMode.ENABLED;  // 设置地形阴影模式
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
  var utc = Cesium.JulianDate.fromDate(new Date("2024/07/20 18:00"));
  viewer.clockViewModel.currentTime = Cesium.JulianDate.addHours(utc, 0, new Cesium.JulianDate());

  // 光照
  viewer.scene.globe.enableLighting = true;
  viewer.shadows = true;
  viewer.scene.sun.show = true;
  viewer.scene.skyAtmosphere.show = true;
  viewer.scene.fog.enable = true;

  // 启用深度检测
  viewer.scene.globe.depthTestAgainstTerrain = false;

  // 能否让相机进入地下
  viewer.scene.screenSpaceCameraController.enableCollisionDetection = false; //true 禁止 false 允许

  //全局状态更新
  const store = useCesiumStore()
  store.update(viewer)

  // 标绘工具
  plotDrawTool = new Tool(viewer, {
    canEdit: false,
  });

  // 广播三维视图初始化完成
  bus.emit('viewerInited', true)
}

export async function useCesiumViewer(containerId) {
  if (viewer) return
  return initViewer(containerId)
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

/**
 * @description: 根据场景编号加载geojson
 * @param: scene: {event事件代码:A、B、C,element要素文件名:[]}
 */
export function loadScene(scene = {
  event: 'A',
  element: ['Flood', 'Road', 'Bridge', 'SignalStation'],
}) {
  plotDrawTool.removeAll();
  // 构建所有的请求
  const requests = scene.element.map(el => axios.get(`/data/geojson/${scene.event}/${el}.geojson`));

  // 使用 Promise.all 并发请求所有文件
  Promise.all(requests)
    .then(responses => {
      // 批量加载每个响应的数据
      responses.forEach(res => {
        plotDrawTool.allCreateByGeojson(res.data);
      });

      // 所有加载完成后，调用 flatViewHull
      // flatViewBox()
      // fixedView()
      // flatViewHull()

    })
    .catch(error => {
      console.error('Error loading geojson files:', error);
    });
}

/**
 * @description:计算所有要素的叙事偏离度，以颜色代表要素
 */
export function calculateEntityImportance(id) {
  // 获取当前时间
  const time = Cesium.JulianDate.now();

  // 设置衰减参数
  const p = 0.2; // 衰减速率，p 越大，距离远的重要性越低
  const epsilon = 0.01; // 防止距离为 0 的情况0

  // 结果数组，存储每个实体的重要性
  let importanceResults = [];

  //根据id获取主体要素
  let targetEntity = plotDrawTool.getEntityObjById(id).entityObj.entity

  // 获取主体实体的几何中心
  const targetCenter = getEntityCenter(targetEntity, time);

  plotDrawTool.getEntityObjArr().forEach((entityObj) => {
    if (entityObj.attr.id != id) {
      // 获取当前实体的几何中心
      const entityCenter = getEntityCenter(entityObj.entity, time);

      // 如果实体或主体没有中心位置，跳过
      if (!targetCenter || !entityCenter) return;

      // 计算当前实体与主体实体几何中心之间的距离
      let distance = Cesium.Cartesian3.distance(targetCenter, entityCenter);

      // 计算基于距离的反比重要性
      let importance = 1 / (Math.pow(distance, p) + epsilon);

      // 记录所有实体的重要性
      let result = {
        id: entityObj.attr.id,
        distance: distance,
        importance: importance
      };

      importanceResults.push(result);
    }
  });

  // 查找最大重要性
  let maxImportance = Math.max(...importanceResults.map(result => result.importance));

  // 计算均值
  let meanImportance = importanceResults.reduce((sum, result) => sum + result.importance, 0) / importanceResults.length;

  // 计算方差
  let variance = importanceResults.reduce((sum, result) => sum + Math.pow(result.importance - meanImportance, 2), 0) / importanceResults.length;

  // 计算标准差
  let standardDeviation = Math.sqrt(variance);

  // 将指定id的实体重要性设置为最大值加上epsilon
  importanceResults.push({
    id: id,
    distance: 0,
    importance: maxImportance + standardDeviation
  })

  // 最大值、均值、方差更新
  maxImportance = Math.max(...importanceResults.map(result => result.importance));
  let minImportance = Math.min(...importanceResults.map(result => result.importance));

  // 进行最大最小值归一化
  importanceResults.forEach(result => {
    result.normalizedImportance = (result.importance - minImportance) / (maxImportance - minImportance);
  });

  meanImportance = importanceResults.reduce((sum, result) => sum + result.normalizedImportance, 0) / importanceResults.length;
  variance = importanceResults.reduce((sum, result) => sum + Math.pow(result.normalizedImportance - meanImportance, 2), 0) / importanceResults.length;
  standardDeviation = Math.sqrt(variance);

  // 保证归一化后的最小值不为 0
  importanceResults.forEach(result => {
    result.normalizedImportance = result.normalizedImportance * (1 - standardDeviation) + standardDeviation; // 平移归一化值，避免最小值为 0;
  });

  importanceArr = importanceResults

  return importanceResults;
}

/**
 * @description： 获取实体中心
 * @param {*} entity 
 * @param {*} time 
 * @returns 
 */
function getEntityCenter(entity, time) {
  let positions = [];

  if (entity.position) {
    // 点实体：直接返回位置
    return entity.position.getValue(time);
  } else if (entity.polyline) {
    // 线实体：获取所有顶点
    positions = entity.polyline.positions.getValue(time);
  } else if (entity.polygon) {
    // 面实体：获取多边形外环顶点
    const hierarchy = entity.polygon.hierarchy.getValue(time);
    positions = hierarchy.positions;
  }

  if (positions.length > 0) {
    // 使用包围球的中心作为近似几何中心
    let boundingSphere = Cesium.BoundingSphere.fromPoints(positions);
    return boundingSphere.center;
  }

  return null;
}


/**
 * @description: 显示当前可视化范围
 * @returns 
 */
export function currentCamera() {
  const camera = viewer.camera;

  // 获取相机当前的经纬度和海拔高度
  const cartographic = Cesium.Cartographic.fromCartesian(camera.position);
  const longitude = Cesium.Math.toDegrees(cartographic.longitude);
  const latitude = Cesium.Math.toDegrees(cartographic.latitude);
  const altitude = cartographic.height;

  // 获取相机的 heading, pitch, roll
  const heading = Cesium.Math.toDegrees(camera.heading);
  const pitch = Cesium.Math.toDegrees(camera.pitch);
  const roll = Cesium.Math.toDegrees(camera.roll);

  // 获取相机视锥并可视化
  const frustum = camera.frustum;
  const frustumOutline = new Cesium.FrustumOutlineGeometry({
    frustum: frustum,
    origin: camera.position,
    orientation: Cesium.Transforms.headingPitchRollQuaternion(camera.position, new Cesium.HeadingPitchRoll(camera.heading, camera.pitch, camera.roll))
  });

  // 将视锥可视化
  const frustumInstance = new Cesium.GeometryInstance({
    geometry: frustumOutline,
    attributes: {
      color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.CYAN)
    }
  });

  viewer.scene.primitives.add(new Cesium.Primitive({
    geometryInstances: frustumInstance,
    appearance: new Cesium.PerInstanceColorAppearance()
  }));

  // 返回当前相机的位置信息和朝向角度
  return {
    longitude,
    latitude,
    altitude,
    heading,
    pitch,
    roll
  };
}

/**
 * @description:计算视觉显著度：可见面积
 */
async function polygonObjVisibleArea_nor(entityObj, screen = { position: { x, y, z }, screenNormal: { x, y, z } }, terrainFilter) {
  // 提取 entity 的多边形顶点
  const positions = entityObj.entity.polygon.hierarchy.getValue(Cesium.JulianDate.now()).positions;
  // 使用 Cesium.sampleTerrainMostDetailed 获取带地形高度的顶点
  const terrainPositions = await Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, positions);
  let visiPoints = terrainPositions
  if (terrainFilter) {
    visiPoints = filterVisiblePoints(terrainPositions, screen.position)
  }

  const projectedPoints = [];
  const camera = viewer.camera;

  // 获取屏幕的宽度和高度（以像素为单位）
  const screenWidth = viewer.canvas.clientWidth;
  const screenHeight = viewer.canvas.clientHeight;

  const fovy = camera.frustum.fovy;  // 垂直视角
  const aspectRatio = screenWidth / screenHeight;  // 屏幕宽高比
  const f = 1.0 / Math.tan(fovy / 2);  // 计算焦距

  // 直接使用屏幕法向量代替方向矩阵的计算
  const screenNormal = new Cesium.Cartesian3(screen.screenNormal.x, screen.screenNormal.y, screen.screenNormal.z);
  // 选择一个初始的上方向
  let up = Cesium.Cartesian3.UNIT_Z;

  // 检查 screenNormal 是否与 up 平行
  if (Cesium.Cartesian3.equalsEpsilon(screenNormal, up, Cesium.Math.EPSILON6) ||
    Cesium.Cartesian3.equalsEpsilon(screenNormal, Cesium.Cartesian3.negate(up, new Cesium.Cartesian3()), Cesium.Math.EPSILON6)) {
    // 如果平行，则使用 UNIT_Y 作为上方向
    up = Cesium.Cartesian3.UNIT_Y;
  }

  // 计算右方向
  const right = Cesium.Cartesian3.cross(screenNormal, up, new Cesium.Cartesian3());
  Cesium.Cartesian3.normalize(right, right);

  // 重新计算上方向，使其垂直于 right 和 screenNormal
  const adjustedUp = Cesium.Cartesian3.cross(right, screenNormal, new Cesium.Cartesian3());
  Cesium.Cartesian3.normalize(adjustedUp, adjustedUp);

  // 构建视图旋转矩阵
  const rotationMatrix = new Cesium.Matrix3(
    right.x, adjustedUp.x, -screenNormal.x,
    right.y, adjustedUp.y, -screenNormal.y,
    right.z, adjustedUp.z, -screenNormal.z
  );

  // 将多边形顶点从世界坐标转换为相机坐标并进行投影
  visiPoints.forEach(position => {
    // 计算顶点相对于相机的位置
    const relativePosition = new Cesium.Cartesian3(
      position.x - screen.position.x,
      position.y - screen.position.y,
      position.z - screen.position.z
    );

    // 应用旋转矩阵，将世界坐标转换到相机视角坐标系
    const viewPosition = Cesium.Matrix3.multiplyByVector(rotationMatrix, relativePosition, new Cesium.Cartesian3());

    const x = viewPosition.x;
    const y = viewPosition.y;
    const z = viewPosition.z;

    // 计算投影后的屏幕坐标 (u, v)
    const u = f * x / z;
    const v = f * y / (z * aspectRatio);

    // 将 (u, v) 转换为屏幕的实际像素坐标
    const pixelX = (u + 1) * screenWidth / 2;
    const pixelY = (1 - v) * screenHeight / 2;

    projectedPoints.push(new Cesium.Cartesian2(pixelX, pixelY));
  });

  // 使用 2D 多边形面积公式计算投影后的面积
  let area = 0;
  for (let i = 0; i < projectedPoints.length; i++) {
    const p1 = projectedPoints[i];
    const p2 = projectedPoints[(i + 1) % projectedPoints.length];
    area += (p1.x * p2.y - p2.x * p1.y);
  }
  area = Math.abs(area) / 2.0;

  let result = {
    id: entityObj.attr.id,
    area: area,
    projectedPoints: projectedPoints
  };

  return result;
}

async function polygonObjVisibleArea_or(entityObj, screen = { position: { x, y, z }, orientation: { heading, pitch, roll } }, terrainFilter) {
  // 提取entity的多边形顶点
  const positions = entityObj.entity.polygon.hierarchy.getValue(Cesium.JulianDate.now()).positions;
  // 使用 Cesium.sampleTerrainMostDetailed 获取带地形高度的顶点
  const terrainPositions = await Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, positions);
  let visiPoints = terrainPositions
  if (terrainFilter) {
    visiPoints = filterVisiblePoints(terrainPositions, screen.position)
  }

  const projectedPoints = [];
  const camera = viewer.camera;

  // 获取屏幕的宽度和高度（以像素为单位）
  const screenWidth = viewer.canvas.clientWidth;
  const screenHeight = viewer.canvas.clientHeight;

  const fovy = camera.frustum.fovy;  // 垂直视角
  const aspectRatio = screenWidth / screenHeight;  // 屏幕宽高比
  const f = 1.0 / Math.tan(fovy / 2);  // 计算焦距

  // 获取相机的旋转矩阵
  const headingMatrix = Cesium.Matrix3.fromRotationZ(screen.orientation.heading);
  const pitchMatrix = Cesium.Matrix3.fromRotationX(screen.orientation.pitch);
  const rollMatrix = Cesium.Matrix3.fromRotationY(screen.orientation.roll);

  // 将旋转矩阵相乘，得到相机的最终方向矩阵
  const rotationMatrix = Cesium.Matrix3.multiply(
    Cesium.Matrix3.multiply(headingMatrix, pitchMatrix, new Cesium.Matrix3()),
    rollMatrix,
    new Cesium.Matrix3()
  );

  // 将多边形顶点从世界坐标转换为相机坐标并进行投影
  visiPoints.forEach(position => {
    // 计算顶点相对于相机的方向
    const relativePosition = new Cesium.Cartesian3(
      position.x - screen.position.x,
      position.y - screen.position.y,
      position.z - screen.position.z
    );

    // 应用旋转矩阵，将世界坐标转换到相机视角坐标系
    const viewPosition = Cesium.Matrix3.multiplyByVector(rotationMatrix, relativePosition, new Cesium.Cartesian3());

    const x = viewPosition.x;
    const y = viewPosition.y;
    const z = viewPosition.z;

    // 计算投影后的屏幕坐标 (u, v)
    const u = f * x / z;
    const v = f * y / (z * aspectRatio);

    // 将 (u, v) 转换为屏幕的实际像素坐标
    const pixelX = (u + 1) * screenWidth / 2;
    const pixelY = (1 - v) * screenHeight / 2;

    projectedPoints.push(new Cesium.Cartesian2(pixelX, pixelY));
  });

  // 使用 2D 多边形面积公式计算投影后的面积
  let area = 0;
  for (let i = 0; i < projectedPoints.length; i++) {
    const p1 = projectedPoints[i];
    const p2 = projectedPoints[(i + 1) % projectedPoints.length];
    area += (p1.x * p2.y - p2.x * p1.y);
  }
  area = Math.abs(area) / 2.0;

  let result = {
    id: entityObj.attr.id,
    area: Math.abs(area) / 2,
    projectedPoints: projectedPoints
  }

  return result
}


/**
 * @description: 计算视觉显著度：可见长度
 */

async function polylineObjVisibleArea_nor(entityObj, screen = { position: { x, y, z }, screenNormal: { x, y, z } }, terrainFilter) {
  // 提取多段线的顶点
  const positions = entityObj.entity.polyline.positions.getValue(Cesium.JulianDate.now());
  // 使用 Cesium.sampleTerrainMostDetailed 获取带地形高度的顶点
  const terrainPositions = await Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, positions);
  let visiPoints = terrainPositions
  if (terrainFilter) {
    visiPoints = filterVisiblePoints(terrainPositions, screen.position)
  }

  const projectedPoints = [];
  const camera = viewer.camera;

  // 获取屏幕的宽度和高度（以像素为单位）
  const screenWidth = viewer.canvas.clientWidth;
  const screenHeight = viewer.canvas.clientHeight;

  const fovy = camera.frustum.fovy;  // 垂直视角
  const aspectRatio = screenWidth / screenHeight;  // 屏幕宽高比
  const f = 1.0 / Math.tan(fovy / 2);  // 计算焦距

  // 直接使用屏幕法向量代替方向矩阵的计算
  const screenNormal = new Cesium.Cartesian3(screen.screenNormal.x, screen.screenNormal.y, screen.screenNormal.z);
  let up = Cesium.Cartesian3.UNIT_Z;  // 设定上方向
  // 检查 screenNormal 是否与 up 平行
  if (Cesium.Cartesian3.equalsEpsilon(screenNormal, up, Cesium.Math.EPSILON6) ||
    Cesium.Cartesian3.equalsEpsilon(screenNormal, Cesium.Cartesian3.negate(up, new Cesium.Cartesian3()), Cesium.Math.EPSILON6)) {
    // 如果平行，则使用 UNIT_Y 作为上方向
    up = Cesium.Cartesian3.UNIT_Y;
  }

  // 计算右方向
  const right = Cesium.Cartesian3.cross(screenNormal, up, new Cesium.Cartesian3());
  Cesium.Cartesian3.normalize(right, right);

  // 重新计算上方向，使其垂直于 right 和 screenNormal
  const adjustedUp = Cesium.Cartesian3.cross(right, screenNormal, new Cesium.Cartesian3());
  Cesium.Cartesian3.normalize(adjustedUp, adjustedUp);

  // 构建视图旋转矩阵
  const rotationMatrix = new Cesium.Matrix3(
    right.x, adjustedUp.x, -screenNormal.x,
    right.y, adjustedUp.y, -screenNormal.y,
    right.z, adjustedUp.z, -screenNormal.z
  );

  // 将折线顶点从世界坐标转换为相机坐标并进行投影
  visiPoints.forEach(position => {
    // 计算顶点相对于相机的位置
    const relativePosition = new Cesium.Cartesian3(
      position.x - screen.position.x,
      position.y - screen.position.y,
      position.z - screen.position.z
    );

    // 应用旋转矩阵，将世界坐标转换到相机视角坐标系
    const viewPosition = Cesium.Matrix3.multiplyByVector(rotationMatrix, relativePosition, new Cesium.Cartesian3());

    const x = viewPosition.x;
    const y = viewPosition.y;
    const z = viewPosition.z;

    // 计算投影后的屏幕坐标 (u, v)
    const u = f * x / z;
    const v = f * y / (z * aspectRatio);

    // 将 (u, v) 转换为屏幕的实际像素坐标
    const pixelX = (u + 1) * screenWidth / 2;
    const pixelY = (1 - v) * screenHeight / 2;


    projectedPoints.push(new Cesium.Cartesian2(pixelX, pixelY));
  });

  let totalLength = 0;
  // 计算相邻顶点之间的长度
  for (let i = 0; i < projectedPoints.length - 1; i++) {
    const p1 = projectedPoints[i];
    const p2 = projectedPoints[i + 1];

    // 计算两点之间的屏幕距离
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const length = Math.sqrt(dx * dx + dy * dy);

    totalLength += length;
  }

  // 从 entity 中读取线条的像素宽度
  const lineWidth = entityObj.entity.polyline.width.getValue(Cesium.JulianDate.now());

  let result = {
    id: entityObj.attr.id,
    area: totalLength * lineWidth,  // 这是多段线在屏幕上的可见长度
    projectedPoints: projectedPoints
  };

  return result;
}
async function polylineObjVisibleArea_or(entityObj, screen = { position: { x, y, z }, orientation: { heading, pitch, roll } }, terrainFilter) {
  // 提取多段线的顶点
  const positions = entityObj.entity.polyline.positions.getValue(Cesium.JulianDate.now());
  // 使用 Cesium.sampleTerrainMostDetailed 获取带地形高度的顶点
  const terrainPositions = await Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, positions);
  let visiPoints = terrainPositions
  if (terrainFilter) {
    visiPoints = filterVisiblePoints(terrainPositions, screen.position)
  }

  const projectedPoints = [];
  const camera = viewer.camera;

  // 获取屏幕的宽度和高度（以像素为单位）
  const screenWidth = viewer.canvas.clientWidth;
  const screenHeight = viewer.canvas.clientHeight;

  const fovy = camera.frustum.fovy;  // 垂直视角
  const aspectRatio = screenWidth / screenHeight;  // 屏幕宽高比
  const f = 1.0 / Math.tan(fovy / 2);  // 计算焦距

  // 获取相机的旋转矩阵
  const headingMatrix = Cesium.Matrix3.fromRotationZ(screen.orientation.heading);
  const pitchMatrix = Cesium.Matrix3.fromRotationX(screen.orientation.pitch);
  const rollMatrix = Cesium.Matrix3.fromRotationY(screen.orientation.roll);

  // 将旋转矩阵相乘，得到相机的最终方向矩阵
  const rotationMatrix = Cesium.Matrix3.multiply(
    Cesium.Matrix3.multiply(headingMatrix, pitchMatrix, new Cesium.Matrix3()),
    rollMatrix,
    new Cesium.Matrix3()
  );

  // 将折线顶点从世界坐标转换为相机坐标并进行投影
  visiPoints.forEach(position => {
    // 计算顶点相对于相机的方向
    const relativePosition = new Cesium.Cartesian3(
      position.x - screen.position.x,
      position.y - screen.position.y,
      position.z - screen.position.z
    );

    // 应用旋转矩阵，将世界坐标转换到相机视角坐标系
    const viewPosition = Cesium.Matrix3.multiplyByVector(rotationMatrix, relativePosition, new Cesium.Cartesian3());

    const x = viewPosition.x;
    const y = viewPosition.y;
    const z = viewPosition.z;

    // 计算投影后的屏幕坐标 (u, v)
    const u = f * x / z;
    const v = f * y / (z * aspectRatio);

    // 将 (u, v) 转换为屏幕的实际像素坐标
    const pixelX = (u + 1) * screenWidth / 2;
    const pixelY = (1 - v) * screenHeight / 2;

    projectedPoints.push(new Cesium.Cartesian2(pixelX, pixelY));
  });

  let totalLength = 0;
  // 计算相邻顶点之间的长度
  for (let i = 0; i < projectedPoints.length - 1; i++) {
    const p1 = projectedPoints[i];
    const p2 = projectedPoints[i + 1];

    // 计算两点之间的屏幕距离
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const length = Math.sqrt(dx * dx + dy * dy);

    totalLength += length;
  }

  // 从 entity 中读取线条的像素宽度
  const lineWidth = entityObj.entity.polyline.width.getValue(Cesium.JulianDate.now());

  let result = {
    id: entityObj.attr.id,
    area: totalLength * lineWidth,  // 这是多段线在屏幕上的可见长度,
    projectedPoints: projectedPoints
  };

  return result;
}

/**
 * @description: 计算视觉显著度：可见面积-piont
 */

async function pointObjVisibleArea_nor(entityObj, screen = { position: { x, y, z }, screenNormal: { x, y, z } }) {
  // 获取点的世界坐标
  const position = entityObj.entity.position.getValue(Cesium.JulianDate.now());
  // 使用 Cesium.sampleTerrainMostDetailed 获取带地形高度的顶点
  const terrainPosition = await Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, position);
  const camera = viewer.camera;

  // 获取屏幕的宽度和高度（以像素为单位）
  const screenWidth = viewer.canvas.clientWidth;
  const screenHeight = viewer.canvas.clientHeight;

  const fovy = camera.frustum.fovy;  // 垂直视角
  const aspectRatio = screenWidth / screenHeight;  // 屏幕宽高比
  const f = 1.0 / Math.tan(fovy / 2);  // 计算焦距

  // 直接使用屏幕法向量代替方向矩阵的计算
  const screenNormal = new Cesium.Cartesian3(screen.screenNormal.x, screen.screenNormal.y, screen.screenNormal.z);
  let up = Cesium.Cartesian3.UNIT_Z;  // 设定上方向
  // 检查 screenNormal 是否与 up 平行
  if (Cesium.Cartesian3.equalsEpsilon(screenNormal, up, Cesium.Math.EPSILON6) ||
    Cesium.Cartesian3.equalsEpsilon(screenNormal, Cesium.Cartesian3.negate(up, new Cesium.Cartesian3()), Cesium.Math.EPSILON6)) {
    // 如果平行，则使用 UNIT_Y 作为上方向
    up = Cesium.Cartesian3.UNIT_Y;
  }

  // 计算右方向
  const right = Cesium.Cartesian3.cross(screenNormal, up, new Cesium.Cartesian3());
  Cesium.Cartesian3.normalize(right, right);

  // 重新计算上方向，使其垂直于 right 和 screenNormal
  const adjustedUp = Cesium.Cartesian3.cross(right, screenNormal, new Cesium.Cartesian3());
  Cesium.Cartesian3.normalize(adjustedUp, adjustedUp);

  // 构建视图旋转矩阵
  const rotationMatrix = new Cesium.Matrix3(
    right.x, adjustedUp.x, -screenNormal.x,
    right.y, adjustedUp.y, -screenNormal.y,
    right.z, adjustedUp.z, -screenNormal.z
  );

  // 计算顶点相对于相机的方向
  const relativePosition = new Cesium.Cartesian3(
    terrainPosition.x - screen.position.x,
    terrainPosition.y - screen.position.y,
    terrainPosition.z - screen.position.z
  );

  // 应用旋转矩阵，将世界坐标转换到相机视角坐标系
  const viewPosition = Cesium.Matrix3.multiplyByVector(rotationMatrix, relativePosition, new Cesium.Cartesian3());

  const x = viewPosition.x;
  const y = viewPosition.y;
  const z = viewPosition.z;

  // 计算投影后的屏幕坐标 (u, v)
  const u = f * x / z;
  const v = f * y / (z * aspectRatio);

  // 计算圆形点的屏幕面积 (单位：平方像素)
  let visibleArea = 0;

  // 将 (u, v) 转换为屏幕的实际像素坐标
  const pixelX = (u + 1) * screenWidth / 2;
  const pixelY = (1 - v) * screenHeight / 2;
  let projectedPoint = new Cesium.Cartesian2(pixelX, pixelY);


  const pixelSize = entityObj.entity.point.pixelSize.getValue(Cesium.JulianDate.now());
  visibleArea = Math.PI * Math.pow(pixelSize / 2, 2);

  let result = {
    id: entityObj.attr.id,
    area: visibleArea,     // 点在屏幕上的可见面积
    projectedPoint: projectedPoint
  };

  return result;
}

async function pointObjVisibleArea_or(entityObj, screen = { position: { x, y, z }, orientation: { heading, pitch, roll } }) {
  // 获取点的世界坐标
  const position = entityObj.entity.position.getValue(Cesium.JulianDate.now());
  // 使用 Cesium.sampleTerrainMostDetailed 获取带地形高度的顶点
  const terrainPosition = await Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, position);
  const camera = viewer.camera;

  // 获取屏幕的宽度和高度（以像素为单位）
  const screenWidth = viewer.canvas.clientWidth;
  const screenHeight = viewer.canvas.clientHeight;

  const fovy = camera.frustum.fovy;  // 垂直视角
  const aspectRatio = screenWidth / screenHeight;  // 屏幕宽高比
  const f = 1.0 / Math.tan(fovy / 2);  // 计算焦距

  // 获取相机的旋转矩阵
  const headingMatrix = Cesium.Matrix3.fromRotationZ(screen.orientation.heading);
  const pitchMatrix = Cesium.Matrix3.fromRotationX(screen.orientation.pitch);
  const rollMatrix = Cesium.Matrix3.fromRotationY(screen.orientation.roll);

  // 将旋转矩阵相乘，得到相机的最终方向矩阵
  const rotationMatrix = Cesium.Matrix3.multiply(
    Cesium.Matrix3.multiply(headingMatrix, pitchMatrix, new Cesium.Matrix3()),
    rollMatrix,
    new Cesium.Matrix3()
  );

  // 计算顶点相对于相机的方向
  const relativePosition = new Cesium.Cartesian3(
    terrainPosition.x - screen.position.x,
    terrainPosition.y - screen.position.y,
    terrainPosition.z - screen.position.z
  );

  // 应用旋转矩阵，将世界坐标转换到相机视角坐标系
  const viewPosition = Cesium.Matrix3.multiplyByVector(rotationMatrix, relativePosition, new Cesium.Cartesian3());

  const x = viewPosition.x;
  const y = viewPosition.y;
  const z = viewPosition.z;

  // 计算投影后的屏幕坐标 (u, v)
  const u = f * x / z;
  const v = f * y / (z * aspectRatio);

  // 计算圆形点的屏幕面积 (单位：平方像素)
  let visibleArea = 0;

  // 将 (u, v) 转换为屏幕的实际像素坐标
  const pixelX = (u + 1) * screenWidth / 2;
  const pixelY = (1 - v) * screenHeight / 2;
  let projectedPoint = new Cesium.Cartesian2(pixelX, pixelY);

  const pixelSize = entityObj.entity.point.pixelSize.getValue(Cesium.JulianDate.now());
  visibleArea = Math.PI * Math.pow(pixelSize / 2, 2);

  let result = {
    id: entityObj.attr.id,
    area: visibleArea,     // 点在屏幕上的可见面积
    projectedPoint: projectedPoint
  }

  return result;
}

/**
 * @description 判断点是否被地形遮挡
 * @param {*} terrainPositions 
 * @param {*} screenPosition 
 * @returns 
 */
function filterVisiblePoints(terrainPositions, screenPosition) {
  const cameraPosition = new Cesium.Cartesian3(screenPosition.x, screenPosition.y, screenPosition.z);
  const visiblePoints = [];

  for (let i = 0; i < terrainPositions.length; i++) {
    const terrainPosition = terrainPositions[i];

    // 计算从相机位置到当前顶点的射线方向
    const rayDirection = Cesium.Cartesian3.subtract(terrainPosition, cameraPosition, new Cesium.Cartesian3());
    const ray = new Cesium.Ray(cameraPosition, rayDirection);

    // 检查射线与地形的相交情况
    const intersection = viewer.scene.pickFromRay(ray);

    if (Cesium.defined(intersection) && Cesium.defined(intersection.position)) {
      // 获取相交点与相机之间的距离
      const intersectionDistance = Cesium.Cartesian3.distance(cameraPosition, intersection.position);
      const vertexDistance = Cesium.Cartesian3.distance(cameraPosition, terrainPosition);

      // 如果顶点到相机的距离小于或等于相交点的距离，则顶点未被遮挡
      if (vertexDistance <= intersectionDistance) {
        visiblePoints.push(terrainPosition);
      }
    } else {
      // 如果射线没有相交点，表示该顶点可见
      visiblePoints.push(terrainPosition);
    }
  }

  return visiblePoints;
}

/**
 * @description: 计算所有要素可见面积
 * @param {*} screen 
 */
async function objArrVisibleArea(screen, center, terrainFilter) {
  let orientation = calculateHeadingPitchFromDirection(center, screen.position)
  if (orientation.pitch >= -0.01) {
    return -Infinity
  }
  if (!screen.orientation) {
    screen.orientation = orientation
  }
  let areaArr = []
  let allProjectedPoints = [];  // 用来存储所有实体的投影后的点
  let entities = plotDrawTool.getEntityObjArr()
  for (const entityObj of entities) {
    let entity = entityObj.entity
    if (entity.polygon && entity.polygon.hierarchy) {
      let area = await polygonObjVisibleArea_or(entityObj, screen, terrainFilter);
      if (area.area < 1) {
        return -Infinity
      }
      areaArr.push(area)

      // 将多边形的所有投影点加入到 allProjectedPoints 数组中
      area.projectedPoints.forEach(point => {
        allProjectedPoints.push(point);
      });
    }

    // 处理折线 (polyline) 实体
    else if (entity.polyline && entity.polyline.positions) {
      let area = await polylineObjVisibleArea_or(entityObj, screen, terrainFilter);
      if (area.area < 1) {
        return -Infinity
      }
      areaArr.push(area)

      // 将折线的所有投影点加入到 allProjectedPoints 数组中
      area.projectedPoints.forEach(point => {
        allProjectedPoints.push(point);
      });
    }

    // 处理点实体
    else if (entity.position) {
      let area = await pointObjVisibleArea_or(entityObj, screen, terrainFilter)
      if (area.area < 1) {
        return -Infinity
      }
      areaArr.push(area)

      // 将点的投影坐标加入到 allProjectedPoints 数组中
      allProjectedPoints.push(area.projectedPoint);
    }
  }

  // 获取屏幕的宽度和高度（以像素为单位）
  const screenWidth = viewer.canvas.clientWidth;
  const screenHeight = viewer.canvas.clientHeight;

  // 将 Cartesian2 转换为普通数组格式以供 quickhull 使用
  const pointArray = allProjectedPoints.map(p => [p.x, p.y]);

  // 计算所有投影点的凸包面积
  const convexHullArea = calculateConvexHullArea(pointArray)
  const screenArea = screenWidth * screenHeight
  let hullVisibility = convexHullArea / screenArea;
  if (convexHullArea > screenArea) {
    hullVisibility = 0 - screenArea / convexHullArea;
  }

  areaArr.map(item => item.areaRatio = item.area / (screenWidth * screenHeight))

  // 计算最小值、最大值和标准差
  // let areaRatios = areaArr.map(item => item.areaRatio);
  // let minAreaRatio = Math.min(...areaRatios);
  // let maxAreaRatio = Math.max(...areaRatios);

  // 计算归一化可见性并平移标准差
  // areaArr.forEach(item => {
  //   item.visibility = (item.areaRatio - minAreaRatio) / (maxAreaRatio - minAreaRatio);  // 平移一个标准差
  // });

  // let meanVisibility = areaArr.reduce((sum, val) => sum + val.visibility, 0) / areaArr.length;
  // let stdVisibility = Math.sqrt(areaArr.reduce((sum, val) => sum + Math.pow(val.visibility - meanVisibility, 2), 0) / areaArr.length);

  // 平移归一化可见性标准差
  // areaArr.forEach(item => {
  //   item.visibility = item.visibility * (1 - stdVisibility) + stdVisibility;  // 平移一个标准差
  // });

  // 对齐 importanceArr 和 areaArr，确保同样的 id 顺序
  let alignedArr = importanceArr.map(importanceItem => {
    let correspondingAreaItem = areaArr.find(areaItem => areaItem.id === importanceItem.id);

    if (correspondingAreaItem) {
      return {
        id: importanceItem.id,
        normalizedImportance: importanceItem.normalizedImportance,
        visibility: correspondingAreaItem.areaRatio
      };
    }
    return null;  // 如果未找到匹配的 id
  }).filter(item => item !== null);  // 过滤掉没有匹配的项

  // 提取对齐后的 normalizedImportances 和 visibilities
  let normalizedImportances = alignedArr.map(item => item.normalizedImportance);
  let visibilities = alignedArr.map(item => item.visibility);
  // console.log('visibilities', alignedArr)

  let correlation = pearsonCorrelation(normalizedImportances, visibilities);

  let maxmium = 1 + 1 * 1.5

  console.log('correlation', correlation)
  console.log('hullVisibility', hullVisibility)
  console.log('F', (correlation + hullVisibility * 1.5) / maxmium)
  return (correlation + hullVisibility * 1.5) / maxmium
}


/**
 * 固定值法-移动视点至场景45°
 */
export function fixedView() {
  // 获取数据源中的所有实体
  const entities = plotDrawTool.getEntityObjArr();
  const cartographics = [];

  // 遍历每个实体
  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i].entity;

    // 处理多边形实体
    if (entity.polygon && entity.polygon.hierarchy) {
      const positions = entity.polygon.hierarchy.getValue(Cesium.JulianDate.now()).positions;
      for (let j = 0; j < positions.length; j++) {
        const cartographic = Cesium.Cartographic.fromCartesian(positions[j]);
        cartographics.push(cartographic);
      }
    }

    // 处理折线 (polyline) 实体
    else if (entity.polyline && entity.polyline.positions) {
      const positions = entity.polyline.positions.getValue(Cesium.JulianDate.now());
      for (let j = 0; j < positions.length; j++) {
        const cartographic = Cesium.Cartographic.fromCartesian(positions[j]);
        cartographics.push(cartographic);
      }
    }

    // 处理点实体
    else if (entity.position) {
      const position = entity.position.getValue(Cesium.JulianDate.now());
      const cartographic = Cesium.Cartographic.fromCartesian(position);
      cartographics.push(cartographic);
    }
  }

  // 使用最详细的地形数据更新所有位置的高度
  Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, cartographics).then((updatedPositions) => {
    const boundingSpheres = [];

    // 使用更新后的地形高度计算边界球
    for (let i = 0; i < updatedPositions.length; i++) {
      const cartographic = updatedPositions[i];
      // 将 Cartographic 转换回 Cartesian3（包含最详细的高度）
      const positionWithHeight = Cesium.Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, cartographic.height);
      const boundingSphere = new Cesium.BoundingSphere(positionWithHeight, 0);
      boundingSpheres.push(boundingSphere);
    }

    // 合并所有实体的边界球体为一个整体边界球体
    const totalBoundingSphere = Cesium.BoundingSphere.fromBoundingSpheres(boundingSpheres);

    // 可视化边界球（作为球体实体）
    // viewer.entities.add({
    //   position: totalBoundingSphere.center,
    //   ellipsoid: {
    //     radii: new Cesium.Cartesian3(totalBoundingSphere.radius, totalBoundingSphere.radius, totalBoundingSphere.radius),
    //     material: Cesium.Color.RED.withAlpha(0.3), // 半透明红色
    //     outline: true,
    //     outlineColor: Cesium.Color.RED
    //   }
    // });

    // const offset = new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-46), totalBoundingSphere.radius * 2.0);

    // 调整相机以包含整个数据源
    viewer.camera.flyToBoundingSphere(totalBoundingSphere, {
      duration: 0,
      // offset: offsetoffset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-90)) // 俯视视角
      complete: function () {
        // 手动触发 moveEnd 事件监听器
        viewer.camera.moveEnd.raiseEvent();  // 触发 moveEnd 事件
        let screen = {
          position: viewer.camera.position,
          orientation: {
            heading: viewer.camera.heading,
            pitch: viewer.camera.pitch,
            roll: viewer.camera.roll
          }
        }
        const normal = calculateNormal(totalBoundingSphere.center, screen.position)
        screen.screenNormal = normal
        objArrVisibleArea(screen, totalBoundingSphere.center)
      }
    });
  });
}

/**
 * 最大投影面积法-移动视点至场景包围盒
 */
export function flatViewBox() {
  // 获取数据源中的所有实体
  const entities = plotDrawTool.getEntityObjArr();
  const cartographics = [];

  // 遍历每个实体
  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i].entity;

    // 处理多边形实体
    if (entity.polygon && entity.polygon.hierarchy) {
      const positions = entity.polygon.hierarchy.getValue(Cesium.JulianDate.now()).positions;
      for (let j = 0; j < positions.length; j++) {
        const cartesian = positions[j]; // 这是 Cartesian3 坐标
        const cartographic = Cesium.Ellipsoid.WGS84.cartesianToCartographic(cartesian); // 转换为 Cartographic
        cartographics.push(cartographic);
      }
    }

    // 处理折线 (polyline) 实体
    else if (entity.polyline && entity.polyline.positions) {
      const positions = entity.polyline.positions.getValue(Cesium.JulianDate.now());
      for (let j = 0; j < positions.length; j++) {
        const cartesian = positions[j]; // 这是 Cartesian3 坐标
        const cartographic = Cesium.Ellipsoid.WGS84.cartesianToCartographic(cartesian); // 转换为 Cartographic
        cartographics.push(cartographic);
      }
    }

    // 处理点实体
    else if (entity.position) {
      const cartesian = entity.position.getValue(Cesium.JulianDate.now()); // 这是 Cartesian3 坐标
      const cartographic = Cesium.Ellipsoid.WGS84.cartesianToCartographic(cartesian); // 转换为 Cartographic
      cartographics.push(cartographic);
    }
  }

  // 检查 cartographics 是否为空
  if (cartographics.length === 0) {
    console.error("cartographics 数组为空，无法处理数据。");
  } else {
    // 转换为二维点数组
    const points = cartographics.map(cartographic => {
      const longitude = Cesium.Math.toDegrees(cartographic.longitude);
      const latitude = Cesium.Math.toDegrees(cartographic.latitude);

      return turf.point([longitude, latitude]);
    });

    // 使用 turf.js 计算凸包
    const turfPoints = turf.featureCollection(points);
    const convexHull = turf.convex(turfPoints);

    if (convexHull) {

      // 获取 Cesium 视图窗口的长宽比
      const width = viewer.scene.canvas.clientWidth;
      const height = viewer.scene.canvas.clientHeight;
      const aspectRatio = width / height; // 计算长宽比

      // 计算最小旋转矩形（通过不同角度旋转来寻找最小外接矩形）
      const { minRotatedRect, minRotationAngle } = comTool.calculateMinimumAspectRatioRectangle(convexHull, aspectRatio);

      // 如果得到了最小旋转矩形
      if (minRotatedRect) {
        const unrotatedRectCoords = comTool.rotatePolygon(minRotatedRect, minRotationAngle);

        // 准备转换为 Cartographic 坐标，并获取精确高度
        const terrainPoints = unrotatedRectCoords.map(coord => {
          const [lon, lat] = coord;
          return Cesium.Cartographic.fromDegrees(lon, lat);
        });

        // 使用 sampleTerrainMostDetailed 获取矩形顶点的精确高度
        Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, terrainPoints).then(updatedTerrainPoints => {
          // 找到四个顶点中的最大高度
          const maxHeight = Math.max(...updatedTerrainPoints.map(cartographic => cartographic.height));

          // 将所有顶点的高度统一为最大高度
          const cartesianPoints = updatedTerrainPoints.map(cartographic =>
            Cesium.Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, maxHeight)
          );

          // 可视化矩形的线框
          viewer.entities.add({
            polyline: {
              positions: cartesianPoints,
              width: 6, // 线框宽度
              material: Cesium.Color.RED.withAlpha(0.8) // 设置颜色
            }
          });

          // 使用最小包围矩形的四个角来定义 Cesium.Rectangle
          const west = updatedTerrainPoints[0].longitude;
          const south = updatedTerrainPoints[0].latitude;
          const east = updatedTerrainPoints[2].longitude;
          const north = updatedTerrainPoints[2].latitude;

          const rectangle = new Cesium.Rectangle(west, south, east, north);

          // 1. 获取Rectangle的中心点（Cartographic坐标）
          const centerCartographic = Cesium.Rectangle.center(rectangle);

          // 2. 将中心点从Cartographic坐标转换为Cartesian3坐标
          const centerCartesian = Cesium.Cartographic.toCartesian(centerCartographic);

          const headingDegrees = comTool.recShortDegree(updatedTerrainPoints)

          // 摄像头飞行到矩形范围并应用高度信息
          viewer.camera.flyTo({
            destination: Cesium.Rectangle.fromCartographicArray(updatedTerrainPoints),
            orientation: {
              heading: Cesium.Math.toRadians(headingDegrees),
              pitch: Cesium.Math.toRadians(-90.0),
              roll: 0.0
            },
            duration: 0,
            complete: function () {
              // 手动触发 moveEnd 事件监听器
              viewer.camera.moveEnd.raiseEvent();  // 触发 moveEnd 事件
              let screen = {
                position: viewer.camera.position,
                orientation: {
                  heading: viewer.camera.heading,
                  pitch: viewer.camera.pitch,
                  roll: viewer.camera.roll
                }
              }
              const normal = calculateNormal(centerCartesian, screen.position)
              screen.screenNormal = normal
              objArrVisibleArea(screen, centerCartesian)
            }
          });
        }).catch(error => {
          console.error('Error sampling terrain: ', error);
        });
      }
    } else {
      console.error("无法计算凸包，可能点集过少或无法形成闭合区域。");
    }
  }
}

/**
 * 最大投影面积法-移动视点至场景凸包
 */
function flatViewHull() {
  // 获取数据源中的所有实体
  const entities = plotDrawTool.getEntityObjArr();
  const cartographics = [];

  // 遍历每个实体
  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i].entity;

    // 处理多边形实体
    if (entity.polygon && entity.polygon.hierarchy) {
      const positions = entity.polygon.hierarchy.getValue(Cesium.JulianDate.now()).positions;
      for (let j = 0; j < positions.length; j++) {
        const cartographic = Cesium.Cartographic.fromCartesian(positions[j]);
        cartographics.push(cartographic);
      }
    }

    // 处理折线 (polyline) 实体
    else if (entity.polyline && entity.polyline.positions) {
      const positions = entity.polyline.positions.getValue(Cesium.JulianDate.now());
      for (let j = 0; j < positions.length; j++) {
        const cartographic = Cesium.Cartographic.fromCartesian(positions[j]);
        cartographics.push(cartographic);
      }
    }

    // 处理点实体
    else if (entity.position) {
      const position = entity.position.getValue(Cesium.JulianDate.now());
      const cartographic = Cesium.Cartographic.fromCartesian(position);
      cartographics.push(cartographic);
    }
  }

  // 使用最详细的地形数据更新所有位置的高度
  Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, cartographics).then((updatedPositions) => {
    const ellipsoid = viewer.scene.globe.ellipsoid;

    // 转换 Cesium Cartesian3 点到简单的数组格式
    const points = updatedPositions.map(cartographic => {
      const cartesian = ellipsoid.cartographicToCartesian(cartographic);
      return [cartesian.x, cartesian.y, cartesian.z];
    });


    // 计算凸包
    const hull = QuickHull(points);

    // 提取凸包面并创建多面体
    const geometryInstances = hull.map(face => {
      // 通过面索引获取顶点位置
      const positions = face.map(id => {
        return new Cesium.Cartesian3(points[id][0], points[id][1], points[id][2]);
      });

      return new Cesium.GeometryInstance({
        geometry: new Cesium.PolygonGeometry({
          polygonHierarchy: new Cesium.PolygonHierarchy(positions),
          perPositionHeight: true
        }),
        attributes: {
          color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.RED.withAlpha(0.3))
        }
      });
    });

    // 将几何体添加到场景
    viewer.scene.primitives.add(new Cesium.Primitive({
      geometryInstances: geometryInstances,
      appearance: new Cesium.PerInstanceColorAppearance({
        translucent: true,
        closed: false
      })
    }));

    // 计算所有顶点的质心
    const vertices = points.map(p => new Cesium.Cartesian3(p[0], p[1], p[2]));
    const centroid = comTool.calculateCentroid(vertices);

    // 找到中心距最小和最大的顶点
    const { minVertex, maxVertex } = comTool.findMinMaxVertices(vertices, centroid);

    // 绘制主轴
    viewer.entities.add({
      polyline: {
        positions: [minVertex, maxVertex],
        width: 5,
        material: Cesium.Color.BLUE
      }
    });
  });
}

/**
 * @description 计算凸包面积
 * */
function calculateConvexHullArea(points) {
  if (points.length < 3) {
    return 0;  // 至少需要3个点才能形成多边形
  }

  // 使用 QuickHull2d 计算点的凸包
  const hullPoints = qh(points);
  // drawConvexHullOnSVG(hullPoints)

  // 使用 2D 多边形面积公式计算凸包面积
  let area = 0;
  for (let i = 0; i < hullPoints.length; i++) {
    const p1 = hullPoints[i];
    const p2 = hullPoints[(i + 1) % hullPoints.length];
    area += (p1[0] * p2[1] - p2[0] * p1[1]);
  }

  return Math.abs(area) / 2.0;  // 返回凸包的面积
}

/**
 * @description 绘制凸包投影多边形
 * @param {*} hullPoints 二维数组
 */
function drawConvexHullOnSVG(hullPoints) {
  const svg = document.getElementById('hullSVG');

  // 创建一个 <polygon> 元素
  const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');

  // 将凸包点转换为字符串格式的 points 属性
  const points = hullPoints.map(point => point.join(',')).join(' ');

  // 设置 <polygon> 的属性
  polygon.setAttribute('points', points);
  polygon.setAttribute('stroke', 'red');  // 设置线条颜色
  polygon.setAttribute('stroke-width', '2');
  polygon.setAttribute('fill', 'none');  // 设置为无填充

  // 将 <polygon> 添加到 SVG 中
  svg.appendChild(polygon);
}


/**
 * @description 计算相关性（皮尔逊相关系数）
 * */
function pearsonCorrelation(x, y) {
  let meanX = x.reduce((sum, val) => sum + val, 0) / x.length;
  let meanY = y.reduce((sum, val) => sum + val, 0) / y.length;

  let numerator = x.reduce((sum, xi, i) => sum + (xi - meanX) * (y[i] - meanY), 0);
  let denominatorX = Math.sqrt(x.reduce((sum, xi) => sum + Math.pow(xi - meanX, 2), 0));
  let denominatorY = Math.sqrt(y.reduce((sum, yi) => sum + Math.pow(yi - meanY, 2), 0));

  return numerator / (denominatorX * denominatorY);
}

/**
 * @description 获取整个场景边界球的均匀初始视点
 */
async function getViewpointsFromBoundingSphere(n) {
  // 获取数据源中的所有实体
  const entities = plotDrawTool.getEntityObjArr();
  const cartographics = [];

  // 遍历每个实体
  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i].entity;

    // 处理多边形实体
    if (entity.polygon && entity.polygon.hierarchy) {
      const positions = entity.polygon.hierarchy.getValue(Cesium.JulianDate.now()).positions;
      for (let j = 0; j < positions.length; j++) {
        const cartographic = Cesium.Cartographic.fromCartesian(positions[j]);
        cartographics.push(cartographic);
      }
    }

    // 处理折线 (polyline) 实体
    else if (entity.polyline && entity.polyline.positions) {
      const positions = entity.polyline.positions.getValue(Cesium.JulianDate.now());
      for (let j = 0; j < positions.length; j++) {
        const cartographic = Cesium.Cartographic.fromCartesian(positions[j]);
        cartographics.push(cartographic);
      }
    }

    // 处理点实体
    else if (entity.position) {
      const position = entity.position.getValue(Cesium.JulianDate.now());
      const cartographic = Cesium.Cartographic.fromCartesian(position);
      cartographics.push(cartographic);
    }
  }

  // 使用最详细的地形数据更新所有位置的高度
  const updatedPositions = await Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, cartographics);

  const boundingSpheres = [];
  // 使用更新后的地形高度计算边界球
  for (let i = 0; i < updatedPositions.length; i++) {
    const cartographic = updatedPositions[i];
    // 将 Cartographic 转换回 Cartesian3（包含最详细的高度）
    const positionWithHeight = Cesium.Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, cartographic.height);
    const boundingSphere = new Cesium.BoundingSphere(positionWithHeight, 0);
    boundingSpheres.push(boundingSphere);
  }

  // 合并所有实体的边界球体为一个整体边界球体
  const totalBoundingSphere = Cesium.BoundingSphere.fromBoundingSpheres(boundingSpheres);

  const center = totalBoundingSphere.center;
  const radius = totalBoundingSphere.radius;

  // 生成 Fibonacci 均匀分布点
  const points = generateFibonacciPointsOnSphere(n, radius, center);

  // 创建视点数组
  let viewpoints = []
  points.map(point => {
    const headingPitch = calculateHeadingPitchFromDirection(center, point);

    if (headingPitch.pitch < 0) {
      let start = {
        position: point,
        orientation: {
          heading: headingPitch.heading,
          pitch: headingPitch.pitch,
          roll: 0 // Roll 固定为0
        }
      }
      // visualizeBestParticle(start, 0, center)
      viewpoints.push(start);
    }
  });

  return {
    center: center,
    viewpoints: viewpoints
  };
}

/**
 * @description 根据连线方向计算 heading 和 pitch
 *  */
function calculateHeadingPitchFromDirection(center, point) {
  const direction = Cesium.Cartesian3.subtract(center, point, new Cesium.Cartesian3());
  Cesium.Cartesian3.normalize(direction, direction);

  // 获取 center 的纬度（弧度）
  const centerCartographic = Cesium.Cartographic.fromCartesian(center);
  const centerLatitude = centerCartographic.latitude;
  const centerLongitude = centerCartographic.longitude;

  const pointCartographic = Cesium.Cartographic.fromCartesian(point);
  const pointLatitude = pointCartographic.latitude;
  const pointLongitude = pointCartographic.longitude;

  // 将 z 分量设为 0，以获得水平分量
  const horizontalDirection = new Cesium.Cartesian3(direction.x, direction.y, 0);
  const horizontalLength = Cesium.Cartesian3.magnitude(horizontalDirection);

  // 使用 angleBetween 计算 pitch
  let pitch = Math.PI / 2 - Cesium.Cartesian3.angleBetween(center, direction);

  // console.log(pitch)

  let heading = 0

  if (pointLatitude > centerLatitude) {
    heading = Math.PI
  }

  // 如果 horizontalDirection 不为零向量，计算北向夹角
  if (horizontalLength != 0) {

    Cesium.Cartesian3.normalize(horizontalDirection, horizontalDirection);

    // 定义北向向量
    const north = new Cesium.Cartesian3(center.x, center.y, 0); // 北向方向
    Cesium.Cartesian3.normalize(north, north);

    // 计算与北向的夹角作为 heading
    heading = Cesium.Cartesian3.angleBetween(north, horizontalDirection);

    // 修正 heading 使其在 [0, 360] 范围内

    if (pointLongitude < centerLongitude) {
      heading = 2 * Math.PI - heading;
    }
  }

  return {
    heading: heading,
    pitch: pitch,
    roll: 0
  };
}

/**
 * @description 计算屏幕法向量
 */
function calculateNormal(center, point) {
  const direction = Cesium.Cartesian3.subtract(center, point, new Cesium.Cartesian3());
  Cesium.Cartesian3.normalize(direction, direction);

  return direction
}

/**
 * @description 生成 Fibonacci 均匀分布点
 *  */
function generateFibonacciPointsOnSphere(n, radius, center) {
  const _radius = radius * 1.5
  const points = [];
  const phi = (1 + Math.sqrt(5)) / 2; // 黄金比例

  for (let i = 0; i < n; i++) {
    const theta = 2 * Math.PI * i / phi;
    const z = 1 - (2 * i) / (n - 1); // 线性插值 z 值
    const r = Math.sqrt(1 - z * z); // 半径
    const x = r * Math.cos(theta);
    const y = r * Math.sin(theta);
    const point = new Cesium.Cartesian3(x * _radius + center.x, y * _radius + center.y, z * _radius + center.z);
    points.push(point);
  }

  return points;
}


/**
 * @description 粒子群优化主函数
 */
export async function PSO(n, g, sceneId, params, terrainFilter) {
  const start = performance.now();
  viewer.entities.removeAll();
  let startPoints = await getViewpointsFromBoundingSphere(n)
  let fitnessFunction = async (center, position) => {
    const normal = calculateNormal(center, position)
    const screen = {
      position: position,
      screenNormal: normal
    }
    let fitness = await objArrVisibleArea(screen, center, terrainFilter)
    return fitness
  }
  const cVPPso = new CVPPSO(startPoints.viewpoints, startPoints.center, fitnessFunction, g, params);
  const result = await cVPPso.optimize();
  // const r_orientation = calculateHeadingPitchFromDirection(startPoints.center, result.position)
  const direction = Cesium.Cartesian3.subtract(result.position, startPoints.center, new Cesium.Cartesian3());
  const enuMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(startPoints.center);
  const enuOffset = Cesium.Matrix4.multiplyByPointAsVector(enuMatrix, direction, new Cesium.Cartesian3());
  const end = performance.now();
  // viewer.camera.flyTo({
  //   destination: result.position,
  //   orientation: r_orientation,
  //   duration: 0
  // })
  // viewer.camera.flyTo({
  //   destination: Cesium.Cartesian3.fromDegrees(102.836266, 29.295275, 6722.1),
  //   orientation: {
  //     heading: Cesium.Math.toRadians(336.462), // 水平角
  //     pitch: Cesium.Math.toRadians(-27.092),  // 俯仰角
  //     roll: Cesium.Math.toRadians(0)          // 翻滚角
  //   },
  //   duration: 0
  // })
  axios.post('https://signow.space/mapi/vupoint/add', {
  // axios.post('https://signow.space/mapi/vupoint/addPerf', {
    x: result.position.x,
    y: result.position.y,
    z: result.position.z,
    fitness: result.fitness,
    scene: sceneId,
    // time: end - start,
    n: n,
    g: g,
  }, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  }).then((res) => {
    // console.log(res)
    viewer.camera.lookAt(startPoints.center, enuOffset)
  })
}

/**
 * @description 粒子优化过程可视化
 */
// 绘制粒子最优点和朝向的函数
export function visualizeBestParticle(bestParticle, generation, center) {
  const position = bestParticle.position

  const direction = Cesium.Cartesian3.subtract(center, position, new Cesium.Cartesian3());
  Cesium.Cartesian3.normalize(direction, direction);

  // 绘制最优粒子的位置点
  viewer.entities.add({
    // id: `bestParticle-gen${generation}`,
    name: `Best Particle Generation ${generation}`,
    position: position,
    point: {
      pixelSize: 10,
      color: Cesium.Color.YELLOW
    }
  });

  // 单位方向向量
  const endPosition = new Cesium.Cartesian3(position.x + direction.x * 1000, position.y + direction.y * 1000, position.z + direction.z * 1000);

  viewer.entities.add({
    // id: `bestParticle-arrow-gen${generation}`,
    name: `Best Particle Orientation Generation ${generation}`,
    polyline: {
      positions: [position, endPosition],
      width: 3,
      material: Cesium.Color.RED
    }
  });
}

/**
 * 转换坐标
 * @param {*} x 
 * @param {*} y 
 * @param {*} z 
 * @returns 
 */
export function convertXYZToLatLonHeight(x, y, z) {
  // 确保 Cesium 已加载
  if (!Cesium) {
      throw new Error("CesiumJS is not loaded.");
  }

  // 构造 Cartesian3 笛卡尔坐标
  const cartesian = new Cesium.Cartesian3(x, y, z);

  // 定义 WGS84 椭球体
  const ellipsoid = Cesium.Ellipsoid.WGS84;

  // 使用 Cesium 提供的转换方法
  const cartographic = ellipsoid.cartesianToCartographic(cartesian);

  // 转换经度和纬度为度数
  const longitude = Cesium.Math.toDegrees(cartographic.longitude); // 经度
  const latitude = Cesium.Math.toDegrees(cartographic.latitude);   // 纬度
  const height = cartographic.height;                              // 高度

  return { longitude, latitude, height };
}