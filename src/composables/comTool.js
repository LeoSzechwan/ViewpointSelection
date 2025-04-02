import turf from 'turf'
// 首先引入 math.js 库
import { create, all } from 'mathjs'

export default class ComTool{

  // 函数：计算最小旋转矩形
  calculateMinimumRotatedRectangle(convexHull) {
    let minArea = Infinity;
    let minRectangle = null;
    let minRotationAngle = 0;

    // 遍历所有边的方向，旋转点集
    const hullCoords = convexHull.geometry.coordinates[0];
    for (let i = 0; i < hullCoords.length - 1; i++) {
      const p1 = hullCoords[i];
      const p2 = hullCoords[i + 1];

      const angle = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
      const rotatedCoords = this.rotatePolygon(hullCoords, -angle);

      const boundingBox = turf.bboxPolygon(turf.bbox(turf.featureCollection(rotatedCoords.map(c => turf.point(c)))));

      const area = turf.area(boundingBox);

      if (area < minArea) {
        minArea = area;
        minRectangle = boundingBox;  // 保存最小矩形
        minRotationAngle = angle;  // 保存旋转角度
      }
    }

    return { minRotatedRect: minRectangle, minRotationAngle };
  }

  // 计算最小包围固定长宽比矩形
  calculateMinimumAspectRatioRectangle(convexHull, aspectRatio) {
    const hullCoords = convexHull.geometry.coordinates[0];
    let minArea = Infinity;
    let minRectangle = null;
    let minRotationAngle = 0;

    // 遍历每条边
    for (let i = 0; i < hullCoords.length - 1; i++) {
      const p1 = hullCoords[i];
      const p2 = hullCoords[i + 1];

      // 计算边的方向
      const angle = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);

      // 旋转点集
      const rotatedCoords = this.rotatePolygon(hullCoords, -angle);

      // 确定固定长宽比矩形的最小面积
      const rotatedMinX = Math.min(...rotatedCoords.map(p => p[0]));
      const rotatedMaxX = Math.max(...rotatedCoords.map(p => p[0]));
      const rotatedMinY = Math.min(...rotatedCoords.map(p => p[1]));
      const rotatedMaxY = Math.max(...rotatedCoords.map(p => p[1]));

      // 计算宽度和高度
      const width = rotatedMaxX - rotatedMinX;
      const height = rotatedMaxY - rotatedMinY;

      // 根据长宽比计算最小矩形的尺寸
      let rectWidth, rectHeight;
      if (width / height > aspectRatio) {
        rectWidth = width;
        rectHeight = width / aspectRatio;
      } else {
        rectHeight = height;
        rectWidth = height * aspectRatio;
      }


      // 生成当前的矩形
      const currentRectangle = [
        [rotatedMinX, rotatedMinY], // 左下角
        [rotatedMinX + rectWidth, rotatedMinY], // 右下角
        [rotatedMinX + rectWidth, rotatedMinY + rectHeight], // 右上角
        [rotatedMinX, rotatedMinY + rectHeight], // 左上角
        [rotatedMinX, rotatedMinY] // 回到左下角
      ];

      // 旋转矩形回原始角度
      // const unrotatedCoords = this.rotatePolygon(currentRectangle, angle);

      // 计算矩形面积
      const area = rectWidth * rectHeight;
      if (area < minArea) {
        minArea = area;
        minRectangle = currentRectangle;
        minRotationAngle = angle; // 保存旋转角度
      }
    }

    return { minRotatedRect: minRectangle, minRotationAngle };
  }

  // 函数：旋转点集
  rotatePolygon(coords, angle) {
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);

    return coords.map(coord => {
      const x = coord[0];
      const y = coord[1];
      return [
        x * cos - y * sin,
        x * sin + y * cos
      ];
    });
  }

  // 计算四条边的长度，找出短边
  calculateDistance(p1, p2) {
    const geodesic = new Cesium.EllipsoidGeodesic(p1, p2);
    return geodesic.surfaceDistance;
  }

  // 计算矩形短轴方向
  recShortDegree(updatedTerrainPoints) {
    const distances = [
      this.calculateDistance(updatedTerrainPoints[1], updatedTerrainPoints[2]), // p2-p3
      this.calculateDistance(updatedTerrainPoints[0], updatedTerrainPoints[1]), // p1-p2
      this.calculateDistance(updatedTerrainPoints[2], updatedTerrainPoints[3]), // p3-p4
      this.calculateDistance(updatedTerrainPoints[3], updatedTerrainPoints[0])  // p4-p1
    ];

    // 找出最短的边
    let shortestIndex = 0;
    for (let i = 1; i < distances.length; i++) {
      if (distances[i] < distances[shortestIndex]) {
        shortestIndex = i;
      }
    }

    // 根据最短边的索引，确定短边的两个端点
    let p1, p2;
    if (shortestIndex === 0) {
      p1 = updatedTerrainPoints[1];
      p2 = updatedTerrainPoints[2];
    } else if (shortestIndex === 1) {
      p1 = updatedTerrainPoints[0];
      p2 = updatedTerrainPoints[1];
    } else if (shortestIndex === 2) {
      p1 = updatedTerrainPoints[2];
      p2 = updatedTerrainPoints[3];
    } else {
      p1 = updatedTerrainPoints[3];
      p2 = updatedTerrainPoints[0];
    }

    // 计算 p1 到 p2 的方向角 (heading)，使用 atan2 计算方向角
    const deltaLongitude = p2.longitude - p1.longitude;
    const deltaLatitude = p2.latitude - p1.latitude;
    const heading = Math.atan2(deltaLongitude, deltaLatitude);  // 得到弧度制

    // 将弧度转换为角度
    const headingDegrees = Cesium.Math.toDegrees(heading);
    return headingDegrees
  }

  // 计算质心
  calculateCentroid(vertices) {
    const n = vertices.length;
    const centroid = vertices.reduce((acc, vertex) => {
      acc[0] += vertex.x;
      acc[1] += vertex.y;
      acc[2] += vertex.z;
      return acc;
    }, [0, 0, 0]);
    return centroid.map(c => c / n);
  }

  // 计算惯性张量
  calculateInertiaTensor(vertices, centroid) {
    let Ixx = 0, Iyy = 0, Izz = 0;
    let Ixy = 0, Ixz = 0, Iyz = 0;

    vertices.forEach(vertex => {
      const xPrime = vertex.x - centroid[0];
      const yPrime = vertex.y - centroid[1];
      const zPrime = vertex.z - centroid[2];

      Ixx += yPrime * yPrime + zPrime * zPrime;
      Iyy += xPrime * xPrime + zPrime * zPrime;
      Izz += xPrime * xPrime + yPrime * yPrime;
      Ixy -= xPrime * yPrime;
      Ixz -= xPrime * zPrime;
      Iyz -= yPrime * zPrime;
    });

    return [
      [Ixx, Ixy, Ixz],
      [Ixy, Iyy, Iyz],
      [Ixz, Iyz, Izz]
    ];
  }

  // 计算惯性张量的特征值和特征向量
  calculatePrincipalAxis(inertiaTensor) {
    const config = {}
    const math = create(all, config)
    const { eigenvectors } = math.eigs(inertiaTensor);
    return eigenvectors;
  }

  // 找到最小和最大的中心距顶点
  findMinMaxVertices(vertices, centroid) {
    let minDistance = Infinity;
    let maxDistance = -Infinity;
    let minVertex = null;
    let maxVertex = null;

    const centroidCartesian = new Cesium.Cartesian3(centroid[0], centroid[1], centroid[2]);

    vertices.forEach(vertex => {
      const distance = Cesium.Cartesian3.distance(vertex, centroidCartesian);
      if (distance < minDistance) {
        minDistance = distance;
        minVertex = vertex;
      }
      if (distance > maxDistance) {
        maxDistance = distance;
        maxVertex = vertex;
      }
    });

    return { minVertex, maxVertex };
  }
}