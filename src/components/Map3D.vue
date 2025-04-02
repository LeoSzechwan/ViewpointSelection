<template>
  <div id="cesium-container">
    <PlotInfo></PlotInfo>
    <PlotTool></PlotTool>
    <div id="info-label">
      <div>
        <span>{{ cameraParam.lon }}, </span>
        <span>{{ cameraParam.lat }}, </span>
        <span>{{ cameraParam.alt }}, </span>
      </div>
      <div style="display: flex; flex-wrap: nowrap">
        <span>α: {{ cameraParam.head }}°</span>
        <span>β: {{ cameraParam.pit }}°</span>
        <span>γ: {{ cameraParam.roll }}°</span>
      </div>
    </div>
    <!-- <svg id="hullSVG" width="100vw" height="100vh" style="border: 1px solid black;position: absolute;z-index: 5;"></svg> -->
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { useCesiumViewer, loadScene } from "@/composables/cesium.js";
import { useCesiumStore } from "@/store/cesium.js";
import PlotInfo from './PlotInfo.vue'
import PlotTool from './PlotTool.vue'
import * as Cesium from 'cesium'

// 观察相机位姿
let cameraParam = ref({
  lat: 0,
  lon: 0,
  alt: 0,
  head: 0,
  pit: 0,
  roll: 0
})
onMounted(() => {
  useCesiumViewer("cesium-container").then(() => {
    const store = useCesiumStore();
    const viewer = store.viewer;
    viewer.camera.moveEnd.addEventListener(() => {
      cameraParam.value.lat = Cesium.Math.toDegrees(viewer.scene.camera.positionCartographic.latitude).toFixed(6);
      cameraParam.value.lon = Cesium.Math.toDegrees(viewer.scene.camera.positionCartographic.longitude).toFixed(6);
      cameraParam.value.alt = viewer.scene.camera.positionCartographic.height.toFixed(1);
      cameraParam.value.head = Cesium.Math.toDegrees(viewer.scene.camera.heading).toFixed(3);
      cameraParam.value.pit = Cesium.Math.toDegrees(viewer.scene.camera.pitch).toFixed(3);
      cameraParam.value.roll = Cesium.Math.toDegrees(viewer.scene.camera.roll).toFixed(3);
      // cameraParam.value.lat = viewer.scene.camera.positionCartographic.latitude.toFixed(6);
      // cameraParam.value.lon = viewer.scene.camera.positionCartographic.longitude.toFixed(6);
      // cameraParam.value.alt = viewer.scene.camera.positionCartographic.height.toFixed(1);
      // cameraParam.value.head = viewer.scene.camera.heading.toFixed(3);
      // cameraParam.value.pit = viewer.scene.camera.pitch.toFixed(3);
      // cameraParam.value.roll = viewer.scene.camera.roll.toFixed(3);
    });
    loadScene({
      event: 'A',
      element: ['Flood', 'Road', 'Bridge', 'SignalStation'],
    });
  });
});
</script>

<style scoped>
#cesium-container {
  height: 100%;
  width: 100%;
}

#info-label {
  position: absolute;
  width: 100%;
  right: 5px;
  bottom: 5px;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: end;
  z-index: 4;
  font-size: 0.8rem;
  color: #fff;
  text-shadow: -0.05rem -0.05rem 0 #111, 0.05rem -0.05rem 0 #111,
    -0.05rem 0.05rem 0 #111, 0.05rem 0.05rem 0 #111;
}
</style>
